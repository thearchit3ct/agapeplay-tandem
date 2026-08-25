# Construire l'application mobile — 26 août 2026

*Ce document est écrit pour la personne qui lancera la **première** build. Il
dit les commandes exactes, ce que chaque profil produit, et — surtout — la
liste honnête de ce qui n'est pas dans ce dépôt et ne peut pas y être : un
compte Expo, un compte Apple, une console Play.*

Périmètre : issue #13. Le dépôt est prêt à construire ; **aucune build n'a été
lancée**, aucun compte n'est connecté sur la machine où ce texte a été écrit.
Tout ce qui suit a été vérifié dans la limite de ce qui se vérifie sans compte.

---

## Le régime des builds — amendement du 28 août 2026

*Ajouté en tête parce que c'est désormais la première chose à savoir avant de
taper `eas build`. Rien de ce qui suit dans ce document n'est retiré ; deux
phrases sont amendées, et elles le disent à l'endroit où elles se trouvent.*

Le fondateur paie un abonnement Expo, et une build en consomme le crédit. Un
*update* n'en consomme pas. À partir de là, la règle du dépôt tient en une
ligne :

> **Une build ne se lance que pour un changement natif. Tout le reste part par
> les airs.**

`expo-updates` est entré dans le dépôt le 28/08/2026 pour rendre cette phrase
exécutable.

### Ce qui justifie une build, et rien d'autre

Une build est légitime quand le binaire installé sur le téléphone doit changer.
C'est le cas, et seulement le cas, quand :

- une **dépendance native** entre, sort ou change de version — tout ce que
  `npx expo install` pose et qui a du code Android/iOS derrière
  (`expo-notifications`, `react-native-reanimated`, `expo-updates` lui-même…) ;
- une **clé native d'`app.json`** bouge : `plugins`, `scheme`, `permissions`,
  `intentFilters`, `associatedDomains`, `package`, `bundleIdentifier` ;
- l'**icône ou l'écran de démarrage** change — ce sont des ressources compilées
  dans le binaire, pas des images servies au vol ;
- le **SDK Expo** monte d'un cran.

Tout le reste — un écran, une phrase, une couleur, une règle de
`packages/domain`, une requête Supabase, une correction de bug JavaScript — est
un update. Y compris les corrections urgentes : c'est même le cas d'usage qui
paie l'abonnement.

### Les deux commandes

```bash
cd apps/mobile

# Un changement JavaScript — le cas courant, gratuit.
eas update --channel interne --environment production \
  --message "le bilan ne perd plus la réponse au retour"

# Un changement natif — un jalon, une build, du crédit consommé.
eas build --profile internal --platform android --auto-submit
```

Le `--message` est la seule trace lisible de ce qu'un update contient : il
apparaît dans le tableau de bord Expo et c'est ce qu'on relit six semaines plus
tard. Une phrase de produit, pas un hash de commit.

**`--environment production` n'est pas décoratif — c'est la garde la plus
importante de cette commande.** Contrairement à une build, `eas update` fabrique
le bundle **sur la machine qui tape la commande**, avec l'environnement qu'elle
trouve : donc `apps/mobile/.env`, qui n'est pas versionné (voir plus bas, point
2 de « Ce qui attend un humain »). Un `.env` absent, périmé ou pointant sur un
autre projet Supabase produirait un bundle aux mauvaises clés — et cette fois
**il partirait par les airs vers les applications déjà installées**, sans build
pour l'arrêter, avec exactement la panne silencieuse déjà décrite : des écrans
qui disent « connecte-toi » sans fin. Le drapeau ferme ce chemin ; la doc d'Expo
est explicite : « Only the environment variables from the specified environment
will be used during the update process. » Ce sont les variables posées une fois
par `eas env:create --environment production` qui servent, et elles seules.

Ne jamais publier un update sans ce drapeau.

### Le canal relie une build à ses updates

Une build embarque le nom d'un canal, et ne recevra jamais que les updates
publiés sur **ce** canal. Trois profils, trois canaux, posés dans `eas.json` :

| Profil de build | Canal | Qui l'installe |
| --- | --- | --- |
| `internal` | `interne` | la piste interne du Play Store |
| `development` | `developpement` | le dev client sur le téléphone de développement |
| `preview` | `apercu` | l'APK qu'on fait essayer à quelqu'un |

Le canal est écrit **dans le binaire au moment de la build** : on ne change pas
le canal d'une application déjà installée. Publier sur `apercu` n'atteint donc
jamais la piste interne, et c'est la propriété qu'on voulait.

