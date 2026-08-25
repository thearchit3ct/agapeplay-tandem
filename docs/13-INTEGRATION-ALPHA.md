# Intégration du parcours Alpha

**Version 2 — 25/08/2026.** Écrite pour l'issue #27. La version 1 est conservée
intégralement plus bas, sous « État initial » : rien n'en est retiré, et ce qui
en tient est repris ici nommément. Ce que cette version ajoute, c'est la
décision que l'issue réclame — un niveau, pas trois pistes — la conception du
mode compagnon, l'esquisse du parcours original, les conditions de marque, et un
courriel prêt à partir dont l'envoi appartient à un humain.

---

## Ce que nous savons d'Alpha, et ce que nous croyons savoir

Il faut séparer les deux avant de décider quoi que ce soit, parce que la
tentation d'un document de conception est d'écrire au présent ce qui n'a jamais
été vérifié.

**Ce qui est établi et stable.** Alpha est un parcours de découverte de la foi
chrétienne, conçu autour d'un repas partagé, d'un exposé et d'une discussion en
petit groupe où aucune question n'est écartée. Il est utilisé par des Églises de
traditions différentes, catholiques comme protestantes, et la marque comme les
contenus sont contrôlés par Alpha International, avec des relais nationaux —
en France, Parcours Alpha.

**Ce que nous ne savons pas, et qu'il ne faut pas écrire comme un fait.** Le
nombre exact de sessions et de semaines. La version 1 de ce document dit
« 11 semaines et 16 sessions » pour la série Alpha Film ; la formulation
courante ailleurs parle de « 10 à 12 sessions ». Les deux circulent, elles ne
décrivent probablement pas le même objet — un parcours, une série de films, un
format d'Église — et **aucune des deux ne doit être codée en dur dans Tandem**.
Le modèle de données de la version 1 avait déjà raison sur ce point : le nombre
de séances est une donnée saisie par l'Église qui lance son parcours, jamais une
constante du produit.

Ne sont pas vérifiés non plus : l'existence d'une API ou d'un flux de
métadonnées, la politique de liens profonds vers MyAlpha, les langues
disponibles, et l'attitude d'Alpha envers un outil tiers qui organiserait
l'accompagnement autour de son parcours. Ce sont exactement les points du
courriel plus bas.

---

## La décision : Niveau A, et rien d'autre pour l'instant

### D'abord, réconcilier deux découpages qui ne se recouvrent pas

La version 1 énumère trois niveaux (« compagnon », « intégration officielle »,
« post-Alpha ») **et** trois niveaux A/B/C (référencement, métadonnées, médias).
Ce sont deux axes différents présentés comme une seule échelle, et c'est ce qui
empêchait la décision d'être écrite : on peut être « compagnon » en A comme en
C, et le parcours « Après Alpha » ne relève d'aucun des trois puisqu'il ne
touche à aucun contenu Alpha.

Le découpage retenu, et le seul employé désormais :

| Axe | Valeurs | Ce que ça décide |
|---|---|---|
| **Niveau de licence** | A, B, C | ce que Tandem a le droit d'afficher d'Alpha |
| **Usage produit** | compagnon, après-parcours | ce que Tandem fait pour l'utilisateur |

Les trois « niveaux » de la version 1 sont donc requalifiés : « compagnon » et
« post-Alpha » sont des usages, « intégration officielle » n'est pas un niveau
mais la condition d'accès à B et à C.

### La décision

**Niveau A pour le MVP et jusqu'à accord écrit.** Tandem stocke le nom du
parcours saisi par l'Église, le nombre de séances qu'elle déclare, les dates de
sa cohorte, et des liens vers les ressources officielles. Rien d'autre d'Alpha
n'entre dans le produit — ni texte de session, ni titre repris d'un support, ni
visuel, ni vidéo, ni miniature.

**Niveau B est la demande du premier contact**, pas une hypothèse de travail.
Tant qu'aucune réponse n'est arrivée, aucune ligne de code ne le prépare.

**Niveau C est hors périmètre** jusqu'à licence signée, et le restera
probablement longtemps : héberger des médias protégés engage un hébergement, un
territoire, des langues, un retrait sur demande et une mesure d'audience à
négocier point par point.

