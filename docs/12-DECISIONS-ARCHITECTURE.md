# Décisions d'architecture

## ADR-001 — Deux interfaces, un noyau métier partagé

**Statut** : proposé

**Décision** : utiliser Next.js pour le web et Expo/React Native pour le mobile, avec des packages TypeScript partagés.

**Contexte** : l'espace mentor et responsable bénéficie du web ; les défis courts, notifications, hors ligne et deep links bénéficient du natif.

**Conséquences positives** : meilleure ergonomie par plateforme, publication mobile cohérente, réutilisation du domaine et des contrats.

**Coût** : deux shells d'interface, deux matrices de tests et une discipline de partage nécessaire.

## ADR-002 — Supabase pour le MVP backend

**Statut** : proposé

**Décision** : utiliser Supabase Auth, Postgres, RLS, Realtime et Edge Functions.

**Contexte** : le produit demande authentification, permissions relationnelles, synchronisation et messagerie légère.

**Risque principal** : une mauvaise politique RLS peut exposer des journaux ou messages. Les migrations et politiques seront donc testées comme du code de sécurité.

## ADR-003 — Pas de matching ouvert au lancement

**Statut** : accepté

**Décision** : une relation est créée par invitation explicite ou rattachement supervisé à une communauté.

**Raison** : réduire les risques d'abus, de harcèlement, d'usurpation et de relation adulte-mineur non contrôlée.

## ADR-004 — Le journal est privé par défaut

**Statut** : accepté

**Décision** : le participant choisit explicitement le contenu partagé et le destinataire.

**Raison** : les informations spirituelles et personnelles peuvent être sensibles ; la confiance est une fonctionnalité, pas un texte de politique caché.
