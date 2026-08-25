-- La mesure respectueuse — issue #20.
--
-- `public.analytics_events` existe depuis la migration `…_000007`. Elle est
-- vide, et elle l'était pour une bonne raison : rien n'émettait. Ce fichier ne
-- la remplit pas — c'est le travail des applications — il pose ce qu'il faut
-- pour qu'elle puisse être remplie sans devenir ce qu'on refuse.
--
-- Trois questions, trois réponses écrites ici :
--
--   1. **Que peut contenir un événement ?** Rien qui ressemble à un texte de
--      journal. Ce n'est pas une consigne de revue de code : c'est une
--      contrainte, et une application compromise s'y heurte comme les autres.
--   2. **Qui peut écrire ?** Les comptes connectés, et eux seuls. La table
--      acceptait `anon` : sur un site statique sans composant serveur, c'était
--      un point d'écriture ouvert sur la seule mesure du produit.
--   3. **Qui peut lire ?** Personne depuis la Data API. Aucune politique SELECT
--      n'existait, et il n'en est pas ajouté. La vue du funnel, plus bas, n'a
--      aucun `grant` : elle se lit depuis l'éditeur SQL du tableau de bord.
--
-- Ce que ce fichier ne fait **pas**, et qui est le cœur du dispositif :
-- `anonymous_id` n'est relié à aucun compte. Il naît sur l'appareil, il n'est
-- pas dérivé d'`auth.uid()`, et aucune table ne les rapproche. C'est ce qui
-- rend la « procédure de suppression » honnête — voir `docs/23`.

-- ---------------------------------------------------------------------------
-- 1. Ce qu'un événement peut contenir
-- ---------------------------------------------------------------------------
--
-- Le catalogue du doc 08 tient en dix noms. La contrainte les recopie plutôt
-- que de faire confiance au client : `event_name` est une colonne libre, et un
-- nom inventé polluerait le funnel sans que rien ne le signale.
--
-- ⚠️ Ajouter un événement au doc 08 demande donc une migration. C'est le prix
-- assumé d'une liste fermée, et il est petit : le catalogue éditorial bouge
-- rarement, la mesure qu'il gouverne se lit longtemps.

alter table public.analytics_events
  drop constraint if exists analytics_events_nom_connu;

alter table public.analytics_events
  add constraint analytics_events_nom_connu check (event_name in (
    'account_created',
    'journey_started',
    'session_completed',
    'partner_invited',
    'partner_accepted',
    'share_created',
    'weekly_checkin_completed',
    'help_requested',
    'report_created',
    'journey_paused'
  ));

-- Le verrou central de ce chantier.
--
-- Le doc 08 pose la règle en français — « les événements ne doivent jamais
-- contenir le texte d'un journal, le contenu d'un message ou une référence
-- permettant de déduire une situation intime » — et le doc 06 la range parmi
-- les engagements du produit. Une règle qu'aucun mécanisme ne tient est une
-- intention ; celle-ci devient une contrainte.
--
-- Trois barrières, et chacune ferme un chemin différent :
--
--   - **les clés** sont celles du doc 08, et rien d'autre. `journey_id` et
--     `locale` n'y figurent pas : ce sont des colonnes de la table, les
--     redoubler dans `metadata` créerait deux vérités ;
--   - **les valeurs sont scalaires**. Sans ce point, un texte de journal
--     passerait imbriqué — `{"day": {"texte": "…"}}` a une clé permise et une
--     valeur qui ne l'est pas ;
--   - **les valeurs sont courtes** : 40 caractères. Une tranche de durée, une
--     catégorie de signalement, un type de partage tiennent largement ;
--     une phrase, non.
--
-- Fonction plutôt qu'expression en clair : un CHECK n'accepte ni sous-requête
-- ni fonction à retour d'ensemble, et `jsonb_each` est l'une et l'autre. La
-- fonction est `immutable` — obligatoire pour être appelée depuis un CHECK — ce
-- qu'elle est réellement : elle ne lit que son argument.