Ce qui décide, c'est le critère d'acceptation de l'issue lui-même — « aucun
contenu Alpha intégré sans autorisation », et « issue technique séparée créée
uniquement après validation du partenariat ». Une conception qui anticiperait B
violerait le second sans même avoir violé le premier.

### Le champ qui rend la décision opposable

`external_programs.license_status`, déjà prévu par la version 1, est le point où
la décision cesse d'être une intention. Sa valeur par défaut doit être le refus,
et l'affichage de tout contenu fourni doit en dépendre. Trois valeurs suffisent :

- `reference_seule` — défaut, correspond au Niveau A ;
- `metadonnees_autorisees` — Niveau B, ne peut être posé que par un
  administrateur plateforme, jamais par une Église ;
- `medias_autorises` — Niveau C.

**Contrepartie assumée** : ce champ ne protège de rien si un responsable
d'Église recopie le texte d'une session Alpha dans un champ libre de Tandem.
Aucun schéma n'attrape un copier-coller. Ce qui l'attrape est une mention
écrite à l'endroit du geste — le champ « lien vers la ressource officielle »
doit dire, sous le champ, que Tandem ne reçoit pas de contenu de parcours — et
la modération, si un signalement remonte. C'est le même mode de défaillance que
celui nommé au doc 23 § « La fuite que rien de tout cela n'arrête » : la clause
de provenance qu'il réclame pour la charte éditoriale couvre ce cas-ci comme
elle couvre le sien.

### L'écart avec la roadmap, qui n'est pas tranché ici

L'issue #27 est jalonnée **M3 — Bêta publique**. Le doc 09 range le compagnon
Alpha, le partenariat officiel et le parcours « Après Alpha » en **Phase 5 —
Expansion**. Les deux ne peuvent pas être vrais. Le présent document ne réécrit
pas le doc 09 : l'écart est nommé, et l'arbitrage revient au responsable
produit. Un élément de contexte pour cet arbitrage : la seule tâche de l'issue
qui ait un délai imposé de l'extérieur est le premier contact, parce que sa
réponse peut prendre des mois et qu'elle conditionne tout le reste. Le contact
peut partir avant M3 sans que rien ne soit développé.

---

## Le mode compagnon Alpha

### Ce qu'il est

Une Église lance son parcours Alpha comme elle l'a toujours fait. Dans Tandem,
elle déclare une **cohorte** : un nom, une date de début, un nombre de séances,
et autant de liens officiels qu'elle veut. Tandem n'a rien à dire de ce qui se
passe dans la salle. Il s'occupe de ce qui se passe entre deux salles.

Le mode compagnon est donc, structurellement, **une grille de semaines vides que
l'Église remplit de pointeurs**. C'est ce qui le rend compatible avec le
Niveau A sans effort : il n'y a pas de contenu Alpha à ne pas copier, parce
qu'il n'y a pas de contenu du tout.

### Ce que Tandem apporte, semaine par semaine

Chaque séance de cohorte porte, côté Tandem, trois choses et pas davantage :

1. **un rappel** de la rencontre, à l'heure choisie par le participant ;
2. **une question personnelle facultative**, écrite par AgapePlay ou par
   l'Église, qui ne présuppose rien du contenu de la session — « qu'est-ce qui
   t'a surpris cette semaine ? », « y a-t-il une question que tu n'as pas posée
   à voix haute ? ». Une question qui ne présuppose rien est aussi une question
   qui ne risque pas de paraphraser Alpha ;
3. **un geste vers le binôme** : partager sa réponse, ou ne pas la partager.

Le journal reste privé par défaut. La présence à une session n'est pas exposée
au binôme : elle peut se déclarer, elle ne se publie pas. Un participant qui
saute trois semaines ne voit pas apparaître de série rompue.

### Ce que Tandem apporte qu'Alpha n'a pas, et c'est le cœur

**Un binôme qui dure après la dernière session.**

Alpha est excellent à ce qu'il fait, et ce qu'il fait a une fin. Le petit groupe
se disperse, l'animateur reprend son année, et la personne qui vient de dire
« je crois que quelque chose a changé » se retrouve, six semaines plus tard,
sans personne à qui le redire. C'est le trou que Tandem occupe, et il ne
concurrence rien : aucune Église ne cherche à retenir ses invités dans le
parcours, elles cherchent toutes à les garder après.