### `runtimeVersion` : la garantie qu'un update n'atteint pas une build incompatible

C'est la pièce qui empêche l'accident dont on ne se relève pas : un bundle
JavaScript qui appelle un module natif absent du binaire, et l'application qui
se ferme au lancement chez tout le monde à la fois.

`app.json` porte donc :

```json
"runtimeVersion": { "policy": "appVersion" }
```

Un update n'est servi qu'aux builds dont le `runtimeVersion` est **exactement**
le sien. Sous la politique `appVersion`, ce runtime **est** le champ `version`
d'`app.json`. Une build 0.3.0 ne reçoit que les updates publiés depuis un arbre
où `version` vaut `0.3.0` ; le jour où l'on passe à 0.4.0 pour ajouter une
dépendance native, les deux populations sont étanches, chacune servie par sa
propre lignée d'updates.

**La conséquence, et c'est la ligne la plus importante de cette section :**

> Sous `appVersion`, `version` dans `app.json` **est** l'identité du runtime.
> La bumper pour un changement purement JavaScript orpheline toutes les builds
> installées : l'update part, n'atteint personne, et ne dit rien. **`version`
> ne bouge qu'à un jalon natif.** Un envoi JavaScript se nomme par son
> `--message`, jamais par un numéro de version.

C'est un écart assumé avec l'habitude du dépôt voisin (Versets Flash, « toujours
bumper après une build »), et avec ce qu'a fait ce dépôt lui-même jusqu'ici —
0.2.0 → 0.2.3 pour du travail JavaScript. Sous EAS Update, ce geste devient
nuisible.

**Et la règle vaut dans l'autre sens, où elle est plus dangereuse encore :**

> **Tout changement natif doit bumper `version`.** L'oublier donne à la nouvelle
> build le même `runtimeVersion` que l'ancienne : les deux populations cessent
> d'être étanches, et le prochain update — bâti contre le nouveau code natif —
> est servi à l'ancien binaire, qui n'a pas les modules qu'il appelle. C'est
> précisément le plantage au lancement pour tout le monde que cette politique
> existe pour empêcher.

La liste « Ce qui justifie une build » plus haut est donc à double emploi : elle
dit quand dépenser un crédit, **et** quand `version` est obligé de bouger. Les
deux gestes sont le même geste.

Sous `appVersion`, ces deux obligations reposent entièrement sur l'humain — la
politique ne déduit rien, elle recopie un champ. C'est le fond de l'arbitrage
avec `fingerprint`, qui automatiserait la détection dans les deux sens : on
échange une machinerie expérimentale contre une discipline écrite. Elle est
écrite ici.

**Pourquoi `appVersion` et pas `fingerprint`.** La politique `fingerprint` calcule
un hash du projet et détecte toute seule qu'un changement est natif : plus
précise, et elle laisserait `version` libre. Deux raisons de ne pas la prendre
ici. La doc d'Expo la donne encore pour expérimentale et `eas update:configure`
écrit `appVersion` par défaut — c'est le chemin éprouvé. Surtout, son mode de
défaillance est mauvais pour un studio d'une personne : un hash qui dérive pour
une raison qu'on ne voit pas dans le diff (une dépendance transitive, un fichier
de configuration), et l'update ne part plus vers les builds existantes **sans
qu'on comprenne pourquoi**. Sous `appVersion`, la même panne existe — mais sa
cause est une ligne visible dans `git diff app.json`, décidée par un humain. On
préfère une règle qu'on peut enfreindre en la voyant à une règle qui se retourne
en silence. La question se rouvrira quand le fingerprint sortira de
l'expérimental.

### Quand l'utilisateur reçoit l'update

Le greffon pose, dans le binaire, `CHECK_ON_LAUNCH = ALWAYS` et
`LAUNCH_WAIT_MS = 0` (valeurs par défaut, vérifiées par
`npx expo config --type introspect`). Concrètement :

1. l'application s'ouvre **immédiatement** sur le bundle déjà en cache — un
   update ne fait jamais attendre devant l'écran de démarrage ;
2. elle demande en tâche de fond s'il existe un update pour son runtime et son
   canal, et le télécharge ;
3. il s'applique **au lancement suivant**.

Donc : **un update publié aujourd'hui est vu au deuxième lancement**, pas au
premier. Ne pas conclure à un update perdu parce qu'il n'est pas là tout de
suite ; rouvrir l'application.

