-- Rendre l'appariement possible — et le refermer aussitôt sur l'invitation.
--
-- Le geste fondateur du produit ne pouvait pas aboutir. Mesuré sur une base
-- reconstruite depuis les migrations du dépôt :
--
--     select public.accept_tandem_invitation('<code valide>');
--     ERROR:  42501: permission denied for table tandems
--
-- Aucune des sept premières migrations n'accorde `insert` sur `public.tandems` ;
-- le seul grant est `grant select, update on public.tandems to authenticated`
-- (migration `…_000002`, ligne 178). Tant que `accept_tandem_invitation` était
-- `security definer`, son propriétaire couvrait ce manque. La migration
-- `…_000004` l'a passée en `security invoker` — décision saine, elle remet
-- l'acceptation sous la RLS ordinaire — mais sans accorder le droit
-- correspondant. La politique `tandems_insert_member`, créée par cette même
-- migration, ne pouvait rien y faire : **une politique RLS n'accorde rien, elle
-- restreint un droit qui doit exister par ailleurs.**
--
-- ---------------------------------------------------------------------------
-- Le niveau retenu : le grant, pas `security definer`
-- ---------------------------------------------------------------------------
--
-- Deux réparations étaient possibles.
--
-- Repasser la fonction en `security definer` aurait marché — son propriétaire
-- est superutilisateur, il traverse la RLS. C'est précisément ce qui la
-- disqualifie ici : la RLS de `tandems` serait entièrement contournée à
-- l'insertion, `tandems_insert_member` resterait lettre morte, et le corps de
-- la fonction deviendrait l'unique rempart — toute régression future y ouvrirait
-- une brèche sans qu'aucune politique ne la rattrape. Ce serait, de plus,
-- annuler l'intention explicite de `…_000004`.
--
-- Le grant, lui, laisse deux barrières indépendantes : les gardes de la fonction
-- (concordance de l'e-mail, refus de l'auto-acceptation) **et** la politique
-- ci-dessous, qui tient seule si un client parle à PostgREST en direct.
--
-- Son coût, assumé et refermé ici : `grant insert` ouvre la table à tout client
-- authentifié. Sans politique exigeante, n'importe qui pourrait s'apparier
-- unilatéralement à n'importe qui — inacceptable sur un produit qui met en
-- relation des mineurs de 16-17 ans et des mentors adultes. C'est donc la
-- politique qui porte tout le poids, et elle est écrite en conséquence.

grant insert on public.tandems to authenticated;

