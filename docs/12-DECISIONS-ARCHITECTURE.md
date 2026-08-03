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

## ADR-005 — Vérification manuelle et preuve minimisée

**Statut** : accepté

**Décision** : un opérateur AgapePlay ou une église autorisée vérifie l'âge et
le rôle du mentor à partir d'une pièce contrôlée ou d'une attestation officielle.
Le système conserve le statut, la date, le validateur et le type de preuve, mais
aucune copie de pièce par défaut.

**Raison** : satisfaire le besoin de confiance tout en réduisant le risque lié
au stockage de documents d'identité.

## ADR-006 — Paiements exclusivement sur le web

**Statut** : accepté

**Décision** : Stripe Checkout/Billing est utilisé sur le web pour les offres
personnelles et église. Les apps mobiles ne contiennent aucune surface d'achat
et consomment uniquement les droits synchronisés par le backend.

**Raison** : garder un parcours de paiement unique et maîtrisé. Une revue
Apple/Google spécifique est obligatoire avant publication ; le modèle ne doit
pas être considéré comme automatiquement accepté par les stores.

## ADR-007 — Escalade des incidents impliquant un mineur

**Statut** : accepté

**Décision** : l'église et AgapePlay reçoivent les signalements selon leur rôle.
Un signalement grave impliquant un mineur est automatiquement escaladé à
AgapePlay. Le tandem peut être bloqué immédiatement pendant la revue.

**Raison** : éviter qu'une église soit le seul point de traitement d'un incident
grave et garantir une capacité de réponse plateforme.
