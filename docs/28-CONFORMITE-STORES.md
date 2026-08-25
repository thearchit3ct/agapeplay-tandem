# Conformité App Store, Google Play et politique de confidentialité

*Écrit le 26 août 2026 pour l'issue #23. Ce document rassemble ce qu'il faut
savoir — et ce qu'il faut saisir — pour publier Tandem sur les deux magasins
d'applications sans mentir sur ce que le produit fait de ses données. Il
complète le doc 06, qui pose la politique, et le doc 25, qui décrit la mesure.
En cas de contradiction, c'est le doc 06 qui l'emporte.*

*Ce qui est écrit ici décrit le code du 26 août 2026, pas une intention. Chaque
affirmation a été relue contre une migration, un module ou une capture. Les
manques sont écrits comme des manques : un formulaire de conformité rempli avec
optimisme est un formulaire qu'on devra corriger devant quelqu'un.*

---

## Ce que ce document ne fait pas

Il ne remplace pas une relecture juridique — le doc 06 et le doc 25 posent déjà
cette limite, et la section 7 en fait un plan plutôt qu'une phrase. Il ne crée
aucun compte développeur, ne soumet rien, et n'invente ni SIRET, ni adresse de
contact : ce qui attend un humain est listé en section 8, nommément.

---

## 1. L'inventaire des données

### Ce qui vit dans la base

La colonne « base légale » est une **proposition**, pas un avis : c'est
exactement ce que la relecture juridique de la section 7 doit confirmer ou
corriger.

| Donnée | Où | Pourquoi | Base légale proposée | Durée | Ce qui l'efface |
|---|---|---|---|---|---|
| Adresse e-mail | `auth.users` | se connecter (lien magique, Google, Microsoft) | contrat (art. 6.1.b) | vie du compte | `supprimer_mon_compte()` — mise à NULL |
| Nom affiché, langue | `profiles` | s'adresser à la personne, choisir la langue | contrat | vie du compte | `supprimer_mon_compte()` — nom vidé, ligne conservée en pierre tombale |
| Dates de consentement (âge, confidentialité, règles) | `profiles` | prouver que l'entrée a été consentie | obligation d'accountability (art. 5.2) | vie du compte | `supprimer_mon_compte()` |
| Journal | `journal_entries` | l'écran du journal | contrat + consentement explicite (art. 9.2.a) — voir plus bas | vie du compte | `supprimer_mon_compte()` |
| Partages d'entrées | `journal_shares` | ouvrir une entrée au binôme | contrat | vie du compte | `supprimer_mon_compte()` (cascade sur l'entrée) |
| Messages de tandem | `tandem_messages` | la conversation | contrat | **non bornée — dette, voir §6** | rien : ils restent chez le binôme |
| Progression | `session_progress` | reprendre où l'on s'est arrêté | contrat | vie du compte | `supprimer_mon_compte()` |
| Bilan de semaine (un mot parmi cinq) | `weekly_checkins` | l'accueil du samedi | contrat | vie du compte | `supprimer_mon_compte()` |
| Préférences de notification | `notification_preferences` | régler les rappels | contrat | vie du compte | `supprimer_mon_compte()` |
| Préférence de mesure | `mesure_preferences` | faire traverser un refus d'un appareil à l'autre | consentement / opposition | vie du compte | `supprimer_mon_compte()` |
| Relation de tandem | `tandems` | l'existence de la relation | contrat | passe à `ended` au départ ; un tandem **bloqué** reste bloqué | jamais supprimée — le blocage survit à son auteur |
| Invitation de binôme, **avec l'adresse d'un tiers** | `tandem_invitations` | inviter quelqu'un | intérêt légitime (art. 6.1.f) | 7 jours (`expires_at`) | expiration, acceptation, `supprimer_mon_compte()` dans les deux sens |
| Appartenance d'église, cohorte, rôle | `church_members`, `group_members` | l'espace communauté | contrat | vie du compte | `supprimer_mon_compte()` |
| Lien d'invitation d'église, **avec un jeton** | `church_invitations` | faire entrer un groupe | intérêt légitime | 30 j par défaut, 90 au maximum (contrainte en base) | révocation, péremption |
| Affectation de mentor | `mentor_assignments` | l'espace mentor | contrat | vie du compte | `supprimer_mon_compte()` |
| Vérification et formation du mentor | `mentor_profiles` | ne confier un mineur qu'à un adulte vérifié | obligation légale / intérêt vital des mineurs | vie du compte | `supprimer_mon_compte()` |

