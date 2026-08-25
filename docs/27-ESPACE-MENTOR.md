# L'espace mentor

*Issue #16. Écrit le 26 août 2026, en même temps que la migration
`20260826090000_espace_mentor.sql` et `tests/rls/espace-mentor.test.ts`.*

Ce document dit **ce qui a été décidé et pourquoi**. Le comment vit dans la
migration, qui est commentée ligne à ligne ; l'autorité sur les politiques est
la suite de tests, pas ce texte.

---

## Le point de départ

Le chantier #17 avait laissé la place vide exprès. `mentor_assignments` avait
ses chemins d'écriture — le responsable nomme, le jeune accepte — et
`mentor_profiles` son instantané de vérification. Mais un mentor ne lisait
**rien** : ni le nom de la personne qu'il accompagne, ni le moindre signe de sa
part. L'écran mentor affichait deux cartes de statut et une phrase, « aucun
participant ne t'est encore affecté », qu'aucune requête n'allait vérifier.

La matrice du doc 06 bornait d'avance ce chantier : « progression de séance —
**signaux minimaux si affecté** », « journal : non », « messages : non »,
« demande d'aide : oui ». Restait à décider ce que « minimal » veut dire quand
il faut l'écrire en SQL.

---

## Le principe qui gouverne tout le reste

> **Le mentor reçoit des catégories, jamais des observations.**

La tentation, en écrivant un tableau de suivi, est de considérer que « la
dernière séance remonte au 3 août » est un signal minimal, puisqu'il ne contient
aucun mot du jeune. C'est la décision centrale de ce chantier, et elle dit le
contraire : une date d'activité est une observation. Elle se compare d'une
personne à l'autre, elle se compte, elle se met en colonne — et elle fabrique le
classement que le cinquième critère de l'issue interdit, même privé, même dans
la tête d'un seul lecteur.

Ce qui sort est donc **un mot parmi quatre**, calculé dans une fonction
`security definer`, à partir de lignes qui ne franchissent jamais sa frontière.

La distinction à ne pas perdre : l'interdit porte sur les **dates d'activité
observée**, pas sur l'horodatage d'un geste que la personne a posé elle-même
vers son mentor. Une demande d'aide porte son `created_at`, et le mentor le lit
— parce que c'est le jeune qui a frappé à la porte, et savoir depuis quand il
attend fait partie du geste.

---

## Décision 1 — le chemin du nom

`profiles` est own-only depuis le 4 août, et le seul chemin vers le nom d'autrui
était `tandem_partenaire()` (le binôme). Il en fallait un second, et le
raisonnement de la décision 7 du #17 se rejoue mot pour mot : **pas de politique
SELECT sur `profiles`** — elle ouvrirait toutes les colonnes, aujourd'hui et à
chaque colonne ajoutée plus tard, et personne ne s'en souviendrait — mais une
fonction qui énumère ce qui sort.

`tandem_mes_accompagnements()`, **sans paramètre**, donc jamais un annuaire :
elle répond « les personnes que j'accompagne », et rien d'autre ne peut lui être
demandé.

**Elle ne rend que les affectations `active`.** Une affectation `pending` est une
proposition que le jeune n'a pas encore acceptée ; en rendre le nom donnerait au
mentor l'identité de quelqu'un qui n'a pas dit oui — et la décision 5 du #17
tient précisément à ce que ce oui existe. Le mentor voit ses propositions en
attente par `mentor_assignments_member_read` (des uuid et un statut, depuis le
4 août) ; l'écran en fait **un compte, jamais une liste** — « une proposition
attend une réponse » — sans nommer personne. Sans ce compte, un mentor qu'on
vient de nommer lirait « aucun participant ne t'est encore affecté » alors
qu'une affectation existe et attend : faux, et décourageant.

> **Le nom naît de l'acceptation.**

---

## Décision 2 — les quatre signaux, et le seuil

Par ordre de précédence, parce qu'une personne n'a qu'un mot :

| Signal | Quand | Ce que l'écran dit |
|---|---|---|
| `aide_demandee` | une demande d'aide est ouverte ou prise en compte | « Demande de l'aide » |
| `nouveau` | aucune activité connue, affectation de moins de 14 jours | « Vient d'arriver » |
| `actif` | une activité dans les 14 derniers jours | « En chemin » |
| `a_relancer` | le reste | « Fais-lui signe » |

