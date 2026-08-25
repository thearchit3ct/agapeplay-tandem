# L'écosystème AgapePlay vu depuis Tandem

**Version 1 — 25/08/2026.** Écrite pour l'issue #25, qui demande de « relier
mémorisation, jeu et discipulat ».

Le mot « écosystème » cache d'ordinaire une intention commerciale : faire qu'un
produit en vende un autre. Ce document part de l'intention inverse, et c'est ce
qui rend le reste cohérent.

> Tandem doit rester entièrement utilisable par quelqu'un qui n'installera
> jamais rien d'autre. Tout ce qui suit est un raccourci offert à ceux qui ont
> déjà le reste, jamais un chemin réservé.

---

## Le reste du studio, tel qu'il est

Relevé dans le dépôt `versets-flash` le 25/08/2026. Les faits ci-dessous
proviennent du code et des migrations, pas des dossiers de conception — ce dépôt
a la particularité d'avoir des `docs/` en avance ou en retard sur sa production,
et deux cas d'écart y sont explicitement consignés.

**Versets Flash** est l'application web progressive de mémorisation biblique du
studio : répétition espacée SM-2, jeux, espace d'Église, sur `app.agapeplay.store`.
React et Vite, stockage local IndexedDB via Dexie, synchronisation Supabase,
interface en quatre langues (fr, en, es, it). Elle propose treize mini-jeux en
direct multi-joueurs, avec un code de salle à cinq chiffres et une vue
projection pour l'animateur.

**Le site vitrine**, `agapeplay.store`, est un site Astro statique sans backend.
Il porte une page publique par jeu, dont `https://agapeplay.store/jeux/alleluia`.
**Il n'existe aucune page produit en anglais** : le catalogue anglais renvoie
vers `/en/shop`. Tandem se lance en français et en anglais (doc 00) ; la moitié
anglophone de son public tombera donc sur une page en français, et il vaut mieux
l'écrire ici que le découvrir.

**Alléluia!** est vendu. La table `physical_products` du dépôt le porte au
catalogue à 29,99 €, avec une page produit et un état de stock, et des demandes
d'avis post-livraison sont envoyées aux acheteurs. **L'état de stock est une
donnée de production mutable** : il ne se lit pas dans le dépôt, et rien de ce
document ne doit supposer qu'il vaut « disponible » un jour donné.

**Les défis d'Église** existent sous la forme `church_collective_challenges` :
un objectif collectif porté par une Église — révisions cumulées, passage
partagé, retours après absence, encouragements — alimenté par les sessions
locales de ses membres, avec une clé d'idempotence qui empêche le double
comptage. C'est le mécanisme le plus proche de ce que Tandem fait, et c'est
précisément pour cela qu'il ne faut pas les confondre : un défi d'Église compte
des révisions, un parcours Tandem accompagne une relation.

---

## Le défi de mémorisation

### Où il se place

**Semaine 4 du parcours « Repartir avec Jésus »** — « Lire et mémoriser la
Bible », doc 07. Le défi n'est pas une nouveauté greffée sur le parcours : la
semaine existe déjà, et l'une de ses actions est littéralement « mémoriser une
phrase ». Ce document ne fait qu'en préciser la forme.

Il se place aussi en **semaine 4 du parcours de suite** esquissé au doc 13
(« Retenir une phrase »), et pour la même raison.

### Quel verset

**Un seul, court, choisi par le participant dans une liste de trois** que
l'auteur du parcours a écrite pour cette semaine-là.

Trois, pas un : un verset imposé se mémorise moins bien qu'un verset choisi, et
le choix lui-même est une petite décision spirituelle qui vaut la peine d'être
posée. Trois, pas dix : au-delà, choisir devient une tâche, et le participant
prend le plus court.

Les trois doivent être **courts** — une phrase, pas un paragraphe — et tenir
hors contexte, parce qu'ils seront relus seuls, un mardi soir, sans le passage
autour.

**La traduction : Louis Segond 1910, ou une autre version du domaine public.**
Versets Flash expose treize traductions, dont deux sous contrat avec la Société
biblique de Genève, assorties d'un arrêt automatique programmé au 1ᵉʳ mai 2029.
C'est une contrainte bien tenue chez eux, et c'est exactement pour cela que
Tandem n'a rien à y gagner : un parcours versionné et traduit hérite d'une date
d'expiration qu'il ne contrôle pas, et le doc 07 impose déjà que les droits du
texte biblique soient vérifiés. Le domaine public retire la question.