*Sur cette dernière ligne : la table n'a **que** `grant select`, aucune politique
d'`update`, et aucune fonction ne fait passer `verification_status` à `verified`.
Le verrou est donc réel — un mentor non vérifié n'accompagne personne — mais le
geste de vérification n'a aucun propriétaire dans le code : il se pose depuis
l'éditeur SQL. La politique publique dit le verrou, pas une procédure qui
n'existe pas.*
| Demande d'aide (catégorie close) | `help_requests` | dire « fais-moi signe » | contrat | vie du compte (cascade sur l'affectation) | `supprimer_mon_compte()` (cascade) |
| Encouragement (clé parmi six) | `mentor_encouragements` | un mot du mentor | contrat | vie du compte (cascade) | `supprimer_mon_compte()` (cascade) |
| Signalement : catégorie, urgence, message visé, note libre (≤ 1000 car.) | `tandem_reports` | protéger quelqu'un | intérêt légitime + protection des mineurs | **conservé après la suppression du compte** | rien, et c'est voulu |
| Décisions de modération | `tandem_report_audit` | savoir qui a décidé quoi | accountability | conservé | rien — la table n'a **aucune** clé étrangère, précisément pour survivre à ce geste |
| Événements de mesure | `analytics_events` | savoir si l'application aide | intérêt légitime (art. 6.1.f), voir doc 25 | **non bornée — dette, voir §6** | rien ne peut les désigner ; le numéro d'appareil tourne à 13 mois |

**La ligne qu'il ne faut pas lire trop vite : `tandem_invitations.invitee_email`.**
C'est l'adresse de quelqu'un qui n'a pas de compte, n'a rien accepté et ne sait
pas encore que son adresse est chez nous. Elle est bornée à sept jours par
`expires_at`, et `supprimer_mon_compte()` efface les invitations **dans les deux
sens** — celles qu'on a émises comme celles qu'on a reçues. Aucun des deux
formulaires de store n'a de case pour « données d'un tiers fournies par
l'utilisateur » ; la politique publique, elle, le dit (`privacyDataInvites`).

**Les convictions religieuses sont une donnée sensible, et le produit en est
plein.** Le doc 06 le dit déjà, en citant la CNIL. Un journal de prière, un
message à son binôme, un bilan de semaine : au sens de l'article 9 du RGPD, ce
sont des données révélant des convictions religieuses. Deux conséquences
concrètes, et elles pèsent plus que tout le reste de ce document :

- il faut une base de l'article 9, et la seule tenable ici est le **consentement
  explicite** (9.2.a). L'écran de confiance (`TrustDialog`) le recueille — case
  `privacyConsent`, date écrite dans `profiles.privacy_consent_at`. Que cette
  case suffise à qualifier un consentement explicite au sens de l'article 9,
  pour un public de 16-17 ans, est **la première question à poser au juriste** ;
- côté Apple, cela ouvre le type `Sensitive Info`, qu'il faut cocher (§3).

### Ce qui reste sur l'appareil, et n'en sort pas

| Clé | Contenu | Ce qui l'efface |
|---|---|---|
| `agapeplay-tandem-demo-state` | langue, onglet, brouillons et état de démonstration | réinitialisation de la démo, historique du navigateur |
| `agapeplay-tandem-mesure-id` | le numéro d'appareil de la mesure | refus de la mesure, suppression de compte |
| `agapeplay-tandem-mesure-consentement` | l'interrupteur local | — |
| `agapeplay-tandem-mesure-jalons` | les jalons de funnel déjà émis | refus de la mesure |
| `agapeplay-tandem-communaute-jeton` | un jeton d'invitation d'église capté dans l'URL | adhésion, ou oubli explicite |
| file hors-ligne (`offlineQueue`) | gestes produits en attente d'envoi | envoi réussi, réinitialisation |