`aide_demandee` passe avant tout : c'est le seul des quatre que la personne a
posé elle-même. `nouveau` existe parce que, sans lui, quelqu'un qui vient
d'accepter serait « à relancer » dès le premier jour, sur la foi d'une absence
qui n'a pas encore eu le temps d'exister.

**Quatorze jours, et pas douze.** `packages/domain/src/bilan.ts` porte
`ABSENCE_SEUIL_JOURS = 12`, et deux nombres voisins pour la même idée seraient
une dérive. Ce n'est pas la même idée : les douze jours du bilan déclenchent un
message que l'application adresse à la personne elle-même — « te revoilà », sans
compter ce qui a manqué — tandis que les quatorze d'ici déclenchent la
sollicitation d'un tiers. **L'horloge du mentor doit partir après celle de
l'application, jamais en même temps** : sinon un même silence produit deux
relances le même jour, et la seconde vient d'un adulte. Quatorze est le premier
compte rond de semaines strictement postérieur à douze, et un test épingle
l'inégalité plutôt que la valeur.

**Le vocabulaire est une décision, pas une couche de peinture.** « Fais-lui
signe » est une action proposée au mentor ; « 17 jours d'absence » serait un
jugement porté sur le jeune. Le #49 avait posé « aucun wording de honte » et
« jamais un écart chiffré » face à soi-même ; la même dignité vaut face au
mentor. Aucune couleur ne hiérarchise les signaux à l'écran — un rouge et un
vert feraient un classement à eux seuls.

**Le tri est alphabétique, et il vient de la base.** Trier par signal, c'est
classer, quel que soit le nom qu'on lui donne : le premier de la liste est
toujours le dernier de quelque chose. L'écran ne retrie jamais — un tri côté
client serait un tri qu'aucun test SQL ne garde.

**Ce qui a été écrit puis retiré** : la date de la dernière activité, le nombre
de séances, le nombre de bilans, l'état de la dernière semaine. Chacun aurait
rendu le tableau plus « utile », et chacun aurait fabriqué la comparaison.

---

## Décision 3 — la demande d'aide : une catégorie close, pas un mot libre

C'est la décision la plus discutable du chantier, alors elle est écrite en
entier.

