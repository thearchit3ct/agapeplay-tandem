-- Le bilan de fin de semaine, et le rappel qui ne compte rien — issue #18.
--
-- L'issue demande cinq choses : un bilan de fin de semaine, un rappel réglable
-- et désactivable, un message de reprise après absence, aucun mot de honte ni
-- de série perdue, et une mesure sans contenu sensible. Cette migration porte
-- les deux premières et rend la troisième calculable ; les mots vivent dans
-- `packages/content/copy`, la mesure passe par `analytics_events` sans changer
-- une ligne de son dispositif.
--
-- ---------------------------------------------------------------------------
-- Ce que cette table contient, et surtout ce qu'elle ne contient PAS
-- ---------------------------------------------------------------------------
--
-- L'EPIC D du doc 04 range ensemble « réponse rapide de statut », « note ou
-- texte privé » et « partage explicite d'une réponse ». La tentation était
-- d'en faire une table qui porte les trois : un statut, un texte, un partage.
-- On ne l'a pas prise, parce que les deux derniers existent déjà et que les
-- réécrire créerait deux endroits qui disent la même chose.
--
--   - la **note privée** est une entrée de `journal_entries`. Elle a déjà sa
--     politique own-only, sa suppression, son export, sa place dans
--     `supprimer_mon_compte()`. Une colonne `note text` ici serait un second
--     journal, avec une seconde politique à tenir, un second export à écrire et
--     une seconde ligne à ne pas oublier le jour d'une suppression de compte ;
--   - le **partage** est une ligne de `journal_shares`, posée sur cette entrée.
--     Le geste, l'écran, le retrait et la fonction de lecture sont écrits
--     (`20260825160000`) ; il n'y a rien à ajouter et beaucoup à ne pas
--     dupliquer.
--
-- Reste la réponse rapide de statut, qui n'existait nulle part. C'est tout ce
-- que cette table porte : **une semaine, un mot**.
--
-- Conséquence assumée : on ne partage pas son statut à son binôme. Ce serait un
-- second chemin de lecture croisée — donc une seconde fonction `security
-- definer`, donc le double de surface — pour un seul mot, et un mot qu'on lit
-- mal. « rude » trois semaines de suite se laisse interpréter par quelqu'un qui
-- n'a pas les phrases autour. Ce que l'on ouvre à son binôme, ce sont des mots
-- choisis : une entrée de journal, partagée exprès. Le statut, lui, reste à
-- celle qui l'a posé.
--
-- ---------------------------------------------------------------------------
-- Quand une semaine « se termine » — et pourquoi ce n'est pas relatif au
-- parcours de chacun
-- ---------------------------------------------------------------------------
--
-- Deux lectures étaient possibles. Une semaine relative au parcours — « ta
-- quatrième semaine depuis le début » — et une semaine civile, celle du
-- calendrier.
--
-- C'est la semaine **civile ISO** qui est retenue, et la raison est le public :
-- la question posée est « comment s'est passée ta semaine ? », pas « où en
-- es-tu de ton parcours ? ». La semaine d'un adolescent de seize ans est celle
-- du lycée, du week-end et de la maison ; elle se termine quand elle se termine
-- pour tout le monde, pas au septième jour d'un compteur.
--
-- La lecture relative avait surtout un défaut rédhibitoire ici : elle exige un
-- parcours commencé et une progression pour avancer. Quelqu'un qui n'a rien
-- fait depuis trois semaines n'aurait donc jamais de bilan à remplir — soit
-- exactement la personne à qui l'on veut proposer de revenir. Une semaine ne
-- doit rien devoir à ce qu'on y a accompli, sans quoi le bilan devient le
-- constat d'une dette.
--
-- La clé est donc `2026-W35` : l'année ISO et le numéro de semaine ISO, tels
-- que `packages/domain/src/bilan.ts` les calcule, avec ses tests — y compris
-- les vendredis de début janvier, qui appartiennent à la dernière semaine de
-- l'année précédente.
--
-- **La fenêtre : du samedi au vendredi suivant.** Le bilan de la semaine W
-- s'ouvre le samedi de W et se referme le vendredi soir de W+1. Sept jours,
-- jamais deux bilans ouverts en même temps, jamais un arriéré. Passé vendredi,
-- la semaine s'en va sans laisser de trace : aucun écran ne la rappelle,
-- aucune ligne ne la compte. C'est la traduction en dates de « une semaine sans
-- bilan n'est pas un échec » — une file de bilans en retard serait précisément
-- l'inverse.
--
-- La base ne connaît pas cette fenêtre, et c'est volontaire : elle accepte
-- n'importe quelle clé de semaine bien formée. La fenêtre est une règle
-- d'écran — ce qu'on propose — et non une règle de droit — ce qu'on autorise.
-- L'inscrire ici transformerait une correction tardive en refus de la base, et
-- obligerait à faire confiance à l'horloge du téléphone pour l'appliquer.
--
-- ---------------------------------------------------------------------------
-- Le vocabulaire, et ce qu'il refuse de dire
-- ---------------------------------------------------------------------------
--
-- Cinq réponses closes, et pas une échelle. Une note de 1 à 5 aurait produit
-- une courbe, la courbe aurait produit une comparaison, et la comparaison est
-- exactement le mécanisme de honte que l'issue demande d'éviter. Les cinq mots
-- qualifient **la semaine**, jamais la personne : une semaine peut être rude
-- sans que quiconque ait échoué.
--
--   `paisible`  — elle a été calme ;
--   `dense`     — il s'y est passé beaucoup de choses ;
--   `rude`      — elle a été dure ;
--   `ailleurs`  — « j'étais ailleurs ». C'est la réponse de celle qui n'a rien
--                 ouvert de la semaine, et elle est offerte au même rang que
--                 les autres, sans excuse à fournir ni case « je n'ai pas eu le
--                 temps » qui demanderait de se justifier ;
--   `incertain` — « je ne sais pas trop ». Sans elle, quelqu'un qui ne sait pas
--                 choisirait un mot faux ou ne répondrait pas ; les deux
--                 abîment la seule chose que cette table prétend contenir.
--
-- Aucun de ces mots n'est un score, aucun n'est meilleur qu'un autre, et rien
-- dans le schéma ne permet d'en tirer une série : il n'y a ni compteur, ni
-- `streak`, ni colonne « semaines consécutives ». Ce qui n'existe pas ne
-- s'affiche pas par accident.
--
-- ---------------------------------------------------------------------------
-- Une ligne par semaine, modifiable
-- ---------------------------------------------------------------------------
--
-- Clé primaire `(user_id, week_key)` : répondre deux fois pour la même semaine
-- n'est pas deux bilans, c'est un bilan corrigé. L'`update` est ouvert pour
-- cette raison — une réponse qu'on ne peut pas reprendre est une réponse qu'on
-- hésite à donner — et le `delete` aussi : ce qu'on a écrit sur soi s'efface,
-- ici comme dans le journal.