Sur mobile, les mêmes clés vivent dans `AsyncStorage`, plus la préférence de
rappel quotidien.

### Ce que le produit ne collecte pas

Vérifiable, pas déclaratif : aucune position géographique, aucun carnet
d'adresses, aucune photo, aucun micro, aucun capteur, aucune donnée de santé,
aucune donnée de paiement — le produit n'a pas de paiement. Aucun historique de
navigation. Aucun rapport de plantage : il n'y a pas de SDK de crash reporting
dans le dépôt.

**Aucune notification distante, donc aucun jeton d'appareil.**
`apps/mobile/src/notifications.ts` n'appelle que `scheduleNotificationAsync` —
un rappel local, programmé sur le téléphone. `getExpoPushTokenAsync` n'apparaît
nulle part. Rien ne part vers Expo, FCM ou APNs, et il n'y a donc aucun jeton
push à déclarer. Le jour où une notification distante arrivera, cette ligne
devient fausse et les deux formulaires changent.

---

## 2. L'inventaire des dépendances et des tiers

### Les paquets

**Web** (`apps/web`) : React 19, React DOM, Vite 8, TypeScript,
`@supabase/supabase-js`, et les trois paquets internes du dépôt. Rien d'autre.

**Mobile** (`apps/mobile`) : Expo 57 (`expo`, `expo-router`, `expo-linking`,
`expo-status-bar`, `expo-device`, `expo-notifications`), React Native 0.86,
`react-native-screens`, `react-native-safe-area-context`,
`react-native-url-polyfill`, `@react-native-async-storage/async-storage`,
`@supabase/supabase-js`, et les paquets internes.

**Aucun SDK d'analyse, de publicité, d'attribution, de A/B testing, de support
client ou de suivi de plantage** n'est présent, ni sur le web ni sur le mobile.
La mesure est écrite à la main (doc 25) et écrit dans notre propre base.

### Les tiers réellement contactés depuis un navigateur

Constaté sur la page publique servie en production locale, requêtes réseau
enregistrées :

- `fonts.googleapis.com` (la feuille de style des polices) ;
- `fonts.gstatic.com` (les fichiers `.woff2`).

Et rien d'autre. La page de confidentialité ne construit aucun client Supabase
et n'écrit rien dans le stockage — vérifié : `localStorage` est vide après
chargement, sur mobile comme sur bureau.

### Google Fonts : l'arbitrage, écrit pour être défendu

`apps/web/src/styles.css` ouvre sur un `@import` vers Google Fonts (DM Mono,
Special Elite). C'est une requête vers un tiers : l'adresse IP du navigateur et
son en-tête `User-Agent` parviennent à Google.

**Dans la politique publique : oui, c'est dit** (`privacyThirdFonts`), en clair
et sans euphémisme.

**Dans les formulaires de store : non, ce n'est pas déclaré comme un partage.**
La question qui tranche est celle-ci : *la requête transporte-t-elle une donnée
que l'application a collectée ?* Non. Aucune donnée de compte, aucun
identifiant, aucun contenu ne part avec. Les deux formulaires portent sur les
données que l'application **collecte puis transmet**, pas sur les métadonnées de
connexion inhérentes au chargement d'une ressource distante — sinon toute image
hébergée ailleurs deviendrait un partage de données.

Ce qui rendrait cette réponse fausse, et qu'il faut surveiller : le jour où une
police serait chargée avec un paramètre identifiant, ou remplacée par un service
qui pose un cookie. Aucun des deux n'est le cas.

**À corriger un jour, hors périmètre de conformité** : le CSS référence
`Cormorant Garamond` et `Space Grotesk`, absentes de l'`@import` — elles
retombent silencieusement sur les polices de repli. Ce n'est pas un sujet de
données ; c'est un défaut de rendu qui traîne.

### Les sous-traitants

