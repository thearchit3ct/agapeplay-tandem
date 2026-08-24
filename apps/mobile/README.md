# AgapePlay Tandem Mobile

Application mobile participant iOS/Android basée sur Expo Router et React Native.

## Démarrage

```bash
cd apps/mobile
npm install
npm run start
```

Copier `.env.example` vers `.env` et renseigner les variables Supabase avant d’activer l’authentification.

## Périmètre du premier socle

- écran d’accueil mobile et rituel du jour ;
- navigation vers parcours, séance et tandem ;
- conversation du tandem : lecture du fil et envoi de messages (depuis le 24/08/2026) ;
- bilingue français/anglais ;
- thème AgapePlay partagé dans l’esprit de l’application web ;
- point d’entrée Supabase prêt pour l’authentification et la synchronisation.

Les espaces mentor et église restent volontairement sur le web dans cette première itération.