create table if not exists public.weekly_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Année ISO et numéro de semaine ISO, `2026-W35`. Le format est contraint
  -- parce qu'il est comparé et trié comme du texte : une clé mal formée
  -- passerait inaperçue jusqu'au jour où l'ordre des semaines se mettrait à
  -- mentir.
  week_key text not null check (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  state text not null check (state in ('paisible', 'dense', 'rude', 'ailleurs', 'incertain')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, week_key)
);

comment on table public.weekly_checkins is
  'Le bilan de fin de semaine — issue #18. Une ligne = une semaine civile ISO et un mot qui la qualifie, rien d''autre : la note privée est une entrée de journal_entries, son partage une ligne de journal_shares. Own-only de bout en bout, aucune lecture croisée, aucun compteur de série — le schéma ne permet pas d''en calculer une.';

comment on column public.weekly_checkins.week_key is
  'Semaine ISO au format 2026-W35, calculée par packages/domain/src/bilan.ts. La fenêtre de saisie (du samedi au vendredi suivant) est une règle d''écran, pas une règle de base : n''importe quelle semaine bien formée est acceptée ici.';

comment on column public.weekly_checkins.state is
  'Comment la semaine s''est passée, en cinq réponses closes. Ce n''est pas une échelle et l''ordre n''a pas de sens : une note chiffrée produirait une courbe, donc une comparaison, donc la honte que l''issue #18 demande d''éviter. « ailleurs » est offert au même rang que les autres — l''absence n''a pas à se justifier.';

alter table public.weekly_checkins enable row level security;

