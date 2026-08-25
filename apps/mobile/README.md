# AgapePlay Tandem Mobile

Application mobile participant iOS/Android basée sur Expo Router et React Native.

## Démarrage

```bash
cd apps/mobile
npm install
npm run start
```

Copier `.env.example` vers `.env` et renseigner les variables Supabase avant d’activer l’authentification.

## Périmètre

- écran d’accueil : la séance publiée du jour, le bilan de fin de semaine, les réglages de rappel et de mesure ;
- parcours et séance : **contenu publié**, gardé en cache sur le téléphone et lisible hors ligne (depuis le 26/08/2026) ;
- conversation du tandem : lecture du fil, envoi, blocage et signalement (depuis le 24/08/2026) ;
- journal privé : écrire, relire, supprimer, partager une entrée à son binôme et la retirer (depuis le 26/08/2026) ;
- « Mon compte » : emporter ses données, se déconnecter partout, supprimer son compte (depuis le 26/08/2026) ;
- invitations par lien — tandem et communauté — retenues jusqu’à la connexion ;
- rappels locaux, séance et bilan, pilotés par `notification_preferences` ;
- bilingue français/anglais ;
- thème AgapePlay partagé dans l’esprit de l’application web.

Les espaces mentor et responsable de communauté restent volontairement sur le web.

## Construire l’application

Voir [`docs/29-BUILD-MOBILE.md`](../../docs/29-BUILD-MOBILE.md) : les trois profils EAS, les commandes exactes, et ce qui attend un compte humain.
