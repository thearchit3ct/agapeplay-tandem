-- Le suivi d'un signalement, et la trace que personne ne peut réécrire.
--
-- `20260806163000_role_moderateur.sql` a donné un lecteur aux signalements et
-- s'est arrêté là, en le disant : « la colonne `status` (`open` / `reviewing` /
-- `resolved`) reste inatteignable par l'API — écart connu et assumé ici, à
-- trancher séparément, parce que l'ouvrir demanderait de décider *qui* peut
-- clore un signalement et avec quelle trace ». C'est cette migration-ci.
--
-- Sans suivi, deux modérateurs traitent le même signalement sans le savoir, et
-- rien ne garde trace des décisions prises sur un incident impliquant un mineur.
-- L'ouverture est donc double, et indissociable : le statut devient modifiable
-- **par un modérateur et lui seul**, et **chaque changement laisse une ligne que
-- personne ne peut modifier ni effacer**. Ouvrir le premier sans le second
-- serait pire que l'immobilité actuelle.

-- ---------------------------------------------------------------------------
-- 1. Le statut, et lui seul : le grant porte sur la colonne
-- ---------------------------------------------------------------------------
--
-- Une politique restreint des **lignes**, jamais des colonnes. `grant update on
-- public.tandem_reports` aurait donc laissé un modérateur réécrire `reason` —
-- c'est-à-dire falsifier le témoignage de la personne qui a signalé — ou
-- déplacer `message_id` vers un autre message. Une politique n'aurait rien pu
-- pour l'en empêcher.
--
-- Le grant par colonne le peut, et le comportement a été mesuré sur cette base
-- (PostgreSQL 17.6) plutôt que supposé :
--
--     grant update (ouvert) on … to authenticated;
--     set role authenticated;
--     update … set ouvert = 'x';            -- UPDATE 1
--     update … set ferme  = 'x';            -- ERROR: permission denied for table
--     update … set ouvert = 'y', ferme='y'; -- ERROR: permission denied for table
--
-- Deux enseignements. Le refus est réel et il couvre aussi la tentative mixte —
-- on ne peut pas glisser une colonne fermée à côté d'une colonne ouverte. Et le
-- message parle de **table**, pas de colonne : c'est la forme exacte que les
-- tests attendent, un `permission denied for column` n'existe pas ici.
--
-- `resolved_at` n'est volontairement pas accordé : le trigger ci-dessous le
-- pose lui-même. Une date de clôture qu'on peut écrire à la main n'est pas une
-- date de clôture, c'est une déclaration.

grant update (status) on public.tandem_reports to authenticated;

-- La ligne, maintenant. `using` porte sur l'ancienne ligne, `with check` sur la
-- nouvelle ; ici le prédicat ne parle que de l'appelant, donc le même aux deux
-- endroits. Sans `with check`, une politique UPDATE laisse passer n'importe
-- quelle nouvelle valeur : la borne serait sur qui commence, pas sur ce qui
-- arrive.
--
-- Le contraste avec le grant est le cœur du sujet, et deux tests le séparent :
--
-- - un modérateur qui vise une autre colonne se heurte au grant → **erreur** ;
-- - un non-modérateur qui vise `status` a bien le droit sur la colonne, mais
--   aucune ligne ne satisfait le `using` → **zéro ligne, sans erreur**.
--
-- Le second est le piège de ce dépôt : un UPDATE refusé par un `using` ne lève
-- rien. Un test qui attendrait une exception passerait au vert en croyant avoir
-- mesuré une politique, alors qu'il n'aurait mesuré qu'une absence de crash.

drop policy if exists "reports_update_moderator" on public.tandem_reports;
create policy "reports_update_moderator"
  on public.tandem_reports for update
  to authenticated
  using (public.tandem_est_moderateur())
  with check (public.tandem_est_moderateur());

comment on column public.tandem_reports.status is
  'Suivi du traitement. Modifiable par les seuls modérateurs (grant par colonne + reports_update_moderator), et chaque changement écrit une ligne dans tandem_report_audit.';

-- ---------------------------------------------------------------------------
-- 2. Le journal d'audit : immuable parce que personne n'y écrit
-- ---------------------------------------------------------------------------
--
-- Une politique « on n'efface pas » se lève ; un droit jamais accordé ne se
-- contourne pas. Ce journal n'a donc **aucun** `grant insert`, `update` ou
-- `delete` — les lignes n'y arrivent que par le trigger ci-dessous. Les
-- modérateurs le lisent, rien de plus.
--
-- ⚠️ Ne jamais ajouter de `grant insert` ici « pour permettre à l'app d'écrire
-- l'audit » : une trace que l'application peut écrire est une trace que
-- l'application peut inventer.
--
-- **Aucune clé étrangère, et c'est mesuré, pas négligé.**
-- `tandem_reports.reporter_id references auth.users(id) on delete cascade` :
-- supprimer un compte supprime ses signalements. Une FK vers `tandem_reports`
-- laisserait donc le choix entre deux pièges :
--
--   - `on delete cascade` → l'effacement d'un compte effacerait l'audit des
--     décisions prises à son sujet, exactement ce que ce journal existe pour
--     empêcher ;
--   - `no action` → la suppression du compte **échouerait**, ce qui casserait
--     l'effacement RGPD sur un produit qui accueille des mineurs.
--
-- On garde donc des `uuid` nus. Le journal ne porte que `report_id` et
-- `moderator_id` : aucune donnée du signalement, aucune du mineur concerné.
-- Ce qui survit à la suppression d'un compte, c'est la trace d'une décision de
-- modération — pas le contenu qu'elle jugeait.