**Une liste de versets « fondamentaux » n'existe pas côté Versets Flash** — la
recherche a été faite. En revanche, ses vingt-quatre plans thématiques et son
défi « Les 40 Jours » sont des corpus déjà relus, et l'auteur du parcours peut
s'en inspirer. Il **écrit** malgré tout ses trois versets : le choix relève de
la gouvernance doctrinale du doc 07, et se déléguer un choix de texte à une
autre équipe reviendrait à publier sans relire.

### Quel geste

Trois jours de la semaine 4, à la fin de la séance, une seule chose :

**Jour 1** — choisir son verset parmi les trois, et l'écrire à la main dans le
journal. L'écrire, pas le cocher : la copie est le premier tour de mémorisation,
et elle est gratuite.

**Jour 3** — le retaper de mémoire, sans regarder. Tandem ne compare rien, ne
note rien, n'affiche aucun pourcentage. La personne voit elle-même l'écart entre
ce qu'elle a écrit et l'original affiché juste après. C'est le seul moment du
parcours où l'application montre à quelqu'un qu'il a échoué, et elle le fait
sans le dire.

**Jour 5** — le dire à son binôme. Le partage de cette entrée est proposé, comme
tout partage dans Tandem : proposé, jamais fait.

### Et Versets Flash, là-dedans

Une ligne, en bas de la séance du jour 1, après le geste et jamais avant :

> **Vous voulez le travailler entre deux séances ?** Versets Flash est notre
> application de mémorisation. Elle n'est pas nécessaire pour cette semaine.

Suit un lien. C'est tout. Cette formulation dit trois choses à la fois — ce que
c'est, à qui c'est, et que ça ne compte pas — et le doc 16 interdit d'en faire
une carte, un encadré coloré ou un appel à l'action.

### Où ce lien pointe, et pourquoi pas là où on croit

C'est le point le plus contre-intuitif du document, et il repose sur un fait
mesuré dans l'autre dépôt.

**Versets Flash intercepte les liens profonds sur un appareil neuf.** Tant que
son état local d'accueil n'est pas posé et que personne n'est connecté,
l'application affiche son écran d'accueil puis son parcours d'installation **à
la place de la route demandée** — sauf pour une liste fermée de chemins publics,
en correspondance exacte. Et une fois l'installation terminée, l'utilisateur est
envoyé sur l'écran de session : **le lien d'origine est perdu**, pas mis en
attente.

Autrement dit, un lien vers un jeu ou un verset précis fonctionne pour qui a
déjà l'application, et se dissout pour tous les autres — c'est-à-dire pour
exactement les gens à qui Tandem le propose. Il n'existe par ailleurs **aucun
lien profond mobile natif** : ni App Links Android, ni association de domaine
iOS, ni gestionnaire de protocole déclaré. Tout passe par le web.

**Décision** : le lien du jour 1 pointe vers **la racine de l'application**, et
la séance ne promet jamais qu'il ouvrira le verset choisi. Une promesse tenue
une fois sur deux abîme plus qu'un lien modeste.

**Ce qui pourrait changer cette décision** — et qui ne dépend pas de Tandem :
si l'équipe de Versets Flash ajoute son chemin d'accueil de verset à sa liste
publique, ou conserve la destination demandée à travers son parcours
d'installation, le lien pourra devenir précis. C'est une demande à leur adresser,
pas un contournement à bricoler ici.

**Une contrainte à respecter si le lien devient un jour paramétré** : le
paramètre `code` est déjà surchargé chez eux — il désigne à la fois un retour
d'authentification et un code de salle en direct, distingués par un test sur
cinq chiffres. Aucun lien venu de Tandem ne doit le réemployer.

### La validation, et ce qu'elle coûte

**Le défi est validé par auto-déclaration, dans Tandem, et par rien d'autre.**
La personne dit « je l'ai », ou ne le dit pas.

Ce que cela interdit, explicitement :

- Tandem ne lit aucun état de Versets Flash pour marquer une séance terminée ;
- aucun retour de l'autre application ne peut débloquer, valider ou avancer quoi
  que ce soit dans un parcours ;
- il n'existe aucun écran où « allez le réviser dans Versets Flash » est la
  seule instruction proposée.