Concrètement, le binôme est **noué au début du parcours, pas à la fin**. C'est
le seul choix de conception qui compte dans tout ce document. Une relation
proposée le dernier soir est une relation qui ne commencera pas ; une relation
qui a déjà dix semaines d'échanges brefs derrière elle survit à la fin du
parcours sans qu'on ait rien à faire. La bascule vers l'après est alors un
non-événement : le binôme continue, le contenu change.

Deux conséquences à assumer :

- **le binôme n'est pas l'animateur du petit groupe.** Il l'est parfois, et
  c'est très bien, mais en faire la règle ferait porter à l'équipe Alpha une
  charge de suivi qu'elle n'a pas prévue, et transformerait Tandem en outil de
  supervision d'un parcours qui ne nous appartient pas ;
- **pour un participant de 16 ou 17 ans**, le binôme relève du cadre déjà écrit
  au doc 06 : proposé par l'Église, accepté explicitement par le jeune,
  signalable et blocable à tout moment. Une cohorte Alpha ne crée aucune
  exception à cette règle, et le parcours Alpha Jeunes non plus.

---

## Le parcours original « Après Alpha »

### Le nom, d'abord

« Après Alpha » utilise la marque Alpha dans un titre de produit. Tant qu'aucun
accord ne l'autorise, **le parcours ne peut pas porter ce nom publiquement**.
Il porte un nom qui lui appartient — « Et maintenant », « La suite », le choix
revient à l'éditorial — et sa fiche dit en clair à qui il s'adresse : « pensé
pour la suite d'un parcours de découverte, quel qu'il soit ». C'est vrai, c'est
utile au lecteur, et ça ne s'adosse à personne.

« Après Alpha » reste le nom **interne** du chantier, y compris dans ce document
et dans le doc 09.

### La forme

Six semaines, comme « Repartir avec Jésus » (doc 07), et pour la même raison :
c'est la durée qu'un binôme tient sans renégocier son engagement. Cinq séances
courtes et une discussion hebdomadaire.

| Semaine | Objectif | Ce que la semaine demande |
|---|---|---|
| 1 | Nommer ce qui a bougé | écrire ce qui a changé pendant le parcours, et ce qui n'a pas changé |
| 2 | Lire seul pour la première fois | un passage court, sans exposé pour l'expliquer |
| 3 | Prier avec ses propres mots | sortir des formules apprises, y compris les nôtres |
| 4 | Retenir une phrase | mémoriser un verset — voir le doc 24 |
| 5 | Rencontrer l'Église telle qu'elle est | assister à autre chose qu'un parcours, et en parler honnêtement |
| 6 | Choisir une prochaine étape | avec un responsable humain, pas avec l'application |

**Ce que ce parcours ne fait délibérément pas** : reprendre les thèmes d'Alpha
« en plus approfondi ». Ce serait à la fois un dérivé juridiquement discutable
et un mauvais produit — la personne vient de les entendre. La semaine 2 est le
pivot : le parcours de découverte donnait un exposé avant le texte, celui-ci
donne le texte sans exposé, et c'est précisément la compétence qui manque à
quelqu'un qui sort d'un parcours.

**La semaine 5 est celle qui échouera.** « Assister à autre chose » suppose
qu'il y ait autre chose, à une heure atteignable, où quelqu'un accueille la
personne. C'est une dépendance à l'Église locale que l'application ne peut pas
fournir et ne doit pas simuler. La séance doit prévoir son propre échec : si
rien n'est trouvé, la question devient « qu'est-ce qui t'a empêché d'y aller ? »
et la réponse remonte au responsable, pas au score du participant.

**La gouvernance doctrinale du doc 07 s'applique intégralement.** Ce parcours
sera lu par des personnes venues de traditions différentes selon l'Église qui a
lancé le parcours de découverte — la semaine 5, en particulier, ne peut pas
décrire « l'Église » comme si une seule forme existait.

---

## Conditions de marque et de partenariat à clarifier

Les points ci-dessous sont ceux sur lesquels une réponse d'Alpha change une
décision produit. Ils sont classés par ce qu'ils débloquent, pas par ordre
d'importance.

**Ce qui bloque le Niveau A** — c'est-à-dire ce que nous faisons déjà et qui
pourrait devoir cesser :

