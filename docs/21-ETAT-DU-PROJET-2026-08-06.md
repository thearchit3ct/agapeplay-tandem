# État du projet — 6 août 2026

*Ce document remplace [`19-ETAT-COMPLET-DU-PROJET-2026-08-05.md`](./19-ETAT-COMPLET-DU-PROJET-2026-08-05.md),
qui décrit un état antérieur à la campagne de sécurité du 6 août. Les deux
peuvent être lus ensemble : le 19 dit ce que le produit veut être, celui-ci dit
où il en est réellement.*

Dépôt `thearchit3ct/agapeplay-tandem`, branche `main`.

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