-- ---------------------------------------------------------------------------
-- Qui lit, qui écrit
-- ---------------------------------------------------------------------------
--
-- Own-only, quatre politiques, aucune ouverture à autrui — pas même au binôme,
-- pas même au mentor. C'est la forme de `journal_entries`, et pour la même
-- raison : ce que quelqu'un dit de sa semaine est à lui.
--
-- Les quatre sont écrites séparément plutôt qu'en un `for all` à la
-- `notification_preferences_own`, parce qu'elles ne portent pas le même risque
-- et que les lire séparément est ce qui permet de le voir. `for all` cache en
-- particulier que l'`update` a besoin de **deux** clauses.

drop policy if exists "weekly_checkins_select_own" on public.weekly_checkins;
create policy "weekly_checkins_select_own"
  on public.weekly_checkins for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "weekly_checkins_insert_own" on public.weekly_checkins;
create policy "weekly_checkins_insert_own"
  on public.weekly_checkins for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- `using` **et** `with check`. `using` dit quelles lignes l'update a le droit de
-- voir ; `with check` dit ce qu'elles ont le droit de devenir — sans quoi un
-- `update … set user_id = <quelqu'un d'autre>` déplacerait un bilan dans le
-- compte d'un tiers, qui n'a rien demandé et ne pourrait plus l'effacer, sa
-- propre politique de delete ne voyant qu'une ligne dont il est désormais
-- propriétaire.
--
-- ⚠️ **Ce `with check` est aujourd'hui une seconde serrure, pas la première, et
-- il faut le savoir pour ne pas se tromper sur ce que les tests prouvent.**
-- Mesuré le 25/08/2026 : en remplaçant ce `with check` par `(true)`, le
-- déplacement reste refusé — `tests/rls/bilan-hebdomadaire.test.ts` ne rougit
-- pas d'une ligne. La raison est dans la table « Policies Applied by Command
-- Type » de la documentation de `CREATE POLICY` : pour un UPDATE, les
-- politiques SELECT s'appliquent à la ligne existante **et à la nouvelle**. Une
-- ligne qu'on ne pourrait plus lire après coup ne peut donc pas être écrite, et
-- `weekly_checkins_select_own` referme déjà la porte.
--
-- On garde le `with check` quand même, et ce n'est pas de la superstition : il
-- devient la seule serrure le jour où quelqu'un élargit la politique SELECT —
-- pour un tableau de bord d'église, pour une lecture par le mentor, pour
-- n'importe quelle raison qui semblera bonne. La vérification par mutation le
-- montre en deux temps plutôt qu'en un : SELECT élargi seul ⇒ le déplacement
-- reste refusé ; SELECT élargi **et** `with check (true)` ⇒ il passe. C'est la
-- règle du dépôt, « la garde la plus permissive fixe le niveau », vue depuis
-- l'autre bout : ici deux gardes disent la même chose, et c'est la plus stricte
-- qui tient tant que l'autre ne bouge pas.
drop policy if exists "weekly_checkins_update_own" on public.weekly_checkins;
create policy "weekly_checkins_update_own"
  on public.weekly_checkins for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "weekly_checkins_delete_own" on public.weekly_checkins;
create policy "weekly_checkins_delete_own"
  on public.weekly_checkins for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Sans `grant`, la Data API rend 401 quelles que soient les politiques — piège
-- consigné depuis `20260804000001`, et qui ne se voit pas en relisant les
-- politiques.
grant select, insert, update, delete on public.weekly_checkins to authenticated;

-- ---------------------------------------------------------------------------
-- Le rappel : une préférence de plus, et pourquoi pas une de moins
-- ---------------------------------------------------------------------------
--
-- `notification_preferences` porte déjà `sessions`, `messages`, `church` et
-- `absence`. La question était de savoir si le rappel de bilan pouvait se
-- ranger sous `sessions`. Non : `sessions` gouverne le rappel du petit pas
-- quotidien, `weekly_checkin` celui d'un rendez-vous hebdomadaire qui n'est pas
-- une séance. Quelqu'un peut très bien vouloir qu'on lui fiche la paix en
-- semaine et accepter une question le samedi — et l'inverse. Les confondre
-- ferait qu'éteindre l'un éteint l'autre, ce qui est la définition d'un
-- réglage qui ne règle pas.
--
-- `absence`, elle, ne bouge pas : c'est déjà la préférence du message de
-- reprise, troisième critère de l'issue. Deux messages distincts, deux
-- interrupteurs — et le message de reprise reste gouverné par celui qui porte
-- son nom depuis le premier jour.
--
-- `default true` comme ses voisines : le rappel est doux et il se coupe d'un
-- clic. Un rappel éteint par défaut serait une fonctionnalité que personne ne
-- découvre.

