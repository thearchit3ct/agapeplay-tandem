# État du projet — 25 août 2026, au soir

*Ce document succède au doc 21 (06/08), devenu une tour d'amendements à force
d'être vrai. Comme lui, il dit ce qui EST, pas ce qui devrait être. Le doc 21
reste la trace des décisions de la quinzaine ; celui-ci est le point de départ
de la suite.*

En dix-neuf jours, le dépôt est passé d'un plan de reprise à un produit
complet : 31 pull requests fusionnées (#37 à #67), 17 issues fermées sur 27,
trois versions publiées sur le Play Store, une CI qui garde chaque PR.

---

## 1. Le produit, tel qu'il tourne

**Web** — `https://tandem.agapeplay.store` (v0.1.18). Tous les écrans :
parcours 30 séances (écrit, validé par le fondateur), journal + partage au
binôme, conversation avec blocage/signalement catégorisé, bilan hebdomadaire,
invitations, communautés/groupes/rôles, espace mentor à signaux minimaux,
modération avec audit immuable, compte (export, suppression réelle,
déconnexion globale), politique de confidentialité publique
(`/confidentialite`, fr+en). Navigation clavier complète, responsive prouvé
au harnais de 375 px à l'écran large.

**Mobile** — Android, piste interne du Play Store (v0.3.0, versionCode 3).
Barre d'onglets NATIVE (Aujourd'hui / Parcours / Journal / Tandem), clavier
géré (bord-à-bord SDK 54+ compensé), squelettes de chargement, feuilles de
bas d'écran natives, haptique à grammaire documentée, animations de présence
(Reanimated), zoom d'Apple sur les cartes de séance (iOS 18+ seulement — pas
d'imitation Android), parcours en cache hors ligne, deep links d'auth et
d'invitation prouvés sur appareil, icône/splash au visuel du fondateur.
L'espace mentor et la communauté restent web-first ; le mobile le dit.

**Base** — Supabase (projet `syzqibcbxyruumtcfpgm`), 24+ migrations toutes
appliquées. Toute la sécurité est prouvée par 267+ tests RLS avec témoins
positifs et vérification par mutation sur base vivante. E-mails par Resend
(`AgapePlay Tandem <tandem@agapeplay.store>`, 60/h). Le lien magique ouvre
directement l'application installée (`agapeplay:///`, prouvé côté serveur).

---

## 2. La chaîne de livraison

```
code → PR → CI (3 jobs, ~2 min 30, zéro secret) → merge
     → natif ?  eas build --profile internal --platform android --auto-submit
                → Play Store piste interne, publié SANS CLIC
     → JS ?     eas update --channel interne --environment production
                → sur les téléphones au 2e lancement, zéro crédit
```

- **CI** (`.github/workflows/ci.yml`) : tests métier/lint/typage/fumée web ;
  typage + export mobile ; suite RLS complète avec pile Supabase jetable
  provisionnée dans le runner. Aucun secret requis, par construction.
- **Web** : build local avec les `VITE_*` figées, déploiement du `dist/`
  depuis `/home/admin/tandem-web-deploy` (Vercel, réécritures SPA). Pas de
  git-integration : rebuild + deploy à chaque merge web.
- **Mobile** : voir le doc 29 (« Le régime des builds ») — c'est la référence
  des commandes. Résumé de la doctrine, décidée le 25/08 avec l'abonnement
  Expo : **une build EAS ne se lance que pour du natif** (dépendance native,
  config `app.json` native, icône/splash, bump SDK), une seule par jalon, sur
  le seul profil `internal`. Tout le reste part en update. `runtimeVersion =
  appVersion` : la `version` d'`app.json` est l'identité du runtime — on ne
  la bumpe QUE pour du natif, et on la bumpe TOUJOURS pour du natif.
  `versionCode` est compté côté EAS (`appVersionSource: remote`), plus
  jamais à la main.

---

## 3. Les comptes et les clés (chemins, jamais de valeurs)

