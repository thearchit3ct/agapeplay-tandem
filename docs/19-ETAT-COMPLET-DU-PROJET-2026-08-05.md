# État complet du projet AgapePlay Tandem

> ⚠️ **Document daté du 5 août 2026, antérieur à la campagne de sécurité du 6.**
> Sa description de l'état du projet — notamment sur les tests, les politiques
> RLS et le backlog — n'est plus exacte. Pour l'état réel, lire
> [`21-ETAT-DU-PROJET-2026-08-06.md`](./21-ETAT-DU-PROJET-2026-08-06.md).
> Il reste utile pour ce qu'il dit de la vision et du périmètre produit.

**Dernière mise à jour :** 5 août 2026  
**Dépôt :** `thearchit3ct/agapeplay-tandem`  
**Branche publiée :** `main`  
**Dernier commit :** `15a48cd` — notifications mobiles et deep links d’invitation

## 1. Résumé exécutif

AgapePlay Tandem est un espace chrétien de discipulat accompagné pour
adolescents et adultes. Le produit met en relation un participant et une
personne de confiance autour de parcours courts, d’un journal privé et d’une
conversation privée.

Le projet dispose maintenant de :

- une application web React/Vite connectable à Supabase ;
- une fondation de données et de sécurité avec RLS ;
- un premier parcours éditorial publié en français et en anglais ;
- une expérience participant web fonctionnelle ;
- une première expérience mobile Expo/React Native ;
- des invitations, messages privés, blocage et signalement ;
- une synchronisation hors ligne web et mobile pour la progression ;
- des rappels locaux mobiles et des deep links d’invitation ;
- des espaces mentor et église amorcés côté web.

Le produit n’est pas encore prêt pour une publication publique. Les
principaux travaux restants concernent le partage de code web/mobile, les
permissions métier complètes, les notifications distantes, les tests sur
appareils réels, la conformité et les déploiements.

## 2. Décisions produit

| Sujet | Décision |
|---|---|
| Public | Adolescents à partir de 16 ans et adultes |
| Langues au lancement | Français et anglais |
| Mentor | Vérifié par une église ou AgapePlay, avec âge et formation vérifiés |
| Mineurs | Parcours mentor uniquement pour les 16–17 ans concernés |
| Journal | Privé par défaut, jamais visible automatiquement par le mentor |
| Conversation | Privée entre les membres du tandem ; redirection WhatsApp possible plus tard |
| Éditeurs | AgapePlay, églises et auteurs partenaires validés |
| Modèle économique | Modèle mixte ; paiements et abonnements sur le web uniquement |
| Paiement prévu | Stripe, à intégrer après la fondation produit |
| IA | Aucune IA dans le MVP |
| Statistiques | Globales, agrégées et anonymisées |
| Authentification | Email/lien magique ; Google et Microsoft préparés ; Apple retiré du MVP |
| Mobile | Expo + React Native + Expo Router |
| Backend | Supabase |
| Web | React 19 + TypeScript + Vite |

## 3. Ce qui est livré côté web

### 3.1 Expérience participant

- Accueil quotidien avec séance principale.
- Navigation Aujourd’hui, Parcours, Tandem, Journal, Mentor et Église.
- Parcours éditorial avec progression locale et distante.
- Flux de séance en trois étapes : lecture, pratique, fin.
- Réflexion facultative enregistrée dans le journal privé.
- Reprise d’une séance sans perte de progression.
- Interface française et anglaise pour l’application et le premier contenu.
- Design rétro noir et blanc avec accent cuivre, responsive et orienté mobile.

### 3.2 Parcours éditoriaux

Les parcours ne sont plus uniquement mockés dans le composant :

- `content_journeys` contient les parcours publiés ;
- `content_sessions` contient les séances ordonnées ;
- les contenus sont filtrés par langue et statut publié ;
- le dernier parcours distant est mis en cache localement ;
- un fallback local permet de continuer si Supabase est indisponible.