**Contrepartie assumée, et elle est sérieuse** : Tandem ne saura jamais si le
verset a réellement été mémorisé. Une déclaration se coche sans effort. C'est
accepté, pour deux raisons. La première est que vérifier exigerait précisément
la jointure d'identités que le doc 08 interdit — on ne peut pas à la fois
promettre qu'aucune identité ne circule entre les deux produits et demander à
l'un de certifier le travail de l'autre. La seconde est qu'un parcours de
discipulat n'a pas de raison de contrôler : le jour 3 a déjà montré à la
personne où elle en était, et le seul témoin qui compte est le binôme du jour 5.

---

## L'activité Alléluia!

### Le jeu, tel qu'il est

D'après son dossier de conception (`docs/jeux/alleluia/`, dépôt
`versets-flash`) : un jeu de devinettes bibliques en équipes, environ
160 cartes réparties en quatre catégories — personnages, lieux, objets et
symboles, miracles et événements. **Quatre à douze joueurs, dès 10 ans, vingt à
vingt-cinq minutes.** Deux équipes, un minuteur de trente secondes, une feuille
de score, et trois manches jouées sur **les mêmes cartes** : parole libre, puis
un seul mot, puis mime. Trois variantes existent, dont une « Enfants » qui
remplace le mime par le dessin.

**Réserve à porter** : le dossier de conception est en v0.1 et sa feuille de
route laisse plusieurs cases non cochées, alors que le jeu est en vente et
expédié. Les valeurs ci-dessus sont celles du dossier ; **la fiche d'activité
doit être relue par quelqu'un qui a joué**, en particulier sur la durée réelle.
Une fiche qui annonce vingt minutes et en prend quarante fait rater une
rencontre.

### La fiche d'activité

Une fiche dans Tandem, proposée à deux moments : une rencontre de binôme en
présence, et une rencontre de groupe organisée par une Église. Elle ne remplace
pas les règles, qui sont dans la boîte ; elle dit comment jouer *dans ce
contexte-là*.

**Le créneau** : l'activité occupe le milieu d'une rencontre, jamais le début ni
la fin. Pas le début, parce qu'un jeu ouvert avant que les gens se soient dit
bonjour devient la rencontre entière. Pas la fin, parce que le geste qui doit
clore une rencontre de binôme est une parole, pas un score.

**Le format à deux, qui est le cas difficile.** Le jeu demande quatre joueurs au
minimum et deux équipes : un binôme ne peut donc pas y jouer tel quel. La fiche
« binôme » renvoie à la **variante solo** — un record de cartes en un temps
donné — jouée à tour de rôle, l'autre tenant le minuteur. Ce n'est pas le jeu
dans sa forme pleine, et la fiche doit le dire plutôt que de laisser deux
personnes découvrir la contrainte en ouvrant la boîte.

**La question d'après la partie**, seule partie qui appartienne vraiment à
Tandem, en deux versions :

- *en binôme* : « qu'est-ce que tu as remarqué, chez toi, pendant qu'on
  jouait ? » ;
- *en groupe* : « qui a découvert quelque chose sur quelqu'un d'autre ? »

Une question sur le jeu, pas sur la Bible. Un jeu de culture biblique transformé
en contrôle de connaissances déguisé produit exactement l'effet qu'on veut
éviter, et il est très facile d'y glisser.

**Ce que la fiche ne fait pas** : elle ne vend pas. Elle indique où trouver le
jeu — la page publique `agapeplay.store/jeux/alleluia` — une fois, en fin de
fiche. Le mot « acheter » ne figure nulle part plus haut. Un parcours de
discipulat qui place une offre commerciale dans une séance abîme la relation
qu'il essaie de construire, et le doc 00 exclut déjà la publicité ciblée fondée
sur les données spirituelles.

**La disponibilité.** L'état de stock vit dans la base de l'autre produit, et
Tandem n'a aucun composant serveur pour l'interroger — `supabase/` n'y contient
que des migrations. La fiche est donc **publiée et dépubliée par l'éditorial**,
comme un contenu, et non pilotée par un état distant. C'est moins malin, et ça
ne casse pas quand l'autre produit change.

---

## Les liens entre les expériences

### Depuis Tandem

Deux chemins sortants, et pas un de plus :

1. la racine de Versets Flash, au jour 1 de la semaine 4 ;
2. la page publique d'Alléluia! sur le site vitrine, en fin de fiche d'activité.

Pas de bandeau, pas de bloc « découvrez aussi » sur l'accueil, pas de
notification. **Chaque lien sortant supplémentaire dégrade la promesse du
document** : à trois ou quatre, l'application ne propose plus un raccourci, elle
fait la promotion du studio.

