# Construire l'application mobile — 26 août 2026

*Ce document est écrit pour la personne qui lancera la **première** build. Il
dit les commandes exactes, ce que chaque profil produit, et — surtout — la
liste honnête de ce qui n'est pas dans ce dépôt et ne peut pas y être : un
compte Expo, un compte Apple, une console Play.*

Périmètre : issue #13. Le dépôt est prêt à construire ; **aucune build n'a été
lancée**, aucun compte n'est connecté sur la machine où ce texte a été écrit.
Tout ce qui suit a été vérifié dans la limite de ce qui se vérifie sans compte.

---

## Ce qui est dans le dépôt

- `apps/mobile/eas.json` — trois profils : `development`, `preview`, `internal`.
- `apps/mobile/app.json` — `version` 0.2.0, `android.versionCode` 1,
  `ios.buildNumber` 1, identifiants d'application posés, liens d'application
  Android (`intentFilters` avec `autoVerify`) et domaine associé iOS.
- `expo-dev-client` en dépendance, requise par le profil `development`.

## Ce qui attend un humain — rien de tout cela n'est contournable

1. **Un compte Expo** (gratuit) et `eas login`. Sans lui, aucune commande de
   build ne part. La première exécution demandera aussi de créer le projet EAS
   et écrira un `extra.eas.projectId` dans `app.json` : c'est normal, il faut
   le committer.
2. **Les variables d'environnement de build.** L'application lit
   `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Elles vivent
   dans `apps/mobile/.env`, qui n'est **pas** versionné et **ne monte pas** dans
   une build EAS. Il faut donc les déclarer côté EAS, une fois :

   ```bash
   cd apps/mobile
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://…supabase.co" --environment production --visibility plaintext
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "…" --environment production --visibility plaintext
   ```

   Sans elles, l'application se construit et se lance, mais `supabase` vaut
   `null` : ni connexion, ni journal, ni tandem. C'est silencieux — les écrans
   disent simplement « connecte-toi » sans fin.
3. **Un compte Apple Developer (99 $/an)** pour toute build iOS, y compris
   interne. Il n'y a pas de contournement : une build iOS sur appareil réel
   exige un profil de provisionnement signé par un compte payant. Le profil
   `preview` construit pour le **simulateur** sans compte payant, et c'est le
   seul chemin iOS gratuit.
4. **Une Play Console (25 $, une fois)** pour distribuer l'AAB du profil
   `internal` en test interne. L'APK du profil `preview`, lui, s'installe
   directement sur un téléphone Android sans aucun compte.
5. **L'icône et l'écran de démarrage.** `app.json` ne déclare **ni `icon`, ni
   `splash`**, et `apps/mobile/assets/` n'existe pas. Aucune icône n'a été
   inventée ici : le logo AgapePlay existe côté studio, et c'est lui qu'il faut
   déposer. En attendant, les builds portent l'icône par défaut d'Expo — ce qui
   est acceptable pour un test interne, et ne l'est pas pour une soumission.
6. **`https://tandem.agapeplay.store/.well-known/assetlinks.json`** — voir la
   section « liens d'application » plus bas. Le fichier ne peut être écrit
   qu'après la première build Android, qui produit l'empreinte à y mettre.

---

## Les trois profils

| Profil | Ce qu'il produit | À quoi il sert |
| --- | --- | --- |
| `development` | Un *dev client* (APK Android / app iOS signée) | Développer avec Metro, **hors d'Expo Go** : c'est le seul environnement où les notifications et le schéma `agapeplay://` existent vraiment |
| `preview` | APK Android installable ; iOS pour **simulateur** | Faire essayer l'application sans compte Apple payant |
| `internal` | AAB Android ; iOS signée pour distribution interne | Test interne Play Console et TestFlight |

```bash
cd apps/mobile

eas login                                             # par un humain, une fois

eas build --profile development --platform android
eas build --profile development --platform ios

eas build --profile preview --platform android        # APK, aucun compte Apple requis
eas build --profile preview --platform ios            # simulateur

eas build --profile internal --platform android       # AAB pour la Play Console
eas build --profile internal --platform ios           # TestFlight
```

`appVersionSource: "local"` dans `eas.json` : c'est `app.json` qui fait foi pour
`version`, `versionCode` et `buildNumber`. Les incrémenter est un geste
volontaire, versionné — pas une décision d'un serveur de build.

---

## Ce qui a été vérifié sans compte

```bash
cd apps/mobile
npx expo config --type public     # propre : aucun avertissement
npx expo-doctor                   # 19/21 — deux échecs, tous deux antérieurs
npm run mobile:export             # depuis la racine : le bundle Metro passe
```

`npm run mobile:export` est **la seule garde réelle** de ce dépôt : Metro ne
surveille pas les fichiers sur la machine de développement, et
`mobile:typecheck` ne prouve pas la résolution des modules d'un workspace.

### Les deux échecs d'`expo-doctor`, et ce qu'ils valent

1. **Doublon de `react` / `react-dom`.** `apps/mobile` épingle `react@19.2.3`
   (la version attendue par le SDK 57), `apps/web` demande `^19.2.8` : npm
   installe donc les deux, une copie par workspace. Une build native ne doit
   embarquer qu'une version d'un module natif — **à vérifier avant la première
   build**. Le remède est d'épingler `apps/web` sur la même version exacte, ce
   qui n'a pas été fait ici : c'est une décision qui touche l'application web
   déployée, pas un chantier mobile.
