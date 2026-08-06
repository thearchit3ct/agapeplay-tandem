-- Rendre le blocage effectif : ADR-002, règle 3.
--
-- Le schéma ne tenait que la moitié de la promesse « un utilisateur bloqué ne
-- peut plus écrire ni lire ». Deux défauts, mesurés par tests/rls/blocage.test.ts :
--
-- 1. `tandems_update_member` ne contraignait ni la colonne `status` ni la
--    transition `blocked` → `active`, et `grant update` porte sur toute la
--    table. La personne bloquée repassait le tandem en `active`, puis réécrivait.
--    Le blocage n'était pas une barrière : c'était un réglage que la personne
--    écartée pouvait annuler seule.
-- 2. `messages_select_member` ne regardait pas `t.status`. Le blocage coupait
--    l'écriture, jamais la lecture : l'historique entier restait ouvert.
--
-- Obstacle de conception : la table ne disait pas *qui* avait bloqué. Sans cette
-- information, « seul celui qui a bloqué peut débloquer » est inexprimable.
-- D'où la colonne `blocked_by`.
--
-- Le produit met en relation des mineurs de 16-17 ans et des mentors adultes.
-- Chaque arbitrage ci-dessous penche donc du côté fermé.

-- ---------------------------------------------------------------------------
-- La colonne qui manquait
-- ---------------------------------------------------------------------------

alter table public.tandems
  add column if not exists blocked_by uuid references auth.users(id) on delete set null;

comment on column public.tandems.blocked_by is
  'Participant qui a posé le blocage. Seul lui peut le lever, et lui seul continue de lire l''historique. NULL sur les lignes bloquées avant cette migration : voir la note « lignes déjà bloquées » plus bas.';

-- On ne bloque pas au nom d'un tiers : `blocked_by` désigne forcément un des
-- deux participants. Cette contrainte est sûre à ajouter — la colonne vient
-- d'être créée, toutes les lignes existantes y valent NULL, aucune ne peut la
-- violer.
--
-- La contrainte *symétrique* (`status = 'blocked'` ⇒ `blocked_by is not null`)
-- serait elle, à l'inverse, une bombe : elle est validée contre les lignes
-- existantes et ferait échouer la migration sur toute base comptant déjà un
-- tandem bloqué — précisément les lignes qu'on a choisi de laisser à NULL.
alter table public.tandems drop constraint if exists tandems_blocked_by_participant_chk;
alter table public.tandems add constraint tandems_blocked_by_participant_chk
  check (blocked_by is null or blocked_by in (participant_a_id, participant_b_id));

create index if not exists tandems_blocked_by_idx
  on public.tandems (blocked_by)
  where blocked_by is not null;

-- ---------------------------------------------------------------------------
-- Qui peut modifier un tandem
-- ---------------------------------------------------------------------------
--
-- Dans une politique UPDATE, `using` est évalué sur l'ancienne ligne et
-- `with check` sur la nouvelle. Le même prédicat, posé aux deux endroits, dit
-- donc deux choses différentes et suffit sans passer par un trigger :
--
-- - côté `using` (ancienne ligne) : si le tandem est déjà `blocked`, seul
--   `blocked_by` a le droit d'y toucher. La personne bloquée ne peut plus rien
--   modifier — ni le statut, ni les participants, ni quoi que ce soit d'autre.
-- - côté `with check` (nouvelle ligne) : si l'état visé est `blocked`, alors
--   `blocked_by` doit être soi-même. On ne bloque pas au nom d'un autre, et on
--   ne pose pas un blocage qu'on ne pourrait pas lever.
--
-- `auth.uid() = blocked_by` vaut NULL — donc faux — quand `blocked_by` est NULL.
-- La règle échoue fermé, ce qui est l'intention.
drop policy if exists "tandems_update_member" on public.tandems;
create policy "tandems_update_member"
  on public.tandems for update
  to authenticated
  using (
    (select auth.uid()) in (participant_a_id, participant_b_id)
    and (status <> 'blocked' or (select auth.uid()) = blocked_by)
  )
  with check (
    (select auth.uid()) in (participant_a_id, participant_b_id)
    and (status <> 'blocked' or (select auth.uid()) = blocked_by)
  );

-- ---------------------------------------------------------------------------
-- Qui peut lire les messages
-- ---------------------------------------------------------------------------
--
-- Le blocage coupe la lecture pour la personne bloquée, et la garde pour celle
-- qui a bloqué. Ce découpage est délibéré : qui bloque a souvent besoin de
-- l'historique pour signaler (`public.tandem_reports` référence un
-- `message_id`), et lui retirer la conversation au moment où il en a le plus
-- besoin punirait la victime du geste de protection.
drop policy if exists "messages_select_member" on public.tandem_messages;
create policy "messages_select_member"
  on public.tandem_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.tandems t
      where t.id = tandem_id
        and (select auth.uid()) in (t.participant_a_id, t.participant_b_id)
        and (t.status <> 'blocked' or (select auth.uid()) = t.blocked_by)
    )
  );

-- ---------------------------------------------------------------------------
-- Les lignes déjà bloquées au moment de la migration
-- ---------------------------------------------------------------------------
--
-- Leur `blocked_by` vaut NULL et rien dans le schéma ne dit qui a bloqué :
-- `tandem_reports.reporter_id` est un indice, pas une preuve (on peut bloquer
-- sans signaler, et signaler sans bloquer). Deviner reviendrait à donner à un
-- inconnu le droit de lever un blocage et de relire la conversation. Choix
-- retenu : **ne rien deviner, et geler ces lignes**.
--
-- Conséquence exacte, assumée : sur une ligne `blocked` à `blocked_by` NULL,
-- plus personne ne lit les messages et plus personne ne change le statut par
-- l'API. C'est plus fermé qu'avant la migration des deux côtés — la protection
-- s'applique immédiatement au lieu d'attendre un re-blocage — au prix d'une
-- ligne que ses deux participants ne peuvent plus débloquer seuls.
--
-- Le dégel est une décision humaine, prise hors RLS depuis l'éditeur SQL du
-- tableau de bord Supabase, en nommant celui qui avait bloqué.
--
-- ⚠️ Pas depuis la Data API avec une clé `service_role` : sur la base que ces
-- migrations reconstruisent, `service_role` n'a ni SELECT ni UPDATE sur
-- `public.tandems` — aucun `grant` ne les lui donne. L'éditeur SQL, lui,
-- travaille en `postgres` et traverse la RLS.
--
--     update public.tandems
--        set blocked_by = '<uuid du participant qui a bloqué>'
--      where id = '<uuid du tandem>';
--
-- après quoi la ligne se comporte comme n'importe quelle ligne bloquée depuis
-- cette migration. Pour lever purement et simplement le blocage :
--
--     update public.tandems set status = 'active', blocked_by = null where id = '<uuid du tandem>';
--
-- Le compte de lignes concernées est affiché à l'application pour que l'opérateur
-- sache s'il a zéro ligne à traiter — le cas attendu — ou une liste.
do $$
declare
  gelees bigint;
begin
  select count(*) into gelees
  from public.tandems
  where status = 'blocked' and blocked_by is null;

  if gelees > 0 then
    raise warning 'blocage_effectif : % tandem(s) bloqué(s) avant cette migration sont gelés (blocked_by NULL). Ni lecture ni déblocage par l''API tant qu''un opérateur n''a pas renseigné blocked_by depuis l''éditeur SQL du tableau de bord.', gelees;
  else
    raise notice 'blocage_effectif : aucun tandem bloqué préexistant, rien à traiter.';
  end if;
end;
$$;