| Qui | Pour quoi | Ce qu'ils voient |
|---|---|---|
| Supabase | base de données, comptes, envoi des liens de connexion | tout ce qui est en base, techniquement |
| Vercel | hébergement du site web | les journaux d'accès HTTP |
| Google, Microsoft | connexion OAuth, **au choix de la personne** | ce que leur propre service voit d'une connexion ; nous recevons l'adresse et le nom |
| Google Fonts | deux polices | l'IP du navigateur (voir ci-dessus) |

**Le pays d'hébergement de la base n'est écrit nulle part dans ce dépôt.** C'est
une information de conformité de premier plan — transfert hors Union européenne
ou non — et elle attend un humain (§8). La politique publique porte un repère
`[À COMPLÉTER]` à cet endroit précis.

---

## 3. Privacy Nutrition Labels (Apple) — réponses prêtes à saisir

À saisir dans App Store Connect → App Privacy. Trois questions gouvernent chaque
type : est-il collecté ? sert-il à vous **pister** ? est-il **lié** à l'identité ?

### Data Used to Track You — **aucun type**

Le pistage, au sens d'Apple, est le recoupement avec des données d'autres
sociétés ou la transmission à un courtier en données. Il n'y a ni l'un ni
l'autre : aucun SDK tiers, aucune régie, aucune transmission. Aucun `SKAdNetwork`
n'est configuré, et l'application n'a donc **pas** à présenter l'invite ATT.

### Data Linked to You

| Type Apple | Ce que c'est chez nous | Finalité à cocher |
|---|---|---|
| Contact Info → Email Address | l'adresse de connexion ; **et** l'adresse de la personne qu'on invite | App Functionality |
| Contact Info → Name | le nom affiché | App Functionality |
| **Sensitive Info** | convictions religieuses portées par le journal, les messages, les bilans | App Functionality |
| User Content → Emails or Text Messages | les messages de tandem | App Functionality |
| User Content → Other User Content | journal, bilans de semaine, progression, partages, demandes d'aide, encouragements | App Functionality |
| User Content → Customer Support | la note libre d'un signalement, lue par un modérateur | App Functionality |
| Identifiers → User ID | l'identifiant de compte (`auth.uid()`) | App Functionality |

**`Sensitive Info` est la case qu'on ne coche pas par distraction, et c'est
celle qui compte le plus ici.** Apple range explicitement les croyances
religieuses dans ce type. Sur un produit d'accompagnement spirituel, l'omettre
serait le manquement le plus visible du dossier.

### Data Not Linked to You

| Type Apple | Ce que c'est chez nous | Finalité à cocher |
|---|---|---|
| Identifiers → Device ID | le numéro d'appareil de la mesure (`anonymous_id`) | Analytics |
| Usage Data → Product Interaction | les dix événements du doc 08 | Analytics |

### Pourquoi « Not Linked » tient — et l'objection qu'on connaît

Trois faits, vérifiables dans la migration `20260825190000` :

1. `analytics_events` n'a **aucune colonne** désignant un compte : ni `user_id`,
   ni adresse, ni identifiant de session. Il n'existe donc aucun prédicat qui
   sélectionne « les événements de cette personne » — ni pour les lire, ni pour
   les supprimer, ni pour qui les réclamerait ;
2. le trigger `mesure_identifiant_non_relie` refuse un événement dont le numéro
   serait l'`auth.uid()` de l'appelant ; le domaine partagé refuse plus tôt, sur
   la forme ;
3. le numéro naît d'un tirage sur l'appareil, tourne à treize mois, et
   `analytics_events` est la **seule** table qui le contient.

**L'objection, telle qu'un juriste ou un examinateur la posera :** la définition
d'Apple lie une donnée à l'identité y compris quand le lien passe par
l'appareil, et l'insertion est réservée à `authenticated` — la requête porte
donc un JWT. La réponse honnête, celle qui survit à la relecture, n'est pas « le
serveur ne sait jamais » : c'est **le serveur sait momentanément qui écrit, il
n'en stocke rien**. La ligne écrite ne porte aucune colonne d'identité, et
aucune jointure ne peut la reconstituer après coup.