- une Église peut-elle déclarer son parcours Alpha dans un outil tiers, et cet
  outil peut-il l'écrire à l'écran (« votre parcours Alpha commence mardi ») ?
- les liens profonds vers les ressources officielles et vers MyAlpha sont-ils
  autorisés depuis une application tierce ?
- quelle attribution Alpha attend-elle, et sous quelle forme exacte ?
- quelles formulations sont interdites parce qu'elles laisseraient croire à un
  produit officiel ?

**Ce qui débloque le Niveau B :**

- existe-t-il un flux, une API ou un jeu de métadonnées communicable (titres de
  sessions, ordre, durée, langues) ?
- sous quelle licence, pour quels territoires et quelles langues ?
- avec quel délai de retrait si Alpha révoque ?

**Ce qui concerne l'après-parcours :**

- un parcours tiers peut-il se présenter comme destiné à la suite d'un parcours
  Alpha sans employer la marque dans son nom ?
- Alpha voit-elle un conflit avec ses propres ressources de suite ?

**Ce qui concerne les données** — et c'est le point que nous n'accepterons pas
de céder :

- Alpha demanderait-elle une remontée de données d'usage ? Si oui, laquelle ?

Position de Tandem, à annoncer plutôt qu'à négocier : **aucune donnée nominative
de participant ne sort du produit vers un partenaire**, quel qu'il soit. Ce qui
peut être partagé, si l'accord le prévoit, est agrégé au niveau d'une cohorte et
ne permet de reconstituer aucun parcours individuel. Le doc 06 range les
convictions religieuses parmi les données sensibles ; un partenariat de marque
ne rouvre pas ce dossier.

**Ce qui concerne les mineurs** : Tandem accueille des 16-17 ans avec un cadre
écrit (doc 06, doc 22). Alpha Jeunes accueille plus jeune. La question à poser
est celle de la frontière : que se passe-t-il si une Église inscrit une cohorte
Alpha Jeunes dans Tandem ? La réponse produit est déjà connue — l'âge minimum
de 16 ans ne bouge pas — mais elle doit être dite à Alpha plutôt que découverte
par une Église déçue.

---

## Premier contact — canal et brouillon

### Le canal

Le canal public retenu est l'adresse générale de Parcours Alpha,
**contact@parcoursalpha.fr**, relevée sur la page de contact du site officiel
le 25/08/2026, avec **contact.jeunes@parcoursalpha.fr** en copie puisque le
public 16-17 ans de Tandem relève de leur périmètre. Le site indique aussi une
adresse postale et un numéro de téléphone, et ne propose pas de formulaire en
ligne.

**Deux réserves à lire avant d'envoyer.** D'abord, la page liste également des
adresses nominatives par domaine ; elles ne sont pas reprises ici, parce qu'un
premier contact adressé à une personne nommée qui n'attend rien de nous se
traite moins bien qu'une demande arrivée par le canal prévu. Ensuite, une
adresse relevée sur un site public peut avoir changé : **vérifier la page de
contact le jour de l'envoi.**

Alpha International n'est pas contactée à ce stade. Le relais national est
l'interlocuteur naturel d'un éditeur français, et une demande adressée
simultanément aux deux niveaux se renvoie généralement d'elle-même.

### Brouillon