| Service | Compte / objet | Accès |
|---|---|---|
| Supabase | projet `syzqibcbxyruumtcfpgm` (compte dédié Tandem) | `~/.supabase-staging-token` |
| Expo/EAS | `@nitch8190/agapeplay-tandem` (id `e6d358e4-…`) | `EXPO_TOKEN=$(cat ~/.expo-token)` |
| Play Console | organisation « agapeplay Next », app `com.agapeplay.tandem` | navigateur du fondateur |
| Compte de service Play | `eas-tandem@postiz-agapeplay.iam.gserviceaccount.com` | `~/.play-service-account.json` (600) |
| Resend | domaine `agapeplay.store` vérifié | `~/.resend-agapeplay-key` |
| Vercel | projet `agapeplay-tandem` | jeton en mémoire studio |

⚠️ Le jeton Expo et la clé du compte de service ont transité en clair dans une
conversation d'agent le 25/08 : **rotation recommandée** un jour calme (leurs
pouvoirs sont bornés : builds du projet, releases de Tandem).

---

## 4. Ce qui attend un humain

- **La recette de la v0.3.0** sur l'appareil du fondateur : les 23 points de
  la phase B (doc 30) + vérifier icône/splash. La v0.2.2 encore installée ne
  recevra jamais d'update (pas de moteur) ; mettre à jour par le Play Store.
- **Le courriel à Parcours Alpha** : rédigé, prêt (doc 13). L'envoi appartient
  au fondateur.
- **La fiche Alléluia!** de l'étude écosystème (doc 24), à faire relire par
  quelqu'un qui a joué.
- **La production Play Store**, le jour voulu : fiche store (description,
  captures, bannière), questionnaire de classification, Data Safety (réponses
  prêtes au doc 28), revue Google. La piste interne suffit d'ici là.
- **Le pilote église** (#22) : plus aucun verrou technique ni de contenu. Il
  manque deux à quatre églises réelles ; l'activation d'une communauté reste
  un SQL sanctionné, par conception.

## 5. Les issues (10 ouvertes sur 27)

#1-2 recherche utilisateur · #4 fiche de validation éditoriale (le parcours
est validé ; reste le cadre pour de futurs auteurs) · #21 qualité mobile
post-build (VoiceOver/TalkBack, crash reporting, TestFlight) · #22 pilote ·
#24 localisation du contenu (le modèle `content_sessions` porte fr+en en dur ;
une vraie extension de langue demandera une décision de schéma) · #25/#27
écosystème et Alpha (études livrées, décisions humaines) · #26 IA éditoriale
(décision : « pas maintenant »).

## 6. Les pièges qui ont coûté, pour ne pas payer deux fois

Les pièges de base et de RLS restent au doc 21 (§ « pièges mesurés ») et dans
les en-têtes de migrations. Les nouveaux de la quinzaine :

- **pgcrypto se qualifie `extensions.`** — la forme nue passe en local et
  tombe au push distant (search_path).
- **Un `with check` d'UPDATE ne se teste pas seul** : la politique SELECT
  tient déjà la porte ; muter les deux pour prouver.
- **`redirect_to` de l'admin `generate_link` est au premier niveau du corps**,
  pas sous `options` — sous `options` il est ignoré et le repli `site_url`
  est silencieux.
- **GoTrue refuse tout redirect vers un hôte en IP non-loopback** avant même
  la liste d'autorisation — les `exp://IP` d'Expo Go ne passent plus ; le
  développement authentifié passe par la build dev-client.
- **La pile RLS locale génère SA config** (`supabase init --force` dans
  `.rls-stack/`) : éditer `supabase/config.toml` du dépôt ne change rien au
  conteneur.
- **Un update EAS se bundle sur la machine qui tape la commande** : toujours
  `--environment production`, sinon les clés du `.env` local partent par les
  airs.
- **Metro sur ce VPS ne surveille pas les fichiers** ; `mobile:export` est la
  seule garde sans appareil, et un doublon de module natif (worklets) ne se
  voit qu'à `expo-doctor`.
