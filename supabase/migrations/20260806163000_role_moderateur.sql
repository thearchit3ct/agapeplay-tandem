-- Le rôle modérateur : donner corps à la promesse de l'ADR-002.
--
-- « `tandem_reports` : signalements séparés du contenu spirituel, visibles par
-- leur auteur et destinés au traitement de modération » (docs/17). Le schéma
-- tenait la moitié : `reports_select_reporter` (migration `…_000005`) ouvre la
-- lecture au seul `reporter_id`. Aucune autre politique SELECT n'existait, aucun
-- rôle modérateur non plus. Un signalement partait donc dans une table que
-- personne ne lisait — pas même par `service_role`, à qui aucun `grant` n'est
-- accordé sur cette table. Sur un produit qui met en relation des mineurs de
-- 16-17 ans et des mentors adultes, c'est le contraire d'un détail : l'ADR-007
-- promet une escalade plateforme, et rien ne pouvait la servir.
--
-- ---------------------------------------------------------------------------
-- Le rôle : une table, aucune interface
-- ---------------------------------------------------------------------------
--
-- Pas les responsables d'église — décision produit : un incident grave impliquant
-- un mineur ne doit pas être traité par la seule communauté où il s'est produit
-- (ADR-007). Un rôle plateforme dédié, donc.
--
-- La table n'a **ni politique ni `grant`**, et c'est délibéré : elle est
-- totalement invisible de la Data API. Personne ne lit la liste — savoir qui
-- modère, c'est savoir qui cibler ou qui contourner — et personne ne s'y ajoute,
-- ce qui ferme d'un seul geste toute escalade de privilège depuis un compte.
--
-- ⚠️ À l'attention de qui passerait ici plus tard : **ne pas « réparer » cette
-- table en lui accordant un `grant`.** L'absence de droit est la protection,
-- pas un oubli. La règle habituelle — toute nouvelle table du schéma `public`
-- exige des GRANT explicites pour être servie par la Data API — s'applique
-- justement à l'envers ici : cette table n'a pas à y être servie.
--
-- Nommer un modérateur est donc un geste humain, rare et délibéré, pris hors RLS
-- depuis l'éditeur SQL du tableau de bord (qui travaille en `postgres`) :
--
--     insert into public.tandem_moderators (user_id, note)
--     values ('<uuid du compte>', 'qui a décidé, et quand');
--
-- et le retrait est symétrique :
--
--     delete from public.tandem_moderators where user_id = '<uuid du compte>';
--
-- La lecture étant évaluée à chaque requête, le retrait referme immédiatement,
-- sans migration ni redéploiement.

create table if not exists public.tandem_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  added_at timestamptz not null default timezone('utc', now())
);

comment on table public.tandem_moderators is
  'Modérateurs plateforme. Alimentée à la main depuis l''éditeur SQL : ni politique ni grant, donc invisible de la Data API. L''absence de droit est la protection — ne pas ajouter de grant.';

comment on column public.tandem_moderators.note is
  'Trace libre de la décision de nomination : qui l''a prise, et pourquoi. Jamais lue par le code.';

alter table public.tandem_moderators enable row level security;

-- ---------------------------------------------------------------------------
-- Pourquoi une fonction plutôt qu'un `exists` en clair dans les politiques
-- ---------------------------------------------------------------------------
--
-- Ce n'est pas une question de récursion : les politiques visées portent sur
-- d'autres tables. C'est une question de droits. Mesuré sur cette base, avec une
-- table témoin :
--
--     ERROR:  permission denied for table zz_secret
--     HINT:   Grant the required privileges to the current role with: …
--
-- Une expression de politique **est** soumise aux droits de l'appelant. Écrire
-- `exists (select 1 from public.tandem_moderators …)` directement dans une
-- politique obligerait donc à accorder `select` sur la table — c'est-à-dire à
-- publier la liste des modérateurs à tout compte authentifié, exactement ce
-- qu'on refuse. La fonction `security definer` est le seul moyen de consulter la
-- table sans l'ouvrir.
--
-- **Aucun paramètre.** Elle lit son identité dans `auth.uid()`. Une variante
-- `tandem_est_moderateur(uuid)` ferait de n'importe quel compte un énumérateur
-- de modérateurs, ce que l'absence de `grant` visait précisément à empêcher.
--
-- `current_user` ne servirait à rien pour identifier l'appelant : dans une
-- fonction `security definer` il désigne le propriétaire.
--
-- Polarité de repli — et elle est l'inverse de celle de `tandem_paire_bloquee`
-- ou `tandem_contact_bloque` : ces fonctions-là *referment* une politique en
-- rendant `true`, celle-ci l'*ouvrirait*. Sans identité, elle rend donc `false`.

create or replace function public.tandem_est_moderateur()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (select 1 from public.tandem_moderators m where m.user_id = auth.uid());
$$;

comment on function public.tandem_est_moderateur() is
  'L''appelant est-il modérateur plateforme ? Sans paramètre — elle lit auth.uid() — pour ne pas devenir un énumérateur de modérateurs. Seul moyen de consulter tandem_moderators sans accorder de select dessus. Rend false sans identité.';