> **Objet** — Outil d'accompagnement entre les sessions : demande de cadre
>
> Bonjour,
>
> Je suis [prénom nom], de la société AGAPE PLAY, éditrice française
> d'applications et de jeux à destination des Églises. Nous préparons une
> application d'accompagnement en binôme, AgapePlay Tandem, et je vous écris
> avant d'avoir écrit la moindre ligne de code sur ce sujet, parce que ce que
> nous envisageons touche à votre parcours.
>
> Le besoin que nous observons est simple : une personne qui termine un parcours
> de découverte se retrouve souvent sans interlocuteur régulier quelques
> semaines plus tard. Notre application propose à un participant et à une
> personne de confiance de rester en lien par des échanges courts et réguliers,
> avec un journal privé par défaut et un cadre de sécurité écrit.
>
> Ce que nous voudrions permettre à une Église qui lance un parcours Alpha :
> déclarer ses dates, renvoyer vers vos ressources officielles par un lien, et
> proposer à ses invités de former un binôme dès le début du parcours — un
> binôme qui continue après la dernière session. Nous n'avons pas l'intention de
> reproduire, résumer, héberger ni remplacer quoi que ce soit de votre contenu :
> notre application est vide de matière Alpha par conception, et la déclaration
> du parcours est faite par l'Église elle-même.
>
> Trois questions, dans l'ordre où elles nous bloquent :
>
> 1. Une application tierce peut-elle mentionner qu'une Église lance un parcours
>    Alpha et renvoyer vers vos ressources officielles par un lien ? Sous quelle
>    forme d'attribution, et avec quelles formulations à éviter pour qu'aucune
>    confusion avec un produit officiel ne soit possible ?
> 2. Existe-t-il un cadre, un flux ou une licence permettant d'afficher des
>    métadonnées de sessions — titres, ordre, durées — sans héberger vos médias ?
> 3. Un parcours de six semaines, écrit par nous et destiné à la suite d'un
>    parcours de découverte, pose-t-il pour vous une difficulté ? Il ne
>    porterait pas la marque Alpha dans son nom.
>
> Un point de principe que nous préférons annoncer : aucune donnée nominative de
> participant ne sortirait de notre application vers un partenaire. Les échanges
> de ce type de parcours relèvent de la vie privée la plus sensible, et notre
> conception le traite ainsi.
>
> Si le sujet vous intéresse, je serais heureux d'en parler par téléphone ou de
> vous montrer l'application en l'état.
>
> Avec mes salutations respectueuses,
>
> [prénom nom]
> AGAPE PLAY — [téléphone] — [courriel]

**Ce que ce brouillon fait délibérément.** Il annonce que rien n'est développé,
ce qui retire toute pression et rend un « non » sans coût pour eux. Il pose la
question de marque avant la question technique, dans l'ordre où elle nous
bloque réellement. Il ne demande pas de partenariat : il demande un cadre. Et il
n'attend pas de réponse pour que le Niveau A continue.

**Ce qu'il ne dit pas, et qu'il faudra dire plus tard** : le modèle économique.
Une licence d'Église payante face à une organisation qui distribue son parcours
gratuitement est une conversation à avoir, mais pas dans un premier message où
elle n'aurait l'air que d'une intention commerciale.

---

## Ce qui attend une décision humaine

1. **Envoyer le courriel, ou pas, et par qui.** Le brouillon est prêt ; le
   canal est vérifié au 25/08/2026 mais doit être recontrôlé le jour de
   l'envoi. Le signataire doit être une personne de l'entreprise, pas une
   adresse générique.
2. **L'écart de jalonnement entre l'issue #27 (M3) et le doc 09 (Phase 5).**
   L'un des deux doit bouger. Personne d'autre que le responsable produit ne
   peut le trancher.
3. **Le nom public du parcours de suite.** « Après Alpha » est écarté ici pour
   raison de marque ; le nom de remplacement est un choix éditorial qui n'a pas
   été fait.
4. **La position sur une éventuelle demande de données d'Alpha.** Le document
   propose de refuser toute donnée nominative. C'est une position, pas encore
   une décision d'entreprise.
5. **Ce qu'on fait si Alpha ne répond pas.** Silence pendant trois mois : on
   reste en Niveau A indéfiniment, on relance, ou on abandonne l'axe Alpha au
   profit d'un compagnon générique « parcours de découverte » qui ne nomme
   personne ? Cette dernière option est réelle et n'a pas été évaluée.
6. **Le contrôle juridique.** Rien de ce document n'a été relu par un juriste.
   Le Niveau A tel que décrit paraît sans risque ; « paraît » n'est pas un avis.
7. **La relecture pastorale du parcours de suite.** La grille de six semaines
   est une esquisse de conception, pas un contenu validé. Le doc 07 impose une
   relecture biblique et théologique avant toute publication.

---

# État initial

*Ce qui suit est la version 1 du document, conservée sans modification. Là où
elle diverge de l'amendement ci-dessus — notamment sur les trois « niveaux »
1/2/3 et sur le nom « Après Alpha » — c'est l'amendement qui fait foi.*

## Conclusion

Oui, AgapePlay Tandem peut intégrer Alpha, mais il faut distinguer trois niveaux :