Si Apple refuse malgré tout, le repli ne coûte rien au produit : basculer
`Device ID` et `Product Interaction` dans « Linked to You » change le label, pas
une ligne de code. Ce serait un label plus pessimiste que le produit.

### Le blocage App Store, à traiter avant de soumettre le mobile

La règle 5.1.1(v) des App Store Review Guidelines impose qu'une application
permettant de créer un compte permette de le **supprimer depuis l'application**.
`supprimer_mon_compte()` existe et fonctionne, mais **l'écran mobile ne l'appelle
nulle part** — l'écart est nommé au doc 25 et au doc 21, et il est antérieur à
ce chantier. En l'état, l'application mobile serait rejetée sur ce point seul.
Ce n'est pas un travail de conformité : c'est un écran à écrire, hors du
périmètre de l'issue #23, et il faut l'ouvrir en issue.

---

## 4. Data Safety (Google Play) — réponses prêtes à saisir

À saisir dans la Play Console → Politique → Sécurité des données.

**Réponses d'ensemble** : l'application **collecte** des données. Elle n'en
**partage** aucune, au sens de Play — un transfert vers un sous-traitant qui
traite pour notre compte (Supabase, Vercel) n'est pas un partage, et il n'y a
pas d'autre destinataire.

| Catégorie → type | Collecté | Partagé | Obligatoire | Finalités |
|---|---|---|---|---|
| Infos perso → Nom | oui | non | oui | Fonctionnalité de l'application ; gestion du compte |
| Infos perso → Adresse e-mail | oui | non | oui | Fonctionnalité ; gestion du compte |
| Infos perso → ID utilisateur | oui | non | oui | Fonctionnalité ; gestion du compte |
| Infos perso → **Opinions politiques ou religieuses** | oui | non | facultatif | Fonctionnalité |
| Messages → Autres messages in-app | oui | non | facultatif | Fonctionnalité |
| Activité dans l'appli → Autres contenus générés par l'utilisateur | oui | non | facultatif | Fonctionnalité |
| Activité dans l'appli → Interactions avec l'application | oui | non | facultatif | Analyse |
| ID de l'appareil ou autres ID | oui | non | facultatif | Analyse |

Tout le reste — position, informations financières, santé et forme, photos et
vidéos, fichiers, contacts, agenda, navigation web, performances de
l'application — est **non collecté**.

Deux remarques sur ce tableau :

- **« Opinions politiques ou religieuses » est coché**, et c'est le pendant Play
  du `Sensitive Info` d'Apple. Le formulaire de Play a bien ce type ; ne pas le
  cocher en le rangeant sous « Messages » serait un choix de commodité ;
- **« facultatif »** au sens de Play veut dire qu'on peut utiliser
  l'application sans fournir la donnée. C'est vrai du contenu (rien n'oblige à
  écrire un journal) et vrai de la mesure (elle se coupe dans les réglages).
  Le nom et l'adresse, eux, sont obligatoires : sans eux il n'y a pas de compte.

### Pratiques de sécurité

- **Chiffrées en transit : oui.** Tout passe en HTTPS — Vercel pour le site,
  Supabase pour l'API et l'authentification.
- **Suppression des données possible : oui**, avec l'URL de la section 5.
- **Examen de sécurité indépendant : non.** Il n'y en a pas eu ; le dire est la
  seule réponse acceptable.

### Public visé

Le doc 06 fixe l'âge minimum à 16 ans. La tranche à déclarer dans la Play
Console est donc **16-17 ans et adultes**, et il faut vérifier au moment de la
déclaration si ce choix déclenche des obligations au titre de la politique
« Familles » de Play — la réponse dépend de règles qui évoluent, et elle se lit
dans la console, pas dans ce document.

---

## 5. Le mécanisme de suppression, documenté publiquement

### Dans l'application

Réglages → **Supprimer mon compte** → un écran qui énumère, avant la
confirmation, ce qui part et ce qui reste, puis `supprimer_mon_compte()`.

Ce que la fonction fait vraiment, et que les deux labels doivent refléter :