Un parcours `repartir-avec-jesus` et trois séances de démonstration ont été
insérés dans Supabase. Le parcours complet de six semaines reste à produire,
relire et traduire.

### 3.3 Authentification et confiance

- Connexion par lien magique email.
- Entrées Google et Microsoft présentes dans l’interface web.
- Consentement séparé pour l’âge, la confidentialité et les conditions.
- Confirmation d’âge minimum de 16 ans.
- Statut de compte et demande de suppression enregistrables.
- Aucun secret serveur ou `service_role` dans le frontend.

État distant constaté : le lien magique email fonctionne. Google et Microsoft
restent désactivés dans Supabase Auth tant que les identifiants des consoles
respectives ne sont pas fournis. Apple a été explicitement retiré du MVP.

### 3.4 Tandem et sécurité relationnelle

- Création d’une invitation email privée.
- Token expirant après sept jours.
- Acceptation protégée par la RPC `accept_tandem_invitation`.
- Vérification de l’adresse du compte, de l’expiration et de l’auto-invitation.
- Statuts de tandem : actif, en pause, bloqué et terminé.
- Conversation limitée aux membres du tandem.
- Blocage depuis la conversation.
- Signalement séparé du contenu privé.
- RLS sur les invitations, tandems, messages et signalements.

### 3.5 Hors ligne et synchronisation web

La file locale couvre actuellement :

- progression de séance ;
- entrées de journal ;
- messages de tandem ;
- préférences de notifications.

Les écritures échouées sont conservées en `localStorage`, puis rejouées au
retour du réseau et après reconnexion. Un bandeau informe l’utilisateur du
mode hors ligne et du nombre d’opérations en attente.

### 3.6 Notifications web

Les préférences sont configurables séparément pour :

- séances quotidiennes ;
- messages du tandem ;
- vie de l’église ;
- rappel après absence.

Elles sont stockées dans `notification_preferences`. Les notifications web
réelles et les workers push restent à implémenter.

### 3.7 Espaces mentor et église

La navigation et les premiers états métier sont présents :

- lecture du statut de vérification mentor ;
- lecture du statut de formation obligatoire ;
- lecture de l’appartenance à une église ;
- lecture du rôle communautaire ;
- comptage des groupes actifs ;
- affichage d’un état vide si aucun rattachement n’existe ;
- rappel explicite de la confidentialité du journal et des conversations.

Ce ne sont pas encore des tableaux de bord complets. Aucun droit
d’administration fictif n’est accordé depuis l’interface.

## 4. Ce qui est livré côté Supabase

Les migrations locales sont dans `supabase/migrations/` et couvrent :

- `profiles` ;
- `session_progress` ;
- `journal_entries` ;
- `tandem_invitations` ;
- `tandems` ;
- `tandem_messages` ;
- `tandem_reports` ;
- `content_journeys` ;
- `content_sessions` ;
- `notification_preferences` ;
- `churches` ;
- `church_groups` ;
- `church_members` ;
- `group_members` ;
- `mentor_profiles` ;
- `mentor_assignments` ;
- `analytics_events` ;
- `community_stats_daily`.

Les protections RLS ont été activées. La revue Supabase des alertes de sécurité
ne signalait aucune alerte au dernier contrôle effectué. Cette vérification
doit être répétée après chaque changement de politique ou de fonction.

## 5. Ce qui est livré côté mobile

Le dossier `apps/mobile` contient une application Expo SDK 57 :

- Expo Router et routes typées ;
- accueil participant ;
- route séance ;
- route parcours ;
- route tandem ;
- route authentification ;
- route d’acceptation d’invitation ;
- thème mobile AgapePlay ;
- bilingue français/anglais ;
- Supabase avec session persistante AsyncStorage ;
- lien magique mobile ;
- file locale de progression ;
- rejeu vers `session_progress` ;
- rappel quotidien local configurable ;
- schéma `agapeplay://` pour les deep links.