1. **compagnon Alpha** : Tandem organise la relation et le suivi autour d'un Alpha lancé par une église ;
2. **intégration officielle** : Alpha autorise l'utilisation de ses contenus, liens, médias ou interfaces dans Tandem ;
3. **parcours post-Alpha** : Tandem accompagne les participants après la fin d'Alpha.

La recommandation est de commencer par le niveau 1 et le niveau 3, puis de demander un partenariat officiel avant toute intégration de vidéos, guides ou contenus protégés.

## Ce que montre l'état de l'art Alpha

Alpha est conçu par et pour l'Église et met l'accent sur les fondamentaux de la foi, la conversation et le contexte local. La série Alpha Film est présentée comme un parcours de 11 semaines et 16 sessions, avec des ressources d'équipe et de formation accessibles via les espaces Alpha officiels. Les formats, langues et ressources peuvent évoluer : il faut toujours vérifier avec Alpha France ou Alpha International avant d'implémenter un connecteur.

Références officielles :

- [À propos d'Alpha](https://alpha.org/about/)
- [Alpha Film Series](https://gulf.alpha.org/blog/preview/alpha-film-series/)
- [Prévisualisation des thèmes Alpha](https://portugal.alpha.org/previews/)
- [Parcours Alpha France](https://parcoursalpha.fr/)
- [Ressources et inscription via MyAlpha](https://app.alpha.org/fr/)

## Ce que Tandem peut apporter

### Avant Alpha

- inviter un ami ;
- prier pour les invités ;
- préparer une conversation ;
- rejoindre une cohorte Alpha via un lien ou QR code ;
- expliquer les règles de confidentialité et de discussion.

### Entre les sessions

- rappel de la prochaine rencontre ;
- question personnelle facultative ;
- binôme d'accueil ;
- prière partagée ;
- défi relationnel ou pratique non doctrinal ;
- suivi de présence sans exposition de journal intime.

### Après Alpha

- parcours de six semaines `Après Alpha` ;
- mémorisation de passages bibliques ;
- découverte des pratiques spirituelles ;
- intégration à un petit groupe ;
- identification d'une prochaine étape avec un responsable ;
- activité AgapePlay ou soirée de discussion pour maintenir le lien.

## Niveaux d'intégration

### Niveau A — Référencement sans licence de contenu

Tandem stocke uniquement :

- le nom du parcours ;
- le nombre de séances ;
- les dates de cohorte ;
- les liens vers les ressources officielles ;
- les check-ins et échanges propres à Tandem.

Avantage : rapide, faible risque juridique et compatible avec les pratiques officielles.

### Niveau B — Import de métadonnées autorisées

Après accord, Tandem pourrait importer les titres, descriptions, références de séances et liens de ressources via un flux ou un contrat fourni par Alpha.

Avantage : meilleure expérience sans héberger les médias protégés.

### Niveau C — Intégration officielle des médias

Après partenariat et validation technique, Tandem pourrait proposer des vidéos, guides ou formations Alpha dans une interface intégrée.

Conditions à clarifier : licence, territoires, langues, hébergement, téléchargement offline, analytics, attribution, SSO, API, support et retrait des contenus.

## Décision recommandée pour le MVP

- ne pas copier les vidéos, scripts, guides ou visuels Alpha ;
- ne pas utiliser la marque Alpha comme si Tandem était un produit officiel ;
- proposer une fonctionnalité `Lancer un accompagnement Alpha` ;
- laisser l'église enregistrer son Alpha officiel et ses liens ;
- construire le binôme, les check-ins, la prière et le suivi dans Tandem ;
- développer un parcours original `Après Alpha` ;
- contacter Alpha France pour demander le cadre de partenariat.

## Modèle de données à prévoir

```text
external_programs
  id
  provider_name
  provider_program_id
  title
  official_url
  license_status
  locale

cohorts
  id
  community_id
  external_program_id
  starts_at
  ends_at

cohort_sessions
  id
  cohort_id
  ordinal
  scheduled_at
  official_resource_url
  tandem_prompt_id
```

`license_status` doit bloquer l'affichage de médias ou contenus tant qu'un accord explicite n'est pas enregistré.

## Différenciation créée

Tandem ne devient pas un concurrent d'Alpha. Il devient une couche d'accompagnement qui aide une église à transformer un parcours de découverte en relation durable et en prochaine étape concrète.