create table if not exists public.tandem_report_audit (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  moderator_id uuid,
  from_status text not null,
  to_status text not null,
  changed_at timestamptz not null default timezone('utc', now())
);

comment on table public.tandem_report_audit is
  'Journal des changements de statut des signalements. Append-only : aucun grant d''écriture, les lignes viennent du seul trigger tandem_report_audit_ecrire. Volontairement sans clé étrangère — une FK cascade effacerait l''audit avec le compte, une FK stricte bloquerait l''effacement RGPD.';

comment on column public.tandem_report_audit.moderator_id is
  'auth.uid() de l''appelant au moment du changement. Jamais current_user : dans une fonction security definer il désigne le propriétaire, pas l''appelant.';

create index if not exists tandem_report_audit_report_idx
  on public.tandem_report_audit (report_id, changed_at desc);

alter table public.tandem_report_audit enable row level security;

-- Lecture seule, et réservée. Le journal dit qui a modéré quoi : l'ouvrir à
-- l'auteur d'un signalement lui livrerait l'identité des modérateurs, ce que
-- l'invisibilité de `tandem_moderators` visait précisément à empêcher.
drop policy if exists "report_audit_select_moderator" on public.tandem_report_audit;
create policy "report_audit_select_moderator"
  on public.tandem_report_audit for select
  to authenticated
  using (public.tandem_est_moderateur());

grant select on public.tandem_report_audit to authenticated;
-- Rien d'autre. Pas d'insert, pas d'update, pas de delete, jamais, à personne.

-- ---------------------------------------------------------------------------
-- Le trigger qui écrit — et pourquoi il connaît le bon modérateur
-- ---------------------------------------------------------------------------
--
-- `security definer` est obligatoire, pas décoratif : en `invoker` la fonction
-- s'exécuterait comme `authenticated`, qui n'a aucun `grant insert` sur le
-- journal, et tout changement de statut échouerait.
--
-- Ce qui autorise l'insertion n'est d'ailleurs pas l'absence de politique
-- INSERT — c'est que le propriétaire de la table contourne sa propre RLS.
-- ⚠️ Un `alter table … force row level security` ajouté un jour casserait donc
-- ce trigger, et avec lui toute écriture de statut.
--
-- Corollaire direct, et c'est le piège que ce projet a déjà payé une fois :
-- **`current_user` désigne ici le propriétaire de la fonction**, pas le
-- modérateur. Un journal alimenté par `current_user` enregistrerait
-- `postgres` à chaque ligne et serait rigoureusement inutile — sans jamais
-- échouer, donc sans jamais se signaler. `auth.uid()` est le seul signal qui
-- désigne l'appelant.
--
-- `is distinct from` plutôt que `<>` : `status` est `not null`, mais l'opérateur
-- juste ne coûte rien et ne surprendra pas si la colonne change un jour.

create or replace function public.tandem_report_audit_ecrire()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    insert into public.tandem_report_audit (report_id, moderator_id, from_status, to_status)
    values (old.id, auth.uid(), old.status, new.status);

    -- La date de clôture suit la décision au lieu d'être déclarée : elle n'est
    -- accordée à personne en écriture (voir le grant par colonne plus haut).
    if new.status = 'resolved' then
      new.resolved_at := timezone('utc', now());
    elsif old.status = 'resolved' then
      new.resolved_at := null;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.tandem_report_audit_ecrire() is
  'Écrit la trace d''un changement de statut de signalement. security definer parce que authenticated n''a aucun droit d''écriture sur le journal — d''où l''emploi impératif de auth.uid() et non de current_user.';

-- `before` et non `after` : il faut pouvoir poser `resolved_at` sur la ligne en
-- cours d'écriture. Le journal, lui, serait indifférent au moment.
drop trigger if exists tandem_report_audit_trg on public.tandem_reports;
create trigger tandem_report_audit_trg
  before update on public.tandem_reports
  for each row
  execute function public.tandem_report_audit_ecrire();

-- ---------------------------------------------------------------------------
-- La garde d'immuabilité, et l'honnêteté sur ce qu'elle vaut
-- ---------------------------------------------------------------------------
--
-- La protection **primaire** reste l'absence de grant : un compte authentifié
-- ne peut même pas formuler la tentative. Cette garde-ci vise plus haut — le
-- propriétaire de la table, et surtout le `grant update` qu'un successeur bien
-- intentionné ajouterait un jour. Sans elle, le seul test d'immuabilité qu'on
-- pourrait écrire mesurerait un *grant*, pas une immuabilité : il resterait
-- vert le jour où le grant apparaîtrait.
--
-- Elle ne prétend pas à l'inviolabilité : qui est `postgres` peut désactiver un
-- trigger, ou `drop` la table. Une trace ne se défend pas contre l'administrateur
-- de sa propre base ; elle se défend contre l'application et ses comptes.
--
-- `insert` est délibérément absent de la liste : c'est le seul chemin d'entrée.

