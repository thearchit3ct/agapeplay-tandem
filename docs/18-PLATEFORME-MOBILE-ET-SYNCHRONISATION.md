# Plateforme mobile et synchronisation

## Décision

Le web actuel reste la surface de développement et de test. La cible mobile
est amorcée dans `apps/mobile` avec Expo SDK 57 + React Native, Expo Router et EAS Build, afin de
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

## Socle natif livré

- accueil mobile participant ;
- routes séance, parcours et tandem ;
- bilingue français/anglais ;
- thème visuel AgapePlay ;
- point d’entrée Supabase pour l’authentification et la synchronisation.

## Prochaine implémentation native

1. Extraire `domain.ts`, `content.ts` et `offlineQueue.ts` dans un package
   partagé.
2. Extraire le thème et les textes partagés, puis connecter les écrans à Supabase.
3. Ajouter les permissions de notifications natives et les deep links
   d'invitation.
4. Tester les conflits de synchronisation sur iOS et Android avant d'ajouter
   les fonctionnalités spécifiques à la plateforme.

Les espaces mentor et église resteront principalement web : ils nécessitent
des écrans larges, des tableaux et des actions d'administration. Le mobile
reste centré sur les séances, le tandem, le journal, les notifications et le
hors-ligne.
