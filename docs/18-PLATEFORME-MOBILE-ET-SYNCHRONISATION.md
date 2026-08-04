# Plateforme mobile et synchronisation

## Décision

Le web actuel reste la surface de développement et de test. La cible mobile
sera une application Expo + React Native, avec Expo Router et EAS Build, afin de
partager le domaine, les contenus, les règles de confidentialité et les
composants de synchronisation sans transformer l'interface web en faux mobile.

## Déjà préparé

- contenu publié versionné dans Supabase avec fallback local par langue ;
- stockage local de l'état de démonstration ;
- cache local du dernier parcours éditorial chargé ;
- file persistante des écritures échouées ;
- rejeu automatique au retour du réseau ;
- progression, journal, messages et préférences de notifications couverts par
  la file.

## Prochaine implémentation native

1. Extraire `domain.ts`, `content.ts` et `offlineQueue.ts` dans un package
   partagé.
2. Créer `apps/mobile` avec Expo Router et les écrans participant.
3. Ajouter les permissions de notifications natives et les deep links
   d'invitation.
4. Tester les conflits de synchronisation sur iOS et Android avant d'ajouter
   les fonctionnalités spécifiques à la plateforme.

Les espaces mentor et église resteront principalement web : ils nécessitent
des écrans larges, des tableaux et des actions d'administration. Le mobile
reste centré sur les séances, le tandem, le journal, les notifications et le
hors-ligne.
