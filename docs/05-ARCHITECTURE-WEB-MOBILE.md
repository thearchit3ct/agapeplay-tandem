# Architecture web et mobile

## Décision recommandée

Construire un monorepo TypeScript avec deux applications et un noyau métier partagé :

- **Web** : Next.js App Router pour le site, l'expérience participant responsive et l'espace mentor/responsable.
- **Mobile natif** : Expo + React Native + Expo Router pour iOS et Android.
- **Backend** : Supabase Auth, PostgreSQL, Row Level Security, Realtime et Edge Functions.
- **Contenu** : package versionné, schémas validés et workflow éditorial.
- **Paiements** : Stripe Checkout/Billing uniquement sur le web ; entitlements
  synchronisés dans le backend et consommés en lecture sur mobile.
- **CI/CD** : GitHub Actions, déploiement web séparé des builds mobiles.

Cette séparation est préférable à une seule interface universelle : le web est plus efficace pour l'administration et les écrans larges ; le mobile natif est plus efficace pour les notifications, le hors ligne, les liens profonds et les usages courts.

## Faisabilité web + mobile natif

Oui, le projet peut partager une grande partie de son code sans faire semblant que les plateformes sont identiques.

### À partager

- modèles de données ;
- validation des formulaires ;
- règles de progression ;
- client API ;
- gestion des droits ;
- catalogue de contenu ;
- noms d'événements analytiques ;
- design tokens ;
- tests métier.

### À différencier

- navigation et shell ;
- notifications ;
- permissions système ;
- offline et synchronisation ;
- tableaux de bord complexes ;
- interactions clavier et accessibilité web ;
- deep links et publication stores.

## Arborescence cible

```text
apps/
  web/                 # Next.js, participant web, mentors, responsables
  mobile/              # Expo Router, iOS et Android
packages/
  domain/              # types, règles métier, use cases purs
  content/             # parcours versionnés et schémas
  api/                 # contrats et clients Supabase
  ui-tokens/           # couleurs, typographie, espacement, motion
  analytics/           # événements et consentement
  test-utils/          # factories, fixtures, helpers
supabase/
  migrations/
  functions/
docs/
  ...
```

## Données et synchronisation

- PostgreSQL est la source de vérité serveur.
- Les actions quotidiennes sont idempotentes afin d'éviter les doubles validations.
- Le mobile stocke localement les séances téléchargées et les actions non synchronisées.
- La synchronisation utilise une file locale et des versions de ligne.
- Les conflits de journal sont résolus en faveur de la version la plus récente uniquement après confirmation ; aucune note ne doit être silencieusement écrasée.
- Les conversations utilisent des canaux privés et des contrôles d'accès côté serveur.
- Les apps mobiles n'exposent aucune surface commerciale : pas de prix, d'achat,
  de gestion d'abonnement ni de lien d'achat web.
- Les webhooks Stripe ne donnent jamais directement un accès ; ils mettent à
  jour une table d'entitlements vérifiée par les politiques d'accès.

## Choix et alternatives

### Web

Next.js App Router est recommandé pour combiner pages publiques, espaces authentifiés, routes et rendu adapté au référencement. Une SPA React simple resterait possible, mais elle serait moins intéressante pour le site public et les parcours partageables.

### Mobile

Expo + React Native permet de livrer iOS et Android depuis un socle TypeScript, avec Expo Router pour la navigation web/native et EAS Build pour les binaires. Des modules natifs dédiés pourront être ajoutés lorsque les notifications ou le hors ligne l'exigeront.

### Backend

Supabase est cohérent pour un MVP : Auth, Postgres et RLS réduisent le nombre de services à assembler. Il faudra cependant traiter les politiques RLS et les canaux Realtime comme du code critique, avec revue et tests dédiés.

## Déploiement cible

- Web : hébergeur compatible Next.js, environnements preview/staging/production.
- Paiement web : Stripe Checkout et Billing, avec webhooks signés et journalisés.
- Backend : Supabase staging et production séparés.
- Mobile : builds internes, TestFlight et Google Play internal testing avant publication.
- Secrets : jamais dans Git ; secrets séparés par environnement.
- Observabilité : erreurs, performance et événements de produit soumis au consentement approprié.

## Références techniques

- [Next.js App Router](https://nextjs.org/docs/app)
- [Expo Router](https://docs.expo.dev/versions/latest/sdk/router/)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [React Native — code spécifique aux plateformes](https://reactnative.dev/docs/platform-specific-code.html)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime et canaux privés](https://supabase.com/docs/guides/realtime/getting_started)