2. **`@react-native-async-storage/async-storage@3.1.1`** là où le SDK attend
   `2.2.0`, et `typescript@5.9.3` là où il attend `~6.0.3`. Antérieur à ce
   chantier, inchangé. Le premier est le plus sensible : AsyncStorage est un
   module natif, et son repli mémoire est déjà un contournement d'un bug mesuré
   (« Native module is null », voir `apps/mobile/src/storage.ts`).

`newArchEnabled` a été retiré d'`app.json` au passage : la propriété n'existe
plus dans le schéma du SDK 57 (la nouvelle architecture y est le seul mode), et
elle faisait échouer le contrôle de configuration — celui-là même qu'on veut
propre avant une build.

---

## Les notifications : locales, jamais poussées

L'application pose deux rappels **sur l'appareil** :

- la séance du jour, tous les jours à 8 h — `notification_preferences.sessions` ;
- le bilan de fin de semaine, le samedi à 11 h —
  `notification_preferences.weekly_checkin`.

Un réglage coupé **annule** la planification ; la règle est pure, testée
(`packages/domain/src/notifications.ts`), et l'appareil se contente de
l'exécuter.

**Il n'y a aucun push serveur, et il ne peut pas y en avoir aujourd'hui** : ce
produit n'a pas de composant serveur capable de décider d'écrire à quelqu'un.
Un message reçu ou une nouvelle de communauté ne déclenchent donc rien tant que
l'application n'est pas ouverte. C'est un écart nommé, pas un oubli — et le
jour où un ordonnanceur existera, il se soldera avec la dette de purge et les
relances de mentor, déjà recensées au doc 21.

Conséquence pratique pour la build : **les notifications n'existent pas dans
Expo Go** (l'import seul d'`expo-notifications` y jette depuis le SDK 53). Les
éprouver demande le profil `development`.

---

## Les liens d'application

Le lien qu'un jeune reçoit est celui du web :

- tandem : `https://tandem.agapeplay.store/?invite=<jeton>` ;
- communauté : `https://tandem.agapeplay.store/?communaute=<jeton>`.

### Android

`app.json` déclare un `intentFilter` `autoVerify` sur l'hôte
`tandem.agapeplay.store`, **chemin exact `/`** — et non `pathPrefix: "/"`. La
distinction est délibérée : un filtre par préfixe capterait aussi
`https://tandem.agapeplay.store/confidentialite`, que le doc 28 exige de
pouvoir ouvrir **dans un navigateur** pour la revue des stores. Les filtres
d'intention ne regardent jamais la requête (`?invite=…`) : seuls le schéma,
l'hôte et le chemin comptent, et c'est pourquoi le chemin doit rester exact.

Après la première build Android, récupérer l'empreinte du certificat :

```bash
eas credentials --platform android      # → SHA-256 de la clé de signature
```

puis servir, à la racine du domaine, `/.well-known/assetlinks.json` :

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.agapeplay.tandem",
      "sha256_cert_fingerprints": ["<EMPREINTE SHA-256 À COMPLÉTER APRÈS LA PREMIÈRE BUILD>"]
    }
  }
]
```

Le fichier doit être servi en `application/json`, sans redirection, en HTTPS.
Tant qu'il n'existe pas, Android ouvre le lien dans le navigateur — ce qui
**fonctionne** : le site web accepte le même jeton. Rien n'est cassé en
attendant, et c'est la propriété qu'on voulait.

### iOS

`ios.associatedDomains` déclare `applinks:tandem.agapeplay.store`. La capacité
« Associated Domains » exige un compte Apple Developer payant, et le fichier
`/.well-known/apple-app-site-association` demandera l'App ID complet
(`<TEAM_ID>.com.agapeplay.tandem`), inconnu tant qu'aucune équipe Apple
n'existe. **Attente humaine**, à traiter avec le point 3 plus haut.

### Ce qui marche déjà, sans rien de tout cela

- `agapeplay:///invite?token=…` dans un build installé ;
- `exp://…/--/invite?token=…` dans Expo Go ;
- le lien web dans un navigateur, sur un téléphone sans l'application.

La lecture des quatre formes est une règle pure et testée
(`packages/domain/src/liens.ts`). Un lien ouvert **sans compte** n'est pas
perdu : le jeton est retenu sur l'appareil et joué dès la connexion.

---

## Après la première build — ce qu'il faudra vérifier sur l'appareil

Rien de ce qui suit ne peut être prouvé depuis ce dépôt.

1. Le lien magique de connexion (déjà éprouvé le 24/08 sur Android réel).
2. Un rappel qui arrive vraiment — couper la préférence depuis le navigateur,
   et vérifier que le téléphone cesse de le poser.
3. Un lien `https://tandem.agapeplay.store/?invite=…` qui ouvre l'application
   après publication d'`assetlinks.json` (Android).
4. L'export : le fichier passe-t-il bien par la feuille de partage, et
   contient-il les mêmes sections que celui du navigateur ?
5. La suppression de compte, de bout en bout, sur un compte jetable — c'est le
   geste que l'App Store contrôle (règle 5.1.1(v)).
6. Une séance déjà ouverte, relue en mode avion.