alter table public.notification_preferences
  add column if not exists weekly_checkin boolean not null default true;

comment on column public.notification_preferences.weekly_checkin is
  'Le rappel du bilan de fin de semaine — issue #18. Distinct de « sessions », qui gouverne le petit pas quotidien : on peut vouloir la paix en semaine et une question le samedi. Éteint, plus aucune carte de bilan n''apparaît ; la table reste écrivable, le geste redevient simplement quelque chose qu''on va chercher.';

-- ---------------------------------------------------------------------------
-- `supprimer_mon_compte()` : la cascade ne suffit PAS ici
-- ---------------------------------------------------------------------------
--
-- `weekly_checkins.user_id` référence `auth.users(id) on delete cascade`, et
-- c'est un leurre : la suppression de compte de ce produit **n'efface pas** la
-- ligne `auth.users`. Elle la neutralise — email à NULL, `banned_until` à cent
-- ans, `deleted_at` posé — parce que `tandem_partenaire()` lit ce `deleted_at`
-- pour dire au binôme que la personne est partie, et parce qu'un identifiant
-- effacé emporterait les messages laissés chez autrui. La cascade ne se
-- déclenche donc jamais, et c'est précisément pourquoi la fonction énumère à la
-- main tout ce qui n'est qu'à la personne (`journal_entries`,
-- `session_progress`, `notification_preferences`, `mesure_preferences`…).
--
-- Sans la ligne ajoutée ci-dessous, les bilans hebdomadaires d'un mineur de
-- seize ans survivraient à la suppression de son compte, indéfiniment, sans que
-- rien ne le signale — aucune erreur, aucun écran, juste des lignes qui
-- restent. `tests/rls/bilan-hebdomadaire.test.ts` le mesure au lieu de le
-- supposer.
--
-- La fonction est **recopiée en entier**, corps et commentaires compris :
-- PostgreSQL ne connaît pas le patch de corps de fonction, et `create or
-- replace` remplace le tout. Une seule ligne diffère de la version du
-- 25/08 (`20260825190000`) — le `delete` sur `weekly_checkins` — et elle est
-- annotée sur place.
--
-- La garde ci-dessous vérifie plus que l'existence de la fonction : elle
-- vérifie qu'on remplace bien **la dernière version connue**. Une base où la
-- migration `20260825190000` n'aurait pas été appliquée porterait une fonction
-- sans `mesure_preferences` ; la recopier telle qu'elle est écrite ici la ferait
-- avancer de deux versions d'un coup, ce qui est peut-être souhaitable mais
-- n'est pas ce que ce fichier prétend faire. On lève, et l'on applique les
-- migrations dans l'ordre.

do $$
declare
  v_source text;
begin
  if to_regprocedure('public.supprimer_mon_compte()') is null then
    raise exception 'supprimer_mon_compte() introuvable : migration 20260825090000 non appliquée ?';
  end if;
  v_source := pg_get_functiondef(to_regprocedure('public.supprimer_mon_compte()'));
  if position('mesure_preferences' in v_source) = 0 then
    raise exception 'supprimer_mon_compte() n''est pas dans sa version du 25/08 (issue #20) : appliquez 20260825190000 avant celle-ci.';
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
  -- recherché. Voir `docs/25`, section « supprimer ».
  delete from public.mesure_preferences where user_id = v_uid;
  -- Ajout du 25/08/2026 (issue #18) : les bilans de fin de semaine. La clé
  -- étrangère vers `auth.users` est `on delete cascade` et ne servira jamais —
  -- cette fonction ne supprime pas la ligne `auth.users`, elle la neutralise.
  -- Ce `delete` est donc le seul chemin par lequel ces lignes s'en vont.
  delete from public.weekly_checkins where user_id = v_uid;

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
  'Suppression réelle du compte de l''appelant. Sans paramètre — elle lit auth.uid() — parce qu''il n''y a personne d''autre à supprimer. Efface les données personnelles (dont le consentement à la mesure et les bilans hebdomadaires), neutralise auth.users et les sessions, garde les messages laissés chez autrui, les signalements et l''audit. Ne termine pas un tandem bloqué : le blocage survit à son auteur. N''efface aucun événement de mesure : aucun ne désigne ce compte.';

revoke all on function public.supprimer_mon_compte() from public;
revoke all on function public.supprimer_mon_compte() from anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