Commandes disponibles :

```bash
npm run mobile:start
npm run mobile:typecheck
npm run mobile:export
```

L’export web Expo et le typecheck passent. Aucun build iOS ou Android signé
n’a encore été produit, car les comptes Apple Developer, Google Play et les
identifiants de signature ne sont pas configurés.

## 6. Vérifications déjà effectuées

À chaque tranche publiée récente :

- `npm run mobile:typecheck` ;
- `npm run mobile:export` ;
- `npm run build` pour l’application web ;
- `git diff --check` ;
- vérification que `main` est propre après publication.

Le dépôt contient actuellement dix vulnérabilités `moderate` signalées par
`npm audit` dans l’arbre Expo. Elles doivent être analysées avant une bêta
publique ; un `npm audit fix --force` ne doit pas être lancé sans revue des
changements majeurs.

## 7. Ce qui reste à faire

### Priorité 0 — rendre le socle réellement partageable

1. Créer `packages/domain` partagé entre web et mobile.
2. Déplacer les types, le catalogue éditorial et les contrats de progression.
3. Partager les textes et les règles de synchronisation sans coupler les UI.
4. Faire charger le contenu Supabase publié dans l’application mobile.
5. Remplacer les contenus statiques mobiles par le cache éditorial versionné.

### Priorité 1 — terminer l’expérience participant

1. Connecter le journal mobile à `journal_entries`.
2. Connecter les messages mobiles à `tandem_messages`.
3. Afficher les invitations reçues et les statuts de tandem.
4. Ajouter la révocation et le changement de binôme.
5. Ajouter les conflits de synchronisation et l’idempotence testée.
6. Ajouter les notifications push distantes et les préférences synchronisées.
7. Ajouter le check-in hebdomadaire et les rappels de reprise sans culpabilisation.

### Priorité 2 — espaces mentor et église

1. Construire la liste des participants autorisés pour chaque mentor.
2. Ajouter les signaux d’activité minimaux : actif, à relancer, demande d’aide.
3. Ajouter l’action d’encouragement sans exposer le journal privé.
4. Construire la création d’église, groupes et cohortes.
5. Ajouter les invitations par lien ou QR code.
6. Implémenter les rôles et leurs permissions serveur complètes.
7. Alimenter `community_stats_daily` par des agrégations contrôlées.
8. Construire la formation mentor et son suivi.
9. Ajouter la vérification manuelle et les statuts de révocation/expiration.

### Priorité 3 — contenu, recherche et partenariats

1. Produire les six semaines de `Repartir avec Jésus`.
2. Faire relire le contenu théologique et les traductions.
3. Documenter les droits des références bibliques utilisées.
4. Conduire les entretiens participants, mentors et responsables.
5. Tester le vocabulaire et le positionnement.
6. Étudier officiellement l’intégration Alpha sans copier de contenu protégé.
7. Préparer les parcours partenaires et la gouvernance éditoriale.

### Priorité 4 — qualité, conformité et publication

1. Ajouter CI GitHub Actions : typecheck, build, tests et smoke tests.
2. Ajouter les tests RLS et les tests de non-divulgation.
3. Tester VoiceOver, TalkBack, clavier et contrastes.
4. Tester iOS et Android sur appareils réels.
5. Configurer TestFlight et Google Play internal testing.
6. Préparer la politique de confidentialité, le DPIA et les procédures de suppression.
7. Préparer Apple Privacy Nutrition Labels et Google Play Data Safety.
8. Configurer crash reporting sans contenu privé.
9. Déployer le web sur Vercel et documenter les variables d’environnement.
10. Préparer EAS Build pour les builds mobiles.

## 8. État des issues GitHub

Les 27 issues initiales sont toujours ouvertes, car leurs critères complets ne
sont pas encore tous remplis. Les issues suivantes ont reçu des annotations de
progression :