Le signalement (#46) porte un `reason` de mille caractères. Le motif ne se
transpose pas, et la raison est le **lecteur** : un signalement est lu par un
modérateur extérieur à l'église, formé, tenu par une procédure écrite (doc 22).
Une demande d'aide est lue par un adulte bénévole de la communauté du jeune.

Ouvrir mille caractères de texte libre d'un mineur vers cet adulte, hors de la
conversation de tandem — qui est, elle, signalable, bloquable et supprimable —
fabriquerait exactement le canal que la membrane du #17 refuse, et le
fabriquerait en croyant rendre service. Ce que le jeune veut dire, il le dit à
son binôme, ou il le signale. Ce bouton-ci dit une seule chose, et c'est déjà
beaucoup : **fais-moi signe.**

Cinq catégories, dans la langue du schéma comme `tandem_reports.category` :
`parcours`, `pratique`, `spirituel`, `moral`, `autre`. Ce n'est pas une échelle
et l'ordre n'a pas de sens ; `autre` est en dernier, comme
`CATEGORIES_PROPOSEES`, pour qu'une sortie de secours n'absorbe pas tout.

**`moral` est offerte au même rang que les autres**, et l'écran affiche les
numéros du doc 22 — 119, 3018, 3114, 17 — **avant** l'envoi lorsqu'elle est
choisie, jamais après. Ce produit ne surveille pas la nuit, et il vaut mieux le
dire pendant qu'on hésite.

**Pas de demande sans destinataire.** `mentor_id` est `not null` et la politique
d'insertion exige un accompagnement actif avec un mentor vérifié. Une ligne
écrite « au cas où » par quelqu'un sans mentor serait une promesse que personne
ne reçoit. Le cas est traité côté écran, pas côté base : `gestesDuParticipant()`
rend `orienter` exactement quand `demanderDeLAide` est faux, et il n'existe donc
aucun état où l'écran se tait. Sans mentor joignable, il montre les recours
réels — le binôme, le responsable de la communauté, les numéros.

**Une seule demande ouverte à la fois**, par index unique partiel. Le doc 06
exige que « les actions sensibles soient idempotentes » : un adolescent qui
appuie trois fois parce que rien ne bouge ne doit pas fabriquer trois dossiers,
ni apparaître comme insistant auprès de celui qu'il appelle.

**Les transitions** : `open → acknowledged` (le mentor a vu) → `closed` (le
demandeur clôt). **Le mentor ne clôt pas** : ce n'est pas à celui qu'on appelle
de décider que l'appel est terminé.

---

## Décision 4 — l'encouragement : six mots, et rien d'autre

Le mentor n'a **aucun** canal vers le participant. L'issue demande pourtant une
action d'encouragement. La plus petite forme qui compte, donc — et « la plus
petite » est ici une garantie, pas une économie.

**Des mots choisis parmi une liste close**, comme les cinq états du bilan (#49).
La table ne porte qu'une **clé** ; le texte vit dans `packages/content/copy`, en
français et en anglais, relu, et modifiable sans migration. Trois conséquences,
et chacune est une raison :

1. aucun contenu écrit par un adulte n'atteint un mineur hors d'un canal
   signalable. Un champ de texte libre mentor → participant aurait été une
   messagerie privée sans blocage, sans signalement et sans historique partagé
   — c'est-à-dire précisément le canal que le doc 06 n'autorise que « dans le
   tandem proposé par l'église et accepté par le jeune » ;
2. la base ne stocke aucune donnée sensible : une clé n'est pas une phrase ;
3. le participant lit dans **sa** langue un mot envoyé dans une autre.

Les six : « je pense à toi », « je prie pour toi », « prends ton temps »,
« fais-moi signe quand tu veux », « content de cheminer avec toi », « on reprend
quand tu veux ». Aucune ne félicite d'un résultat, aucune ne reproche un
silence.

**Un par jour et par accompagnement**, par contrainte d'unicité sur
`(assignment_id, jour)`. Un canal à sens unique, sans réponse possible, devient
du harcèlement à la trentième ligne. `jour` est **hors du `grant insert`** —
sinon la borne se contourne en datant son geste d'hier — et la violation de
l'index est un **refus réussi**, pas une panne : l'écran lit sa réponse et dit
« tu lui as déjà écrit aujourd'hui ».

**Le participant peut effacer ce qu'il a reçu ; le mentor ne le peut pas.** Ce
qui arrive chez quelqu'un lui appartient ; ce que le mentor a envoyé ne lui
appartient plus.

**Aucun accusé de lecture.** Une colonne `read_at` avait été écrite, avec sa
politique UPDATE et son grant, puis retirée avant la livraison : le seul usage
qu'elle aurait eu est de dire au mentor si le jeune avait ouvert son message.
C'est un signal sur le jeune, donc exactement ce que ce chantier refuse de
produire — et un canal à sens unique n'a pas de retour à mesurer. Ce qui reste
est plus simple : un mot arrive, et il est là.

---

## Décision 5 — la vérification garde ce qui sort, pas ce qui est nommé

`verification_status` et `training_status` existaient depuis le 4 août sans que
rien n'en dépende. Ils deviennent opposables ici : les trois chemins ouverts par
ce chantier — lire ses accompagnements, recevoir une demande d'aide, envoyer un
encouragement — exigent tous `verified` **et** `completed`.

Le point d'application est délibéré. **Nommer un mentor reste possible sans
vérification** (`mentor_assignments_leader_insert` du #17 ne demande que le
rôle) : nommer est une intention d'église, et une église a le droit de préparer
avant que la vérification n'aboutisse. Ce qui exige la vérification, c'est le
premier octet qui sort du jeune vers l'adulte. Le doc 06 range la « validation
manuelle par pièce contrôlée ou attestation d'église » dans la politique produit
MVP, et sa section « sécurité relationnelle » ne conçoit la relation supervisée
que par une église qui répond de son mentor.

Conséquence assumée : un mentor nommé mais non vérifié voit un écran vide, et
l'écran lui dit pourquoi — sa carte de vérification est juste au-dessus. Un
écran vide qui s'explique vaut mieux qu'une liste de noms d'adolescents rendue à
quelqu'un que personne n'a encore contrôlé.

**Une exception, et une seule** : la lecture d'une demande d'aide **déjà reçue**
ne porte pas le conjonct de vérification. Ce qui est fermé, c'est la porte
d'entrée, pas la mémoire d'un appel — une demande en cours ne doit pas
disparaître des yeux de celui qui la traite parce que sa formation a expiré
entre-temps.

**Le sens inverse n'est pas gardé, et c'est le sujet.** Le participant voit
l'état de vérification et de formation du mentor qu'on lui propose, **avant**
d'accepter. C'est même l'information qui lui manque le plus pour décider : le
statut sort donc vers le jeune, au sujet de l'adulte, alors qu'il ne sort jamais
dans l'autre sens.

---

## Décision 6 — l'écran du participant, sans lequel rien n'existe

La décision 5 du #17 réserve l'écriture de `active` au participant. **Aucun
écran ne la lui offrait** : aucune affectation n'atteignait donc jamais `active`
par l'application, et le tableau de suivi serait resté vide en permanence.

`tandem_mon_accompagnement()` rend `pending` **et** `active` — contrairement à
sa jumelle, qui ne rend que `active`. L'asymétrie est le sujet : le jeune doit
voir la proposition pour y répondre ; le mentor n'a pas à connaître le nom de
quelqu'un qui n'a pas encore répondu. `paused` et `ended` ne sortent pas — il
n'y a rien à y faire, et une relation terminée n'a pas à rester affichée.

**Un défaut trouvé en relecture, et qui ne se voyait par aucun test de base** :
`gestesDuParticipant` rendait d'abord `orienter: !joignable`, si bien qu'une
proposition en attente affichait à la fois « ton église te propose d'être
accompagné·e par Marc » et, trois lignes plus bas, « personne ne t'accompagne
pour l'instant — 119, 3018, 3114 ». Sur l'écran même où un jeune de seize ans
décide de consentir. La règle juste est `orienter = !repondre && !joignable` :
on oriente quand il n'y a **rien à répondre et personne à joindre**. Un test le
tient désormais, nommément.

**Cette carte vit sur l'onglet « Mentor », pas sur celui du tandem.** La
conversation du binôme et la relation à l'église sont deux membranes que le #17
sépare exprès ; les recoller visuellement suffirait à les faire confondre. Un
même écran porte donc les deux rôles — ce que j'accompagne, et qui
m'accompagne — sans qu'aucun chemin de lecture ne passe de l'un à l'autre.

---

## La mesure

`help_requested` (`source_role`, `category`) était le seul nom du catalogue
verrouillé du doc 08 à n'être émis nulle part. Il l'est désormais, au moment du
geste, avec `source_role: 'participant'` et la catégorie choisie — une valeur
close, jamais un mot de la personne. La contrainte `analytics_events_metadata_sobre`
la refuserait de toute façon.

Aucun autre événement n'est ajouté : l'encouragement et la réponse à une
proposition n'ont pas de nom dans le catalogue, et en inventer un demanderait
d'abord d'amender le doc 08 — décision éditoriale, pas effet de bord d'un
chantier.

---

## L'export et la suppression de compte

Les quatre sens entrent dans `apps/web/src/export.ts`, sous des clefs
distinctes plutôt que fondues : « ce que j'ai demandé » et « ce qu'on m'a
demandé » ne se lisent pas de la même façon dans un fichier d'export. Aucune des
deux tables ne porte de texte libre — ce qui sort est une catégorie et une clé.

`supprimer_mon_compte()` efface les deux tables dans les deux sens.
**Mesuré, et à lire correctement** : `assignment_id` référence
`mentor_assignments` en `on delete cascade`, donc le `delete` des affectations,
déjà présent, emporterait les deux tables tout seul — contrairement à la cascade
vers `auth.users`, qui, elle, ne sert jamais (la fonction ne supprime pas la
ligne `auth.users`, elle la neutralise). Retirer les deux `delete` explicites ne
fait rougir **aucun** test : la mutation a été jouée. Ils sont écrits quand même,
et placés avant celui des affectations, parce qu'ils disent ce qui s'en va là où
la cascade le tait, et qu'ils tiennent encore le jour où quelqu'un
dénormaliserait `assignment_id`.

---

## Ce que ce chantier n'ouvre pas

- **Aucune politique** n'est ajoutée sur `journal_entries`, `tandem_messages`,
  `weekly_checkins`, `session_progress` ni `journal_shares`. Les deux dernières
  sont **lues** par `tandem_mes_accompagnements()`, hors RLS, et rien n'en sort
  qu'un mot parmi quatre. Les suites `journal-prive`, `conversations-privees`,
  `partage-journal` et `bilan-hebdomadaire` montent déjà, chacune, un mentor
  vérifié et affecté qui ne lit rien : elles restent vertes sans être amendées,
  et c'est la mesure la plus utile du chantier.
- **Aucun lien entre une affectation et un tandem.** L'écart nommé par le #17
  (décision 6) reste ouvert, et ce chantier confirme qu'il n'en avait pas
  besoin : le mentor ne passe jamais par la conversation, il a son propre canal,
  minuscule et à sens unique.
- **Aucune statistique agrégée pour le responsable.** Le doc 06 la lui accorde
  (« non, statistique agrégée uniquement ») ; rien ici ne la calcule. Ce serait
  un second lecteur, un second seuil, une seconde surface.

---

## Écarts connus et assumés

- **Le mobile ne connaît rien de tout ceci.** Web-first, comme le #17, et pour
  une raison plus forte ici : le geste de demande d'aide appartient à la carte
  d'accompagnement, et cette carte n'existe qu'en web. L'accrocher à l'écran
  tandem mobile — le seul écran mobile où elle aurait pu tenir — recollerait
  visuellement les deux membranes que la décision 6 du #17 sépare. Rien dans
  `packages/domain/src/mentor.ts` n'est spécifique au web : un écran mobile
  n'aurait qu'à être écrit, le jour où il portera aussi la carte
  d'accompagnement.
- **Aucune notification.** Un mentor apprend qu'on lui a demandé de l'aide en
  ouvrant l'onglet. `notification_preferences` a bien une colonne `church`, et
  rien ne la consomme aujourd'hui : brancher une notification demanderait un
  ordonnanceur, que ce dépôt n'a toujours pas. À rouvrir avec la dette de purge
  nommée par le #17 — c'est le même manque d'infrastructure.
- **Une seule relation d'accompagnement affichée côté participant.** La RPC
  ordonne par date et l'écran prend la première. Une seconde proposition
  concurrente est une question de produit qui ne se pose pas encore.
- **`tandem_accompagnement_actif` prend deux paramètres**, là où le motif du
  dépôt est « sans paramètre, pour ne pas devenir un annuaire ». Elle ne rend
  qu'un booléen sur une paire que l'appelant nomme déjà : un tiers qui la sonde
  obtient `true`, et n'apprend rien qu'il ne sût en écrivant les deux
  identifiants. Le test le dit en clair plutôt que de le supposer.

---

## Comment c'est prouvé

`tests/rls/espace-mentor.test.ts` — 25 tests, chacun avec son témoin positif
dans le même décor : deux églises, **trois mentors aux trois états de
vérification**, sept affectations, et le seul endroit du chantier où une date
d'activité est écrite en clair.

Le test central rend `a_relancer` **dans le même décor** où le mentor lit zéro
ligne de `weekly_checkins` et zéro ligne de `session_progress` en direct — avec
un troisième constat, hors RLS, qui montre que les lignes existent bel et bien.
C'est ce qui prouve que la fonction n'est pas une porte de service.

Sept conjoncts ont été **cassés sur la base vivante** :

| Mutation | Tests rouges |
|---|---|
| La garde de vérification quitte `tandem_mes_accompagnements()` | 1 |
| La fonction rend aussi les affectations `pending` | 1 |
| Le tableau est trié par signal | 2 |
| L'état d'origine quitte le `using` des transitions d'aide | 1 |
| `tandem_accompagnement_actif` ne regarde plus `mentor_profiles` | 3 |
| `jour` entre dans le `grant insert` des encouragements | 1 |
| Les deux `delete` explicites quittent `supprimer_mon_compte()` | **0** |

La dernière ligne est un résultat, pas un échec : elle mesure que la cascade
fait le travail, et c'est ce que le commentaire de la migration affirme. Un
conjonct qui ne fait rougir personne est un conjonct que rien ne tient — sauf
quand une autre garde le tient déjà, et qu'on l'a écrit.