**Le lien vers la page produit est en français, y compris pour un utilisateur
anglophone**, faute d'équivalent. La fiche d'activité anglaise doit le signaler
en une ligne plutôt que de laisser quelqu'un cliquer et se cogner.

### Vers Tandem

Le sens inverse est le plus délicat, parce que la population de Versets Flash
est beaucoup plus large que celle de Tandem, et qu'elle comprend des mineurs de
moins de 16 ans.

**La règle** : aucune invitation vers Tandem ne s'adresse à un utilisateur
individuel de Versets Flash. Le point d'entrée est **l'espace d'Église** — un
responsable qui gère déjà un groupe, à qui l'on propose l'accompagnement en
binôme comme une suite possible.

Ce n'est pas de la prudence excessive. Tandem impose 16 ans (doc 06), noue des
relations privées entre personnes, et fait valider les binômes de mineurs par
une Église. Une invitation adressée à un joueur anonyme court-circuiterait tout
cela d'un seul geste. Un responsable d'Église, lui, est déjà l'autorité que le
modèle de sécurité de Tandem suppose — et il existe déjà comme rôle chez eux,
avec un code d'Église et une adhésion contrôlée.

**Ce qui n'est délibérément pas fait** : aucun compte partagé, aucune session
transmise, aucune connexion unique entre les deux produits. Un utilisateur qui
arrive de Versets Flash crée un compte Tandem comme n'importe qui. C'est un
frottement réel, assumé, et c'est le prix de la section suivante.

**Ce qui n'est pas fait non plus, et qui tentera quelqu'un** : brancher le défi
de mémorisation d'un parcours Tandem sur un défi collectif d'Église de Versets
Flash, pour que les versets appris comptent dans l'objectif commun. Le mécanisme
existe chez eux et il est propre. Mais faire compter une action de parcours dans
un compteur d'Église exige de savoir qui a fait quoi des deux côtés — la
jointure interdite, sous un autre nom.

---

## La non-coupure : ce que ça interdit

Formulé en interdits, parce qu'une garantie écrite en positif ne se vérifie pas
à la relecture d'un diff.

1. **Aucune séance, aucun défi, aucun parcours ne peut être bloqué par l'état
   d'une application tierce.** Tandem ne connaît pas cet état et ne doit acquérir
   aucun moyen de le connaître.
2. **Aucun compte Versets Flash n'est requis, à aucun moment, pour aucune
   fonctionnalité de Tandem.**
3. **Aucun lien profond n'est le seul chemin vers l'accomplissement d'un
   défi.** Chaque défi se réalise entièrement à l'intérieur de Tandem, et le
   lien est mentionné après le geste, jamais à sa place.
4. **Aucune complétion n'est importée.** Ni par appel, ni par retour de lien, ni
   par un champ que l'utilisateur recopierait.
5. **Aucun identifiant de personne ne voyage entre les deux produits**, y
   compris haché. Voir ci-dessous.
6. **Aucune fiche d'activité, aucune séance, ne dépend d'un appel réseau vers
   l'autre produit.** Tout est éditorial.
7. **Aucun contenu biblique n'est repris de l'autre produit sans que Tandem ait
   vérifié ses propres droits** — la contrainte de licence à échéance en est la
   démonstration : hériter d'un texte, c'est hériter de sa date de fin.

Une manière courte de vérifier ces sept points sur une proposition future :
*est-ce que ça marche encore si l'autre produit est éteint ?* Si la réponse est
non, la proposition est refusée.

---

## La mesure de l'usage croisé

### Le piège, d'abord

La façon évidente de mesurer un passage d'un produit à l'autre est de faire
voyager un identifiant dans le lien, et de le hacher pour se sentir tranquille.
**Un identifiant haché reste une clé de jointure.** Ce que le doc 08 interdit
n'est pas le texte clair : c'est le rapprochement entre deux jeux de données
dont l'un contient des convictions religieuses et des échanges de discipulat.
Le hachage n'empêche rien de ce rapprochement ; il le rend seulement moins
visible dans une revue de code.

Aucun lien sortant de Tandem ne porte donc d'identifiant d'utilisateur, de
compte, de tandem, de session ni de parcours nominatif. Le point mérite d'être
écrit ici parce que l'autre produit **sait** capter des paramètres d'entrée — il
en gère plusieurs, captés très tôt au démarrage et effacés de la barre d'adresse
aussitôt. Le mécanisme est disponible, propre, et c'est exactement pour cela
qu'il faut nommer la règle : rien n'empêchera techniquement quelqu'un d'y
ajouter un paramètre, sauf ce document.

