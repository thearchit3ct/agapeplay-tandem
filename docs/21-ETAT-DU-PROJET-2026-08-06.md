# État du projet — 6 août 2026

*Ce document remplace [`19-ETAT-COMPLET-DU-PROJET-2026-08-05.md`](./19-ETAT-COMPLET-DU-PROJET-2026-08-05.md),
qui décrit un état antérieur à la campagne de sécurité du 6 août. Les deux
peuvent être lus ensemble : le 19 dit ce que le produit veut être, celui-ci dit
où il en est réellement.*

Dépôt `thearchit3ct/agapeplay-tandem`, branche `main`.

---

## Amendement du 25 août 2026 — communautés, groupes et rôles (issue #17)

*Ajouté sans rien retirer de ce qui précède, ni des amendements du même jour
plus bas. Le détail des décisions vit dans
[`26-COMMUNAUTES-GROUPES-ET-ROLES.md`](./26-COMMUNAUTES-GROUPES-ET-ROLES.md) ;
ce qui suit est ce qu'il faut savoir sans l'ouvrir.*

Les six tables d'église posées le 4 août n'avaient **aucun chemin d'écriture** —
pas une politique `insert`, pas un `grant`, pas un écran. Elles en ont
désormais, sous un principe unique : **préparer est libre, faire entrer
quelqu'un ne l'est pas.**

Ce qu'il faut retenir ici :

- **Créer une communauté est un geste de l'application** (`creer_ma_communaute`),
  **l'activer ne l'est pas.** `churches` n'a toujours aucun `grant` d'écriture :
  `pending` → `active` se fait depuis l'éditeur SQL du tableau de bord, comme
  pour `tandem_moderators`. ⚠️ Ne pas « réparer » en accordant un `grant update`.
- **`pending` retient trois gestes et trois seulement** : émettre un lien,
  rejoindre par un lien, affecter un mentor. Créer des cohortes et les clôturer
  reste permis. `suspended` referme les mêmes trois, immédiatement.
- **Un lien d'invitation ne confère que `member`.** Jamais mentor, jamais
  responsable. C'est la borne la plus importante du chantier.
- **`ends_on` est une règle de droit, `starts_on` une règle d'écran.** Une même
  fenêtre peut relever des deux niveaux selon le bord — le vocabulaire du
  chantier #49 s'applique bord par bord, pas fenêtre par fenêtre.
- **Le responsable propose, le jeune accepte.** `mentor_assignments` naît
  `pending` et seul le participant peut écrire `active`. La phrase du doc 06 est
  devenue une politique.
- **`admin` et `church_members.status = 'invited'` sont inatteignables.** Aucun
  chemin du dépôt ne les écrit, et un test l'épingle. Ne pas les prendre pour
  des chemins existants.
- **Aucune colonne ne relie un tandem à une église.** La membrane est
  `mentor_assignments`. Voir le doc 26, décision 6, avant d'en ajouter une pour
  l'issue #16.

**Second piège, produit celui-là.** Le jeton d'invitation doit franchir une
connexion : le cas courant est quelqu'un **sans compte**, et `signInWithOAuth`
comme le lien magique reviennent sur l'origine **nue**, sans query string et
avec un état React reparti de zéro. Il passe donc par le stockage local avant
que l'URL ne soit nettoyée. Tout lien futur qui doit survivre à une connexion
aura le même problème.

**Piège mesuré, à ne pas redécouvrir.** `error: infinite recursion detected in
policy for relation "church_groups"`, sur un simple `insert … returning` : la
politique de lecture de `church_groups` interrogeait `group_members`, dont celle
du responsable interrogeait `church_groups`. Une politique qui lit une table
dont la politique lit la première fait lever la base, et le cycle ne se voit pas
à la lecture d'une politique seule. Trois fonctions `security definer` portent
désormais la traversée.

**Écarts.** Pas de QR code (le lien suffit au critère ; un encodeur local coûte
plus qu'il n'apporte — doc 26). Rien côté **mobile** : ce chantier est
web-first, les gestes de responsable sont des gestes d'écran large, et le
domaine partagé n'a rien de spécifique au web — un écran mobile n'aurait qu'à
être écrit. Une seule appartenance active à la fois. Un fondateur unique qui
supprime son compte laisse une église sans responsable, réparable par SQL
sanctionné. Et la dette de conservation de la PR #44 reste ouverte : aucune
purge automatique n'est promise, faute d'ordonnanceur.

---

## Amendement du 25 août 2026 — le bilan de fin de semaine (issue #18)

*Ajouté sans rien retirer de ce qui précède, ni des quatre amendements du même
jour plus bas.*

L'issue demandait cinq choses : un bilan de fin de semaine, un rappel réglable
et désactivable, un message de reprise après absence, aucun mot de honte ni de
série perdue, et une mesure sans contenu sensible. Voici ce qui a été tranché.

**Une semaine se termine le samedi, et c'est la semaine du calendrier — pas
celle du parcours.** La question posée est « comment s'est passée ta semaine ? »,
pas « où en es-tu ? » : la semaine d'un adolescent de seize ans est celle du
lycée et du week-end, elle finit quand elle finit pour tout le monde. La lecture
relative au parcours avait surtout un défaut rédhibitoire : elle exige une
progression pour avancer, donc quelqu'un qui n'a rien fait depuis trois semaines
n'aurait jamais de bilan — précisément la personne à qui l'on veut proposer de
revenir. La clé est une semaine ISO (`2026-W35`), calculée par
`packages/domain/src/bilan.ts` avec ses cas de bord (le 1er janvier 2027 est un
vendredi et appartient à `2026-W53`).

**La fenêtre va du samedi au vendredi suivant.** Sept jours, donc **exactement
un** bilan ouvert à chaque instant : jamais deux à choisir, jamais un arriéré.
Passé vendredi, la semaine s'en va — aucun écran ne la rappelle, aucune ligne ne
la compte. C'est « une semaine sans bilan n'est pas un échec », écrit en dates :
une file de bilans en retard serait exactement l'inverse. La base, elle, ignore
cette fenêtre et accepte toute semaine bien formée : c'est une règle d'écran (ce
qu'on propose), pas une règle de droit (ce qu'on autorise), et l'inscrire en SQL
ferait dépendre une correction tardive de l'horloge du téléphone.

**La table ne porte qu'une semaine et un mot.** L'EPIC D du doc 04 range
ensemble statut, note privée et partage ; les deux derniers existaient déjà et
les réécrire aurait fait deux endroits qui disent la même chose. La note est une
entrée de `journal_entries` — sa politique own-only, sa suppression, son export
et sa ligne dans `supprimer_mon_compte()` sont écrites depuis l'issue #11 — et
son partage une ligne de `journal_shares`. `public.weekly_checkins` ne porte donc
que la réponse rapide : `(user_id, week_key)` en clé, un `state` parmi cinq.

**On ne partage pas son statut à son binôme, et c'est une décision.** Ce serait
un second chemin de lecture croisée — donc une seconde fonction
`security definer`, donc le double de surface — pour un seul mot, et un mot qui
se lit mal : « rude » trois semaines de suite s'interprète tout seul quand on n'a
pas les phrases autour. Ce que l'on ouvre à son binôme, ce sont des mots
choisis. Le statut reste à celle qui l'a posé, mentor compris.

**Cinq réponses closes, aucune échelle.** `paisible`, `dense`, `rude`,
`ailleurs`, `incertain`. Une note de 1 à 5 aurait produit une courbe, la courbe
une comparaison, et la comparaison est le mécanisme de honte que l'issue demande
d'éviter. Les mots qualifient la semaine, jamais la personne. `ailleurs` est
offert au même rang que les autres — l'absence n'a pas à se justifier — et
`incertain` existe pour que celle qui ne sait pas ne choisisse pas un mot faux.
Il n'y a **ni compteur, ni série, ni « semaines consécutives »** : ni dans le
schéma, ni dans le domaine. Un test épingle la liste des exports de
`bilan.ts` — la garde contre « tu as manqué 3 semaines » n'est pas une relecture
de texte, c'est l'absence du nombre.

**Deux interrupteurs, pas un.** `notification_preferences` gagne une colonne
`weekly_checkin` ; `absence`, qui existait depuis le premier jour, garde le
message de reprise. On peut vouloir la paix en semaine et accepter une question
le samedi, et l'inverse : les confondre ferait qu'éteindre l'un éteint l'autre.

**La reprise après absence : douze jours, et un booléen.** Douze et pas huit —
une semaine sautée est à l'intérieur de ce que le produit tolère de lui-même, et
accueillir « de retour » après une seule semaine calme reviendrait à commenter le
rythme de quelqu'un. `repriseApresAbsence` rend un booléen, jamais un écart :
rien de ce qu'on n'a pas calculé ne peut s'afficher. Les mots disent que rien n'a
bougé et qu'on reprend où l'on veut — c'est la seule information utile à
quelqu'un qui rouvre l'application après trois semaines, la peur à cet âge étant
d'avoir perdu sa place.

**Une invitation douce au plus.** Quelqu'un qui revient après un mois remplit les
deux conditions en même temps ; empiler un mot d'accueil et une question à
remplir ferait de son retour une formalité. La précédence est tranchée dans
`invitationDouce`, avec son test : l'accueil passe, le bilan attend.

**La mesure.** `weekly_checkin_completed` est émis **après** que l'écriture ait
lu sa réponse — un événement posé sur une écriture refusée gonflerait la seule
ligne du funnel que ce chantier existe pour remplir. Sa propriété `week` porte la
semaine couverte et non la date du jour : les deux diffèrent d'un à six jours
puisque le bilan se répond jusqu'au vendredi suivant, et `occurred_at` ne dirait
donc pas quelle semaine a été accompagnée. La ligne 7 de
`mesure_funnel_binome` cesse d'être muette par construction.

### Ce que la vérification par mutation a corrigé

Le commentaire de la migration disait d'abord que le `with check` de
`weekly_checkins_update_own` était **la** garde contre un
`update … set user_id = <un tiers>`. La mesure dit autre chose : en le
remplaçant par `(true)`, aucun test ne rougit. La table « Policies Applied by
Command Type » de la documentation de `CREATE POLICY` en donne la raison — pour
un UPDATE, les politiques SELECT s'appliquent à la ligne existante **et à la
nouvelle**, si bien que `weekly_checkins_select_own` referme déjà la porte. Le
`with check` est gardé comme seconde serrure, et la mutation le prouve en deux
temps : SELECT élargi seul ⇒ le déplacement reste refusé ; SELECT élargi **et**
`with check (true)` ⇒ il passe. À retenir pour toute table own-only du dépôt :
un `with check` d'UPDATE ne se teste pas seul.

### ⚠️ L'ordre de déploiement — une régression, pas seulement un manque

**La migration doit passer AVANT l'application.** Ce n'est pas la précaution
d'usage : `toggleNotification` envoie l'objet de préférences entier
(`upsert({ user_id, ...notificationPrefs })`), qui porte désormais
`weekly_checkin`. Contre une base où la colonne n'existe pas encore, PostgREST
rejette **tout l'upsert** — et ce sont les quatre réglages existants (séances,
messages, église, absence) qui cessent d'être enregistrés, pas seulement le
nouveau. La carte de bilan, elle, échouerait aussi sur une table absente, mais
c'est le moindre des deux : elle n'existait pas hier.

C'est le même piège que le correctif de l'issue #20 avait déjà rencontré dans
l'autre sens (« une application déployée en premier écrirait réellement dans la
table, sans qu'aucun verrou ne la relise »). La forme change, la règle est la
même : migration d'abord, application ensuite.

### Écarts assumés de ce chantier

- **Aucun rappel poussé, ni sur le web ni sur le mobile.** Le web n'a pas de
  push du tout ; le mobile est borné par Expo Go, où l'import seul
  d'`expo-notifications` jette (voir `apps/mobile/src/notifications.ts` et le
  piège déjà consigné plus bas). Le rappel livré est donc une carte douce au bon
  moment dans l'application, désactivable, et elle suffit au critère « rappel
  configurable et désactivable ». Le rappel réellement poussé — un samedi matin,
  sur le téléphone — viendra avec les builds EAS de l'issue #13, et il n'aura
  rien à décider : la fenêtre, la préférence et les mots existent déjà.
- **Pas de message de reprise en mode démonstration.** L'absence se calcule
  depuis `session_progress.completed_at` et `weekly_checkins.updated_at` ;
  l'état local ne garde que des identifiants de séances, sans date. Sans compte,
  l'application ne peut donc rien dire d'une absence — et elle se tait plutôt que
  d'affirmer ce qu'elle n'a pas mesuré.
- **Le bilan n'entre pas dans la file hors-ligne.** Une question de fin de
  semaine posée hier n'a pas à être renvoyée demain. L'écran le dit — « ton bilan
  sera encore là quand la connexion reviendra » — au lieu de promettre une
  synchronisation qui n'existe pas.
- **« Une autre fois » n'écarte la carte que pour la visite en cours.** Le refus
  durable est l'interrupteur des réglages, qui porte ce nom et se retrouve ; un
  écart écrit dans le stockage ferait une troisième mémoire du même choix, plus
  discrète et impossible à défaire quand on change d'avis.
- **La correction d'une réponse n'est offerte que le temps de la visite.** La
  base l'autorise à tout moment (`weekly_checkins_update_own`), l'écran la
  propose juste après la réponse — le temps de rattraper un clic manqué. Faire
  réapparaître une carte déjà répondue pour permettre de la corriger reposerait
  une question à laquelle on a répondu, ce que ce chantier existe pour éviter.
- **Le mobile n'émet pas `journey_id` avec l'événement.** L'écran d'accueil
  mobile ne charge aucun parcours ; la colonne est nullable et le funnel ne s'en
  sert pas. Même famille d'écart que `account_created`, déjà nommé au doc 25.

---

## Amendement du 25 août 2026 — trois études de conception (issues #25, #26, #27)

*Ajouté sans rien retirer de ce qui précède. Les trois amendements plus bas
restent valables. Celui-ci ne rapporte **aucun code** : les trois issues
appelaient des décisions, pas une implémentation, et ce qui a été produit est
trois documents.*

**Ce que ces trois études ont en commun.** Chacune touche à une frontière du
produit — une marque tierce, un modèle de langue, une autre application du
studio — et chacune se termine par une liste « Ce qui attend une décision
humaine » qui ne se contourne pas.