create or replace function public.mesure_metadata_sobre(m jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_typeof(m) = 'object'
     and not exists (
       select 1
       from jsonb_each(m) as paire(cle, valeur)
       where paire.cle not in (
              'platform', 'source', 'week', 'day', 'duration_bucket',
              'invitation_type', 'share_type', 'category', 'channel_type',
              'source_role', 'reason_category'
            )
          or jsonb_typeof(paire.valeur) in ('object', 'array')
          or length(paire.valeur #>> '{}') > 40
     );
$$;

comment on function public.mesure_metadata_sobre(jsonb) is
  'Un metadata d''événement ne porte que les clés du doc 08, des valeurs scalaires et courtes (40 caractères). Ce que cette fonction refuse : un texte de journal, un message, une phrase. Appelée depuis un CHECK — d''où immutable.';

alter table public.analytics_events
  drop constraint if exists analytics_events_metadata_sobre;

alter table public.analytics_events
  add constraint analytics_events_metadata_sobre check (public.mesure_metadata_sobre(metadata));

-- ---------------------------------------------------------------------------
-- 2. `anonymous_id` : ce qu'on peut vraiment garantir, et ce qu'on ne peut pas
-- ---------------------------------------------------------------------------
--
-- La forme d'abord : un UUID, tel que les deux applications le tirent de
-- `crypto.randomUUID()`. La contrainte n'empêche pas grand-chose à elle seule,
-- mais elle interdit ce qu'un identifiant de mesure ne doit jamais être — une
-- adresse e-mail, un pseudonyme, un identifiant de session lisible.

alter table public.analytics_events
  drop constraint if exists analytics_events_identifiant_opaque;

alter table public.analytics_events
  add constraint analytics_events_identifiant_opaque check (
    anonymous_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  );

-- Et le fond : `anonymous_id` ne doit jamais valoir `auth.uid()`. Le jour où il
-- le vaudrait, la table cesserait d'être une mesure pour devenir un journal
-- d'activité nominatif, et la procédure de suppression du doc 23 deviendrait un
-- mensonge — il y aurait quelque chose à supprimer, et personne ne le saurait.
--
-- Un trigger, parce qu'un CHECK doit être immutable et qu'`auth.uid()` ne l'est
-- pas (il lit `request.jwt.claims`).
--
-- **Ce que cette garde prouve, et ce qu'elle ne prouve pas.** Elle attrape le
-- cas littéral — l'identifiant de compte envoyé tel quel, qui est l'erreur
-- qu'un raccourci de code produit vraiment. Elle est aveugle à une dérivation :
-- un client qui enverrait `sha256(auth.uid())` passerait. Rien en base ne peut
-- voir cela ; ce qui le tient est ailleurs, dans le fait que l'identifiant naît
-- d'un tirage aléatoire côté appareil (`packages/domain/src/mesure.ts`) et que
-- personne n'a de raison de changer cela sans le dire. La garde ferme la porte
-- la plus fréquentée, pas toutes les fenêtres.

create or replace function public.mesure_identifiant_non_relie()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and new.anonymous_id = auth.uid()::text then
    raise exception 'anonymous_id ne peut pas être l''identifiant du compte : la mesure serait nominative';
  end if;
  return new;
end;
$$;

comment on function public.mesure_identifiant_non_relie() is
  'Refuse un événement dont l''anonymous_id est l''auth.uid() de l''appelant. Attrape le cas littéral, pas une dérivation — voir l''en-tête de la migration.';

drop trigger if exists mesure_identifiant_non_relie on public.analytics_events;
create trigger mesure_identifiant_non_relie
  before insert on public.analytics_events
  for each row execute function public.mesure_identifiant_non_relie();

-- ---------------------------------------------------------------------------
-- 3. Qui peut écrire : les comptes connectés, et eux seuls
-- ---------------------------------------------------------------------------
--
-- La politique de `…_000007` ouvrait l'insertion à `anon` avec `with check
-- (true)`. Le site est statique et la clé publiable est dans le paquet : c'était
-- un point d'écriture anonyme, sans limitation de débit, sur la seule mesure
-- que le produit possède. Un après-midi de curl suffit à rendre le funnel
-- inexploitable — et comme personne ne lit la table depuis l'application, rien
-- ne l'aurait signalé.
--
-- Ce que la fermeture coûte, et qui est assumé : les gestes faits **hors
-- session** ne sont plus mesurés. Le web fonctionne en mode démonstration sans
-- compte, et une séance terminée dans ce mode ne laissera aucune trace. C'est
-- cohérent avec le funnel du doc 08, dont la première étape mesurée est la
-- création de compte : ce qui précède relève de l'audience du site vitrine,
-- pas de cette table.
--
-- `with check (true)` demeure pour `authenticated`, et ce n'est pas un oubli.
-- Une politique ne peut comparer l'événement à personne : il n'y a aucune
-- colonne de propriétaire, par conception. C'est le `grant` qui borne — et les
-- contraintes ci-dessus qui bornent le contenu.

drop policy if exists "analytics_events_insert" on public.analytics_events;
create policy "analytics_events_insert"
  on public.analytics_events for insert
  to authenticated
  with check (true);

revoke insert on public.analytics_events from anon;
grant insert on public.analytics_events to authenticated;

comment on table public.analytics_events is
  'Mesure produit du doc 08. Aucune colonne ne relie une ligne à un compte : anonymous_id naît sur l''appareil. Insertion réservée aux comptes connectés, aucune lecture depuis la Data API — le funnel se lit par la vue mesure_funnel_binome, sans grant.';

comment on column public.analytics_events.anonymous_id is
  'Identifiant d''appareil, tiré au sort, renouvelé au plus tard après 13 mois. Jamais l''auth.uid() ni une dérivation — un trigger refuse le cas littéral. Ne permet de retrouver personne.';

-- ---------------------------------------------------------------------------
-- 4. Le funnel participant-binôme
-- ---------------------------------------------------------------------------
--
-- Le doc 08 décrit un entonnoir en dix étapes dont les deux premières — visite
-- de la présentation, et tout ce qui précède le compte — ne passent pas par
-- cette table. La vue reprend les sept étapes mesurables, dans l'ordre du doc.
--
-- **Aucun `grant`, et il ne faut pas en ajouter.** Même raisonnement que pour
-- `tandem_moderators` (migration `20260806163000`) : l'absence de droit est la
-- protection, pas un oubli. Le produit n'a pas de back-office et n'en gagne pas
-- un ici ; la vue se lit depuis l'éditeur SQL du tableau de bord, qui travaille
-- en `postgres`. Une vue ordinaire s'exécute avec les droits de son
-- propriétaire (`security_invoker` est à `off` par défaut) : un `grant select`
-- accordé un jour à `authenticated` ouvrirait donc la table entière à travers
-- elle, RLS comprise. Raison de plus de n'en accorder aucun.
--
-- **La dernière ligne rendra zéro, et ce n'est pas un bug.**
-- `weekly_checkin_completed` n'a aucun geste dans le produit — le bilan
-- hebdomadaire est l'issue #18, chantier suivant. La North Star du doc 08
-- (« semaines actives accompagnées ») est donc muette par construction tant que
-- ce geste n'existe pas. `share_created`, lui, est bien émis.
--
-- La vue est volontairement sans fenêtre de temps : une vue ne prend pas de
-- paramètre, et en figer une (« les 28 derniers jours ») obligerait à une
-- migration pour la changer. Les variantes datées sont écrites dans `docs/23`,
-- prêtes à copier.

create or replace view public.mesure_funnel_binome as
with etapes(rang, etape, evenement) as (
  values
    (1, 'compte créé', 'account_created'),
    (2, 'parcours commencé', 'journey_started'),
    (3, 'séance terminée', 'session_completed'),
    (4, 'binôme invité', 'partner_invited'),
    (5, 'binôme accepté', 'partner_accepted'),
    (6, 'premier partage', 'share_created'),
    (7, 'semaine accompagnée', 'weekly_checkin_completed')
)
select
  e.rang,
  e.etape,
  e.evenement,
  count(distinct a.anonymous_id) as appareils,
  count(a.id) as evenements,
  min(a.occurred_at) as premiere_trace,
  max(a.occurred_at) as derniere_trace
from etapes e
left join public.analytics_events a on a.event_name = e.evenement
group by e.rang, e.etape, e.evenement
order by e.rang;

comment on view public.mesure_funnel_binome is
  'Funnel du doc 08, sept étapes mesurables. Compte des APPAREILS (anonymous_id distincts), jamais des personnes — un même adolescent sur téléphone et navigateur compte deux fois. La ligne « semaine accompagnée » rend zéro tant que le bilan hebdomadaire (issue #18) n''existe pas. AUCUN grant : se lit en postgres depuis l''éditeur SQL, ne pas en accorder.';

revoke all on public.mesure_funnel_binome from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Le consentement, côté compte
-- ---------------------------------------------------------------------------
--
-- Le réglage vit d'abord sur l'appareil — c'est là que naît l'identifiant, et
-- un refus doit valoir avant même qu'un compte existe. Mais un refus posé sur
-- le navigateur ne dirait rien au téléphone, et le critère est « respecté
-- partout ». D'où cette table : un booléen par compte, lu à l'ouverture de
-- session sur chaque appareil, et le refus l'emporte sur l'accord local.
--
-- Une table à part plutôt qu'une colonne de `notification_preferences` : ce
-- n'est pas une préférence de notification, et loger la mesure dans une table
-- qui porte cet autre nom rendrait l'écran difficile à relire dans deux ans.
--
-- Ce que cette table **ne** contient pas, et ne doit jamais contenir :
-- `anonymous_id`. Une colonne de plus ici, et la jointure identité ↔ mesure
-- que tout le dispositif refuse existerait en une ligne de SQL.

create table if not exists public.mesure_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mesure boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.mesure_preferences is
  'Consentement à la mesure produit, par compte. Ne porte AUCUN anonymous_id : l''ajouter créerait la jointure identité ↔ mesure que le dispositif refuse.';

alter table public.mesure_preferences enable row level security;

drop policy if exists "mesure_preferences_own" on public.mesure_preferences;
create policy "mesure_preferences_own"
  on public.mesure_preferences for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.mesure_preferences to authenticated;


-- ---------------------------------------------------------------------------
-- 6. Ce que la suppression de compte emporte
-- ---------------------------------------------------------------------------
--
-- `supprimer_mon_compte()` (migration `20260825090000`) efface ce qui n'est
-- qu'à la personne. La ligne de préférence de mesure en fait partie.
--
-- Les événements, eux, ne sont pas touchés — et c'est la procédure de
-- suppression elle-même, pas un manque. Aucune ligne d'`analytics_events` ne
-- désigne ce compte : il n'existe aucun prédicat qui pourrait les sélectionner.
-- On ne peut pas supprimer ce qu'on ne peut pas retrouver, et c'est exactement
-- ce qu'on voulait obtenir. Ce qui se supprime réellement — l'identifiant
-- d'appareil — est dans le stockage local, et les deux applications l'effacent.
--
-- La fonction est **recopiée en entier**, corps compris : PostgreSQL ne connaît
-- pas le patch de corps de fonction, et `create or replace` remplace le tout.
-- Une seule ligne diffère du 25/08 — le `delete` sur `mesure_preferences` — et
-- elle est annotée sur place. Le reste est identique au caractère près, y
-- compris les commentaires qui portent les décisions : les couper ici les
-- perdrait pour qui lira la dernière version de la fonction.
--
-- La garde ci-dessous n'est pas décorative : si la migration `20260825090000`
-- n'a pas été appliquée, mieux vaut lever que recréer une fonction dont les
-- tests supposent l'antériorité.

do $$
begin
  if to_regprocedure('public.supprimer_mon_compte()') is null then
    raise exception 'supprimer_mon_compte() introuvable : migration 20260825090000 non appliquée ?';
  end if;
end;
$$;

create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  -- Repli fermé, comme `tandem_est_moderateur()` : sans identité, on ne
  -- supprime rien. Le `grant` ne suffit pas à porter cette garde — il ne dit
  -- rien d'un rôle `authenticated` sans claims, qui est précisément la
  -- situation où `auth.uid()` vaut NULL et où un `where user_id = v_uid`
  -- silencieux ne toucherait aucune ligne… tout en laissant les `update` sans
  -- clause d'identité faire leur œuvre. On lève avant d'en arriver là.
  if v_uid is null then
    raise exception 'identite_absente' using errcode = '28000';
  end if;

  -- L'adresse d'abord : les invitations reçues se retrouvent par elle, et le
  -- bloc `auth` plus bas va l'effacer.
  select u.email into v_email from auth.users u where u.id = v_uid;

  -- 1. Ce qui n'est qu'à elle, et qui part sans discussion.
  delete from public.journal_entries where user_id = v_uid;
  delete from public.session_progress where user_id = v_uid;
  delete from public.notification_preferences where user_id = v_uid;
  delete from public.church_members where user_id = v_uid;
  delete from public.group_members where user_id = v_uid;
  delete from public.mentor_profiles where user_id = v_uid;
  delete from public.mentor_assignments where mentor_id = v_uid or participant_id = v_uid;
  -- Un modérateur qui s'en va cesse d'être modérateur. Le retrait est immédiat
  -- côté base, par conception (voir `20260806163000`).
  delete from public.tandem_moderators where user_id = v_uid;
  -- Ajout du 25/08/2026 (issue #20) : le consentement à la mesure est une
  -- donnée de la personne, et il part avec elle. Les ÉVÉNEMENTS, eux, ne sont
  -- pas touchés — aucun prédicat ne pourrait les désigner, et c'est le résultat
  -- recherché. Voir `docs/23`, section « supprimer ».
  delete from public.mesure_preferences where user_id = v_uid;

  -- 2. Les invitations : toute ligne qui porte son identifiant ou son adresse.
  --
  -- Les deux sens comptent. Celles qu'elle a émises contiennent l'adresse d'un
  -- tiers, confiée pour un usage qui n'a plus lieu d'être ; celles qu'elle a
  -- reçues contiennent la sienne, dans la liste de quelqu'un d'autre.
  -- L'anonymisation aurait été le choix inverse — elle laisse à l'inviteur une
  -- ligne portant une adresse inventée, c'est-à-dire un écran qui ment. Une
  -- ligne absente ne ment pas : la personne invitée n'est plus là.
  delete from public.tandem_invitations
   where inviter_id = v_uid
      or accepted_by = v_uid
      or lower(invitee_email) = lower(coalesce(v_email, '@'));

  -- 3. Les tandems : on termine, **sauf ceux qui sont bloqués**.
  --
  -- Le conjonct `status <> 'blocked'` n'est pas une précaution de style, c'est
  -- la garde la plus tranchante de cette fonction. `messages_select_member`
  -- referme la lecture de l'historique sur la personne bloquée
  -- (`t.status <> 'blocked' or auth.uid() = t.blocked_by`) : faire passer une
  -- ligne bloquée à `ended` lui rouvrirait la conversation entière. Autrement
  -- dit, quelqu'un qui a été bloqué reprendrait la lecture au moment où celui
  -- qui l'a bloqué s'en va — le pire moment possible. **Le blocage survit à son
  -- auteur.** La ligne reste `blocked`, gelée pour les deux.
  update public.tandems
     set status = 'ended',
         ended_at = coalesce(ended_at, timezone('utc', now()))
   where (participant_a_id = v_uid or participant_b_id = v_uid)
     and status <> 'blocked';

  -- 4. Le profil devient la pierre tombale décrite plus haut. Les dates de
  -- consentement partent avec le reste : elles ne prouvent plus rien pour un
  -- compte qui n'existe plus, et ce sont des données de la personne.
  update public.profiles
     set display_name = '',
         account_status = 'deleted',
         deletion_requested_at = coalesce(deletion_requested_at, timezone('utc', now())),
         deleted_at = timezone('utc', now()),
         age_confirmed_at = null,
         privacy_consent_at = null,
         terms_consent_at = null,
         updated_at = timezone('utc', now())
   where id = v_uid;

  -- 5. Les moyens de se connecter, et les sessions déjà ouvertes.
  --
  -- `auth.identities` porte l'adresse et les métadonnées du fournisseur
  -- (Google, Microsoft) : on efface les lignes, pas seulement leur contenu.
  -- `auth.sessions` emporte `auth.refresh_tokens` par cascade — c'est la
  -- révocation côté serveur, celle qui ne dépend pas de la bonne volonté du
  -- client. La déconnexion globale demandée par l'application en est le
  -- pendant visible, pas la garantie.
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;

  update auth.users
     set email = null,
         phone = null,
         encrypted_password = null,
         -- Lu par `nomDepuisIdentite` côté client : ces métadonnées portent un
         -- vrai nom, les vider n'a rien de cosmétique.
         raw_user_meta_data = '{}'::jsonb,
         -- `raw_app_meta_data` n'est PAS touchée : elle porte `provider` et
         -- `providers`, données de contrôle de GoTrue et non données de la
         -- personne. Ni la purge ni le blocage de connexion n'en dépendent, et
         -- la plus petite empreinte possible dans `auth.*` est ce qui rend le
         -- contrôle de droits ci-dessus simple à tenir.
         banned_until = timezone('utc', now()) + interval '100 years',
         deleted_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where id = v_uid;
end;
$$;

comment on function public.supprimer_mon_compte() is
  'Suppression réelle du compte de l''appelant. Sans paramètre — elle lit auth.uid() — parce qu''il n''y a personne d''autre à supprimer. Efface les données personnelles (dont le consentement à la mesure), neutralise auth.users et les sessions, garde les messages laissés chez autrui, les signalements et l''audit. Ne termine pas un tandem bloqué : le blocage survit à son auteur. N''efface aucun événement de mesure : aucun ne désigne ce compte.';

revoke all on function public.supprimer_mon_compte() from public;
revoke all on function public.supprimer_mon_compte() from anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