- **efface** journal, progression, bilans, préférences, appartenances, profils
  et affectations de mentor, rôle de modérateur, invitations dans les deux sens ;
- **neutralise** `auth.users` — adresse, téléphone, mot de passe et métadonnées
  vidés, `banned_until` au loin, `deleted_at` posé — et **supprime les sessions
  côté serveur**, ce qui révoque les jetons sans dépendre du client ;
- **garde** les messages laissés dans la conversation du binôme, sans nom
  au-dessus ; les signalements ; le journal d'audit de modération ;
- **ne dégèle pas un tandem bloqué** : le blocage survit à son auteur.

La ligne de conduite, écrite dans la migration et reprise mot pour mot dans la
politique publique : **on efface la personne, on garde la relation et la trace.**
La raison n'est pas technique — une cascade sur `auth.users` offrirait à qui a
mal agi le moyen le plus simple de faire disparaître la preuve.

**Écart connu : le mobile n'a pas ce bouton.** Voir §3.

### Hors de l'application, pour qui a perdu l'accès

Google Play demande une **URL publique** de demande de suppression. Ce dépôt n'a
aucun composant serveur : un formulaire web supposerait un back-office pour le
recevoir, et un formulaire qui n'aboutit nulle part serait pire qu'une absence.

**La forme retenue : une adresse e-mail de contact, décrite sur la page publique
de confidentialité, dont l'URL sert de réponse au formulaire de Play.**

- URL à saisir dans les deux consoles :
  `https://tandem.agapeplay.store/confidentialite`
- La page décrit le chemin in-app **et** le recours par e-mail
  (`privacyDeleteNoAccess`), en disant qu'une preuve de possession de l'adresse
  sera demandée — sans quoi n'importe qui ferait supprimer le compte d'un autre.
- L'adresse elle-même est un repère `[À COMPLÉTER]` sur la page : elle doit
  exister et être relevée par quelqu'un avant publication (§8).

---

## 6. La dette de conformité, nommée

**Durée de conservation des messages.** Un tandem terminé garde sa conversation
indéfiniment. La dette est nommée dans l'en-tête de `20260825090000` : elle
demande un cron et une décision de durée, pas une RPC. Tant qu'elle tient, la
politique publique le dit (`privacyKeepDebt`) plutôt que de promettre une durée
qui n'existe pas.

**Durée de conservation des événements de mesure.** Aucune purge (doc 25, « ce
qui reste ouvert »). Le risque n'est pas celui d'un fichier nominatif — rien ne
désigne personne — mais une table qui ne se purge jamais finit par peser.

**L'AIPD (DPIA).** Le doc 06 la dit nécessaire : « une analyse d'impact devra
être réalisée avant un traitement à risque élevé ». Les critères sont réunis
sans discussion possible — données sensibles, personnes vulnérables (mineurs),
mise en relation. Elle n'existe pas. C'est le livrable de conformité le plus
lourd qui reste, et il précède la collecte à grande échelle.

**Les règles d'utilisation n'existent pas.** L'écran de confiance fait cocher
« J'accepte les règles d'utilisation d'AgapePlay » (`termsConsent`) et écrit la
date dans `profiles.terms_consent_at`. **Aucun document ne porte ces règles**,
nulle part dans le dépôt. La politique de confidentialité, elle, existe
désormais et est atteignable. Faire accepter un texte qui n'existe pas est un
défaut à part entière, indépendant des stores.

**La vérification d'un mentor n'a pas de propriétaire dans le code.** Rien dans
l'application ne fait passer `mentor_profiles.verification_status` à `verified` ;
la table n'a pas même de politique d'`update`. Sur un produit qui confie des
mineurs à des adultes, une vérification qui ne se pose que depuis l'éditeur SQL
est une procédure sans trace et sans responsable désigné. C'est un sujet de
conformité autant que de produit.

**Suppression de compte sur mobile.** Voir §3 — blocante pour l'App Store.

**Le pays d'hébergement de la base** n'est documenté nulle part (§2).

---

## 7. La revue juridique

### Ce qu'il faut faire relire, dans cet ordre

