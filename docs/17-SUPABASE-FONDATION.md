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
4. Configurer les URLs de redirection Auth avant d'activer les liens magiques.

Le bandeau de l'application indique alors que Supabase est configuré, mais le
mode de démonstration reste actif tant que l'authentification et la
synchronisation ne sont pas branchées dans les dépôts applicatifs.

## Périmètre de la migration

- `profiles` : identité applicative minimale, privée par utilisateur ;
- `session_progress` : séances terminées, sans contenu spirituel ;
- `journal_entries` : notes privées, protégées par RLS ;
- aucun rôle d'église, mentor ou tandem n'est encore exposé avant la migration
  dédiée aux relations et aux permissions.