- [#5](https://github.com/thearchit3ct/agapeplay-tandem/issues/5) — monorepo web/mobile : shell livré, package partagé restant ;
- [#10](https://github.com/thearchit3ct/agapeplay-tandem/issues/10) — invitations et binôme : deep link mobile livré, cycle complet restant ;
- [#13](https://github.com/thearchit3ct/agapeplay-tandem/issues/13) — mobile/offline/notifications : shell, offline progression, rappel local et deep link livrés ;

| Issue | Sujet | État réel |
|---:|---|---|
| 1–2 | Recherche participants et positionnement | À faire |
| 3 | Threat model et protection des données | Fondation partielle, revue complète à faire |
| 4 | Gouvernance éditoriale | À faire |
| 5 | Monorepo web/mobile | Partiel |
| 6 | Modèle de données et RLS | Fondation livrée, tests formels à faire |
| 7 | Authentification, consentements, suppression | Partiel |
| 8 | Parcours Repartir avec Jésus | Démo partielle, contenu complet à faire |
| 9 | Séance quotidienne et progression | Web livré, mobile partiel |
| 10 | Invitation et gestion du binôme | Partiel |
| 11 | Journal privé et partage explicite | Web partiel, mobile à faire |
| 12 | Communication sûre, blocage, signalement | Fondation livrée, workflow complet à faire |
| 13 | Mobile, offline, notifications, deep links | Partiel avancé |
| 14 | Expérience web et shell mentor | Participant livré, mentor partiel |
| 15 | CI et tests cross-platform | À faire |
| 16 | Tableau de suivi mentor | À faire |
| 17 | Communautés, groupes et cohortes | Schéma + état UI, fonctionnalités à faire |
| 18 | Check-in et rappels doux | Préférences seules, à faire |
| 19 | Modération et incidents | Signalement/blocage fondés, procédure à faire |
| 20 | Métriques respectueuses | Schéma prévu, ingestion et dashboard à faire |
| 21 | Validation mobile et publication interne | À faire |
| 22 | Pilote avec 2 à 4 églises | À faire |
| 23 | Conformité stores et confidentialité | À faire |
| 24 | Localisation anglaise | Interface et démo partiellement livrées |
| 25 | Liens Versets Flash / Alléluia! | À faire |
| 26 | Assistance IA éditoriale | Hors MVP, à ne pas démarrer avant décision |
| 27 | Intégration Alpha | Étude partenaire à faire |

## 9. Conditions nécessaires avant une bêta

La bêta ne devrait pas être ouverte avant d’avoir :

- un parcours complet relu en français et en anglais ;
- les permissions mentor/église testées côté serveur ;
- la procédure de vérification et de formation mentor ;
- les tests de non-divulgation du journal et des conversations ;
- les builds iOS/Android internes ;
- une politique de confidentialité et une procédure de suppression validées ;
- un pilote avec des utilisateurs réels et consentants ;
- une stratégie de support et de modération humaine.

## 10. Ordre recommandé pour la suite

1. Package partagé `domain` + contenu Supabase dans le mobile.
2. Journal et tandem mobiles réellement connectés.
3. Tests RLS et CI minimale.
4. Mentor et groupes avec permissions serveur.
5. Notifications push et tests appareils réels.
6. Parcours éditorial complet et pilote église.
7. Vercel, EAS, conformité stores et bêta privée.

## 11. Références du dépôt

- `docs/04-SPECIFICATION-FONCTIONNELLE.md` — spécification produit.
- `docs/06-DONNEES-SECURITE-CONFIANCE.md` — données et confiance.
- `docs/07-CONTENU-EDITORIAL.md` — gouvernance éditoriale.
- `docs/11-ISSUE-MAP.md` — carte initiale des issues.
- `docs/13-INTEGRATION-ALPHA.md` — intégration Alpha.
- `docs/17-SUPABASE-FONDATION.md` — fondation Supabase.
- `docs/18-PLATEFORME-MOBILE-ET-SYNCHRONISATION.md` — stratégie mobile.
