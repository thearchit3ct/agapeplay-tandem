# Procédure d'escalade humaine

**Version 1 — 25/08/2026.** Écrite pour l'issue #19, en même temps que les
catégories et l'urgence des signalements.

Ce document dit ce qu'un modérateur fait quand un signalement dépasse ce que
l'application sait traiter : quels signaux imposent de sortir de l'outil, vers
qui, dans quel délai, et ce qu'on consigne. Il est versionné pour une raison
précise — une procédure de sécurité qui vit dans une conversation n'existe pas.

---

## Ce que l'outil fait, et ce qu'il ne fait pas

Il faut le lire avant le reste, parce que toute la procédure en dépend.

**L'outil ne détecte rien.** Aucune analyse de contenu, aucun mot-clé, aucun
modèle. Un dossier n'arrive dans la file que parce qu'une personne a appuyé sur
« Signaler un problème ». Un adolescent sous emprise qui ne signale pas est
invisible pour ce produit, et le restera.

> **Écart avec le doc 06.** La section « Sécurité relationnelle » écrit : « tout
> signalement grave impliquant un mineur est escaladé **automatiquement** à
> AgapePlay ». Cette phrase décrit une intention, pas le produit de ce jour :
> rien n'est automatique. Ce qui existe est un tri automatique — l'urgence est
> déduite de la catégorie sans qu'aucun humain l'ait posée — et une escalade
> qui, elle, est manuelle et repose sur la personne qui lit la file. Le doc 06
> n'est pas réécrit ici ; l'écart est nommé, et c'est au responsable produit de
> trancher lequel des deux doit bouger.

**L'outil ne surveille pas la nuit.** Il n'y a ni astreinte, ni alerte, ni
notification. La file se consulte ; elle ne prévient personne. C'est pourquoi
l'écran de signalement dit, sur les catégories d'urgence immédiate, d'appeler le
119 ou le 17 — et le dit avant l'envoi, pas après.

**Un modérateur ne peut pas bloquer une relation.** Aucune politique ne le lui
permet : le blocage est un geste des participants, et le schéma exige
`auth.uid() = blocked_by`. Un modérateur peut faire avancer le statut d'un
dossier, et rien d'autre. Toute mesure sur la relation elle-même passe par un
humain hors de l'application (voir « Vers qui »).

**L'application ne garde aucune note de modération.** Il n'existe pas de champ
pour ça, délibérément : `tandem_reports` n'accorde l'écriture que sur `status`.
Ce que le modérateur consigne vit donc ailleurs (voir « Ce qu'on consigne »).

---

## Ce que l'urgence veut dire

L'urgence est déduite de la catégorie choisie par la personne qui signale
(`20260825173000_categorie_et_urgence.sql`). Elle n'est saisie par personne — ni
par l'adolescent, à qui on ne demande pas d'évaluer sa propre situation, ni par
le modérateur, parce qu'elle doit exister avant qu'il ouvre la file.

| Urgence | Catégories | Délai visé pour une **première lecture** |
|---|---|---|
| Immédiate | « des propos ou des images à caractère sexuel », « quelqu'un est en danger » | le jour même, et escalade hors de l'application dès la lecture |
| Élevée | « on insiste alors que j'ai dit non », « on me demande de garder ça pour moi » | 48 heures |
| Ordinaire | « des propos qui me mettent mal à l'aise », « autre chose », dossiers antérieurs aux catégories | 5 jours ouvrés |

**Ces délais sont des objectifs, pas des garanties, et il faut le dire tel quel.**
Le produit compte **un seul modérateur nommé** à ce jour. Un délai de vingt-quatre
heures affiché quelque part serait une promesse que personne ne peut tenir un
week-end. Si la file dépasse durablement ces objectifs, ce n'est pas la
procédure qu'il faut assouplir : c'est un deuxième modérateur qu'il faut nommer.

---

## Ce qui appelle une sortie de l'application

Ces signaux ne se tranchent pas dans la file. Ils s'y consignent, mais la
décision se prend ailleurs et par un humain identifié. Les points 1, 2 et 5 sont
sans nuance : ils escaladent. Les autres demandent une lecture — et toute
hésitation relève du point 6, qui tranche pour vous.

1. **Un mineur est en danger** — menaces, violences, propos suicidaires, un
   adulte qui cherche à isoler un adolescent de son entourage.
2. **Un contenu à caractère sexuel visant un mineur**, quel qu'en soit l'auteur,
   qu'il soit explicite ou allusif, demandé ou envoyé.
3. **Une demande de discrétion adressée à un mineur par un adulte** — garder la
   relation secrète, passer sur une autre application, effacer les messages. Le
   signal qui précède les autres.
4. **Une demande d'argent, de photos, ou de services** adressée à un mineur.
5. **Un contenu manifestement illégal** — pédopornographie, apologie du
   terrorisme, incitation à la haine.
6. **Le doute.** Si la personne qui lit hésite à qualifier — un mot isolé, une
   demande qui pourrait être anodine, un dossier qu'elle relit deux fois — elle
   escalade. Elle n'a pas à établir seule qu'un signal répété devient un
   faisceau. Une escalade de trop coûte une conversation ; une escalade de moins
   coûte autre chose.

Les catégories `sexuel` et `danger` déclenchent le point 1 ou 2 par
construction, sans lecture préalable. Pour toutes les autres, la catégorie
oriente ; elle ne décide pas.

---

## Vers qui

**En interne — AgapePlay.**
Le responsable produit d'AgapePlay est la seule escalade interne. Il est prévenu
directement, hors de l'application (téléphone d'abord, écrit ensuite), sans
attendre la fin de l'analyse du dossier. C'est lui qui décide d'un contact avec
l'église, d'une suspension, ou d'un signalement aux autorités au nom de la
société.

