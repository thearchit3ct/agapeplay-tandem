# Fondation Supabase

Le projet web peut maintenant initialiser un client Supabase avec les variables
Vite suivantes :

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clé publique>
```

La clé historique `anon` est aussi acceptée via `VITE_SUPABASE_ANON_KEY` pour
faciliter la transition vers les clés publishable. Une clé `service_role` ne doit
jamais être ajoutée à l'application web.

## Mise en route du projet

1. Copier `apps/web/.env.example` vers `apps/web/.env.local`.
2. Renseigner l'URL du projet et la clé publique.
3. Exécuter `supabase/migrations/20260804_000001_tandem_foundation.sql` dans le
   SQL Editor Supabase.
4. Configurer les URLs de redirection Auth avant d'activer les liens magiques et
   les fournisseurs OAuth.

Les boutons Google et Microsoft sont disponibles dans l'application.
Chaque fournisseur doit être activé dans Supabase Auth avec ses identifiants et
avec l'URL de redirection de l'application ; tant qu'un fournisseur n'est pas
configuré, son erreur est affichée sans interrompre le mode local.

État du projet distant au 4 août 2026 : le lien magique email est actif ; Google
et Microsoft (Azure) sont encore désactivés. Leur activation nécessite les
identifiants OAuth créés dans les consoles Google Cloud et Microsoft Entra ID,
qui ne doivent jamais être commités dans ce dépôt.

Le bandeau de l'application indique alors que Supabase est configuré. Après
connexion, les séances terminées et le journal privé sont synchronisés avec le
compte distant ; le stockage local reste le filet de sécurité hors connexion.

La migration de fondation a été appliquée au projet distant via le SQL Editor.
Le fichier SQL reste la source de référence pour une nouvelle installation,
même si cette première application n'est pas encore enregistrée dans
l'historique des migrations Supabase.

## Périmètre de la migration

- `profiles` : identité applicative minimale, privée par utilisateur ;
- `session_progress` : séances terminées, sans contenu spirituel ;
- `journal_entries` : notes privées, protégées par RLS ;
- `tandem_invitations` : invitations email privées, expirables et révocables ;
- `tandems` : relation entre deux comptes, avec statut contrôlable ;
- `tandem_messages` : messages privés limités aux membres du tandem ;
- `tandem_reports` : signalements séparés du contenu spirituel, visibles par
  leur auteur et destinés au traitement de modération ;
- `content_journeys` et `content_sessions` : catalogue éditorial publié,
  bilingue et versionnable ;
- `notification_preferences` : rappels séparés par catégorie ;
- `churches`, `church_groups`, `church_members` et `group_members` : première
  fondation des communautés ;
- `mentor_profiles` et `mentor_assignments` : vérification, formation et
  affectation sans exposition du journal privé ;
- `analytics_events` et `community_stats_daily` : événements anonymisés et
  statistiques agrégées ;
- les profils portent aussi les consentements séparés, la confirmation d'âge
  minimum et le statut de demande de suppression ;
- aucun rôle d'église ou mentor n'est encore exposé avant la migration dédiée
  aux permissions.

La fonction `accept_tandem_invitation` vérifie le token, l'adresse email du
compte connecté, l'expiration et l'auto-invitation avant de créer la relation.
Elle s'exécute sous les permissions RLS de l'utilisateur authentifié.