create or replace function public.tandem_report_audit_immuable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'tandem_report_audit est un journal d''audit : ses lignes ne se modifient ni ne s''effacent (tentative de %)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

comment on function public.tandem_report_audit_immuable() is
  'Refuse tout UPDATE ou DELETE sur le journal d''audit. Garde secondaire : la protection primaire est l''absence de grant d''écriture.';

drop trigger if exists tandem_report_audit_immuable_trg on public.tandem_report_audit;
create trigger tandem_report_audit_immuable_trg
  before update or delete on public.tandem_report_audit
  for each row
  execute function public.tandem_report_audit_immuable();

-- ---------------------------------------------------------------------------
-- 3. Le contexte de la relation, sans les personnes
-- ---------------------------------------------------------------------------
--
-- Un signalement sur une relation déjà bloquée n'appelle pas la même décision
-- qu'un signalement sur une relation active. Le modérateur doit donc voir l'état
-- du tandem — et rien de plus. Pas les participants : la modération ne devient
-- pas un annuaire des relations.
--
-- Pourquoi ni l'un ni l'autre des chemins évidents :
--
-- - **élargir `tandems_select_member`** aux modérateurs : `authenticated` a
--   `grant select` sur *toute* la table `tandems` (migration `…_000002`, ligne
--   178), et ce qui limite l'accès est la RLS par ligne. Ouvrir la ligne ouvre
--   donc toutes ses colonnes, `participant_a_id` et `participant_b_id`
--   comprises. Le grant par colonne n'aide pas ici : il est déjà donné en
--   entier, et le restreindre casserait les participants légitimes.
--
-- - **une fonction `tandem_contexte(uuid)`** : elle réintroduirait exactement la
--   forme que ce projet a refusée douze lignes plus haut dans
--   `20260806163000` — un paramètre fait de la fonction un oracle qu'on
--   interroge, et sa sûreté ne tient alors qu'à sa garde interne. Une vue n'a
--   pas de paramètre : il n'y a rien à sonder. Elle rend en outre l'ensemble
--   d'un coup, joignable avec la liste des signalements, là où la fonction
--   imposerait un appel par tandem.
--
-- La vue est donc le chemin, et sa sûreté repose entièrement sur deux points
-- qu'il faut lire ensemble :
--
-- `security_invoker = off` — c'est le **défaut** de PostgreSQL, vérifié sur
-- cette base (`reloptions` vide sur une vue créée sans option). On l'écrit
-- quand même en toutes lettres : toute la conception en dépend, et le lecteur
-- qui supposerait l'inverse est précisément le mode d'échec redouté. En
-- `invoker`, la RLS de `tandems` s'appliquerait au modérateur et la vue serait
-- vide ; en `definer` elle s'exécute comme le propriétaire, donc hors RLS —
-- **la vue doit alors se garder elle-même**, comme le font déjà
-- `tandem_paire_bloquee` et `tandem_contact_bloque`.
--
-- Ses deux gardes, donc :
--   1. `tandem_est_moderateur()` — sans quoi la vue publierait l'état de tous
--      les tandems signalés à n'importe quel compte authentifié ;
--   2. l'`exists` sur `tandem_reports` — seuls les tandems **effectivement
--      signalés**. La table entière n'a pas à transiter par la modération.
--
-- Cet `exists` n'est pas soumis à la RLS de `tandem_reports` (on est en
-- `definer`), et c'est ici sans conséquence : la garde 1 a déjà établi que
-- l'appelant lit de toute façon tous les signalements.
--
-- Les colonnes sont énumérées une à une, et il n'y a pas de `blocked_by` :
-- c'est l'uuid d'un participant. ⚠️ Ne jamais remplacer cette liste par `t.*`.

create or replace view public.tandem_contexte_signale
with (security_invoker = off) as
  select
    t.id            as tandem_id,
    t.status        as status,
    t.created_at    as created_at,
    t.blocked_at    as blocked_at,
    t.ended_at      as ended_at
  from public.tandems t
  where public.tandem_est_moderateur()
    and exists (select 1 from public.tandem_reports r where r.tandem_id = t.id);

comment on view public.tandem_contexte_signale is
  'État des seuls tandems signalés, pour la modération : ni participants, ni blocked_by, ni messages. security_invoker = off (défaut, écrit explicitement) : la vue s''exécute hors RLS et se garde donc elle-même. Ne jamais y mettre t.*.';

grant select on public.tandem_contexte_signale to authenticated;
-- Rien à `anon` : un visiteur non connecté n'a aucune raison d'être ici, et
-- `tandem_est_moderateur()` ne lui est de toute façon pas exécutable.