-- ---------------------------------------------------------------------------
-- Ce que la politique exige
-- ---------------------------------------------------------------------------
--
-- Trois conjoncts, dans cet ordre de lecture :
--
-- 1. **On figure dans le tandem qu'on crée.** Le spectateur n'apparie pas deux
--    tiers.
-- 2. **L'autre participant nous a invité, et l'invitation est vivante.** C'est
--    le conjonct qui porte le poids : il transforme un droit d'insertion
--    général en un droit d'accepter ce qu'on nous a proposé. `i.inviter_id`
--    doit être l'*autre* participant (il figure dans la ligne et n'est pas
--    nous), l'invitation doit viser notre adresse, être encore `pending` et non
--    périmée. La sous-requête est elle-même soumise à la RLS de
--    `tandem_invitations` : `invitations_select_participant` ne laisse voir au
--    destinataire que les invitations à son adresse, ce qui referme le tout.
-- 3. **Aucun blocage ne subsiste entre ces deux personnes.** Voir plus bas.
--
-- Ce que la politique n'a pas à dire : « on ne s'apparie pas avec soi-même » est
-- déjà garanti structurellement par `check (participant_a_id <> participant_b_id)`
-- (migration `…_000002`, ligne 41), et par la garde `invitation_self_acceptance`
-- de la fonction. Le répéter ici serait de la ceinture-bretelles, pas un rempart ;
-- le conjonct 2 l'implique de toute façon, `i.inviter_id` ne pouvant pas être
-- nous.
--
-- ---------------------------------------------------------------------------
-- Le ré-appariement autour d'un blocage
-- ---------------------------------------------------------------------------
--
-- L'index `tandems_active_pair_idx` (migration `…_000002`, ligne 44) est unique
-- sur la paire *non ordonnée* — `least`/`greatest`, donc les deux sens sont
-- couverts — mais seulement `where status in ('active', 'paused')`. Ce qu'il
-- laisse passer : un second tandem quand le premier est `blocked` ou `ended`.
--
-- Pour `ended`, c'est voulu : un tandem qui s'est achevé normalement peut
-- reprendre. Pour `blocked`, non. Tant que l'insertion était impossible, ce
-- contournement était hors d'atteinte ; réparer l'appariement le rend
-- atteignable, et il faut donc le fermer dans le même geste. **La paire dont un
-- tandem est bloqué ne peut pas en créer un neuf** — y compris à l'initiative de
-- celle qui a bloqué : le chemin de retour existe déjà, c'est lever le blocage
-- sur la ligne existante, geste tracé et réservé à `blocked_by`. Recréer un
-- tandem à côté effacerait cette trace, et transformerait un blocage en simple
-- gêne à contourner par une nouvelle invitation.
--
-- Pourquoi un conjonct de politique plutôt qu'élargir l'index unique à
-- `'blocked'` : parce qu'une collision d'index serait avalée par le
-- `on conflict do nothing` de `accept_tandem_invitation`, qui rendrait alors
-- NULL en silence tout en marquant l'invitation `accepted` — les deux clients
-- (`apps/web/src/App.tsx`, `apps/mobile/app/invite.tsx`) ne testent que
-- `error` et afficheraient « invitation acceptée » sans tandem. Le refus par
-- `with check`, lui, **lève**, et remonte jusqu'à l'utilisateur. Fermer un
-- contournement en en ouvrant un autre n'aurait rien réparé.
--
-- Coût de ce choix, à énoncer exactement : un prédicat de politique ne verrouille
-- rien. `tandem_paire_bloquee` est `stable`, elle lit le snapshot de la
-- transaction et ne voit pas une écriture non encore validée. Deux transactions
-- simultanées — l'une qui pose le blocage, l'autre qui accepte l'invitation — ne
-- se croisent sur aucun verrou, et l'index unique ne les rattrape pas puisqu'on
-- a précisément choisi de ne pas l'élargir. **Le ré-appariement autour d'un
-- blocage est donc fermé de façon sûre en séquentiel, et reste théoriquement
-- franchissable en concurrence.** L'index existant continue par ailleurs
-- d'interdire deux tandems actifs pour la même paire.
--
-- L'arbitrage est reprenable : élargir `tandems_active_pair_idx` à `'blocked'`
-- fermerait cette fenêtre, au prix de réécrire `accept_tandem_invitation` pour
-- que la collision cesse d'être avalée silencieusement.
--
-- ---------------------------------------------------------------------------
-- Pourquoi une fonction plutôt qu'un `not exists` en clair
-- ---------------------------------------------------------------------------
--
-- Écrit directement dans le `with check`, le `not exists (select … from
-- public.tandems …)` interroge la table que la politique protège. Mesuré :
--
--     ERROR:  infinite recursion detected in policy for relation "tandems"
--
-- D'où cette fonction, seul endroit du correctif où l'on recourt à
-- `security definer`, et pour un usage minuscule : elle rend un booléen, rien
-- d'autre. `search_path` figé, comme il se doit.
--
-- Elle ne peut pas servir de sonde. Interrogée sur une paire dont l'appelant ne
-- fait pas partie, elle répond `true` — « bloquée » — sans regarder la table :
-- une constante ne renseigne sur rien, et un `true` referme la politique au lieu
-- de l'ouvrir. Le cas ne se présente d'ailleurs pas dans un appariement
-- légitime, le premier conjonct exigeant qu'on figure dans la ligne ; mais
-- l'ordre d'évaluation des conjoncts n'étant pas garanti en SQL, la fonction ne
-- s'appuie pas dessus et se garde elle-même.
--
-- `current_user` ne serait ici d'aucun secours pour identifier l'appelant — dans
-- une fonction `security definer` il désigne le propriétaire. C'est `auth.uid()`
-- qui rend l'identité réelle, en lisant les claims de la requête.

create or replace function public.tandem_paire_bloquee(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null or auth.uid() not in (p_a, p_b) then true
    else exists (
      select 1
      from public.tandems t
      where t.status = 'blocked'
        and least(t.participant_a_id, t.participant_b_id) = least(p_a, p_b)
        and greatest(t.participant_a_id, t.participant_b_id) = greatest(p_a, p_b)
    )
  end;
$$;

comment on function public.tandem_paire_bloquee(uuid, uuid) is
  'Une paire dont un tandem est bloqué ne peut pas en créer un neuf. Appelée par la politique tandems_insert_member, qui ne peut pas interroger sa propre table sans récursion. Rend true — donc refuse — pour qui n''est pas participant.';

revoke all on function public.tandem_paire_bloquee(uuid, uuid) from public;
revoke all on function public.tandem_paire_bloquee(uuid, uuid) from anon;
grant execute on function public.tandem_paire_bloquee(uuid, uuid) to authenticated;
--
-- Conséquence nouvelle sur les lignes `blocked` héritées, à `blocked_by` NULL,
-- que `20260806012728_blocage_effectif` a délibérément gelées : elles sont
-- désormais doublement verrouillées — ni déblocage par l'API, ni ré-appariement.
-- Le dégel reste la même décision humaine, hors RLS, décrite dans cette
-- migration-là.

drop policy if exists "tandems_insert_member" on public.tandems;
create policy "tandems_insert_member"
  on public.tandems for insert
  to authenticated
  with check (
    (select auth.uid()) in (tandems.participant_a_id, tandems.participant_b_id)
    and exists (
      select 1
      from public.tandem_invitations i
      where i.status = 'pending'
        and i.expires_at > timezone('utc', now())
        and lower(i.invitee_email) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
        and i.inviter_id <> (select auth.uid())
        and i.inviter_id in (tandems.participant_a_id, tandems.participant_b_id)
    )
    and not public.tandem_paire_bloquee(tandems.participant_a_id, tandems.participant_b_id)
  );

-- `tandem_paire_bloquee` balaie la table par paire non ordonnée ; sans index,
-- c'est un parcours séquentiel à chaque insertion. Les deux index par
-- participant (`…_000003`) ne servent pas ici, la condition portant sur
-- `least`/`greatest`.
create index if not exists tandems_paire_bloquee_idx
  on public.tandems (least(participant_a_id, participant_b_id), greatest(participant_a_id, participant_b_id))
  where status = 'blocked';
