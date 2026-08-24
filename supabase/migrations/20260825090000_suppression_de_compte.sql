-- La suppression de compte, pour de vrai — issue #7.
--
-- Depuis la migration `…_000002`, l'écran des réglages pose
-- `account_status = 'deletion_requested'` et un horodatage sur `public.profiles`.
-- Rien, nulle part, ne consommait ce drapeau : ni purge, ni révocation, ni
-- export. Le produit promettait dans le doc 06 « suppression du compte et export
-- des données accessibles dans l'application » et tenait un post-it.
--
-- ---------------------------------------------------------------------------
-- Le nœud : effacer la personne sans effacer ce qui n'est pas à elle
-- ---------------------------------------------------------------------------
--
-- Le chemin qui vient d'abord à l'esprit — supprimer la ligne `auth.users` —
-- est celui qu'il ne faut pas prendre, et le schéma le dit tout seul. Quatre
-- clés étrangères y pendent en `on delete cascade` :
--
--     tandems.participant_a_id / participant_b_id → auth.users
--     tandem_messages.sender_id                   → auth.users
--     tandem_reports.reporter_id                  → auth.users
--     tandem_reports.tandem_id                    → tandems
--
-- Effacer la ligne `auth.users` emporte donc, en cascade et sans bruit : le
-- tandem entier, la conversation du partenaire restant — ses propres phrases
-- comprises — et les signalements qui portaient sur la relation. Sur un produit
-- qui met en relation des mineurs de 16-17 ans avec des mentors adultes, cela
-- offre à qui a mal agi le moyen le plus simple de faire disparaître la preuve :
-- se supprimer. La cascade transformerait un droit en arme.
--
-- La ligne retenue, et elle est écrite ici pour être opposable :
--
--   **on efface la personne, on garde la relation et la trace.**
--
--   - Ce qui n'est qu'à elle disparaît : journal, progression, préférences,
--     invitations, appartenances, nom, e-mail, moyens de connexion.
--   - Ce qui appartient aussi à un autre reste : les messages qu'elle a laissés
--     dans la conversation de son binôme restent dans cette conversation, sans
--     nom au-dessus. Le droit à l'effacement porte sur ses données
--     personnelles, pas mécaniquement sur la correspondance d'autrui, et le
--     doc 06 range déjà « conservation limitée et documentée des messages
--     signalés » parmi les engagements du produit.
--   - Ce qui sert à protéger quelqu'un reste : signalements, dossiers de
--     modération, journal d'audit. L'en-tête de `20260806180000` avait d'ailleurs
--     prévu le cas et refusé toute clé étrangère à `tandem_report_audit` pour
--     que l'audit survive précisément à ce geste-ci.
--
-- Ce que cet arbitrage coûte, et qu'on assume : le texte des messages non
-- signalés survit à son auteur. Il faut donc le dire à l'écran **avant** le
-- geste (c'est fait : voir `deleteConfirmKeeps` dans `packages/content/copy`),
-- et il reste une dette nommée — une durée de conservation, avec la purge des
-- tandems terminés depuis N mois. Elle n'existe pas ici : elle demande un cron
-- et une décision de durée, pas une RPC.
--
-- ---------------------------------------------------------------------------
-- Comment on empêche alors la reconnexion
-- ---------------------------------------------------------------------------
--
-- Une purge qui laisse la personne se reconnecter n'est pas une purge. Sans
-- suppression de la ligne `auth.users`, il faut donc la neutraliser : e-mail,
-- téléphone, mot de passe et métadonnées d'identité mis à NULL, `banned_until`
-- au loin, `deleted_at` posé — et les sessions ouvertes effacées côté serveur.
-- C'est exactement la forme du « soft delete » que l'API d'administration de
-- GoTrue applique elle-même ; on la reproduit ici parce que ce dépôt n'a aucun
-- composant serveur.
--
-- Trois conséquences, toutes voulues :
--   - plus aucun lien magique ne peut atteindre ce compte : il n'a plus
--     d'adresse ;
--   - l'adresse d'origine redevient libre. La personne peut revenir — ce sera
--     un compte neuf, sans rien de l'ancien. L'écran le dit ;
--   - `auth.users.deleted_at` devient le seul signal de suppression que son
--     propriétaire ne peut pas écrire lui-même. `profiles.account_status` est,
--     lui, à la portée de `profiles_update_own` : s'en servir pour annoncer au
--     partenaire « ce compte a été supprimé » laisserait n'importe qui poser
--     cette phrase sur son propre écran d'en face.
--
-- ⚠️ Ce bloc `auth.*` est le seul de la migration que la pile locale ne prouve
-- pas : le harnais de tests y travaille en `postgres`, superutilisateur, où
-- toute écriture passe quoi qu'il arrive. Sur le projet hébergé, le schéma
-- `auth` appartient à `supabase_auth_admin`. À vérifier avant de pousser, depuis
-- l'éditeur SQL du tableau de bord :
--
--     select has_table_privilege('postgres', 'auth.users', 'update'),
--            has_table_privilege('postgres', 'auth.sessions', 'delete'),
--            has_table_privilege('postgres', 'auth.identities', 'delete');
--
-- Si l'un des trois rend `false`, la fonction lèvera au lieu de mentir : elle
-- est d'un seul tenant, et une transaction qui échoue à la neutralisation de
-- `auth.users` annule aussi les effacements qui précèdent. Aucun compte à
-- moitié supprimé — mais alors plus rien ne se supprime, et il faudra une
-- fonction Edge en `service_role` pour ce dernier pas.

-- ---------------------------------------------------------------------------
-- La pierre tombale
-- ---------------------------------------------------------------------------
--
-- La ligne `profiles` n'est pas effacée, et ce n'est pas un oubli : la
-- fonction `tandem_partenaire()` la lit en `left join`, et un nom NULL y
-- signifie déjà « partenaire sans profil *encore* » — l'écran propose alors
-- d'inviter. Effacer la ligne ferait donc dire à l'écran du partenaire restant
-- exactement le contraire de ce qui s'est passé. On garde une ligne vidée, dont
-- `deleted_at` date l'effacement pour la conservation à venir.

alter table public.profiles
  add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'Date de l''effacement réel des données, posée par supprimer_mon_compte(). À ne pas confondre avec deletion_requested_at, qui date la demande.';

-- ---------------------------------------------------------------------------
-- Le geste
-- ---------------------------------------------------------------------------
--
-- **Sans paramètre**, comme `tandem_est_moderateur()` et `tandem_partenaire()`
-- avant elle, et ici la raison est plus forte encore : c'est la réponse
-- structurelle à « un tiers ne peut pas supprimer autrui ». Il n'y a personne à
-- nommer. Une variante `supprimer_le_compte(uuid)` ne tiendrait qu'à sa garde
-- interne — une ligne qu'un correctif bien intentionné peut relâcher ; ici, il
-- n'y a rien à relâcher.
--
-- `security definer` : la fonction écrit dans `auth.*`, où `authenticated` n'a
-- aucun droit, et efface des lignes que les politiques n'ouvrent pas à la
-- suppression (`tandems` n'a aucun `grant delete`, `tandem_invitations` non
-- plus). `search_path` figé, schémas qualifiés partout. L'identité vient de
-- `auth.uid()` — dans une fonction `security definer`, `current_user` désigne
-- le propriétaire, une garde fondée dessus serait morte.

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
  'Suppression réelle du compte de l''appelant. Sans paramètre — elle lit auth.uid() — parce qu''il n''y a personne d''autre à supprimer. Efface les données personnelles, neutralise auth.users et les sessions, garde les messages laissés chez autrui, les signalements et l''audit. Ne termine pas un tandem bloqué : le blocage survit à son auteur.';

revoke all on function public.supprimer_mon_compte() from public;
revoke all on function public.supprimer_mon_compte() from anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ---------------------------------------------------------------------------
-- Ce que le partenaire restant voit
-- ---------------------------------------------------------------------------
--
-- Sans ce qui suit, l'écran d'en face mentirait de deux façons : le nom vidé
-- passe pour « pas encore de nom » (l'écran propose alors d'inviter quelqu'un
-- qui est déjà là), et le tandem `ended` tombe dans le vocabulaire du blocage
-- côté interface. `tandem_partenaire()` rend donc une colonne de plus.
--
-- Le signal est `auth.users.deleted_at`, jamais `profiles.account_status` :
-- `profiles_update_own` accorde à chacun l'écriture sur sa propre ligne, si
-- bien qu'un compte bien vivant pourrait se déclarer supprimé sur l'écran de
-- son binôme. Personne n'écrit dans `auth.users` sans passer par ici.
--
-- ⚠️ `create or replace function` refuse de changer le type de retour : d'où le
-- `drop` explicite, sans quoi rejouer ce fichier — ce que fait la boucle de
-- vérification par mutation après chaque restauration — échouerait. Le même
-- piège est déjà consigné pour `create or replace view` au doc 21.

drop function if exists public.tandem_partenaire();

create function public.tandem_partenaire()
returns table (tandem_id uuid, display_name text, partenaire_supprime boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id,
         p.display_name,
         u.deleted_at is not null
  from public.tandems t
  left join auth.users u
    on u.id = case
      when t.participant_a_id = auth.uid() then t.participant_b_id
      else t.participant_a_id
    end
  left join public.profiles p
    on p.id = u.id
  where auth.uid() is not null
    and (t.participant_a_id = auth.uid() or t.participant_b_id = auth.uid());
$$;

-- Les deux décisions d'origine tiennent toujours, et les tests les épinglent :
-- le statut du tandem n'est pas filtré (l'écran de blocage nomme la relation
-- qu'il gèle), et les jointures restent `left` (« pas encore de nom » n'est pas
-- « pas de tandem »). La jointure sur `auth.users` est passée en premier parce
-- qu'elle porte désormais la résolution du partenaire ; `profiles` s'y raccroche.

comment on function public.tandem_partenaire() is
  'Le nom du partenaire, pour chaque tandem où figure l''appelant, et si son compte a été supprimé. Sans paramètre — elle lit auth.uid() — pour ne pas devenir un annuaire inversé des profils. Seul chemin de lecture du profil d''autrui : profiles_select_own reste own-only. partenaire_supprime vient de auth.users.deleted_at, hors de portée de son propriétaire, et non de profiles.account_status que chacun peut écrire. Nom NULL = partenaire sans ligne profiles encore. Rend zéro ligne sans identité.';

revoke all on function public.tandem_partenaire() from public;
revoke all on function public.tandem_partenaire() from anon;
grant execute on function public.tandem_partenaire() to authenticated;