revoke all on function public.tandem_est_moderateur() from public;
revoke all on function public.tandem_est_moderateur() from anon;
grant execute on function public.tandem_est_moderateur() to authenticated;

-- ---------------------------------------------------------------------------
-- Les signalements
-- ---------------------------------------------------------------------------
--
-- Une seconde politique SELECT, permissive : les deux s'additionnent, la
-- signalante continue de voir les siens et le modérateur les voit tous. On
-- n'élargit pas `reports_select_reporter`, on pose une politique séparée — deux
-- raisons de lire, deux politiques, chacune lisible seule.
--
-- Rien d'autre n'est accordé. Pas de `delete` : aucun `grant delete` n'existe
-- sur `tandem_reports`, et on n'en ajoute pas — un signalement posé ne disparaît
-- pas, y compris pour celui qui le traite. Pas d'`update` non plus, ce qui laisse
-- la colonne `status` (`open` / `reviewing` / `resolved`) inatteignable par
-- l'API : écart connu et assumé ici, à trancher séparément, parce que l'ouvrir
-- demanderait de décider *qui* peut clore un signalement et avec quelle trace.

drop policy if exists "reports_select_moderator" on public.tandem_reports;
create policy "reports_select_moderator"
  on public.tandem_reports for select
  to authenticated
  using (public.tandem_est_moderateur());

-- ---------------------------------------------------------------------------
-- Le message signalé, et lui seul
-- ---------------------------------------------------------------------------
--
-- C'est le point délicat de tout ce chantier. Sans le message, la modération ne
-- peut rien juger. Avec la conversation entière, un signalement deviendrait un
-- mandat de perquisition sur une relation privée — exactement ce que l'ADR-002
-- protège, et ce que `messages_select_member` a été resserré pour tenir.
--
-- La politique est donc écrite sur le **message**, jamais sur le tandem :
-- `tandem_reports.message_id` désigne une ligne précise, et l'ouverture s'arrête
-- à elle. Une formulation par `tandem_id` aurait ouvert toute la conversation,
-- et, pire, aurait rendu un signalement *sans* message précis — `message_id` est
-- nullable — plus ouvert qu'un signalement précis. Ici un tel signalement
-- n'ouvre rien.
--
-- La sous-requête sur `public.tandem_reports` est légitime au sens des droits :
-- `authenticated` a bien `select` dessus (migration `…_000005`, ligne 41), ce
-- qui est précisément la contrainte mesurée plus haut. Elle est elle-même
-- soumise à la RLS de `tandem_reports`, et c'est un bénéfice : un modérateur lit
-- exactement les messages attachés aux signalements qu'il peut lire — les deux
-- portées ne peuvent pas diverger. Aucun cycle : aucune politique de
-- `tandem_reports` ne référence `tandem_messages`.
--
-- Que retient alors le conjonct `tandem_est_moderateur()` ? La question a été
-- posée à la base plutôt qu'au raisonnement : retiré, il ne faisait rougir aucun
-- test. La raison est celle qu'on vient de dire — l'`exists` est déjà faux pour
-- un compte étranger, qui ne voit aucun signalement. Ce qu'il retient est plus
-- étroit, et réel : **la personne qui a signalé**, elle, voit le sien. Sans le
-- conjonct, la politique de modération lui rouvrirait le message signalé alors
-- même que `messages_select_member` s'est refermée sur elle — par exemple parce
-- que l'autre participant l'a bloquée. Un signalement deviendrait une clé pour
-- reprendre pied dans une conversation dont on a été écarté. Le test
-- correspondant existe, et c'est lui qui tient ce conjonct.
--
-- Il vaut aussi comme seconde barrière : la première tient à la RLS de
-- `tandem_reports`, donc toute politique SELECT ajoutée un jour sur cette table
-- élargirait la messagerie en cascade. Le conjonct rend cette politique-ci
-- lisible seule.
--
-- Enfin, les politiques SELECT permissives s'additionnent : un modérateur qui
-- serait par ailleurs participant d'un tandem lit ses propres conversations
-- **plus** les messages signalés. C'est voulu, et c'est le test « un message non
-- signalé de la même conversation » qui vérifie que l'union ne déborde pas.

drop policy if exists "messages_select_moderator_reported" on public.tandem_messages;
create policy "messages_select_moderator_reported"
  on public.tandem_messages for select
  to authenticated
  using (
    public.tandem_est_moderateur()
    and exists (
      select 1
      from public.tandem_reports r
      where r.message_id = tandem_messages.id
    )
  );

-- ---------------------------------------------------------------------------
-- Ce qui reste fermé, et le restera
-- ---------------------------------------------------------------------------
--
-- Le journal : aucune politique n'est ajoutée sur `journal_entries`, et il n'y a
-- pas d'exception à prévoir. `journal_select_own` reste le seul chemin. La
-- suite de tests porte une garde explicite là-dessus, pour qu'une branche
-- modérateur ajoutée un jour rougisse au lieu de passer.
--
-- Les tandems : `tandems_select_member` n'est pas touchée. Un modérateur lit le
-- signalement, qui porte un `tandem_id`, mais pas la ligne du tandem. C'est la
-- conséquence directe de « le message signalé, et lui seul » — un manque
-- apparent qui est en réalité la borne.