### Ce qu'on mesure à la place

Deux comptes, chacun de son côté, **jamais réconciliés par personne**.

Côté Tandem, deux événements ajoutés dans la forme du doc 08 :

| Événement | Propriétés autorisées |
|---|---|
| `memorization_challenge_completed` | journey_id, week, declared |
| `companion_link_opened` | journey_id, week, target |

`target` prend deux valeurs et pas davantage : `versets_flash`, `boutique_jeu`.
`declared` est booléen et rappelle que la complétion est déclarative. **Aucune
propriété ne nomme le verset choisi** : le verset qu'une personne retient un
mardi soir en dit plus long sur elle que la plupart des champs de ce document.

Côté Versets Flash, la seule chose demandée est une **provenance non
nominative** : le fait qu'un arrivant vienne de Tandem, et rien de plus. Leur
instrumentation s'y prête — elle distingue déjà l'origine d'une ouverture de jeu
et compte les clics vers les produits physiques par source. C'est une valeur de
plus dans une énumération existante, pas une mécanique nouvelle.

### La comparaison autorisée

**Taux contre taux, par cohorte et par semaine.** Sur la cohorte de mars, x %
des participants ont ouvert le lien en semaine 4 ; côté Versets Flash, y
arrivées attribuées à cette provenance sur la même semaine. La comparaison de
ces deux nombres agrégés est ce que l'issue appelle « mesure de l'usage
croisé », et c'est tout ce qu'on aura.

**Ce qu'on ne saura donc jamais** : si la personne qui a ouvert le lien est celle
qui a créé un compte, combien de personnes utilisent les deux produits, ce que
devient un participant Tandem chez eux. C'est une perte réelle pour le produit
et pour le marketing, et elle est le prix de la promesse. Une équipe qui
trouverait cette mesure trop pauvre doit rouvrir le doc 08, pas contourner ce
document.

**Un seuil de publication.** Aucun chiffre de cette mesure n'est affiché sur une
cohorte de moins de vingt participants. En dessous, un pourcentage désigne
quelqu'un : dans un groupe de six, « une personne sur six a ouvert le lien » se
devine autour de la table.

**Une asymétrie à connaître.** Versets Flash identifie ses utilisateurs
connectés dans son outil de mesure ; Tandem, non. Compter deux nombres de part
et d'autre reste sans risque — mais c'est une raison de plus pour que la
provenance envoyée soit un mot, jamais une valeur propre à une personne.

---

## Ce qui attend une décision humaine

1. **La relecture de la fiche Alléluia! par quelqu'un qui a joué.** Durée réelle,
   praticabilité de la variante solo à deux, adéquation de la variante Enfants.
   Le dossier de conception donne des chiffres ; il est en v0.1 et le jeu est
   déjà vendu.
2. **Les trois versets de la semaine 4**, et confirmation de la traduction du
   domaine public. Choix éditorial soumis à la relecture du doc 07.
3. **La demande à adresser à l'équipe Versets Flash** : rendre atteignable une
   destination précise depuis un lien externe, ou conserver la destination
   demandée à travers l'accueil. Sans elle, le lien reste générique — ce qui est
   acceptable, mais c'est un choix à assumer plutôt qu'à subir.
4. **L'accord de la même équipe sur la provenance non nominative.** Elle demande
   une modification chez eux, et elle n'a pas été demandée.
5. **La page produit anglaise, ou son absence.** Envoyer la moitié anglophone du
   public vers une page en français est un défaut connu ; personne n'a décidé
   s'il est acceptable au lancement.
6. **Le seuil de vingt participants.** Il est proposé, pas mesuré. Quelqu'un doit
   décider si c'est le bon nombre, ou si la mesure ne se publie qu'au niveau de
   toutes les cohortes confondues.
7. **Le sens Versets Flash → Tandem, entièrement.** Ce document dit par où il
   doit passer — l'espace d'Église — et rien de plus. La forme concrète relève
   d'une décision prise dans l'autre dépôt, par une équipe qui n'a pas été
   consultée.
8. **Le jalonnement.** L'issue #25 est en M3 — Bêta publique ; le doc 09 range
   « intégration Versets Flash » et « défis et jeux AgapePlay » en Phase 5 —
   Expansion. Le même écart que pour l'issue #27, et il se tranche une fois pour
   les deux.