### `autoIncrement` et le versionCode — pourquoi `appVersionSource` est passé à `"remote"`

Le profil `internal` porte `"autoIncrement": true`. Le Play Store refuse un AAB
dont le `versionCode` a déjà été soumis, et ce refus arrive **après** la build :
le crédit est consommé, le binaire est à jeter. Le versionCode tenu à la main a
failli coûter exactement cela (PR #65).

`autoIncrement` seul n'aurait pas suffi. Sous `appVersionSource: "local"`, EAS
incrémente le `versionCode` **dans le fichier `app.json` de la machine qui
lance la build** — et si ce changement n'est pas committé, la build suivante
repart du même numéro. Le piège n'était pas fermé, seulement déplacé d'un cran,
et il retombait sur un rituel humain (« penser à committer ») qui est
précisément ce qui a failli coûter la build.

`appVersionSource` vaut donc `"remote"` : EAS tient `versionCode` et
`buildNumber` sur ses serveurs, `autoIncrement` devient idempotent, aucun
fichier à committer après une build.

**Ce que `remote` ne touche pas :** le champ `version`. Il reste dans `app.json`,
versionné, décidé à la main — ce qui est indispensable, puisque c'est lui qui
porte le `runtimeVersion`. La répartition est nette : `version` est à nous et
gouverne la compatibilité, `versionCode`/`buildNumber` sont à EAS et ne servent
qu'aux stores.

**Un seul point d'attention, à la première build.** `android.versionCode: 2` et
`ios.buildNumber: "2"` restent écrits dans `app.json` alors qu'ils sont désormais
ignorés : ils servent de **semence**. EAS initialise sa version distante à partir
de la valeur locale, et la première build sous `remote` produira donc un
versionCode 3 — au-dessus du 2 déjà présent sur la piste interne. Le vérifier
avant de lancer :

```bash
cd apps/mobile
eas build:version:get --platform android    # doit rendre 2, ou rien (non initialisé)
eas build:version:set --platform android    # au besoin, pour poser explicitement 2
```

### Ce que la v0.2.3 déjà installée ne recevra pas

La build 0.2.3 publiée sur la piste interne **ne contient pas `expo-updates`**.
Aucun update ne l'atteindra jamais, quel que soit le canal : elle n'a pas le code
qui va chercher. Le régime ne commence qu'à la build d'amorçage 0.3.0, qui est
la première à embarquer le moteur. C'est le seul crédit que ce chantier coûte,
et il n'y en aura pas d'autre avant le prochain changement natif.

---

## Ce qui est dans le dépôt

- `apps/mobile/eas.json` — trois profils : `development`, `preview`, `internal`.
- `apps/mobile/app.json` — `version` 0.2.0, `android.versionCode` 1,
  `ios.buildNumber` 1, identifiants d'application posés, liens d'application
  Android (`intentFilters` avec `autoVerify`) et domaine associé iOS.
  *(Au 28/08/2026 : `version` 0.3.0, plus `runtimeVersion` et `updates.url` —
  voir « Le régime des builds ». `versionCode` et `buildNumber` y sont
  désormais des semences, tenues par EAS.)*
- `expo-dev-client` en dépendance, requise par le profil `development`.
- `expo-updates` en dépendance depuis le 28/08/2026 : le moteur des envois par
  les airs. Son greffon est appliqué tout seul, il n'a rien à faire dans
  `plugins`.

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

`appVersionSource` valait `"local"` jusqu'au 28/08/2026 : `app.json` faisait foi
pour `version`, `versionCode` et `buildNumber`, et les incrémenter était un
geste volontaire, versionné. **Il vaut `"remote"` depuis**, et cette phrase n'est
plus vraie que de `version` — le pourquoi est en tête de ce document, section
« Le régime des builds ».

---

## Ce qui a été vérifié sans compte

```bash
cd apps/mobile
npx expo config --type public     # propre : aucun avertissement
npx expo-doctor                   # 19/21 — deux échecs, tous deux antérieurs
npm run mobile:export             # depuis la racine : le bundle Metro passe
```

**`expo-dev-client` change ce que vise `npm run mobile:start`.** Depuis qu'il
est en dépendance, `expo start` s'ouvre en mode *build de développement* et non
en mode Expo Go — l'environnement dans lequel l'équipe a testé jusqu'ici, et que
le doc 21 décrit longuement. Presser `s` dans le terminal bascule d'un mode à
l'autre.

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
