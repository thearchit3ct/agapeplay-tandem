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
- les profils portent aussi les consentements séparés, la confirmation d'âge
  minimum et le statut de demande de suppression ;
- aucun rôle d'église ou mentor n'est encore exposé avant la migration dédiée
  aux permissions.

La fonction `accept_tandem_invitation` vérifie le token, l'adresse email du
compte connecté, l'expiration et l'auto-invitation avant de créer la relation.
Elle s'exécute sous les permissions RLS de l'utilisateur authentifié.