1. **La politique de confidentialité publique** (fr + en, textes dans
   `packages/content/copy/web.ts`, page `/confidentialite`) — c'est le document
   opposable, et le seul que le public lit.
2. **La qualification des bases légales** du tableau de la section 1, et surtout
   la question de l'article 9 : la case `privacyConsent` de l'écran de confiance
   vaut-elle consentement explicite au traitement de données révélant des
   convictions religieuses, pour un public de 16-17 ans ?
3. **Le dispositif de mesure** (doc 25) : la mesure d'audience strictement
   interne décrite y échappe-t-elle à l'exigence de consentement préalable au
   sens de l'article 82 de la loi Informatique et Libertés, telle que la CNIL
   l'interprète ?
4. **L'arbitrage de la suppression** (`20260825090000`) : « on efface la
   personne, on garde la relation et la trace ». Conservation des messages chez
   autrui, des signalements, de l'audit — et le blocage qui survit.
5. **Les deux déclarations de store** des sections 3 et 4, avant saisie.
6. **Le périmètre de l'AIPD**, et qui la rédige.

### Par qui

Le profil requis, et non un nom : **un avocat ou un DPO externe spécialisé en
données personnelles (RGPD), avec une pratique réelle sur les traitements
concernant des mineurs et sur les données de l'article 9.** Deux compétences
rares ensemble, et c'est le croisement qui compte ici : un généraliste RGPD ne
verra pas le problème du consentement d'un mineur de 16-17 ans à un traitement
de convictions religieuses, et un spécialiste de la protection de l'enfance ne
verra pas le problème de la mesure.

### Avant quoi

- **Avant toute collecte à grande échelle** — c'est la limite que posent déjà le
  doc 06 et le doc 25, et elle vaut avant la bêta publique (jalon M3).
- **Avant la soumission aux magasins** : les deux déclarations engagent
  l'éditeur, et une déclaration corrigée après coup se remarque.
- **Avant l'ouverture à des églises tierces** : à partir de là, des adultes
  extérieurs à AgapePlay accompagnent des mineurs, et la question du partage de
  responsabilité de traitement se pose pour de bon.

---

## 8. Ce qui attend un humain

Rien de ce qui suit n'a été inventé, et rien ne doit l'être.

1. **Le SIRET et l'adresse du siège d'AGAPE PLAY** — repère `[À COMPLÉTER]` en
   tête de la page publique.
2. **L'adresse e-mail de contact**, qui sert aussi de canal de demande de
   suppression pour qui a perdu l'accès. Elle doit exister, être relevée, et
   quelqu'un doit savoir quoi répondre. Repère `[À COMPLÉTER]` sur la page.
3. **Le pays d'hébergement de la base Supabase**, et l'existence ou non d'un
   transfert hors Union européenne. Repère `[À COMPLÉTER]` sur la page.
4. **Vérifier que `https://tandem.agapeplay.store/confidentialite` répond 200 en
   production** avant de coller l'URL dans une console. La réécriture SPA est
   désormais versionnée (`apps/web/vercel.json`), mais elle dépend de la
   configuration du projet Vercel — à constater, pas à supposer.
5. **Les comptes développeur Apple et Google**, au nom de la SASU.
6. **La revue juridique** de la section 7 : la mandater, avec le périmètre
   ci-dessus.
7. **L'AIPD**, à lancer.
8. **Les règles d'utilisation** à écrire — on les fait accepter aujourd'hui sans
   qu'elles existent (§6).
9. **La suppression de compte sur mobile**, à ouvrir en issue : bloquante pour
   l'App Store.
10. **Vérifier que les migrations du 25 et du 26 août sont appliquées sur le
    projet hébergé.** Deux affirmations de la politique publique en dépendent :
    la suppression réelle du compte (`20260825090000`) et la fermeture de
    l'écriture de mesure à `anon` (`20260825190000`). Tant que la seconde dort,
    la politique de `…_000007` tient encore — insertion ouverte à `anon`, sans
    contrainte ni trigger — et la page décrirait alors le code plutôt que la
    base.