**[`13-INTEGRATION-ALPHA.md`](./13-INTEGRATION-ALPHA.md) passe en version 2**
(issue #27), la version 1 conservée intégralement dessous. Elle réconcilie deux
découpages qui coexistaient sans se recouvrir — trois « niveaux » 1/2/3 et trois
niveaux A/B/C — en séparant le **niveau de licence** (A, B, C) de l'**usage
produit** (compagnon, après-parcours). La décision est **Niveau A**,
c'est-à-dire référencement sans licence de contenu ; le Niveau B est ce que
demande le premier contact, et le Niveau C reste hors périmètre jusqu'à licence
signée. Le mode compagnon est conçu comme une grille de semaines vides que
l'Église remplit de pointeurs : il n'y a pas de contenu Alpha à ne pas copier
parce qu'il n'y a pas de contenu du tout. Le canal de premier contact est
vérifié et un courriel est rédigé, à envoyer par un humain. Deux écarts nommés :
le nombre de sessions d'Alpha n'est pas vérifié et ne doit pas être codé en dur,
et l'issue est jalonnée M3 quand le doc 09 range le sujet en Phase 5.

**[`23-IA-EDITORIALE.md`](./23-IA-EDITORIALE.md) est nouveau** (issue #26).
L'outil sert un auteur pendant qu'il écrit un parcours, et n'est jamais présent
quand un participant le lit. Trois usages fermés — questions de réflexion,
reformulation, niveau de langue — et une liste de ce qu'il ne fait pas, dont la
section `context` d'une séance, le choix du passage et la traduction. La
garantie sur les journaux privés est écrite comme structurelle et vérifiée dans
ce dépôt : `supabase/` ne contient que `config.toml` et `migrations`, donc
**aucun composant serveur n'existe** d'où un journal pourrait être lu ;
`journal_entries` porte quatre politiques own-only et un `grant` à
`authenticated` seul. Le document nomme ce que cette garantie ne couvre pas —
un auteur qui recopie un extrait de journal dans l'outil, qu'aucune RLS
n'arrête — et le renvoie à une clause de provenance et à l'étape 4 du workflow
du doc 07. Huit cas de test, dont un témoin négatif et une escalade progressive.

**[`24-ECOSYSTEME-AGAPEPLAY.md`](./24-ECOSYSTEME-AGAPEPLAY.md) est nouveau**
(issue #25). Il relie Tandem à Versets Flash et à Alléluia! sans jamais rendre
l'un nécessaire à l'autre : le défi de mémorisation est validé par
auto-déclaration dans Tandem, et Versets Flash n'en est qu'un accélérateur
facultatif. La mesure d'usage croisé compte deux événements de part et d'autre
et **ne les rapproche jamais par personne** : aucun identifiant ne voyage dans
un lien, pas même haché — un identifiant haché reste une clé de jointure, et
c'est la jointure que le doc 08 interdit.

Un fait relevé dans l'autre dépôt a changé une décision de conception, et mérite
d'être consigné ici : **Versets Flash intercepte les liens profonds sur un
appareil neuf**. Tant que son état local d'accueil n'est pas posé et que
personne n'est connecté, il affiche son écran d'accueil à la place de la route
demandée, sauf pour une liste fermée de chemins publics ; et son parcours
d'installation termine sur l'écran de session, sans conserver la destination
d'origine. Un lien précis fonctionne donc pour qui a déjà l'application, et se
dissout pour tous les autres — c'est-à-dire pour ceux à qui Tandem le propose.
Le lien retenu pointe vers la racine, et la séance ne promet rien de plus.
## Amendement du 25 août 2026 — la mesure respectueuse (issue #20)

*Ajouté sans rien retirer de ce qui précède. Le détail vit dans
[`25-MESURE-ET-VIE-PRIVEE.md`](./25-MESURE-ET-VIE-PRIVEE.md) ; on ne garde ici
que les décisions et les écarts.*

`analytics_events` existait depuis la migration `…_000007` et n'avait **jamais
reçu une ligne** : rien n'émettait. Le doc 08 décrivait un catalogue et un
funnel que personne ne pouvait lire. Voici ce qui a été tranché.

**`anonymous_id` naît sur l'appareil, et n'est relié à personne.** Un tirage
aléatoire dans le stockage local, jamais l'`auth.uid()` ni une dérivation. Un
trigger refuse le cas littéral en base ; le domaine partagé refuse la forme plus
tôt. Il se renouvelle au bout de treize mois — un plafond qui ne coûte rien au
funnel, dont l'horizon le plus long est de 42 jours, et qui empêche la mesure de
devenir un suivi durable. **Le funnel compte donc des appareils, pas des
personnes**, et la vue SQL le dit dans son propre commentaire.

**Le consentement : information claire et interrupteur, pas de bannière.** Il
n'y a aucun tiers à faire accepter — le produit n'appelle aucun service
extérieur — et une bannière apprendrait seulement à cliquer « J'accepte » sans
lire, ce qui est le contraire du service à rendre à quelqu'un de seize ans. Le
réglage vit sur l'appareil **et** sur le compte
(`public.mesure_preferences`) : chaque appareil lit la préférence du compte à
l'ouverture de session, et **le refus l'emporte toujours** sur l'accord local.
Un refus efface l'identifiant sur-le-champ. Web et mobile, tous les deux.

**Le funnel se lit sans back-office.** `public.mesure_funnel_binome`, sept
étapes, **aucun `grant`** — même raisonnement que `tandem_moderators` : l'absence
de droit est la protection. Une vue ordinaire s'exécute avec les droits de son
propriétaire, si bien qu'un `select` accordé un jour ouvrirait la table entière
à travers elle. Les requêtes datées, que la vue ne peut pas porter, sont écrites
dans le doc 23.

**L'insertion n'est plus ouverte à `anon`.** `…_000007` l'autorisait avec
`with check (true)` : sur un site statique dont la clé publiable est dans le
paquet, c'était un point d'écriture anonyme sans limitation de débit sur la seule
mesure du produit. Contrepartie assumée : les gestes faits en mode démonstration
ne sont plus mesurés.

**La suppression des données de mesure tient en une phrase : il n'y a rien à
supprimer qui pointe vers quelqu'un.** Aucune colonne d'`analytics_events` ne
désigne un compte, donc aucun prédicat ne peut sélectionner « les événements de
cette personne ». Ce qui se supprime réellement est l'identifiant d'appareil, et
les deux applications l'effacent. `supprimer_mon_compte()` emporte en plus la
ligne de consentement. L'export ne contient pas les événements et **le dit
lui-même**, dans un champ du fichier.

**L'émission ne casse jamais un geste produit** — l'exception assumée à « toute
écriture lit sa réponse » : on lit la réponse pour la jeter. Aucune file
hors-ligne : la perte est assumée, un événement n'appartient à personne.

*Écarts nommés, tous dans le doc 23 :* `weekly_checkin_completed` n'a aucun geste
(issue #18), donc la North Star « semaines accompagnées » rend **zéro par
construction** — l'API est posée pour qu'il n'ait qu'à s'y brancher ;
`account_created` n'est pas émis sur mobile, faute d'écran de confiance ; aucune
durée de conservation n'est fixée ; la relecture juridique reste à faire.

*Preuves par mutation :* contrainte `analytics_events_metadata_sobre` retirée sur
base vivante → les trois tests de contenu rougissent seuls, restaurée → verts ;
insertion rouverte à `anon` → le test du visiteur non connecté rougit seul,
refermée → vert.

---

## Amendement du 25 août 2026 — catégories, urgence et escalade (issue #19)

*Ajouté sans rien retirer de ce qui précède. Les deux amendements plus bas
restent valables ; celui-ci ferme l'issue #19, dont la file de signalements et
l'espace modérateur étaient déjà livrés (PR #38).*

Il restait deux critères à l'issue #19 : « catégories et niveaux d'urgence » et
« procédure d'escalade humaine ». Les voici, avec les décisions qu'ils ont
demandées.

**La raison d'un signalement était un texte libre, et dans les faits une phrase
figée.** Les deux applications écrivaient « Signalement depuis la conversation »
dans `reason` — littéral non traduit, décision assumée de la PR #42. Un
modérateur ouvrant la file lisait donc huit fois la même phrase.

**Six catégories, écrites pour quelqu'un de seize ans.** `malaise`,
`insistance`, `secret`, `sexuel`, `danger`, `autre` — des phrases à la première
personne, sans « harcèlement » ni « comportement inapproprié ». Chacune nomme
**une** situation : un libellé qui en coudrait trois obligerait un adolescent à
traduire ce qu'il vit dans le vocabulaire de la modération. Une septième valeur,
`non_precise`, n'est proposée par aucun écran (voir plus bas).

*Ce qui n'est délibérément pas une catégorie* : « on me propose de se voir en
dehors de l'application ». Le tandem est proposé par une église et une rencontre
en présence y est normale ; en faire un motif de signalement apprendrait à
signaler le cadre lui-même. Ce qui alarme est la discrétion demandée autour, et
c'est `secret` qui la porte.

**L'urgence est déduite, jamais saisie.** Demander à un adolescent de trier sa
propre urgence lui fait porter deux charges au pire moment, et c'est précisément
le jugement que quelqu'un sous emprise fait le plus mal. Le modérateur ne peut
pas la poser non plus : elle doit exister avant qu'il ouvre la file, puisque
c'est elle qui décide de l'ordre. C'est donc le produit qui la déduit —
`sexuel` et `danger` en immédiat, `insistance` et `secret` en élevé, le reste en
ordinaire — par une **colonne générée**. PostgreSQL refuse toute valeur proposée
par un client (« cannot insert a non-DEFAULT value into column »), si bien
qu'il n'y a ni politique à écrire ni grant à retirer : une application compromise
ne peut pas minorer une urgence. Contrepartie assumée : changer la dérivation
demande une migration, et recalcule les lignes existantes.

**L'ordre de la file : statut, puis urgence, puis le plus récent.** L'urgence
départage à statut égal, et jamais l'inverse — un dossier clos et « immédiat » ne
doit pas passer devant un dossier ouvert et « ordinaire ». Le troisième critère
est inchangé : ce chantier avait une raison de changer l'ordre, il n'en avait
aucune de changer celui-là.

**Les huit dossiers réels de production deviennent `non_precise`.** Les ranger en
`autre` aurait été une falsification douce : la table dirait que la personne a
choisi « autre chose », alors qu'on ne lui a jamais posé la question. Ils gardent
leur `reason` intact, s'affichent sous un libellé qui leur est propre — « sans
catégorie, signalement antérieur aux catégories » — et prennent l'urgence
ordinaire : ni relégués, ni promus devant des dossiers dont on sait, eux, ce
qu'ils contiennent. `category` n'a **aucun défaut**, délibérément : un défaut
laisserait insérer sans choisir, et on aurait remplacé un littéral figé par un
autre.

**`reason` survit en mot libre facultatif.** Le supprimer aurait effacé les huit
témoignages existants et retiré à la modération le seul endroit où une situation
se raconte avec ses propres mots. La contrainte de longueur n'a pas été touchée :
`char_length(NULL)` rend NULL, un `check` qui rend NULL passe — mesuré. Elle
refuse toujours la chaîne vide, d'où l'obligation, côté applications, d'envoyer
`null` et non `''`.

**La procédure d'escalade est écrite** dans
[`22-PROCEDURE-ESCALADE.md`](./22-PROCEDURE-ESCALADE.md), et l'espace modérateur
en expose l'essentiel là où la décision se prend. Elle est honnête sur ce que
l'outil ne fait pas, et nomme au passage un écart avec le doc 06 : celui-ci
promet qu'« un signalement grave impliquant un mineur est escaladé
**automatiquement** à AgapePlay », alors que rien n'est détecté ni escaladé
automatiquement. Le doc 06 n'a pas été réécrit — l'arbitrage revient au
responsable produit.

**Deux mesures faites sur base vivante plutôt que supposées**, et qui ont chacune
corrigé une attente :

- Une colonne générée est refusée **avant** le contrôle des droits : un
  `update … set urgency = …` rend « column "urgency" can only be updated to
  DEFAULT », et non « permission denied ». Le test attendait le second.
- `alter table … add column if not exists` ne répare pas une expression de
  colonne générée déjà en place. Rejouer la migration après une mutation laisse
  donc la base fausse **en silence** — la restauration s'est faite en croyant
  avoir réussi, et seul le test resté rouge l'a dit.

### Ce que l'issue #19 laisse ouvert

- Un seul modérateur nommé : aucune suppléance, aucune relance sur un dossier
  pris en charge puis oublié. Les délais du doc 22 sont des objectifs, pas des
  garanties, et c'est écrit comme tel.
- La personne qui signale voit son dossier et son statut, mais n'apprend jamais
  ce qui a été décidé.
- Aucune note de modération dans l'application : `tandem_reports` n'accorde
  l'écriture que sur `status`, et c'est ce qui protège le témoignage de la
  personne. Ce que le modérateur consigne vit donc dans un registre hors dépôt.
- Un modérateur ne peut pas bloquer une relation — le blocage exige
  `auth.uid() = blocked_by`. Toute mesure sur la relation passe par un humain.

---

## Amendement du 25 août 2026 — le partage du journal (issue #11)

*Ajouté sans rien retirer de ce qui précède. Le corps du document reste l'état
du 6 août ; l'amendement sur la suppression de compte, plus bas, reste valable
et cet amendement-ci s'y adosse.*

L'issue #11 demandait trois choses au journal privé : un partage explicite à un
destinataire, son retrait, et la suppression d'une entrée. La base savait déjà
supprimer (`journal_delete_own` existe depuis la première migration) — c'est
l'écran qui n'avait pas le geste. Le partage, lui, n'existait nulle part : la
matrice du doc 06 range le journal en « binôme : **non par défaut** », et ce
« par défaut » n'avait aucun chemin pour être levé.

### Le destinataire est le tandem, pas une personne

La table `public.journal_shares` porte `(entry_id, tandem_id, shared_by)`, avec
`(entry_id, tandem_id)` en clé primaire. Le choix de `tandem_id` **à la place**
d'un `shared_with uuid` est la décision structurante : il n'existe aucune valeur
de cette colonne qui désigne un mentor ou un responsable. Un `shared_with`
aurait accepté n'importe quel identifiant et se serait reposé sur une garde
qu'un correctif bien intentionné peut relâcher ; ici, c'est la forme de la table
qui refuse. Le partage porte sur une entrée, jamais sur le journal : geste par
entrée, retrait par entrée.

### Le destinataire lit par une fonction, pas par une politique

`journal_entries` **garde ses quatre politiques own-only, inchangées**. Aucune
n'a été ajoutée, et c'est délibéré : les politiques sont permissives et
s'additionnent (« la garde la plus permissive fixe le niveau »), une politique
SELECT s'applique aussi aux UPDATE et DELETE dès qu'ils lisent, et une politique
qui consulterait `journal_shares` le ferait sous les droits de l'appelant et
sous la RLS de cette table — le piège déjà consigné plus bas. Il aurait donc
fallu une fonction `security definer` de toute façon : autant qu'elle *soit* le
chemin.

`journal_partage_avec_moi()` est donc le seul chemin de lecture du journal
d'autrui : `security definer`, `search_path` figé, identité par `auth.uid()`, et
**sans paramètre**, comme `tandem_partenaire()` et `supprimer_mon_compte()`.
Conséquence directe : `tests/rls/journal-prive.test.ts` reste vrai mot pour mot.
Mais la surface d'attaque a changé de nature — elle est dans un `where`, plus
dans un `using` — et `tests/rls/partage-journal.test.ts` reprend donc le décor
du mentor rattaché et vérifié pour le mesurer là où il est désormais.

### Trois décisions qu'un test épingle

- **Le partage meurt avec la relation, et c'est l'inverse des messages.** La
  lecture exige `t.status in ('active', 'paused')` : un tandem bloqué ou terminé
  referme les partages **pour les deux, y compris pour la personne qui a
  bloqué**. `messages_select_member` fait le contraire — elle garde l'historique
  à qui a bloqué, qui en a besoin pour signaler. Les deux règles sont justes
  ensemble : la conversation est écrite à deux, une entrée de journal reste
  entière à son auteur, et bloquer quelqu'un veut dire « je ne lui donne plus
  rien à lire ». `packages/domain/src/partage.test.ts` tient ce contraste sur une
  même entrée, pour qu'on ne vienne pas « harmoniser » les deux.
- **Les lignes de partage survivent au blocage.** Un blocage se lève ; un
  effacement, non. Détruire les choix de l'autrice sur un changement de statut
  réversible les lui ferait perdre en silence. La ligne reste, la lecture se
  referme, l'écran le dit.
- **Le retrait est une vraie suppression de ligne, sans pierre tombale.** Une
  ligne « entrée retirée » apprendrait au destinataire qu'il y avait quelque
  chose et qu'on le lui a repris — plus d'information que l'autrice n'a choisi
  d'en donner. En revanche l'écran dit à l'autrice ce que le retrait ne peut pas
  faire : ce que son binôme a déjà lu, il l'a lu.

### À la suppression de compte

`supprimer_mon_compte()` n'a pas eu besoin d'une ligne de plus : la clé
étrangère `entry_id → journal_entries on delete cascade` emporte tous les
partages émis avec le journal. Le test le prouve au lieu de le supposer — une
clé qu'on passerait un jour en `on delete set null` romprait la promesse en
silence. Les partages **reçus** restent : ce sont les entrées d'une autre
personne, et c'est exactement la ligne « on efface la personne, on garde la
relation ». Aucune fuite n'en découle, la même fonction passant le tandem à
`ended` (ou le laissant `blocked`), ce qui referme la lecture des deux côtés.

### Côté écran

- **Journal** : par entrée, « partager avec mon binôme » / « retirer le
  partage » et « supprimer ». Chaque geste lit sa réponse — un DELETE refusé par
  un `using` ne lève rien, il rend zéro ligne — d'où le `.select()` accroché à
  chaque suppression dans `apps/web/src/partageJournal.ts`.
- **Pas de bouton là où la base refuserait, et une phrase à la place**, pour
  quatre refus distincts : pas de binôme, relation bloquée, relation terminée,
  et hors ligne. Un cinquième cas est propre à ce dépôt : une entrée écrite hors
  ligne n'existe pas encore côté base, le `exists` du `with check` la
  refuserait, et son geste de partage est donc retiré tant que la file n'est pas
  vidée.
- **La suppression retire aussi l'opération en attente** (`removeSync`). Sans
  cela, l'`upsert` posé par une écriture hors ligne serait rejoué à la
  reconnexion et ferait réapparaître l'entrée supprimée, sans que rien ne
  l'explique.
- **Côté destinataire** : un panneau sous la conversation, dans l'onglet tandem,
  parce qu'il s'agit de la relation et non du journal. Le vide y a deux sens —
  « il ne m'a rien partagé » et « la relation est fermée » — et le panneau dit
  lequel des deux.

### Hypothèse héritée, à ne pas découvrir plus tard

`tandems_active_pair_idx` est unique sur la **paire**, pas sur la personne :
rien n'interdit à un même compte d'avoir deux tandems `active` simultanés, ni
une relation terminée à côté d'une relation vivante. `App.tsx` en prend un seul
(`.order(...).limit(1)`). Le partage hérite de cette hypothèse — l'écran dit
« ton binôme » au singulier. La base, elle, la tient sans ambiguïté, chaque
ligne de partage nommant son tandem.

L'écran du journal ne montre donc que les partages **du tandem courant**. Sans
ce filtre, une entrée partagée du temps d'une relation refermée dirait « Partagé
avec ton binôme » alors que le binôme actuel ne la lit pas, et offrirait
« retirer le partage » à la place d'un partage que la base accepterait : deux
mensonges pour le prix d'un. Ce que le filtre laisse hors de l'écran est assumé,
et c'est le prolongement de la décision « la ligne survit au blocage » — une
ligne posée sur une relation refermée devient invisible et non retirable
d'ici. Elle n'est lisible par personne (le statut la ferme) et elle part avec
son entrée ou avec le compte : ni orphelin, ni fuite.

### Écart mobile, constaté et non traité

`apps/mobile` ne connaît rien du partage : ni geste, ni panneau, ni suppression
d'entrée. Le chantier était borné au web. L'écart est donc le même que celui
qu'a connu la conversation avant le 24/08 — la règle est déjà dans
`packages/domain`, partagée, et c'est ce qui rendra la reprise courte.

### Vérifié

- `npm test` — 115 tests ; `npm run test:rls` — 165 tests, dont 21 nouveaux.
- **Vérification par mutation**, sur la base vivante, script dans
  `.rls-stack/mutation-partage.sql` :
  - conjonct d'appartenance au tandem retiré du `where` de
    `journal_partage_avec_moi()` → 11 tests rougissent, tous dans
    `partage-journal.test.ts`, dont « le mentor ne tire rien de la fonction » ;
    les 13 autres fichiers restent verts ;
  - conjonct `s.shared_by <> auth.uid()` retiré → exactement les deux tests qui
    affirment que l'autrice ne se voit pas rendre ses propres entrées.
  - Restauration à chaque fois en rejouant `supabase/migrations/20260825160000_partage_du_journal.sql`
    **depuis le fichier**, ce qui vérifie du même coup qu'il est rejouable.
- `tsc -b` et `vite build` : passent.

---

## Amendement du 25 août 2026 — la suppression de compte (issue #7)

*Ajouté sans rien retirer de ce qui précède. Le corps du document reste l'état
du 6 août.*

L'issue #7 promettait trois choses que le produit n'avait pas : une purge
derrière la demande de suppression, un export des données, une révocation des
sessions. Les trois sont livrées. Ce que l'écran faisait jusque-là — poser
`account_status = 'deletion_requested'` sur `profiles` — n'était consommé par
rien ; ce drapeau n'est plus le geste, il n'en est que la trace.

### La ligne de conduite, et pourquoi elle n'est pas la cascade

Le schéma proposait un chemin tout tracé et piégé : supprimer la ligne
`auth.users`. Quatre clés étrangères y pendent en `on delete cascade`
(`tandems.participant_a_id` et `_b_id`, `tandem_messages.sender_id`,
`tandem_reports.reporter_id`, et `tandem_reports.tandem_id` vers `tandems`).
Ce seul `delete` emporte donc le tandem entier, la conversation du binôme
restant — **ses propres phrases comprises** — et les signalements portant sur la
relation. Sur un produit qui met en relation des mineurs et des adultes, cela
offre à qui a mal agi le moyen le plus simple d'effacer la preuve : se
supprimer.

La ligne retenue est donc : **on efface la personne, on garde la relation et la
trace.**

| Ce qui disparaît | Ce qui reste, et pourquoi |
|---|---|
| Journal, progression, préférences, appartenances d'église et de groupe, profil mentor et affectations, rôle de modérateur | Les messages envoyés, dans la conversation du binôme, sans nom au-dessus : ils sont aussi la correspondance de l'autre |
| Toute invitation portant son identifiant ou son adresse, dans les deux sens | Les signalements et le journal d'audit — l'en-tête de `20260806180000` avait déjà refusé toute clé étrangère à `tandem_report_audit` pour cette raison précise |
| Nom, adresse e-mail, téléphone, mot de passe, métadonnées d'identité, sessions ouvertes | La ligne `profiles`, vidée et datée : une ligne absente ferait dire à l'écran du binôme « pas encore de nom » |

Ce que cet arbitrage coûte est écrit dans la migration : le texte des messages
non signalés survit à son auteur. C'est dit à l'écran **avant** le geste, et il
reste une dette nommée — une durée de conservation avec purge des tandems
terminés, qui demande un cron et une décision de durée.

### Deux décisions qu'un test épingle

- **Un tandem bloqué reste bloqué.** Le faire passer à `ended` rouvrirait tout
  l'historique à la personne bloquée (`messages_select_member` ne referme la
  lecture que tant que `status = 'blocked'`), au moment précis où celui qui l'a
  bloquée s'en va. Le blocage survit à son auteur.
- **La RPC n'a aucun paramètre.** C'est la réponse structurelle à « un tiers ne
  peut pas supprimer autrui » : il n'y a personne à nommer, donc aucune garde
  interne à relâcher. Un test échoue le jour où une variante à paramètre
  apparaît.

### Ce que le binôme restant voit

`tandem_partenaire()` rend une colonne de plus, `partenaire_supprime`, tirée de
`auth.users.deleted_at` — **et non de `profiles.account_status`**, que
`profiles_update_own` met à la portée de son propriétaire : n'importe qui
pourrait sinon se déclarer supprimé sur l'écran d'en face. La vue du tandem
distingue désormais « terminé » de « bloqué », qui partageaient le même
vocabulaire : un binôme dont le compte d'en face disparaît lisait « Bloqué » et
pouvait comprendre qu'on l'avait écarté.

### L'export et la révocation

L'export est assemblé côté client (`apps/web/src/export.ts`) à partir de
lectures déjà permises par les politiques `own only` : il n'ouvre aucune porte.
Sa règle est de **ne jamais rendre un fichier amputé en silence** — toute
lecture en erreur, ou qui ne rend même pas une liste vide, interrompt l'export.
Il déclare aussi ses propres trous : les messages d'une relation où l'on a été
bloqué ne sont plus lisibles depuis son compte, et le fichier le dit.

La révocation est double, et l'ordre compte : la fonction efface les lignes
`auth.sessions` côté serveur — ce qui ne dépend d'aucun client — et
l'application appelle ensuite `signOut({ scope: 'global' })`, qui n'en est que
le pendant visible. Un geste « me déconnecter partout » est disponible seul dans
les réglages. Enfin la purge continue là où elle est visible : `localStorage`
est vidé (état et file de synchronisation), sans quoi le journal resterait sur
l'ordinateur — souvent partagé, à seize ans.

### Vérifié

- `npm test` — 109 tests ; `npm run test:rls` — 144 tests, dont 13 nouveaux.
- Vérification par mutation, sur la base vivante, un conjonct à la fois
  (`.rls-stack/muter-suppression.mjs`) : la garde d'identité retirée, le lien
  `where user_id = v_uid` élargi à `where true`, le conjonct
  `status <> 'blocked'` supprimé. **Chacune fait rougir exactement un test**, les
  douze autres restant verts.
- `tsc -b`, `vite build`, `npm run mobile:typecheck` : passent.

---

## Ce qui a changé le 6 août

Le projet est passé d'**aucun test** à **157**, et quatre défauts de sécurité
réels ont été trouvés puis corrigés. L'ADR-002 s'engageait à tester migrations
et politiques « comme du code de sécurité » ; c'est maintenant le cas.

| PR | Ce qu'elle apporte |
|---|---|
| #29 | Socle de tests. Il n'y en avait aucun. |
| #30 | Le blocage devient une barrière (colonne `blocked_by`). |
| #31 | L'appariement redevient possible (`grant insert` manquait). |
| #32 | Migrations renommées en quatorze chiffres, et la garde qui l'exige. |
| #33 | Écran de déblocage, web et mobile. |
| #34 | Rôle modérateur, et blocage qui ferme le canal d'invitation. |
| #35 | Suivi des signalements et journal d'audit immuable. |

### Les quatre défauts, pour mémoire

1. **Un adolescent bloqué pouvait se débloquer lui-même.** La politique ne
   contraignait pas la colonne `status` et le droit d'écriture portait sur toute
   la table. Le blocage n'était pas une barrière mais un réglage que la personne
   écartée pouvait annuler seule.
2. **Le blocage ne coupait que l'écriture** : la personne bloquée relisait tout
   l'historique.
3. **L'appariement ne pouvait pas aboutir.** Aucun `grant insert` sur
   `tandems`, et la fonction d'acceptation passée en `security invoker` : une
   politique RLS restreint un droit, elle ne l'accorde pas.
4. **Un signalement n'était lisible de personne** — pas même via `service_role`,
   qui n'a aucun droit sur cette table.

---

## Comment on teste ici

Deux suites étanches.

```bash
npm test          # 78 tests, aucune base requise, ~1 s
npm run test:rls  # 131 tests sur une vraie base Postgres locale, ~90 s
```

La seconde monte une pile Supabase jetable et parle **SQL directement**
(`set local role authenticated` + `request.jwt.claims`), chaque test dans une
transaction annulée. Passer par PostgREST ajouterait une couche HTTP sans rien
tester de plus des politiques.

### La règle qui vaut plus que les tests eux-mêmes

**Un test qui ne peut pas échouer ne prouve rien.** Chaque test de sécurité est
accompagné d'une mutation : on casse **un conjonct à la fois** sur la base
vivante, on vérifie que le test visé rougit, on restaure, et un témoin positif
reste vert pour prouver que ce n'est pas le harnais qui a bougé.

Cette discipline a payé plusieurs fois :

- Une mutation ne faisait rougir aucun test. Plutôt que de conclure que le
  conjonct était décoratif, la cause a été cherchée : une sous-requête dans une
  politique subit la RLS de la table interrogée. Deux tests sont nés de là, dont
  celui qui empêche **un signalement de devenir une clé pour reprendre pied dans
  une conversation dont on a été écarté**.
- Une boucle de mutation s'est révélée fausse deux fois — `create or replace
  view` refuse de changer le jeu de colonnes, puis le correctif par `drop`
  emportait le droit de lecture et faisait rougir pour la mauvaise raison. Sans
  ces ratés reconnus et rejoués, la boucle aurait été verte **sans rien
  mesurer**.
- Une assertion restait verte sous mutation parce qu'un `resolved_at` NULL donne
  un écart NULL, que `Number(null)` transforme en 0 — donc « moins de
  60 secondes ».
- Relâcher le `using` d'`invitations_update_participant` n'a rien fait rougir.
  Cause : un tiers est arrêté par **deux** barrières indépendantes, la
  politique SELECT s'appliquant aussi à l'UPDATE. C'est elle, et non le
  `using`, qui rend le refus silencieux — un client qui ne lirait que `error`
  serait donc correct par accident.

---

## Ce qui reste à faire

### 1. Appliquer les migrations — ✅ FAIT (constaté puis complété le 24/08/2026)

**L'état décrit ci-dessous est dépassé.** Au 24 août, le journal distant
portait déjà les treize migrations sous leurs bons noms à quatorze chiffres —
la réconciliation du doc 20 ET le push des six migrations de sécurité avaient
été faits entre le 6 août et la mise en pause du projet, sans que ce document
soit mis à jour. Vérifié artefact par artefact sur le schéma réel (colonnes de
blocage, table des modérateurs, vue de contexte, fonctions, triggers, grant
d'insertion) : le journal ne mentait pas. La quatorzième —
`partenaire_visible` (PR #37) — a été poussée le 24/08 et vérifiée :
`security definer`, sans paramètre, EXECUTE pour `authenticated` seul.

Au passage, deux faits utiles : le projet distant s'appelle « Tamdem » (sic)
et vivait en pause ; et la base est **vide** — zéro tandem, zéro profil. Le
paragraphe d'origine reste ci-dessous comme trace de ce qui était cru.

**Six migrations attendent dans le dépôt, aucune n'est appliquée** :
`blocage_effectif`, `appariement_possible`, `invitation_bloquee`,
`role_moderateur`, `blocage_depuis_quand`, `suivi_moderation`. Tout ce qui
précède — blocage, appariement, modération, audit — dort tant que la base réelle
ne les a pas reçues.

Deux contraintes, dans cet ordre :

- Le journal du projet distant enregistre encore les sept migrations d'origine
  sous leurs **anciennes** versions. Un `db push` en l'état tenterait de les
  rejouer. Marche à suivre : [`20-RECONCILIER-LES-MIGRATIONS.md`](./20-RECONCILIER-LES-MIGRATIONS.md).
- **`blocage_effectif` doit être appliquée avant tout déploiement du web** : le
  bouton « Bloquer » renseigne désormais `blocked_by` et la politique l'exige.
  L'inverse casse le blocage.

À l'application, `blocage_effectif` lève un avertissement s'il trouve des
tandems déjà bloqués : leur `blocked_by` vaut NULL, ils sont gelés, et le dégel
est un geste humain décrit dans l'en-tête de la migration. Lire la sortie plutôt
que la faire défiler.

### 2. Le nom du partenaire est codé en dur

**« Élodie Martin » apparaît en dur** dans `apps/web/src/views/index.tsx:206`,
`apps/mobile/app/tandem.tsx:102`, `apps/web/src/storage.ts:11`, et dans les
textes eux-mêmes (« Partager avec Élodie »).

Le vrai nom du partenaire n'est **jamais** affiché, même connecté, même avec un
tandem réel en base. C'est le plus large écart du projet entre ce que la base
sait et ce que l'écran montre.

Au passage : le bouton « Partager avec Élodie » appelle `onOpenTandem`. Il
n'existe aucun partage de journal — le libellé est trompeur, la fonctionnalité
manquante n'existe pas.

### 3. Aucune interface de modération — ✅ FAIT (24/08/2026)

**L'état décrit ci-dessous est dépassé.** L'espace modérateur existe dans
l'application web depuis la branche `feat/interface-moderation` : onglet visible
des seuls comptes pour lesquels `tandem_est_moderateur()` rend vrai, lecture des
signalements avec leur contexte et le message signalé, changement de statut, et
journal des décisions par dossier. **Aucune migration n'a été nécessaire** — les
six chemins étaient déjà servis à `authenticated`. Le rappel de conception
ci-dessous tient toujours et n'a pas été touché : `tandem_moderators` n'a
toujours ni grant ni politique, et la nomination reste un geste humain dans
l'éditeur SQL. Le paragraphe d'origine reste ci-dessous.

La base est prête et éprouvée. Mais **nommer un modérateur et lire les
signalements se font à la main dans l'éditeur SQL**. C'est le chantier le plus
rentable maintenant que le socle existe.

Rappel de conception à ne pas défaire : `tandem_moderators` n'a **ni grant ni
politique**, volontairement. Un `grant select` publierait la liste des
modérateurs à tout compte authentifié. La table se consulte par
`tandem_est_moderateur()`, sans paramètre — avec un paramètre, elle deviendrait
un énumérateur.

### 4. Aucun écran pour les invitations en attente — ✅ FAIT (24/08/2026)

**L'état décrit ci-dessous est dépassé.** Le suivi des invitations existe dans
l'application web depuis la branche `feat/invitations-en-attente` : sous la
conversation du tandem, la liste de ce qu'on a envoyé avec son état, et le
bouton qui reprend une invitation vivante. **Aucune migration n'a été
nécessaire** — le chemin d'écriture existait déjà (`grant select, insert,
update` de `…_000002` et `invitations_update_participant`), au point que le
témoin positif de `tests/rls/invitation-bloquee.test.ts:139` le prouvait sans
que rien ne l'utilise.

Deux choses valent d'être retenues de ce chantier :

- **`status` ne dit pas l'état d'une invitation.** Rien — ni trigger, ni cron —
  ne la fait passer à `expired` ; `expires_at` est le seul juge, et c'est lui
  que lisent `accept_tandem_invitation` et `tandems_insert_member`. Un écran
  qui recopierait la colonne afficherait « en attente » pour l'éternité. La
  règle vit dans `packages/domain/src/invitations.ts`.
- **Un tiers est arrêté par deux barrières, pas une.** PostgreSQL applique les
  politiques SELECT à un UPDATE qui lit des colonnes : c'est
  `invitations_select_participant`, et non le `using` de la politique UPDATE,
  qui rend le refus *silencieux*. Mesuré par mutation (voir l'en-tête de
  `tests/rls/invitations.test.ts`). Le `using` seul laisserait le tiers
  atteindre le `with check`, qui lève.

Le paragraphe d'origine reste ci-dessous.

On peut inviter. Une invitation en attente ne se voit ni ne se révoque depuis
l'application.

### 5. Le mobile n'a jamais tourné sur un appareil — ✅ SÉANCE FAITE (24/08/2026)

**Amendement du 24/08/2026 — la conversation existe sur mobile.** Le retard des
tables est réduit : l'écran tandem lit et écrit désormais `tandem_messages`,
avec le fil, le composeur, et une phrase pour chaque état — pas de tandem,
lecture coupée par un blocage, envoi raté. **Aucune migration** : les deux
chemins existaient depuis `…_000002`, resserrés par `blocage_effectif`. La
règle de lecture et d'écriture vit dans `packages/domain/src/conversation.ts`,
comme `unblockAffordance` avant elle, et le cas qu'elle sert est celui qu'aucune
réponse HTTP ne signale : `messages_select_member` filtre **en silence**, si
bien qu'une personne bloquée reçoit zéro ligne et aucune erreur. Sans cette
règle, l'écran lui afficherait « rien encore ». Les deux écarts avec le web sont
recensés dans le tableau des écarts assumés.

**L'état ci-dessous est daté.** Le 24 août, l'application a tourné sur un
Android réel (Expo Go 57, Metro exposé sur l'IP publique du serveur — le
tunnel ngrok d'Expo était en panne et s'est révélé inutile). Verdict : elle
démarre, navigue, s'affiche — et la séance a trouvé puis réparé une chaîne
de défauts que rien d'autre ne pouvait révéler, détaillés dans la PR de la
séance. Le plus important : **la connexion par lien magique n'avait jamais
pu aboutir dans AUCUN environnement** — liste d'autorisation du projet vide
(tout lien rabattu vers localhost:3000), adresse de retour codée en dur, et
surtout aucun écouteur d'URL pour ramasser les jetons au retour. Le circuit
complet existe désormais et une connexion réelle a été constatée côté
serveur (last_sign_in_at). Pièges d'outillage mesurés, pour la prochaine
séance : Expo Go du Play Store ne porte qu'UN SDK (APK versionné sur
expo.dev/go pour un projet plus ancien) ; sur ce serveur, Metro ne détecte
pas les changements de fichiers (chaque correctif = redémarrage avec
--clear + re-scan, et vérifier le bundle servi par un grep de marqueur — un
redémarrage a servi du cache) ; le rechargement à chaud n'y fonctionne pas.

Le paragraphe d'origine reste ci-dessous comme trace de ce qui était cru.

### (état antérieur) Le mobile n'a jamais tourné sur un appareil

Il compile, Metro le résout, les écrans existent — personne ne les a vus
s'afficher. Il ne lit par ailleurs que **deux** tables (`tandems`,
`session_progress`) contre onze côté web : son retard est réel, pas cosmétique.

`npm run mobile:export` est la seule commande qui exerce vraiment Metro et
prouve la résolution des workspaces. `mobile:typecheck` ne prouve rien là-dessus.

### 6. Dette, réelle mais pas urgente — ✅ TROIS POSTES SUR QUATRE SOLDÉS (24/08/2026)

**Amendement du 24/08/2026.** Les trois premiers points de la liste ci-dessous
sont réglés dans l'application web ; le quatrième n'est pas de la dette et n'a
pas été touché. **Aucune migration, aucun changement visuel, aucune montée de
version.**

- **Les deux blocs `:root` n'en font plus qu'un.** Comparaison faite déclaration
  par déclaration : le premier bloc était mort en entier sauf `font-synthesis` et
  `text-rendering`, que le second ne redéclarait pas. Le bloc unique porte donc
  les valeurs du thème imprimé — celles qui s'appliquaient déjà — plus ces deux
  lignes. Vérifié par un diff du CSS **produit** avant et après : la seule
  différence est la disparition du bloc doublon, à cascade identique. Les deux
  commentaires qui se défendaient du défaut en citant « ligne 217 » (espace
  modérateur, suivi des invitations) disent maintenant la vraie raison de leur
  place en fin de fichier : ils écrivent des couleurs en clair et doivent suivre
  les reprises du thème.
- **Les sept dépendances sont épinglées** sur ce qui était installé, en `^x.y.z`
  (`react` et `react-dom` 19.2.8, `typescript` 7.0.2, `vite` 8.2.0,
  `@types/react` 19.2.18, `@types/react-dom` 19.2.4, `@vitejs/plugin-react`
  6.0.5). Le but était la reproductibilité, pas une montée de version : contrôlé
  en comparant les versions **résolues** du `package-lock.json` avant et après —
  aucune n'a bougé.
- **La sélection de séance est une fonction testée**,
  `prochaineSeance` dans `packages/domain/src/parcours.ts` (l'expression était
  passée à `App.tsx:103`, la ligne citée ci-dessous est périmée). Sept tests
  épinglent l'existant *tel quel*, y compris ce qui se discute : quand tout est
  fait, on retombe sur la première séance — le parcours se relit, il ne se
  termine pas sur un écran vide. Ce n'est pas corrigé ici ; c'est désormais une
  décision qui casse un test si on la défait. Un parcours vide rend toujours
  `undefined`, et l'écran suppose toujours le contraire : la question reste
  ouverte, elle est écrite en clair dans `App.tsx`.

Au passage, un défaut cousin trouvé le même jour et corrigé avec eux :
**`blockTandem` et `unblockTandem` ne lisaient pas leur réponse**
(`App.tsx:443` et `:464`). Un UPDATE écarté par le `using` d'une politique ne
lève rien — zéro ligne, aucune erreur : l'écran annonçait « bloqué » et basculait
son état local alors que la base n'avait rien écrit. C'est le mensonge exact que
la PR #42 avait retiré du mobile, resté debout sur le web. Les deux gestes lisent
maintenant la ligne rendue (`.select(…).maybeSingle()`), traitent `data == null`
comme un refus, et posent leur état depuis le serveur plutôt que depuis ce qu'ils
croient avoir écrit. Deux textes ont dû naître pour cela dans
`packages/content/copy/web.ts` — `blockRefused` et `unblockRefused` — parce que
`syncError` dirait « on n'a pas joint le serveur », or le serveur a répondu.
`reportTandem` n'était pas concerné : un insert refusé par un `with check` lève.

Une précision qui vaut d'être écrite, parce qu'elle est le revers exact du
remède : un `update … returning` **lit**, et une lecture passe par la politique
SELECT (c'est le piège déjà recensé plus bas). Si `tandems_select_member`
cachait la ligne modifiée, `data` serait nul sur une écriture réussie et l'écran
dirait « le blocage n'a pas été posé » alors qu'il l'est — un faux négatif à la
place du faux positif. Elle ne la cache pas : elle est
`auth.uid() in (participant_a_id, participant_b_id)`, sans regarder `status`
(`20260804000002`, jamais retouchée depuis). Les deux participants relisent donc
la ligne, avant comme après le geste. Aucune politique n'a été modifiée ici,
mais ce chemin d'écriture dépend désormais de celle-là.

La liste d'origine reste ci-dessous.

- **`apps/web/src/styles.css` a deux blocs `:root`** (lignes 3 et 217). Le
  second écrase le premier : le fichier décrit l'inverse de ce qui s'affiche.
- **Sept dépendances web sont en `"latest"`.** Deux installations à un mois
  d'écart ne donnent pas le même code.
- **La sélection de séance est une expression inline** (`App.tsx:59`), pas une
  fonction : la progression du parcours n'est pas testable. À extraire vers
  `packages/domain`.
- **`packages/ui-tokens` n'existe pas.** Web et mobile ont deux langages
  visuels distincts, avec une seule couleur commune dont le rôle s'inverse.
  C'est une décision de design, pas une dette technique.

---

## Écarts connus et assumés

Ces points sont **constatés, pas des oublis**. Les rouvrir demande une décision.

| Écart | Pourquoi il est là |
|---|---|
| La modération ne lit pas les participants d'un tandem | Conséquence directe de « le message signalé, et lui seul ». La vue `tandem_contexte_signale` donne le statut et les dates, jamais les personnes. |
| Le bloqueur peut remplacer l'autre participant par un tiers | Le `with check` n'exige que sa propre présence, pas la stabilité de la paire. |
| Une invitation antérieure à un blocage reste visible du bloqueur — **traité côté interface le 24/08/2026** | La politique concernée gouverne aussi le `select … for update` de la RPC d'acceptation ; la resserrer casserait des acceptations légitimes de façon peu visible. Elle est donc inchangée : c'est l'écran qui retire ces invitations de la liste « Reçues » (`apps/web/src/invitations.ts`), au motif qu'elles sont de toute façon inacceptables — `tandems_insert_member` exige `not tandem_paire_bloquee(…)`. |
| Sur une paire bloquée, l'inviteur ne peut plus révoquer son invitation — **affiché et expliqué depuis le 24/08/2026** | Elle reste `pending` jusqu'à péremption. Le chemin de retour sanctionné est de lever le blocage. L'écran ne le contourne pas : il n'affiche aucun bouton là où le `with check` lèverait, et dit le chemin de retour. |
| La lecture d'un dossier de modération ne laisse aucune trace | Seules les décisions en laissent. Tracer les consultations est une décision séparée. |
| Le mobile ne met aucun message de côté quand l'envoi échoue — **constaté le 24/08/2026** | Le web a une file hors-ligne (`enqueueSync`, `kind: 'tandem_message'`) ; le mobile n'en a une que pour la progression de séance (`ProgressOperation`). Plutôt que d'élargir cette file dans le même chantier, l'écran dit que le message n'est pas parti et **laisse la saisie en place**. La divergence est visible et réparable ; une file silencieuse qui perdrait un message ne le serait pas. |
| Le mobile ne rafraîchit la conversation qu'au retour sur l'écran — **constaté le 24/08/2026** | Ni le web ni le mobile n'ont de temps réel. Le web se relit au rechargement de page, le mobile à la reprise de focus (`useFocusEffect`). Aucun bouton « relire » n'a été ajouté : le web n'en a pas sur la conversation, et en poser un ici inventerait un geste que l'autre application ne connaît pas. |
| Le texte des messages non signalés survit à la suppression de leur auteur — **25/08/2026** | Ils sont aussi la conversation du binôme, et une cascade la lui prendrait. Il manque en revanche une durée de conservation : purge des tandems terminés depuis N mois, à décider, avec un cron. |
| Le mobile n'a ni suppression, ni export, ni « déconnecter partout » — **25/08/2026** | Hors périmètre de ce chantier. L'écran mobile du tandem ignore aussi `partenaire_supprime` : il affichera un nom vide là où le web dit « ce compte a été supprimé ». La colonne est additive, rien n'est cassé. |
| Un compte peut écrire `account_status = 'deleted'` sur sa propre ligne sans rien supprimer — **25/08/2026** | `profiles_update_own` accorde l'écriture sur toute la ligne, et `saveTrust` a besoin d'y écrire `'active'`. C'est précisément pourquoi rien de visible par autrui ne s'appuie sur cette colonne : le signal de suppression est `auth.users.deleted_at`. |
| Le bloc `auth.*` de `supprimer_mon_compte()` n'est pas prouvé localement — **25/08/2026** | Le harnais de tests travaille en `postgres`, superutilisateur : l'écriture y passe quoi qu'il arrive. Sur le projet hébergé, le schéma `auth` appartient à `supabase_auth_admin`. La requête de vérification est écrite dans l'en-tête de la migration. Si les droits manquent, la fonction lève et rien n'est supprimé à moitié. |
| `invitation_email_mismatch` est inatteignable pour un tiers | Depuis le passage en `security invoker`, le tiers ne voit pas la ligne : le refus remonte `invitation_not_found`. Le refus est réel, le message n'est pas celui qu'on attend en lisant le code. |

---

## Pièges mesurés — à ne pas redécouvrir

Chacun a coûté du temps une fois. Ils sont ici pour ne pas le coûter deux.

**Migrations**

- Un préfixe qui ne fait pas quatorze chiffres est tronqué par le CLI, qui prend
  alors plusieurs fichiers pour une seule version : collision de clé primaire et
  base à moitié montée. `tests/migrations.test.ts` l'interdit désormais.
- `supabase/config.toml` **n'est pas versionné** — `supabase init` est requis.

**Politiques**

- **Une expression de politique est soumise aux droits de l'appelant.**
  Référencer une table sans `grant` donne `permission denied`. Toute
  consultation d'une table privée depuis une politique passe donc par une
  fonction `security definer`.
- **Une sous-requête dans une politique subit la RLS de la table interrogée.**
  Un conjonct peut sembler décoratif alors qu'il tient un cas réel.
- **Une politique restreint des lignes, jamais des colonnes.** Pour borner une
  écriture à une colonne, c'est un `grant update (colonne)` qu'il faut.
- **Dans une politique UPDATE sans `with check`, PostgreSQL réemploie
  l'expression `using`** pour contrôler la nouvelle ligne.
- **Les politiques SELECT s'appliquent aussi à un UPDATE** dès qu'il lit des
  colonnes (`where`, `returning`) — c'est-à-dire presque toujours. Une ligne
  peut donc être refusée sans que le `using` de la politique UPDATE ait eu son
  mot à dire, et c'est ce qui décide si le refus lève ou se tait.
- **Dans une fonction `security definer`, `current_user` désigne le
  propriétaire**, pas l'appelant. Une garde fondée dessus est morte ;
  `auth.uid()` est le bon signal.
- Une politique qui interroge sa propre table produit une **récursion infinie**.
- **`create or replace function` refuse de changer le type de retour** — comme
  `create or replace view` refuse de changer le jeu de colonnes. Il faut un
  `drop function` explicite **dans le fichier de migration**, sans quoi rejouer
  ce fichier échoue : c'est exactement ce que fait la boucle de vérification par
  mutation après chaque restauration, et elle rougirait pour la mauvaise raison.
- **Une mesure prise sous l'identité de celui qui vient d'agir ne prouve pas ce
  qu'on croit.** Une ligne effacée et une ligne masquée par la RLS rendent le
  même « zéro ». Les tests de suppression mesurent donc les faits hors RLS
  (`reset role`) et rentrent explicitement sous une identité quand c'est la
  politique qu'ils veulent éprouver.
- **`commeAnonyme` ne peut pas éprouver la garde interne d'une fonction** : le
  `grant execute` manquant lève le premier, et le test reste vert quoi qu'on
  fasse à la garde. C'est le rôle `authenticated` **sans claims**
  (`commeAuthentifieSansIdentite`) qui rend la mesure possible.

**Tests**

- **Un UPDATE refusé par un `using` ne lève rien** : il touche zéro ligne.
  Compter `rowCount`. Un INSERT refusé par un `with check`, lui, lève.
- `SELECT … FOR UPDATE` applique **aussi** le `using` des politiques UPDATE.
- Sans claims, `auth.uid()` vaut NULL et tout test négatif passe sans qu'aucune
  politique n'ait discriminé.

**Build**

- `import.meta.env` est figé à la compilation : sans `VITE_SUPABASE_URL`,
  Rollup supprime toute branche Supabase. **`npm run build` ne prouve donc rien
  sur ces lignes** — c'est `tsc -b` qui les couvre.
- Expo SDK 57 lit déjà les workspaces racine : aucun `metro.config.js` n'est
  nécessaire, et `disableHierarchicalLookup: true` casse la résolution.

**Exploitation**

- **`service_role` n'a aucun droit sur `public.tandems`.** Toute recette
  d'exploitation passe par l'éditeur SQL du tableau de bord, qui travaille en
  `postgres` et traverse la RLS.

---

## Dans quel ordre reprendre

1. **Appliquer les migrations.** Le travail fait ne sert à rien tant qu'il dort
   dans le dépôt.
2. **Le nom en dur.** Court, et visible par tout utilisateur.
3. **L'interface de modération.** La base l'attend.
4. **Le mobile sur un appareil.** Ne se délègue pas : il faut un téléphone.

---

## Amendement du 26 août 2026 — l'espace mentor (issue #16)

Le détail des décisions vit dans **`docs/27-ESPACE-MENTOR.md`** ; ce qui suit
n'en garde que ce qu'un état du projet doit dire.

### Ce qui existe désormais

Deux tables (`help_requests`, `mentor_encouragements`), trois fonctions
`security definer` (`tandem_accompagnement_actif`, `tandem_mes_accompagnements`,
`tandem_mon_accompagnement`), un écran refondu (`apps/web/src/views/mentor.tsx`,
extrait du barrel `views/index.tsx`), et le premier chemin par lequel une
affectation de mentor peut atteindre `active` depuis l'application.

Ce dernier point mérite d'être isolé : la décision 5 du #17 réservait déjà
l'écriture de `active` au participant, mais **aucun écran ne la lui offrait**.
Sans l'écran ajouté ici, le tableau de suivi serait resté vide pour toujours.

### Le principe, en une ligne

Le mentor reçoit **des catégories, jamais des observations** : un mot parmi
quatre, calculé dans une fonction qui lit `session_progress` et
`weekly_checkins` hors RLS et n'en laisse rien sortir. Aucune date d'activité,
aucun compte, aucun tri par signal.

### Écart mobile, constaté et non traité

`apps/mobile` ne connaît rien de l'espace mentor. Le chantier est web-first,
comme le #17, et pour une raison plus forte : le geste de demande d'aide
appartient à la carte d'accompagnement, qui n'existe qu'en web. L'accrocher à
l'écran tandem mobile — le seul écran mobile où elle aurait pu tenir —
recollerait visuellement les deux membranes que la décision 6 du #17 sépare.
La règle est dans `packages/domain/src/mentor.ts`, partagée : la reprise sera
courte le jour où le mobile portera aussi la carte d'accompagnement.

### Deuxième écart : aucune notification

Un mentor apprend qu'on lui a demandé de l'aide en ouvrant l'onglet. Rien ne
prévient, rien ne relance — c'est le même manque d'ordonnanceur que la dette de
purge nommée par le #17, et il se soldera avec elle ou pas du tout.

### Vérifié

- `npm test` — 203 tests (20 fichiers) ; `npm run test:rls` — **267 tests**
  (19 fichiers), dont 25 nouveaux. Les quatre suites qui prouvent depuis le
  25/08 qu'un mentor vérifié et affecté ne lit **rien** du journal, des
  conversations, des partages et des bilans restent vertes **sans avoir été
  amendées** — c'est la mesure la plus utile du chantier.
- **Vérification par mutation**, sur la base vivante, scripts dans
  `.rls-stack/mutations/` — sept conjoncts cassés, six font rougir :
  garde de vérification retirée de `tandem_mes_accompagnements()` (1 rouge) ;
  la fonction rend aussi les affectations `pending` (1) ; tri par signal au lieu
  du nom (2) ; l'état d'origine quitte le `using` des transitions de demande
  d'aide (1) ; `tandem_accompagnement_actif` ne regarde plus `mentor_profiles`
  (3) ; `jour` entre dans le `grant insert` (1).
- Le septième est un **résultat, pas un échec** : retirer les deux `delete`
  explicites de `supprimer_mon_compte()` ne fait rougir personne, parce que la
  cascade depuis `mentor_assignments` fait le travail. C'est ce que le
  commentaire de la migration affirme, et c'était à mesurer plutôt qu'à croire.
- Restauration en rejouant `supabase/migrations/20260826090000_espace_mentor.sql`
  **depuis le fichier**, ce qui vérifie du même coup qu'il est rejouable. Piège
  rencontré : un `grant` ne se retire pas en rejouant la migration — un `grant`
  est additif. La mutation `jour` a donc dû être annulée par un `revoke`
  explicite, et sa trace résiduelle avait faussé la mutation suivante avant
  qu'on s'en aperçoive.
- `tsc -b` et `vite build` : passent.

---

## Amendement du 26 août 2026 — la conformité des stores et la politique publique (issue #23)

L'issue #23 demandait six choses : un inventaire des données et des SDK, les
labels Apple, le formulaire Data Safety de Google, un mécanisme de suppression
documenté, une politique de confidentialité relue, une revue juridique planifiée.
Le tout vit maintenant dans **`docs/28-CONFORMITE-STORES.md`**, et la politique
elle-même est **une page publique servie sans compte**.

### Ce qui existe désormais

- `docs/28-CONFORMITE-STORES.md` : l'inventaire par donnée (finalité, base
  légale proposée, durée, ce qui l'efface), l'inventaire des paquets et des
  tiers, les deux déclarations de store **prêtes à saisir**, le mécanisme de
  suppression, la dette de conformité et le plan de revue juridique ;
- la **politique de confidentialité publique**, en français et en anglais,
  à `/confidentialite`, sans session, sans requête réseau autre que les polices,
  sans une écriture dans le stockage — vérifié au navigateur ;
- un lien vers elle depuis les trois écrans qui la citent : l'écran de confiance
  (avant les cases à cocher), l'écran de connexion, les réglages ;
- `apps/web/vercel.json`, qui versionne la réécriture SPA dont dépend l'adresse.

### La décision qui gouverne la page : elle ne pose rien

`App()` lit et écrit `localStorage` dès son premier `useState`, et sa chaîne
d'imports construit le client Supabase à l'évaluation du module — lequel relit
la session stockée et peut rafraîchir son jeton. Une page qui promet « rien
n'est posé sur ton appareil » et qui monte `App` avant de rendre sa première
phrase serait fausse avant d'être lue.

D'où deux choses : le branchement se fait dans `main.tsx`, **avant** `App`, et
`App` y est chargé par `import()` dynamique. Ce n'est pas une optimisation de
poids ; c'est ce qui rend la promesse vérifiable. Elle a d'ailleurs été
vérifiée : `localStorage` vide après chargement, et deux seules destinations
réseau, `fonts.googleapis.com` et `fonts.gstatic.com`.

### Deux arbitrages qu'on devra défendre

**Google Fonts : dans la prose, pas dans les cases.** La feuille de style
importe deux polices depuis Google ; l'IP du visiteur y parvient. La politique
publique le dit platement. Les formulaires de store, eux, ne le déclarent pas
comme un partage : ils portent sur les données que l'application **collecte puis
transmet**, et cette requête ne transporte aucune donnée collectée. Le
raisonnement est écrit au doc 28 pour être opposé tel quel.

**La mesure n'est « pas liée à l'identité », et la phrase exacte compte.** Ce
n'est pas « le serveur ne sait jamais qui écrit » — l'insertion est réservée à
`authenticated`, donc la requête porte un JWT. C'est **le serveur sait
momentanément qui écrit et n'en stocke rien** : la ligne écrite n'a aucune
colonne d'identité, et aucune jointure ne la reconstitue. C'est la formulation
qui survit à une relecture juridique ; l'autre ne survit pas.

### Ce que le chantier a trouvé sans le chercher

- **L'application mobile serait rejetée par l'App Store.** La règle 5.1.1(v)
  exige la suppression de compte depuis l'application ; `supprimer_mon_compte()`
  existe, l'écran mobile ne l'appelle nulle part. L'écart était déjà nommé au
  doc 25 comme un manque produit ; il est en plus bloquant pour la publication.
- **On fait accepter des règles d'utilisation qui n'existent pas.** L'écran de
  confiance coche `termsConsent` et écrit `profiles.terms_consent_at` ; aucun
  document ne porte ces règles, nulle part dans le dépôt. La politique de
  confidentialité, elle, existe désormais.
- **Le pays d'hébergement de la base n'est écrit nulle part** — information de
  conformité de premier plan, absente du dépôt.

### Écart assumé : des repères `[À COMPLÉTER]` sur une page publique

Trois trous restent visibles sur la page : SIRET et adresse du siège, adresse
e-mail de contact, pays d'hébergement. Ils sont encadrés d'un filet tireté pour
gêner quiconque relirait la page avant publication sans les avoir remplis. Un
SIRET inventé aurait rendu la page « finie » et fausse ; un trou marqué est une
page honnête qui n'est pas encore publiable. La liste complète de ce qui attend
un humain est la section 8 du doc 28.

### Vérifié

- `npm test` — 205 tests (20 fichiers), dont la parité des copies sur les
  quelque cinquante-cinq clés de la politique, dans les deux langues.
- `tsc -b` et `vite build` : passent. Le morceau d'entrée du paquet ne contient
  **pas** le SDK Supabase, constaté par recherche dans le fichier produit —
  c'est ce qui prouve que la page publique ne le télécharge pas.
- Rendu au navigateur, à 375 px et à 1280 px, en français et en anglais : deux
  défauts trouvés et corrigés, tous deux venus d'un emprunt au thème de
  l'application. `h2` vaut l'encre sombre hors de `.content-section` — tous les
  titres de section étaient invisibles ; et `.brand-lockup` est escamoté puis
  masqué par les points de rupture de la barre latérale — la marque disparaissait
  sous 375 px. La page a désormais son propre bloc de marque.
- Aucune migration, aucun changement mobile, aucun changement de comportement
  produit : le périmètre est `docs/`, `apps/web/**` et les textes partagés.

## Amendement du 26 août 2026 — le parcours « Repartir avec Jésus » (issue #8)

Le contenu est **écrit et intégré**. Il n'est **pas relu**, et cela suffit à le
rendre impubliable en l'état : le doc 07 impose sept étapes avant publication,
et une seule est faite. La liste de ce qui attend un humain est plus bas, et
elle est bloquante pour le pilote en église.

### Ce qui existe désormais

`supabase/migrations/20260826120000_parcours_repartir_complet.sql` : les
vingt-sept séances manquantes (jours 4 à 30) et la retouche de deux des trois
séances du 04/08. Aucun changement de schéma, aucune politique. Le parcours
tient les six semaines et les cinq séances du doc 07, dans l'ordre de ses
objectifs — faire le point, comprendre l'Évangile, développer la prière, lire
et mémoriser, grandir avec les autres, servir et transmettre.

`tests/parcours-repartir.test.ts` épingle la forme : trente jours uniques, six
semaines de cinq, aucun champ vide, durées entre cinq et quinze minutes, une
référence « Livre chiffre:chiffre » dans chaque citation des deux langues. Il
lit les migrations, pas la base, et tourne sur `npm test` sans Docker.

### Deux citations anglaises étaient sous copyright

`repartir-01` (« Come to me, all you who are weary and burdened ») et
`repartir-03` (« Carry each other's burdens ») reprenaient mot pour mot la New
International Version. Elles sont remplacées par la World English Bible. Le
parcours entier tient désormais sur deux traductions du domaine public —
Louis Segond 1910 en français, WEB en anglais — ce qui règle par construction
le critère de droits que le doc 07 laissait ouvert et que l'issue #4 n'a pas
tranché. Les trois `verse_fr` du 04/08 ont été vérifiés dans la même passe :
ils étaient déjà Segond au mot près.

Le test refuse le retour des deux formulations NIV. Ce qu'on observe est le
texte, pas la manière dont il est arrivé là : les deux tournures sont celles de
la NIV mot pour mot, et cela suffit à les écarter.

### Comment les citations ont été vérifiées

Aucune n'a été écrite de mémoire. Les textes ont été récupérés aux sources —
`api.getbible.net/v2/ls1910` et `bible-api.com?translation=web` — et chaque
extrait cité a été contrôlé comme **plage contiguë** de son verset, casse,
guillemets et ponctuation de fin mis à part. Soixante-deux citations
contrôlées, deux défauts trouvés et corrigés :

- la citation anglaise de Philippiens 4:6 sautait le milieu du verset sans le
  marquer (« In everything, **[…]** let your requests be made known to God ») ;
- Psaumes 23:1, d'abord retenu comme verset de mémorisation, a été écarté : la
  WEB y rend le nom divin par « Yahweh », vocalisation que plusieurs traditions
  évitent, et le parcours doit se lire sans accroc par un jeune catholique
  comme protestant.

Le contrôle est resté un script hors dépôt, volontairement : un test qui appelle
deux API rendrait `npm test` intermittent.

### La discussion hebdomadaire est la cinquième séance

Le doc 07 demande « une discussion hebdomadaire » sans dire où elle tombe dans
un schéma à trente jours. Décision : jours 5, 10, 15, 20, 25 et 30. Leur thème
est « La discussion de la semaine », leur action envoie vers la conversation du
tandem, et leur question se répond à deux. Le test épingle ces six jours — sans
quoi la discussion pourrait disparaître à la première réécriture de contenu
sans que rien ne le signale.

### Les trois versets de mémorisation sont une proposition

Le doc 24 fixe la forme de la semaine 4 : un verset choisi dans une liste de
trois, recopié à la main le premier jour, retapé de mémoire le troisième, dit
au binôme le cinquième — ici les jours 16, 18 et 20. Il note explicitement que
**le choix des trois est une décision humaine**.

Proposés : **Psaumes 119:105**, **Ésaïe 41:10**, **Jean 14:27**. Courts, tenant
hors contexte, sans marqueur confessionnel. Ils vivent dans l'action du jour 16,
faute d'un champ dédié — le schéma n'a qu'un verset par séance et ce chantier
n'y touche pas. Ils attendent un relecteur au même titre que le reste.

### Le pont vers Versets Flash n'a pas été écrit

Le doc 24 prévoyait une ligne vers Versets Flash au bas de la séance du jour 16.
Elle n'y est pas. La mémorisation se fait avec le journal et le binôme, et rien
d'une séance ne doit dépendre d'une autre application. Le pont reste une
décision d'écosystème à prendre ailleurs ; ce qui est écrit ici tient sans lui.
Divergence assumée avec le doc 24, datée du 26/08.

### Écart de forme : la semaine 1 ne se lit pas comme les cinq autres

Les séances des jours 1 à 3 portent des thèmes d'auteur — « Une foi qui
respire », « La grâce au quotidien », « Une foi incarnée » — là où les semaines
2 à 6 prennent pour thème l'objectif du doc 07. La semaine 1 mélange donc trois
thèmes d'auteur, un « Faire le point » et un « La discussion de la semaine ».

C'est la conséquence directe de la borne du chantier : seuls les `verse_en` des
trois séances existantes pouvaient être retouchés. Réécrire leurs thèmes aurait
dépassé le périmètre. C'est la première chose qu'un relecteur remarquera, et
c'est une retouche d'une ligne le jour où on la décide.

### Ce qui attend un relecteur humain — bloquant pour le pilote

> **Constat du 26/08/2026 — les séances sont validées.** Le fondateur a relu et
> validé les trente séances, versets de mémorisation compris (« les séances
> sont valides »). La validation couvre les points 1 à 4 de la liste ci-dessous,
> qui reste comme trace de ce qui a été soumis à relecture. Le point 5 — le test
> sur petit groupe — n'est pas une relecture de texte : il se confond avec le
> pilote église (#22) et y est transféré. Le paragraphe d'origine est conservé
> ci-dessous.

Le doc 07 décrit sept étapes avant publication. Seule la première est faite.
Sont à relire, avant qu'un adolescent lise une ligne de ce parcours :

1. **Les trente séances**, en entier — relecture biblique et théologique, puis
   relecture pédagogique et inclusive. Elles sortent d'une seule main et n'ont
   été vues par personne d'autre.
2. **Les trois versets de mémorisation** — Psaumes 119:105, Ésaïe 41:10,
   Jean 14:27. Une proposition, pas un choix arrêté.
3. **Les deux citations anglaises retouchées** — `repartir-01` et
   `repartir-03`. Le remplacement est mécaniquement correct ; qu'il dise encore
   ce que la séance voulait dire est un jugement, pas un contrôle.
4. **La parité française et anglaise du sens** — l'anglais est écrit comme de
   l'anglais, pas traduit mot à mot, ce qui rend l'écart possible et invisible
   à un test.
5. **Le test sur petit groupe** (étape 6 du doc 07), qui n'a pas eu lieu.

Le parcours est marqué `published` en base depuis le 04/08 : la relecture n'est
donc pas seulement en retard, elle est en retard sur du contenu déjà lisible
par l'application. C'est l'état, et il vaut mieux l'écrire.

### Vérifié

- `npm test` — 212 tests (21 fichiers), dont les sept du parcours.
- `npm run test:rls` — 267 tests, inchangé. La migration s'applique sur la pile
  locale sans erreur.
- Les soixante-deux citations, contrôlées aux sources comme décrit plus haut.

---

## Amendement du 26 août 2026 — le shell mobile est complet (issue #13)

*Cinq fronts, une règle commune : le mobile cesse d'être une maquette qui
ressemble à l'application, et devient l'application.*

### 1. Le dépôt est prêt à construire, aucune build n'a été lancée

`apps/mobile/eas.json` (profils `development`, `preview`, `internal`) et un
`app.json` complété — `versionCode`, `buildNumber`, liens d'application. Le
détail, les commandes exactes et **la liste honnête de ce qui attend un humain**
(compte Expo, Apple Developer 99 $/an, Play Console, icône de marque,
`assetlinks.json`) vivent dans le **doc 29**, écrit pour la personne qui lancera
la première build.

Deux constats de ce chantier valent d'être ici :

- **`newArchEnabled` faisait échouer le contrôle de configuration.** La
  propriété n'existe plus dans le schéma du SDK 57. Retirée.
- **`react` est installé en double** (19.2.3 côté mobile, 19.2.8 côté web).
  Une build native ne doit embarquer qu'une version d'un module natif : c'est
  le seul point d'`expo-doctor` qui pourrait mordre au premier `eas build`. Le
  remède touche `apps/web` et n'a donc pas été appliqué ici.

### 2. Les rappels vivent sur le compte, pas sur le téléphone

Le rappel de séance était gardé par une clé locale d'AsyncStorage — un second
endroit qui disait la même chose que `notification_preferences.sessions`. Un
rappel coupé depuis le navigateur revenait donc sur le téléphone. C'est le bug
que la mesure (#20) et le bilan (#18) avaient déjà corrigé chacun de leur côté,
avec le même commentaire ; il restait celui-là.

La règle « que faut-il planifier » est pure et testée
(`packages/domain/src/notifications.ts`) ; l'appareil annule tout et repose la
liste complète, jamais un delta — lui seul sait ce qui traîne réellement dans sa
file. Le samedi du rappel de bilan est **relié par un test** à la fenêtre de
`semaineDuBilan` : deux définitions du même jour auraient dérivé.

Piège noté : le déclencheur hebdomadaire d'`expo-notifications` compte les jours
à la façon d'Apple (dimanche = 1), là où le domaine parle en jours ISO
(samedi = 6). Un rappel posé sur le jour ISO brut tomberait le vendredi.

**Aucun push serveur, et ce n'est pas un provisoire** : il n'existe aucun
composant serveur qui pourrait décider d'écrire à quelqu'un. Même écart que les
relances de mentor et la purge — il se soldera avec un ordonnanceur, ou pas.

### 3. On peut désormais partir, et emporter ses données

L'écran « Mon compte » porte les trois gestes que le web avait depuis la PR #44
et que le mobile n'avait pas : l'export, la déconnexion partout, la suppression
de compte. **Cela lève un blocage de publication nommé au doc 28** : la règle
5.1.1(v) de l'App Store exige la suppression depuis l'application.

L'assemblage de l'export a **déménagé dans `packages/domain`**. Deux listes de
sections auraient divergé à la première table ajoutée, et le fichier téléchargé
depuis un téléphone serait devenu plus court que celui du navigateur sans que
rien ne le dise — exactement le mode d'échec que ce module refuse. Le web garde
la seule chose qui lui est propre : la remise du fichier par un `Blob`. Le
mobile passe par la feuille de partage native.

La suppression vide aussi le téléphone. La liste des clés locales est
**exhaustive par construction** (`apps/mobile/src/clefs.ts`) : les modules ne
déclarent plus leur clé chez eux, ils la lisent là. Une clé ajoutée ailleurs et
oubliée dans une liste de purge est un manque silencieux, et c'était le seul
remède qui ne repose pas sur la vigilance.

Le journal mobile arrive avec les mêmes gestes que le web (#45), y compris le
partage et son retrait, avec la garde qui compte : **une suppression lit les
lignes réellement touchées**, parce qu'un DELETE refusé par une politique ne
lève rien.

### 4. Le lien d'invitation va jusqu'au bout

Le mobile savait accepter un jeton passé en paramètre de route — c'est-à-dire
seulement si on tapait l'URL à la main. Le lien réellement envoyé aux gens est
celui du web, et rien ne le reliait à l'application.

Les quatre formes d'URL (web, `agapeplay://`, Expo Go) sont lues par une règle
pure et testée (`packages/domain/src/liens.ts`), qui ne touche **pas** au
fragment — c'est là que voyagent les jetons d'authentification, et son test le
vérifie. Le jeton est retenu jusqu'à la connexion, puis consommé **avant** de
connaître le résultat : les deux issues sont terminales.

Le lien de communauté (#17) est traité aussi. Le mobile n'a pas d'espace de
communauté : rejoindre y aboutit, et l'écran dit que la suite se vit sur le
site plutôt que de promettre une page qui n'existe pas.

### 5. La séance hors ligne était une illusion, elle est réelle

Le critère de l'issue est « séance déjà téléchargée lisible hors ligne ». Les
écrans `journey` et `session` affichaient un contenu **écrit en dur** — trois
titres inventés, un verset — et enregistraient toujours la même séance quel que
soit le jour ouvert. Hors ligne, ils étaient « lisibles » au sens où ils ne
dépendaient de rien ; ils ne disaient simplement pas la vérité.

Le contenu vient maintenant de `loadPublishedJourney`, comme sur le web, avec le
cache de ce téléphone. **Le module ne pouvait pas être appelé tel quel** :
l'écriture du cache était un `localStorage.setItem` nu, sur le chemin heureux et
hors de tout `try` — sous Hermes, une `ReferenceError` au moment précis où la
lecture réseau venait de réussir. Son propre en-tête l'annonçait depuis le
05/08 : « le jour où le mobile chargera le contenu publié, ce stockage devra
être injecté ». Il l'est, avec le navigateur pour défaut, si bien que le web n'a
rien à changer.

### Écarts assumés, inchangés ou nommés ici

- **La file hors-ligne des messages** n'existe toujours pas : l'écran garde la
  saisie et le dit. Idem pour le journal — écrire demande la connexion.
- **Le mobile n'a ni espace mentor ni espace de communauté.** Rejoindre une
  communauté par lien y aboutit ; tout le reste est sur le web.
- **La langue n'est pas persistée.** `locale` est un état d'écran. Conséquence
  assumée et écrite : changer de langue **replanifie** les rappels, pour qu'une
  notification française n'arrive pas sur une application passée à l'anglais.
- **Aucune icône de marque.** `app.json` n'en déclare pas, et aucune n'a été
  inventée : le logo existe côté studio. Bloquant pour une soumission, pas pour
  un test interne.
- **`journey_started` n'est toujours pas émis par le mobile.** Le web le pose au
  démarrage d'un parcours ; le mobile n'a pas ce moment — il ouvre une séance,
  il ne « commence » rien. Le funnel du doc 08 le verra donc comme une étape
  manquante côté mobile, au même titre qu'`account_created` (doc 25).
  `share_created`, lui, est désormais émis des deux côtés — sans `journey_id`
  sur mobile, l'écran du journal ne chargeant pas le parcours.
- **`expo-dev-client` fait viser un build de développement à `expo start`.**
  Presser `s` revient à Expo Go. Noté au doc 29, parce que c'est la première
  surprise d'un matin après un `git pull`.

### Vérifié

- `npm test` — 235 tests (23 fichiers), dont les nouveaux du domaine :
  planification des rappels, lecture des liens, cache de parcours injecté.
- `npm run mobile:export` — le bundle Metro passe, après chaque front.
- `npm run mobile:typecheck` et `tsc -b` côté web : passent.
- `npx expo config --type public` : propre. `npx expo-doctor` : 19/21, les deux
  échecs restants sont antérieurs et documentés au doc 29.
- **Rien n'a été prouvé sur un appareil** : aucune build n'a été lancée, aucun
  compte n'est connecté. La liste de ce qu'il faudra vérifier après la première
  build est en fin de doc 29.

---

## Amendement du 25 août 2026 — le feel natif mobile

*Le fondateur a installé l'APK réel sur un téléphone Android et en a rapporté
deux choses : « l'application se comporte comme une web app », et « les cases à
remplir : lorsque le clavier s'ouvre, il masque la case ». Ce chantier répond
aux deux. C'est de la finition : aucun écran n'a disparu, aucune règle produit
n'a bougé, aucun texte n'a été ajouté — la parité fr/en de
`packages/content/copy` est donc inchangée.*

### Le clavier — ce qui se passait vraiment

La cause n'était pas un `KeyboardAvoidingView` mal réglé : c'est qu'il n'y en
avait aucun, et qu'aucun réglage de `app.json` ne pouvait suffire.

**Depuis le SDK 54, Android est en bord-à-bord obligatoire.** Le greffon
`withEdgeToEdge` d'Expo le dit lui-même — « Android 16 makes edge-to-edge
mandatory » — et il **refuse** désormais qu'on le débraye : déclarer
`android.edgeToEdgeEnabled` ne produit qu'un avertissement. Or en bord-à-bord la
fenêtre ne se redimensionne plus à l'ouverture du clavier. Donc
`android:windowSoftInputMode=adjustResize`, c'est-à-dire
`android.softwareKeyboardLayoutMode: "resize"`, **ne déplace plus rien tout
seul**. Le champ restait où il était, et le clavier passait devant.

Décision : `softwareKeyboardLayoutMode` reste déclaré à `"resize"`. C'est déjà
le défaut, la valeur est inerte en bord-à-bord, et `"pan"` — la seule autre —
ferait glisser toute la fenêtre vers le haut, ce qui décollerait un composeur
censé rester au ras du clavier. On garde donc la valeur qui ne nuit pas, et
l'écart se rattrape en JavaScript, dans `apps/mobile/src/clavier.ts` :

- `useHauteurDuClavier` écoute `keyboardWillShow/Hide` sur iOS et
  `keyboardDidShow/Hide` sur Android — Android n'émet pas les `Will…`, et
  écouter les quatre partout ferait deux mises à jour par ouverture sur iOS ;
- `useEspacementDuClavier` en soustrait `insets.bottom`. Android mesure la
  hauteur du clavier depuis le bas de l'**écran**, pas depuis le bas de la zone
  sûre : sans cette soustraction, la barre de navigation serait comptée deux
  fois et laisserait une cinquantaine de points de blanc sous le champ ;
- `useChampAuDessusDuClavier` ajoute `remonter`, branché sur le `onFocus` du
  champ. Il appelle `scrollResponderScrollNativeHandleToKeyboard` — méthode
  **publique et typée** de `ScrollView`, écrite exactement pour ce problème, et
  qui diffère d'elle-même son défilement quand les mesures du clavier ne sont
  pas encore connues. La réserve de 96 points sous le champ n'est pas
  décorative : dans cette application le bouton d'envoi est toujours **sous** la
  case, et un champ visible dont on ne peut pas atteindre le bouton ne règle que
  la moitié du défaut.

Pas de `KeyboardAvoidingView`, et pas de module clavier natif : `behavior="height"`
s'appuie précisément sur le redimensionnement qui n'existe plus, `undefined` sur
Android — le montage le plus répandu — ne fait rien du tout ici, et une
dépendance native serait la seule chose dont `mobile:export`, notre unique garde
sans appareil, ne pourrait rien dire.

**La liste réelle des écrans à saisie est plus courte que prévu.** `index.tsx`,
`compte.tsx` et `invite.tsx` n'importent aucun `TextInput` — le bilan hebdomadaire
est un jeu de `Pressable`, et il n'y a pas de mot libre sur l'accueil. Restent
**trois écrans et quatre cases** : `auth.tsx` (e-mail), `journal.tsx` (entrée),
`tandem.tsx` (composeur, et mot libre du panneau de signalement).

### La conversation, seule restructuration

Le composeur est sorti du `ScrollView`. Fil et composeur sont désormais deux
frères d'une colonne, et c'est **la colonne** qui remonte au-dessus du clavier :
le fil, en `flex: 1`, se rétrécit d'autant, et le composeur reste au ras du
clavier. C'est le comportement d'une messagerie, et c'était impossible tant que
la case défilait avec le fil.

Deux conséquences assumées : le fil s'ouvre et revient sur son dernier message
(à la fin du chargement et après un envoi, jamais sur un effet de `messages` —
cela ferait deux défilements) ; et le composeur s'efface pendant qu'un panneau
est ouvert, parce qu'épinglé il recouvrirait le bouton de confirmation, et qu'il
proposerait d'écrire à quelqu'un à qui on est en train de dire qu'on le bloque.

Ce qui n'a pas bougé : `accesConversation` gouverne toujours ce que le composeur
autorise, et il reste **affiché fermé** plutôt que retiré, comme sur le web.

### L'identité au lancement

**Décision du fondateur, prise pendant le chantier : l'icône et l'écran de
démarrage définitifs porteront SON visuel — une illustration de flamme qu'il
fournit — et non une adaptation du logo studio.** Ce qui est committé ici est
donc **provisoire** : les chemins standard sont déclarés dans `app.json`, les
binaires seront remplacés avant la première build, sans toucher à la
configuration.

Deux choses valent d'être sues de ce provisoire. D'abord ce ne sont **pas des
placeholders** : ce sont de vraies pièces de marque, tirées telles quelles de
`versets-flash/assets/Logo/` et adaptées aux formats Expo avec Pillow — le
dépôt n'affiche donc jamais un carré gris, même si la build partait demain.
Ensuite le fond de démarrage est déjà à `#1C2B4A`, le bleu nuit de la charte,
comme demandé pour la flamme : le sceau à l'encre y aurait disparu, c'est donc
la **colorway crème officielle** (`agapeplay-sceau-creme.png`) qui tient ce
fond. Rien n'a été recoloré nulle part.

- **Icône : le monogramme** (`agapeplay-monogramme.png`), sur le crème du lockup
  `#FCF4DD` échantillonné sur `agapeplay.png`. Le sceau a été écarté après essai
  : son texte circulaire « AGAPE PLAY · ÉDITIONS DE JEUX » devient illisible à
  48 points, la taille réelle d'un lanceur.
- **Icône adaptative Android** : le même monogramme sur fond transparent, tenu à
  46 % du carré pour rester dans le disque de sûreté de 66 % — vérifié sous
  masque circulaire *et* sous masque arrondi, les deux plus sévères.
- **Écran de démarrage : le sceau crème** (`agapeplay-sceau-creme.png`), à 200
  points de large sur le bleu nuit `#1C2B4A`. Il a ici la place d'être lu, là
  où il ne l'a pas à 48 points.
- **Écart tonal assumé, et il est temporaire** : l'icône provisoire est crème,
  le démarrage est nuit — le lancement change donc de fond. Les deux définitifs
  étant la même flamme, c'est au visuel du fondateur de trancher la cohérence ;
  `adaptiveIcon.backgroundColor` (`#FCF4DD` aujourd'hui) est le réglage à
  reprendre avec les binaires, et il est déclaré pour ça.
- `userInterfaceStyle` passe de `"dark"` à `"light"`. L'application est crème et
  encre, elle n'a jamais eu de mode sombre, et Android tirait sa barre système
  de cette déclaration.

### La main

- **Transitions** : `Stack` passe de `animation: 'fade'` à `'default'`. Un fondu
  entre deux routes est exactement ce que fait un site ; un téléphone glisse
  l'écran suivant depuis le bord. Cela rétablit du même coup le geste de retour
  au bord de l'écran, que le fondu rendait muet.
- **Retour d'appui** : `theme.ts` porte `presse` (opacité, pour les libellés),
  `ondeEncre` / `ondeClaire` (l'onde de matériau d'Android sous les grandes
  surfaces) et `toucheMinimale` (44 points). **Aucun `Pressable` de
  l'application n'avait de retour au doigt** avant ce chantier : c'est la moitié
  du « ça se comporte comme une web app ».
- **Haptique** (`src/toucher.ts`, trois nuances) : `toucherLeger` pour ce qui
  part — message, entrée, partage, interrupteur de rappel, export prêt ;
  `toucherAbouti` pour ce qui s'achève — séance terminée, bilan posé ;
  `toucherGrave` pour les gestes de protection — bloquer, signaler, supprimer
  une entrée ou son compte. Vibré **sur la réponse du serveur, jamais sur
  l'appui** : la main doit apprendre que la chose est faite, pas qu'un bouton a
  été touché. Naviguer, ouvrir un panneau, changer de langue, annuler : rien.
- **Tirer-pour-rafraîchir** sur l'accueil, le journal et la conversation. Les
  trois lectures sont sorties de `useFocusEffect` pour que le geste emprunte
  exactement le même chemin que l'arrivée sur l'écran — un second chemin de
  rechargement finirait par diverger. Les gardes de démontage ont suivi :
  servant deux appelants, elles sont devenues des `ref`.

### La barre d'onglets — refusée, et pourquoi

Le brief l'autorisait. Elle n'a pas été faite, pour quatre raisons qui tiennent
ensemble :

1. **Il n'y a pas d'icônes.** `@expo/vector-icons` n'est pas une dépendance
   déclarée, et aucun trait de marque n'existe pour Accueil / Parcours / Journal
   / Tandem. Une barre d'onglets en texte seul lit *moins* natif que les cartes
   numérotées actuelles : on paierait la restructuration pour s'éloigner du but.
2. **La langue est un état d'écran.** `locale` est un `useState<Locale>('fr')`
   dans sept composants séparés. Un jeu de libellés d'onglets ne peut pas suivre
   une bascule qui n'a pas de source unique.
3. **C'est une restructuration de routes** — quatre fichiers vers `app/(tabs)/`,
   un layout de plus, et le retrait du lien `← Aujourd'hui` sur quatre écrans.
   C'est la refonte que le chantier excluait.
4. **Les deux changements qui répondent vraiment au reproche** — les transitions
   de plateforme et le retour d'appui — sont livrés ici.

Prérequis du chantier suivant, si on la veut : remonter `locale` dans
`stockage` derrière un hook partagé (ce qui corrigerait au passage une vraie
verrue — changer de langue sur un écran ne suit pas sur le suivant), et
commander quatre icônes dans le trait imprimé de la marque.

### Vérifié, et ce qui ne l'est pas

- `npm test` — 235 tests (23 fichiers) : verts, inchangés.
- `npm run mobile:typecheck` et `npm run mobile:export` : passent après chaque
  front.
- `npx expo config --type public` : icône, icône adaptative, greffon de
  démarrage et version 0.2.1 correctement résolus.
- Les rendus d'icône et de démarrage ont été relus à l'œil, aux tailles réelles
  et sous les masques d'Android — y compris le sceau crème sur le bleu nuit,
  après le changement de fond.
- Le point 5 de `docs/29-BUILD-MOBILE.md` (« l'icône et l'écran de démarrage »)
  reste ouvert **volontairement** : les chemins sont déclarés, les binaires
  définitifs attendent le fondateur. À solder quand la flamme sera déposée.
- **Rien n'est prouvé sur un appareil.** Le clavier, les vibrations et l'écran
  de démarrage ne se vérifient qu'après une build EAS : la checklist de recette
  au doigt est dans la PR.

---

## Amendement du 27/08/2026 — la barre d'onglets, faite

La section « La barre d'onglets — refusée, et pourquoi » ci-dessus reste vraie
telle qu'elle a été écrite : elle décrit l'état du 25/08/2026 et les raisons de
ne pas la faire ce jour-là. Ses deux prérequis sont désormais soldés, et la
barre existe. Ce qui suit amende cette section sans la réécrire.

### Les quatre raisons, une à une

1. **« Il n'y a pas d'icônes. »** Il y en avait, et elles étaient sous la main :
   celles des systèmes. `NativeTabs.Trigger.Icon` prend un SF Symbol sur iOS
   (`sf`) et un Material Symbol sur Android (`md`), chacun avec sa variante
   pleine à la sélection. Le second est rendu depuis la fonte qu'`expo-symbols`
   embarque — dépendance d'`expo-router`, déjà installée, aucun réseau. Aucune
   icône n'a donc été dessinée ni commandée : celles du système suivent la
   teinte, l'épaisseur et le poids de sélection de la plateforme, ce qu'un tracé
   maison ne saurait pas faire.
2. **« La langue est un état d'écran. »** Elle ne l'est plus :
   `apps/mobile/src/langue.ts` la tient pour toute l'application et la retient
   dans `stockage` (clé `CLEFS.langue`, donc purgée à la suppression de compte).
   La verrue nommée ici — changer de langue sur un écran ne suivait pas sur le
   suivant — est corrigée du même coup, et le choix survit au redémarrage.
3. **« C'est une restructuration de routes. »** Elle a été faite : les quatre
   écrans d'onglets vivent dans `app/(onglets)/`, le reste — séance, compte,
   invitation, connexion — dans la pile racine. Le groupe est transparent dans
   les URL : `agapeplay:///` mène toujours à l'accueil, `/invite?token=…` reste
   `/invite`, et `useAuthDeepLink` comme `useLiensDInvitation` sont inchangés.
   Le lien « ← Aujourd'hui » a bien disparu des quatre écrans d'onglets ; sur les
   écrans poussés il a changé de nature (`src/retour.ts` : on dépile, on ne
   navigue plus vers l'accueil, sans quoi la pile grandissait à chaque
   aller-retour).
4. **« Les deux changements qui répondent vraiment au reproche sont livrés. »**
   Ils l'étaient. Ceux-ci répondent à la suite du même reproche.

### Ce que la barre apporte, et qu'aucune barre en JavaScript n'aurait donné

Liquid Glass sur iOS 26, réduction au défilement (`minimizeBehavior`), remontée
au sommet quand on retouche l'onglet déjà ouvert, ondes de matériau et
`BottomNavigationView` sur Android. Rien de tout cela n'est écrit dans le
dépôt : c'est le propos.

### Les deux autres fronts

- **Les squelettes de chargement** (`src/squelette.tsx`) : une pulsation
  d'opacité en `Animated`, aucune dépendance nouvelle, une seule valeur animée
  partagée pour que les formes d'un écran battent ensemble, et le battement
  coupé quand le système demande moins de mouvement. Trois textes d'attente ont
  disparu des catalogues (`sessionLoading`, `loading` du tandem) ; **aucune
  phrase de réponse n'a été touchée** — `sessionNotDownloaded`, `notDownloaded`,
  `emptyThread`, `threadClosed` disent quelque chose, un squelette non.
- **Les feuilles natives** (`app/feuilles/`) : blocage, déblocage, signalement
  et suppression de compte sont des routes présentées en `formSheet`. La logique
  produit n'a pas bougé d'un iota — elle est restée dans les écrans, et
  `src/feuilles.ts` ne porte que la décision. Deux nuances voulues et héritées
  des panneaux : blocage, déblocage et suppression referment la feuille **avant**
  d'écrire ; le signalement la garde ouverte pendant l'envoi et ne la referme
  que si l'insert a abouti, pour ne pas faire ressaisir une catégorie et une
  phrase difficiles à écrire.

### Ce qui est vérifié, et ce qui ne l'est pas

- `npm test` — 238 tests (23 fichiers), verts. Trois de plus qu'au 25/08 : le
  catalogue `mobile-onglets.ts` est entré dans le test de parité.
- `npm run mobile:typecheck` et `npm run mobile:export` : verts après chaque
  front. Attention : `.expo/types/router.d.ts` est ignoré par git et **n'est pas
  régénéré par `expo export`** — un fichier périmé fait échouer le typage sur des
  routes pourtant valides. Le régénérer, c'est démarrer le serveur de
  développement une fois.
- **Rien n'est prouvé sur un appareil.** Trois points ne se voient que là, et un
  seul échoue en silence : le rendu des icônes Android passe par
  `renderToImageAsync`, qui rend `null` avec un simple avertissement s'il manque
  — l'onglet perdrait son icône sans que rien ne rougisse. Le repli documenté
  serait alors `src={require(…)}` depuis un tracé maison. La checklist de
  recette au doigt est dans la PR.

---

## Amendement du 25 août 2026 — le clavier et le responsive de l'app web (issue #14)

*Ajouté sans rien retirer de ce qui précède. Les deux derniers critères de
l'issue #14 — « navigation clavier complète » et « responsive testé desktop et
mobile » — étaient les seuls encore ouverts au 24/08. Aucune règle produit n'a
bougé : ni une garde, ni une écriture, ni une lecture de réponse, ni une phrase.
C'est un chantier d'accessibilité et de mise en page, et rien d'autre.*

### Ce qui était mesuré avant

Le relevé vient d'un harnais Playwright jetable (trois largeurs, quatorze
écrans, cinq dialogues), pas d'une relecture. Six constats, du plus grave au
moins :

1. **le focus ne se voyait nulle part.** `outline: auto 1px rgb(16, 16, 16)` —
   l'anneau par défaut de Chromium, c'est-à-dire du noir sur `#111111`. Les six
   onglets, les cinq réponses du bilan, les six catégories de signalement, tous
   les boutons du produit : on avançait à l'aveugle. Le fichier `styles.css` ne
   portait aucune règle `:focus-visible` ;
2. **« Réglages » n'existait plus sous 820 px.** `.quiet-button` était masqué
   par la bascule vers le rail, et `.sidebar-bottom` entier par la bascule vers
   la barre du bas. Donc, sur téléphone : pas d'export, pas de déconnexion
   partout, pas de réglage de mesure, **pas de suppression de compte**. Le
   produit se dit « mobile first » ;
3. **deux onglets étaient coupés par le bord de l'écran.** La barre du bas
   valait `repeat(4, 1fr)` pour six onglets (sept avec la modération), dans une
   hauteur fixée à 72 px : « Mentor » et « Église » passaient à la ligne, sous
   le bord ;
4. **la barre du bas passait par-dessus les dialogues.** `.main-content` porte
   `animation … both`, ce qui en fait un contexte d'empilement permanent : le
   `z-index: 20` du fond des dialogues n'y valait que contre ses frères, et la
   barre latérale à `z-index: 10` — dans le contexte du dessus — la recouvrait.
   Sous 620 px, la case « j'ai lu ce qui va se passer » et le bouton de
   suppression de compte étaient dessous ;
5. **le dialogue des réglages n'avait pas de fin.** `place-items: center` centre
   tant que l'enfant tient ; plus haut que l'écran, il déborde des deux côtés et
   le bas devient inatteignable — un débordement vers le début d'un axe ne crée
   pas de barre de défilement. Le harnais n'a jamais pu cliquer « Supprimer mon
   compte », à aucune largeur ;
6. **cinq gestes de dialogue étaient écrits en clair sur du papier.**
   `.text-button`, `.outline-button` et le lien vers la politique valent l'encre
   du fond sombre, et les sept dialogues sont sur fond papier : « Télécharger
   mes données », « Se déconnecter partout », « Supprimer mon compte »,
   « Annuler », « Lire la politique de confidentialité » se lisaient en gris
   très clair sur `#f0efe8`. On pouvait les atteindre au clavier ; on ne pouvait
   pas les voir.

Aucun débordement horizontal n'a été trouvé, ni avant ni après — la règle
« jamais de scroll horizontal de page » tenait déjà, et tient toujours.

### Ce qui a changé

- **`:focus-visible`, deux encres.** `#eeeeea` partout, `#171716` sur les
  surfaces claires (carte de séance, étape de séance, dialogues). Décalage de
  2 px, sans quoi un bouton d'encre pleine avalerait son propre anneau.
  `:focus-visible` et non `:focus` : personne ne demande un anneau au clic ;
- **un lien d'évitement** vers `#contenu`. Il compte plus qu'ailleurs ici, et
  pour une raison contre-intuitive : sous 620 px la barre latérale devient la
  barre du bas mais **reste première dans le DOM**. La tabulation commence donc
  par sept destinations avant l'écran qu'on regarde, sur téléphone comme sur
  écran large. Réordonner le DOM aurait été une refonte ;
- **un crochet unique pour les sept dialogues** (`views/dialogue.ts`) : Échap
  ferme, la tabulation reste dedans, le focus revient au déclencheur au
  démontage — donc quelle que soit la façon de fermer. L'écoute est posée sur le
  nœud du dialogue et jamais sur `document`, parce que les réglages et la
  suppression sont ouverts **en même temps** : sur `document`, une touche Échap
  aurait fermé les deux. `TrustDialog` est appelé **sans** `onClose` : cette
  fenêtre n'a ni croix ni clic sur le fond, lui donner Échap ferait d'une règle
  produit un contournement au clavier ;
- **les deux groupes radio** — six catégories de signalement, cinq catégories de
  demande d'aide — ont un `tabIndex` roulant et les flèches. Ils portaient
  `role="radiogroup"` sans en tenir la promesse : six arrêts de tabulation pour
  un choix unique ;
- **les dialogues et le bandeau d'annonce sont sortis de `<main>`**, pour la
  raison du point 4. Rien d'autre n'a bougé : ni les états, ni les gardes, ni
  l'ordre dans lequel ils s'ouvrent ;
- **la barre du bas range ses onglets en `auto-fit`**, sur la hauteur qu'ils
  demandent, et garde « Réglages » à sa droite. Elle garde ses **libellés** :
  des icônes seules auraient tenu sur une ligne, mais ✦ ◷ ↗ ▤ ⌁ ⌂ ne se devinent
  pas, et un onglet qu'on ne nomme pas est un onglet qu'on n'ouvre pas ;
- **les champs hors dialogue** — code d'église, nom de communauté, nom et dates
  d'une cohorte — rendaient le champ blanc du système sur une carte à `#191918`.
  Mêmes déclarations que `.auth-dialog input`, à l'encre du fond sombre : c'est
  ranger un élément oublié dans le thème, pas en dessiner un ;
- **une fuite du thème vert abandonné a été fermée.** `.primary-button.compact`
  est plus spécifique que la reprise du thème imprimé et gardait son ombre
  `#204334` — un trait vert sous les boutons de l'espace église, de l'espace
  mentor et du journal, seule couleur restée dans un produit monochrome.

### Ce qui reste, et qui n'a pas été touché

- `aria-hidden` a été posé sur l'avatar « C » de la barre du haut : c'est un
  reste de maquette, il s'annonçait juste après le vrai nom du compte. Il est
  retiré de la **lecture**, pas de l'écran — l'enlever pour de bon est une
  décision de produit ;
- quatre dialogues ne sont pas joignables en mode démonstration et n'ont donc
  été éprouvés qu'en relecture : la connexion (derrière `supabaseConfigured`),
  les consentements (derrière une lecture de profil distante), le déblocage
  (derrière un tandem bloqué) et l'espace modérateur (derrière
  `tandem_est_moderateur()`). Ils portent le même crochet que les trois autres,
  qui sont mesurés ;
- le harnais tourne sans réseau : les polices Google ne se chargent pas, et les
  captures sont donc rendues avec les polices de repli. Les mesures de
  débordement restent utilisables — une police de repli n'est pas plus étroite
  que DM Mono — mais les proportions fines restent à l'œil humain.

### Vérifié

- `npm test` — 238 tests (23 fichiers), verts, parité fr/en comprise (une clé
  ajoutée : `skipToContent`).
- `apps/web` : `tsc -b` et `vite build` verts.
- Harnais Playwright sur `dist/` servi localement, trois largeurs
  (375 / 768 / 1280) : 45 mesures de débordement horizontal, toutes à
  `scrollWidth === clientWidth` ; 30 arrêts de tabulation relevés avec la valeur
  calculée de leur `outline` ; cinq dialogues éprouvés (focus d'entrée, piège
  avant et arrière sur 40 appuis, Échap, restitution au déclencheur,
  imbrication réglages/suppression).
## Amendement du 25 août 2026 — l'intégration continue (issue #15)

*Ajouté sans rien retirer de ce qui précède. La section « Comment on teste ici »
plus haut décrit les deux suites ; celle-ci dit ce qui les déclenche désormais,
et ce qu'elles ne diront jamais.*

Le harnais était écrit depuis le 6 août. Il ne manquait que le déclencheur :
**rien ne tournait sur une pull request.** C'est fait —
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml), trois jobs en
parallèle, sur `pull_request` et sur `push` vers `main`.

- **Tests métier, lint, typage et fumée web** — `npm test` (238 tests),
  `npm run lint`, `npm run build` (donc `tsc -b`), puis `npm run smoke:web`.
- **Typage et export mobile** — `mobile:export` d'abord, `mobile:typecheck`
  ensuite.
- **Permissions et RLS** — la suite complète sur une pile Supabase jetable,
  montée par `tests/rls/provision.mjs`. C'est le job qui compte : une politique
  cassée rougit maintenant **avant** la fusion, et non plus le jour où quelqu'un
  y repense.

**Aucun secret n'est requis, et c'est un choix qui se défend :** la base est un
conteneur monté depuis les migrations du dépôt, les deux applications se
construisent sans variables d'environnement. Une CI qui réclamerait un secret ne
pourrait pas tourner sur la PR d'un contributeur extérieur.

### Le lint : posé, et borné

Le dépôt n'en avait aucun. Il en a un, dont le périmètre a été **mesuré avant
d'être choisi** : aucune règle de mise en forme (les commentaires français
denses et les noms de fonctions en français sont le style de ce dépôt, pas une
faute à corriger), seulement du code mort, les fautes de logique franches et les
règles des hooks React. Sur l'existant : **six erreurs**, toutes du code mort
réel — cinq imports jamais utilisés et une constante orpheline, retirés dans la
même PR. Zéro `no-explicit-any`, zéro violation des règles des hooks.

`react-hooks/exhaustive-deps` reste en **avertissement** : onze effets omettent
délibérément des dépendances — `App.tsx` surtout, où ajouter `authSession`
relancerait des lectures réseau à chaque rafraîchissement de session. Les
corriger changerait le comportement de l'application ; les taire par onze
commentaires `eslint-disable` serait du bruit posé pour faire plaisir à l'outil.
Ils restent visibles et ne bloquent pas.

### La fumée web : ce qu'elle prouve, et ce qu'elle ne prouve pas

`scripts/fumee-web.mjs` sert `apps/web/dist`, vérifie que **chaque** ressource
que la page référence répond, et cherche cinq marqueurs dans le JavaScript
réellement servi — les deux catalogues de langue, le partage du journal, le
signalement, le blocage.

**Elle ne prouve pas que React monte.** La page est une coquille remplie par le
navigateur, et il n'y a pas de navigateur ici : un composant qui lèverait à la
première ligne de rendu passerait au vert. Playwright a été écarté — un
navigateur de 300 Mo téléchargé à chaque exécution, pour un produit dont la
logique qui peut blesser quelqu'un est déjà couverte par 238 tests unitaires et
la suite RLS. Le jour où un parcours d'écran doit être prouvé de bout en bout,
c'est un chantier à lui seul.

### Ce que la CI ne dira jamais

Le clavier, les vibrations, les icônes d'onglets Android, les feuilles natives :
rien de tout cela ne se voit sans appareil. La recette au doigt, jusqu'ici
dispersée dans les corps de PR #58 et #61, est consolidée dans
[`30-RECETTE-MOBILE.md`](./30-RECETTE-MOBILE.md) — trente-trois points, dont un
qui échoue **en silence**.

### Deux mesures faites en passant, à ne pas redécouvrir

- **`apps/mobile/expo-env.d.ts` et `.expo/types/` sont absents d'un checkout
  vierge, `expo export` ne les crée pas, et `tsc --noEmit` passe quand même.**
  Le typage des routes est donc plus permissif en CI que sur une machine où le
  serveur de développement a tourné. Ce n'est pas une panne, c'est une limite —
  et elle interdit de « réparer » la CI en versionnant un fichier généré.
- `npm test` et `npm run build` tiennent chacun en moins de trois secondes sur
  un clone vierge, une fois `npm ci` passé. Le coût de la CI, c'est la suite RLS
  et l'export Metro, pas les tests.
## Amendement du 28/08/2026 — la soie : le mouvement qui sert

La phase précédente a donné au mobile ses composants natifs — barre d'onglets,
feuilles du système, squelettes. Celle-ci lui donne son mouvement. Le critère
tenu d'un bout à l'autre : **une animation qui n'apprend rien à l'œil est une
animation à retirer.** Aucun ressort, aucun rebond, aucune durée au-delà de
220 ms, et pas une seule animation posée pour décorer une transition qui allait
déjà bien.

### Front 1 — la carte de séance s'ouvre au lieu d'être poussée

`Link.AppleZoom`, porté par `expo-router@57.0.16`, est la transition à élément
partagé d'UIKit : la surface touchée grandit jusqu'à devenir l'écran, le geste
de retour la ramène à sa place, et tout cela est piloté au doigt, interruptible,
calculé hors du fil JavaScript. Elle est posée à deux endroits, tous deux menant
à `/session` : les rangées du Parcours, et le bouton « Commencer » de la carte du
jour.

**Elle est iOS 18 et au-delà, et rien d'autre — dit sans détour.** Sur Android,
sur iOS 17 et sur le web, `Link.AppleZoom` se replie sur un `Slot` : il rend son
enfant tel quel et la pile garde la transition de sa plateforme (le glissement
latéral d'Android reste ce qu'Android attend). **Aucune imitation en JavaScript
n'a été écrite pour combler l'écart**, et c'est une décision, pas une paresse :
une fausse transition à élément partagé, calculée hors du fil natif, décroche du
doigt dès que la liste est longue — c'est exactement le genre de faux natif que
cette phase corrige.

**Un arbitrage à connaître.** Sur le Parcours, la rangée entière est déjà le
lien : la surface qui grandit est celle qu'on a touchée, il n'y a rien à
restructurer. Sur l'accueil, non — la carte du jour n'est pas un lien, seul son
bouton l'est, et c'est donc le bouton qui grandit. La rendre entièrement
touchable pour que la transition parte d'elle changerait ce qu'un appui fait,
c'est-à-dire du produit. La décision est renvoyée à la recette : si l'effet
paraît petit au doigt, le geste suivant est de faire de la carte le lien.

### Front 2 — ce qui arrive et ce qui part

`react-native-reanimated@4.5.1` entre dans l'arbre (`npx expo install`, version
alignée sur le SDK 57). La dépendance est payée pour **une** chose que
l'`Animated` de React Native ne sait pas faire : une *sortie*. Au moment où l'on
voudrait animer la disparition d'une entrée de journal, React l'a déjà retirée de
l'arbre ; la retenir soi-même reviendrait à tenir un second état de liste à côté
du vrai — le genre de doublon qui finit par afficher une entrée que la base n'a
plus. Les entrées, elles, auraient pu se faire à la main ; elles passent par le
même outil pour n'avoir qu'une grammaire.

Ce qui bouge, et rien d'autre : une bulle qui arrive dans la conversation, une
page de journal qu'on vient d'écrire ou qu'on retire, la demande de confirmation
de suppression, et l'échange question → réponse de la carte du bilan. Fondu plus
translation de dix points, 220 ms à l'entrée, 150 ms à la sortie — on regarde ce
qui arrive, on ne regarde pas ce qui part.

**Trois précautions valent d'être retenues.**

1. **La cascade du premier rendu.** Poser `entering` sur chaque élément d'un
   `map` fait entrer *toute* la liste à l'ouverture de l'écran : cinquante bulles
   qui montent ensemble, c'est de la décoration, et une décoration qui retarde la
   lecture de ce qui vient d'être dit. `useNouveauxVenus` (`src/presence.tsx`)
   mémorise la première fournée en bloc et ne laisse entrer que ce qui arrive
   ensuite. Le repère de fournée est **la fin du chargement**, pas le montage :
   le fil arrive une fraction de seconde après l'écran, et prendre le montage
   pour repère aurait mémorisé une liste vide.
2. **Aucun worklet écrit ici.** Les quatre constantes de `presence.tsx` sont des
   *descriptions* fournies par la bibliothèque ; le code qui tourne sur le fil
   d'interface est celui de Reanimated, déjà compilé. C'est volontaire : le
   greffon Babel des worklets ne se prouve pas sans appareil (voir plus bas), et
   moins on lui en demande, moins il y a de choses à découvrir sur un build de
   production.
3. **Le mouvement réduit est déjà tenu par la bibliothèque.** Les constructeurs
   de Reanimated portent `ReduceMotion.System` par défaut : ils lisent le même
   drapeau système que nous et n'animent pas quand il est levé.
4. **L'entrée est décidée au montage, jamais reprise ensuite.**
   `useNouveauxVenus` répond « oui, celui-ci est neuf » au rendu où l'élément
   apparaît, puis « non » à tous les suivants. Passer cette réponse directement
   à `entering` reviendrait à *retirer* la prop pendant que l'animation est en
   vol, et selon la façon dont la bibliothèque relit ses props à la mise à jour,
   cela va du clignotement à une bulle qui reste à opacité zéro — un message
   envoyé qui n'apparaît pas est une avarie, pas un défaut d'esthétique. Le
   composant `Venue` gèle donc la décision avec `useState` : lue au premier
   rendu de *cet* élément, elle ne change plus. Rien à vérifier sur appareil, le
   cas est rendu impossible.
5. **Une entrée qui remplace une sortie attend que la place soit libre.**
   Reanimated garde une vue sortante dans la hiérarchie jusqu'à la fin de son
   animation : sur la carte du bilan, la confirmation se serait installée
   *pendant* que les cinq boutons s'effacent, et la carte aurait grandi puis
   rétréci d'un coup. `ENTREE_APRES_SORTIE` porte les 160 ms de retard qui
   l'évitent.

### Front 3 — la main

**La micro-échelle.** `src/appui.tsx` porte `Appui`, le `Pressable` de
l'application : 0,975 en 100 ms sous le doigt, en plus de l'assombrissement déjà
en place. Un assombrissement se lit comme un changement de *couleur* ; une
surface qui recule se lit comme un *déplacement*, et c'est ce geste physique qui
manquait au reproche « ça se comporte comme une web app ».

Deux points de conception qui ne se devinent pas :

- **`Appui` *est* le pressable, pas un emballage autour.** `<Link asChild>` clone
  ses props sur son unique enfant ; une `Animated.View` qui envelopperait un
  `Pressable` recevrait donc le `onPress`, et le doigt tomberait dans le vide.
- **Le prix de cette forme.** `Animated.createAnimatedComponent` aplatit le
  style et n'accepte plus la forme fonction — `style={({ pressed }) => …}` — dont
  neuf écrans se servent. `Appui` la résout donc lui-même, avec l'état d'appui
  qu'il tient déjà pour l'échelle. Les appelants n'ont rien changé.

Quand le système demande moins de mouvement, l'échelle est coupée mais
l'opacité reste : un retour d'appui qui disparaîtrait avec les animations serait
une régression d'accessibilité déguisée en respect de l'accessibilité.

**La grammaire haptique, désormais écrite dans `src/toucher.ts`.** Elle se lit en
deux questions. *Quelque chose s'est-il passé, ou quelque chose a-t-il échoué ?*
— cela choisit entre les impacts et les notifications. *Est-ce ordinaire ou
est-ce grave ?* — cela choisit l'intensité.

| Nuance | Famille système | Ce qu'elle dit | Où |
|---|---|---|---|
| `toucherLeger` | impact léger | quelque chose est **parti** | message envoyé, entrée écrite, partage posé ou retiré, rappel basculé |
| `toucherAbouti` | notification succès | quelque chose s'est **achevé** | séance terminée, bilan posé |
| `toucherRefus` | notification avertissement | quelque chose a été **refusé** | blocage/déblocage sans effet, envoi qui n'aboutit pas, écriture repoussée |
| `toucherGrave` | impact lourd | un geste de **protection** | bloquer, débloquer, signaler, supprimer |

Deux corrections de cohérence sont venues avec :

- **L'échec était muet.** C'est pourtant le moment où le retour physique sert le
  plus : quelqu'un qui appuie sur « Bloquer » et dont l'écriture est refusée en
  silence par la politique reçoit une phrase — mais il a déjà rangé son
  téléphone. `toucherRefus` le rattrape. Elle ne remplace jamais la phrase : elle
  la précède. `Warning` et non `Error` : le système n'est pas en panne, il a dit
  non.
- **Le blocage vibrait, le déblocage non** — la même relation, deux poids.
  Rouvrir une conversation qu'on avait fermée est le même ordre de geste que la
  fermer, et souvent le plus difficile des deux.
- **Le refus de mesure était muet** alors que les deux rappels voisins, sur la
  même grille de l'accueil, vibraient. Trois interrupteurs dont un seul silencieux,
  c'est la grammaire qui se contredit à trois lignes d'intervalle. Il n'a pas
  reçu de `toucherRefus` en face pour autant : `basculerMesure` rend l'état
  effectif et n'a pas de chemin d'échec à annoncer.

**Aucune haptique sur la navigation**, et la règle est maintenant écrite dans le
module pour que les futurs écrans la suivent : ouvrir un écran, changer
d'onglet, changer de langue, ouvrir une feuille, annuler — rien. Toutes les
nuances sont appelées **après** la réponse du serveur, jamais sur l'appui : ce
que la main doit sentir, c'est que la chose est faite, pas qu'on l'a demandée.

### Ce que le chantier a trouvé sans le chercher

**La position de lecture au rafraîchissement de la conversation ne saute pas —
et pour une raison qu'il ne faut pas casser.** `load()` (`app/(onglets)/tandem.tsx`)
pose `setLoading(false)` et ne repose **jamais** `setLoading(true)`. Passé la
première lecture, `loading` reste donc faux à jamais, l'effet qui appelle
`auDernierMessage()` ne se redéclenche plus, et un tirer-pour-rafraîchir ne
défile pas. C'est une propriété acquise par accident : quiconque « corrigerait »
ce `setLoading(true)` manquant réintroduirait le saut de liste, et ferait de plus
réapparaître les bulles fantômes à chaque geste de rafraîchissement.

L'écart réel est l'inverse, et il est laissé tel quel : un message arrivé au
rafraîchissement **n'est pas annoncé** si l'on n'était pas déjà en bas du fil.
L'entrée douce ne se voit que si la bulle est à l'écran. Le remède serait un
repère « nouveaux messages » — c'est du produit, pas du mouvement.

### Écarts assumés de ce chantier

1. **« Un encouragement reçu » n'a pas de surface mobile.** Le brief le citait
   parmi les présences à animer ; il n'existe que côté web
   (`packages/content/copy/web.ts`, espace mentor). Rien n'a été construit pour
   lui : bâtir un écran afin d'avoir quelque chose à animer serait l'inverse de
   l'ordre des choses.
2. **La carte du bilan ne se retire pas après la réponse, et elle ne devait
   pas.** Le brief demandait qu'elle « se retire » ; la condition d'affichage
   garde la carte à l'écran depuis l'issue #18, et « c'est noté » suivi du mot
   choisi est une réponse, pas un accusé qu'on escamote. Ce qui a été animé est
   donc l'échange à l'intérieur de la carte — la question s'efface, la
   confirmation prend sa place — et non la durée de vie de la carte. Un chantier
   de mouvement ne décide pas quand un contenu disparaît.
3. **Le greffon Babel des worklets n'est pas prouvé hors appareil.** Il n'y a
   pas de `babel.config.js` dans `apps/mobile`, et il n'en faut pas :
   `babel-preset-expo` enregistre `react-native-worklets/plugin` de lui-même dès
   que le paquet est présent (`node_modules/babel-preset-expo/build/configs/expo.js`,
   « Automatically add worklets or reanimated plugin when package is installed »).
   Le chemin se résout (`require.resolve('react-native-worklets/plugin')`). Mais
   **`mobile:export` ne prouve rien à ce sujet** : il empaquette, il n'exécute
   pas. Un greffon mal câblé se voit à l'exécution sur un build natif, et la
   recette du fondateur est la première preuve réelle.
4. **`react-native-reanimated` touche le `package-lock.json` de la racine**,
   c'est-à-dire un fichier partagé avec les chantiers `.github/` et `apps/web/`
   en cours. Inévitable dès lors qu'une dépendance est ajoutée ; nommé ici pour
   que la collision soit visible plutôt que surprenante.

### Vérifié

- `npm test` — 238 tests (23 fichiers), verts. Aucun test nouveau : ce chantier
  n'a ajouté aucune règle, et un test de durée d'animation testerait la
  bibliothèque.
- `npm run mobile:typecheck` et `npm run mobile:export` : verts après chaque
  front, y compris sur une ligne de base sans code d'animation — la chaîne
  d'outils a été prouvée avant les fonctionnalités.
- `apps/mobile/app.json` et `apps/mobile/package.json` : 0.2.3, en verrou comme
  au 27/08.

**`versionCode` passe de 1 à 2, et il le fallait.** `eas.json` déclare
`appVersionSource: "local"` et **aucun profil ne porte `autoIncrement`** : le
numéro de build est celui écrit dans `app.json`, tel quel. Or la v0.2.2 est déjà
sur la piste interne du Play Store, posée avec `versionCode: 1` — la valeur
n'avait plus bougé depuis la PR #56. Un second envoi au même numéro est refusé
par Google (« version code 1 has already been used »), et la recette de cette PR
n'aurait jamais pu commencer. `buildNumber` d'iOS suit, par symétrie ; aucun
profil de soumission iOS n'existe encore.

À décider un jour : poser `"autoIncrement": true` sur le profil `internal`
plutôt que de compter à la main. Ce n'est pas fait ici — c'est une décision de
chaîne de publication, pas de finition mobile.
- **Rien n'est prouvé sur un appareil.** Le zoom d'Apple demande un iPhone sous
  iOS 18, l'haptique demande un moteur, la micro-échelle et le greffon des
  worklets demandent un build natif. La checklist de recette au doigt est dans
  la PR.