**L'église n'est pas la première escalade, et c'est une décision.** Le modérateur
est extérieur à l'église concernée (ADR-007), et le tandem d'un mineur est
proposé par cette église : lorsqu'un signalement vise un mentor, prévenir
l'église d'abord revient à prévenir l'entourage de la personne visée. La
séquence est donc : responsable produit, puis église si le dossier le justifie.

**Vers l'extérieur — les numéros et plateformes existants.**

| Situation | Où |
|---|---|
| Enfance en danger (France) | **119**, gratuit, 24 h/24 |
| Urgence, danger immédiat | **17** (police/gendarmerie), ou **112** |
| Cyberharcèlement, aide aux mineurs en ligne | **3018**, gratuit |
| Contenu illégal en ligne | **PHAROS** — `internet-signalement.gouv.fr` |
| Prévention du suicide | **3114**, gratuit, 24 h/24 |

Ces numéros sont français. Le produit s'adresse aujourd'hui à des églises
francophones en France ; le jour où ce ne sera plus vrai, ce tableau devra
grandir avant l'ouverture, pas après.

**Ce que le modérateur ne fait pas lui-même** : il ne contacte ni le mineur, ni
la personne visée, ni les parents. Pas par prudence juridique — parce qu'un
message venu de la modération dit à la personne signalée qu'elle a été signalée,
et que c'est exactement ce que le schéma se donne du mal à empêcher
(`reports_select_reporter` : la personne visée ne voit rien).

---

## Ce qu'on consigne

**Dans l'application, automatiquement.** Chaque changement de statut écrit une
ligne dans `tandem_report_audit` : le dossier, le modérateur (`auth.uid()`), le
statut d'avant, celui d'après, l'horodatage. Personne ne peut modifier ni
effacer ces lignes — aucun droit d'écriture n'est accordé, à personne. La
consultation d'un dossier, elle, ne laisse aucune trace : seules les décisions en
laissent (écart assumé, doc 21).

**Hors de l'application, à la main.** Tout le reste, parce que l'outil n'a pas
de champ pour ça. Le registre est tenu par le responsable produit, hors du
dépôt, et une entrée d'escalade contient :

- l'identifiant du dossier (`tandem_reports.id`) — jamais un nom, jamais un
  message recopié ;
- la date et l'heure de la lecture, et celles de l'escalade ;
- vers qui l'escalade est partie, et par quel moyen ;
- ce qui a été décidé, et par qui ;
- si un service extérieur a été saisi : lequel, et la référence rendue.

**Ce qu'on n'y recopie jamais** : le texte du message signalé, le mot libre écrit
par la personne, l'identité des participants. Le dossier reste dans
l'application ; le registre dit ce qu'on en a fait.

---

## Ce que cette procédure ne couvre pas encore

Nommé ici plutôt que découvert un jour de crise.

- **Une seule personne modère.** Il n'y a ni suppléance, ni rotation, ni délai
  au-delà duquel un dossier non lu remonte à quelqu'un d'autre.
- **Rien ne relance.** Un dossier « pris en charge » puis oublié le reste
  indéfiniment : aucun rappel, aucune alerte sur l'ancienneté.
- **Aucune conservation décidée.** Le doc 06 annonce une « conservation limitée
  et documentée des messages signalés » ; cette durée n'est fixée nulle part, et
  le doc 21 range déjà l'absence de purge parmi les écarts connus.
- **Aucun retour à la personne qui a signalé.** Elle voit son signalement et son
  statut, et n'apprend jamais ce qui a été décidé.

Chacun de ces points est une décision produit, pas un oubli de code.
