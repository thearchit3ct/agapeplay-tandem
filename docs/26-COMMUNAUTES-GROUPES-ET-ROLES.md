# Communautés, groupes, cohortes et rôles

*Issue #17. Écrit le 25 août 2026, en même temps que la migration
`20260825230000_communaute_et_cohortes.sql` et
`tests/rls/communaute.test.ts`.*

Ce document dit **ce qui a été décidé et pourquoi**. Le comment vit dans la
migration, qui est commentée ligne à ligne ; l'autorité sur les politiques est
la suite de tests, pas ce texte.

---

## Le point de départ

Six tables existaient depuis le 4 août — `churches`, `church_groups`,
`church_members`, `group_members`, `mentor_profiles`, `mentor_assignments` —
avec RLS, politiques SELECT prudentes et `grant select`. Mesuré avant ce
chantier : **aucune politique d'écriture, aucun `grant` d'écriture, aucun
écran**. Une église ne pouvait pas naître, un groupe pas se créer, un rôle pas
s'attribuer. Le schéma décrivait un produit que rien ne permettait de vivre.

L'issue demandait cinq choses : créer une communauté ; des groupes et des
cohortes avec dates ; les rôles responsable, mentor et participant ; une
invitation par lien ou QR code ; la clôture et une politique de rétention.

---

## Le principe qui gouverne tout le reste

> **Préparer est libre. Faire entrer quelqu'un ne l'est pas.**

C'est de là que découlent la création libre, l'activation manuelle, le sens de
`pending`, et le fait qu'une cohorte terminée soit une règle de droit et non
d'écran. Sur un produit qui met en relation des mineurs de 16-17 ans avec des
mentors adultes, ce qui coûte cher à défaire est ce qui attend.

---

## Décision 1 — qui crée, qui active

**La création est un geste de l'application.** La RPC `creer_ma_communaute(nom)`
crée l'église et son premier responsable d'un seul coup. Un responsable
d'église réelle doit pouvoir monter sa communauté un dimanche soir sans nous
appeler ; exiger un SQL sanctionné ferait de chaque pilote (issue #22) un
ticket, et d'AgapePlay un goulot.

**L'activation ne l'est pas.** `churches` ne reçoit aucune politique d'écriture
et aucun `grant` d'écriture : la colonne `status` est inatteignable depuis la
Data API, pour tout le monde, y compris le fondateur. Le motif est celui de
`tandem_moderators` (migration `20260806163000`) — l'absence de droit *est* la
protection. Activer, ou suspendre, se fait depuis l'éditeur SQL du tableau de
bord :

```sql
update public.churches set status = 'active'    where id = '<uuid>';
update public.churches set status = 'suspended' where id = '<uuid>';
```

⚠️ **Ne pas « réparer » cette table en lui accordant un `grant update`.**

Ce partage n'aurait aucun sens si `pending` ne retenait rien. Il retient
exactement les trois actes liants, et rien d'autre :

| Geste | `pending` | `active` | `suspended` |
|---|---|---|---|
| Créer un groupe ou une cohorte, poser ses dates, clôturer | oui | oui | oui |
| Émettre un lien d'invitation | **non** | oui | **non** |
| Rejoindre par un lien | **non** | oui | **non** |
| Affecter un mentor à un participant | **non** | oui | **non** |

Conséquence voulue : `suspended` n'est pas décoratif. Une église suspendue
cesse à l'instant d'inviter et d'affecter — les politiques relisent `status` à
chaque requête, sans migration ni redéploiement.

**Une nuance assumée** : `pending` et `suspended` ouvrent exactement les mêmes
droits, alors que l'un est une attente et l'autre une sanction. Une communauté
suspendue peut donc encore créer et clôturer des cohortes. C'est délibéré, et le
dommage est borné par la ligne du dessus — personne n'entre, aucun mentor n'est
affecté, une cohorte préparée pendant une suspension reste vide. Distinguer les
deux demanderait un second conjonct sur chaque politique d'organisation, pour
empêcher quelqu'un de ranger des dates dans un espace que plus personne ne peut
rejoindre. À reprendre le jour où une suspension réelle aura eu lieu et qu'on
saura ce qu'on veut qu'elle fasse.

---

## Décision 2 — les cohortes, et le bord de la fenêtre qui est un droit

Une cohorte est un **groupe qui a des dates** : `starts_on` et `ends_on` sur
`church_groups`, toutes deux nullables. Pas de table dédiée — elle aurait
dupliqué, pour deux colonnes, toute la mécanique d'appartenance, d'invitation
et de clôture, et il aurait fallu répondre deux fois à chaque question de droit.

La fenêtre a **deux bords, et un seul est un droit** :

- **`starts_on` est une règle d'écran.** S'inscrire en août à une cohorte qui
  commence en septembre est le geste normal du mois d'août. Une base qui le
  refuserait n'aurait rien protégé et aurait cassé l'usage.
- **`ends_on` est un droit.** La question n'est pas « qu'affiche l'écran ? »
  mais « qu'est-ce qu'une base qui accepte tout laisserait passer ? » : un lien
  collé dans un groupe de messagerie en février fait toujours entrer quelqu'un
  en décembre — dans une cohorte terminée, dont les mentors sont partis et que
  plus personne ne regarde. Aucun écran ne rattrape un lien qui circule.

Le vocabulaire est celui du chantier #49 ; ce qui est nouveau ici, c'est qu'une
même fenêtre puisse relever des deux niveaux selon le bord.

---

## Décision 3 — les rôles, et deux valeurs d'enum devenues inatteignables

- **`leader` (responsable)** crée les groupes et les cohortes, émet les liens,
  nomme les mentors, affecte, clôture, retire.
- **`mentor`** est affecté, et rien de plus **dans ce chantier**. Ce qu'un
  mentor lira de la personne qu'il accompagne est l'issue #16 ; le doc 06 le
  borne d'avance à « signaux minimaux si affecté ».
- **`member` (participant)** rejoint, appartient, part.
- **`admin` est inatteignable** — plus fort que muet. La RPC de création n'écrit
  que `leader`, celle de jointure que `member`, et le `with check` du
  responsable borne à trois valeurs. Aucun chemin du dépôt ne peut écrire
  `admin`, et un test l'épingle. La raison est l'ADR-007 : l'autorité de
  plateforme est `tandem_moderators`, parce qu'un incident grave impliquant un
  mineur ne doit pas être arbitré par la seule communauté où il s'est produit.
  Un `admin` d'église serait un troisième pouvoir sans mandat.

Même sort, même raison de l'écrire : **`church_members.status = 'invited'` est
inatteignable**. Une adhésion naît `active` — la RPC ne s'exécute qu'une fois le
jeton présenté et vérifié, il n'y a pas d'attente à représenter.

Deux bornes du pouvoir du responsable méritent d'être nommées :

- **il ne modifie pas sa propre ligne.** Se rétrograder ferait une église sans
  pilote, réparable seulement par SQL sanctionné. Le geste légitime existe :
  nommer un autre responsable, qui pourra retirer le premier ;
- **il n'accepte pas à la place du jeune.** Voir décision 5.

---

## Décision 4 — l'invitation par lien

Une invitation d'église **n'est pas** une invitation de tandem, et on n'a pas
détourné la seconde pour faire la première. `tandem_invitations` est
nominative : elle porte une adresse, s'adresse à une personne, s'accepte une
fois. Un lien de communauté se lit à voix haute un dimanche et se colle dans un
groupe de messagerie — il ne connaît personne d'avance.

D'où `church_invitations` : anonyme, multi-usage, plafonnée (`max_uses`,
50 par défaut, 500 au plus), périssable (30 jours par défaut, **90 au maximum
par contrainte `check`**), révocable.

**La révocation est définitive.** Le `with check` exige `status = 'revoked'` :
un lien repris ne se remet pas en service. La contrainte `check` de la table
l'autoriserait — c'est la politique qui ferme — parce qu'un lien révoqué a
continué de circuler pendant qu'il ne valait rien, et le remettre en vie
rouvrirait une porte à tous ceux qui l'ont recopié entre-temps. On en émet un
autre : le nouveau porte un jeton que personne n'a jamais eu.

Et surtout : **un lien ne confère que `member`.** Jamais `mentor`, jamais
`leader`. C'est la borne la plus importante du chantier. Un lien qui
fabriquerait des mentors fabriquerait des adultes référents de mineurs par
simple circulation d'URL, et rien ne rattrape une URL partie. Le doc 06 dit
« mentor proposé par l'église » : proposé par quelqu'un, nommément, parmi des
membres déjà entrés.

`rejoindre_une_communaute(token)` est en **`security definer`**, là où
`accept_tandem_invitation` est `security invoker`. Ce n'est pas un
relâchement, c'est la conséquence du reste : côté tandem, l'invitée peut lire
son invitation avant d'accepter (elle est reconnue à son adresse) ; côté
église, celui qui présente un jeton ne lit rien — ni l'invitation, ni l'église,
ni le groupe. La RPC est le seul endroit d'où l'on peut vérifier un jeton sans
avoir d'abord publié les jetons.

Elle est **idempotente** (doc 06 : « les actions sensibles sont idempotentes ») :
rejoindre deux fois n'use qu'une place — un compteur qui compterait les clics
au lieu des personnes épuiserait un lien avec une seule assemblée.

**Écart constaté : pas de QR code.** Le critère dit « lien **ou** QR », et le
lien est là. Un encodeur QR local — les dépendances externes et les services
tiers sont interdits — représente plusieurs centaines de lignes de manipulation
de bits et de correction Reed-Solomon, dans un dépôt dont la règle est que
chaque décision est épinglée par un test. Le rapport entre ce que cela coûte et
ce que cela ajoute à un lien qu'on peut déjà copier ne le justifie pas
aujourd'hui. À rouvrir si les pilotes le demandent.

---

### Le jeton doit franchir une connexion

Le cas majoritaire d'un lien d'église n'est pas quelqu'un de connecté : c'est
quelqu'un qui **n'a pas encore de compte**. Il ouvre le lien reçu dans un groupe
de messagerie, arrive sans session, se connecte — et `signInWithOAuth` comme le
lien magique quittent la page pour revenir sur `window.location.origin`, **nu**.
La query string a disparu, l'état React est reparti de zéro.

Le jeton est donc mis à l'abri dans le stockage local (`retenirJetonCommunaute`)
**avant** que l'URL ne soit nettoyée, relu quand une session apparaît, et oublié
dès qu'il a servi — ou dès qu'il a été refusé, ce qui est aussi terminal. Le
nettoyage de l'URL n'est pas cosmétique non plus : un jeton laissé dans la barre
d'adresse entre dans l'historique d'un appareil souvent partagé, à seize ans.

`clearState()` ne l'emporte pas : la suppression de compte efface ce qui
appartient à la personne, et un jeton d'invitation appartient à l'église qui l'a
émis. Il périme tout seul, en base, au plus tard à 90 jours.

---

## Décision 5 — le responsable propose, le jeune accepte

Le doc 06 : « pour les 16-17 ans, mentor proposé par l'église **et accepté par
le jeune** ». C'était une phrase de documentation ; elle est désormais opposable.

`mentor_assignments.status` prend `pending` par défaut (la valeur par défaut
change dans cette migration) et `status` n'est pas dans le `grant insert` :
aucun chemin ne permet de créer une affectation déjà active. Ensuite :

| Qui | Peut écrire |
|---|---|
| Participant | `active` (accepter), `ended` (refuser, ou partir) |
| Mentor | `ended` |
| Responsable | `paused`, `ended` |

**Seul le participant peut écrire `active`.** Un responsable qui serait aussi le
mentor cumule ses deux jeux de transitions — et n'obtient toujours pas `active`.

---

## Décision 6 — la membrane église ↔ tandem : aucune colonne

Un tandem n'appartient à aucune église, et ce chantier ne l'y relie pas.

Ajouter `church_id` sur `tandems` aurait fabriqué exactement la jointure que la
matrice du doc 06 refuse : « responsable — progression de séance : non,
statistique agrégée uniquement ». Une colonne ne lit rien par elle-même, mais
elle rend le prédicat écrivable, et l'issue #16 aurait trouvé la porte ouverte
au lieu d'une décision à prendre.

La relation supervisée que le doc 06 décrit est déjà portée par
`mentor_assignments`, qui **nomme la paire sans toucher à la conversation**.
C'est la membrane, et elle suffit.

**Écart nommé, à l'attention de #16** : rien ne relie aujourd'hui une
affectation au tandem qui en naît éventuellement. Les deux objets coexistent
sans se connaître. C'est le prix de la borne, et il est délibéré.

---

## Décision 7 — la liste des membres passe par une fonction, pas par une politique

`church_members_leader_read` rend au responsable une liste d'**uuid** :
`profiles` est own-only depuis le 4 août. Un écran de gestion qui affiche seize
identifiants hexadécimaux n'est pas un écran de gestion, et le doc 06 accorde au
responsable le « profil public minimal — oui si groupe ».

Deux façons de le donner :

- une **politique SELECT sur `profiles`** pour les responsables. Refusée :
  `profiles` porte les dates de consentement, l'état du compte, la demande de
  suppression, et une politique y ouvre *toutes* les colonnes — aujourd'hui, et
  à chaque colonne ajoutée plus tard. Personne ne se souviendrait, en ajoutant
  un champ, qu'un responsable d'église le lira ;
- une **fonction** qui énumère les cinq colonnes utiles. Retenue.
  `tandem_membres_de_ma_communaute()`, sans paramètre, sur le motif de
  `tandem_partenaire()`.

---

## Clôture et rétention

Clôturer une cohorte est un `update … set status = 'closed'`, et ce que cela
produit tient entièrement dans des règles de droit :

- **plus personne n'entre** — la politique d'insertion exige `active`, la RPC
  lève `cohorte_close`, et l'émission d'un lien vers elle est refusée ;
- **plus aucun mentor n'y est affecté** ;
- **les liens déjà émis vers elle cessent de valoir**, sans qu'il faille les
  révoquer un par un. C'est ce qui justifie que la clôture soit un droit : un
  lien est une chose qui a quitté nos mains.

Ce que la clôture **ne fait pas**, délibérément : elle n'efface ni les
appartenances, ni les affectations. Une cohorte close reste lisible par ceux qui
l'ont vécue. Effacer les membres à la clôture reviendrait à retirer à quelqu'un
la trace d'un parcours qu'il a fait ; le geste qui efface une trace de ce genre
appartient à la personne, et il existe déjà.

### La politique de rétention, écrite pour pouvoir être citée

1. Les données de communauté d'une personne — adhésion, appartenances aux
   groupes, affectations, liens qu'elle a émis — vivent tant que son compte vit
   et **partent avec lui**. `supprimer_mon_compte()` les efface ; les tests le
   mesurent au lieu de le supposer.
2. Une cohorte close est conservée telle quelle, indéfiniment, tant que les
   comptes qui la composent existent.
3. **Aucune purge automatique n'est promise**, et il ne faut pas en supposer
   une. Ce dépôt n'a aucun `pg_cron`, aucune tâche planifiée, aucun
   ordonnanceur. Promettre une durée qu'aucun mécanisme ne tient serait pire que
   de n'en promettre aucune.

**Dette nommée et bornée (héritée de la PR #44).** Le doc 06 promet une
« conservation limitée et documentée des messages signalés ». Elle n'est
toujours pas tenue, et la clôture des cohortes en hérite : rien n'expire de
lui-même ici non plus. La solder demande trois choses, dans cet ordre — décider
des durées (produit et juridique), monter un ordonnanceur (`pg_cron` + une
fonction de purge, décision d'infra), puis écrire la purge et ses tests. Aucune
des trois n'appartient à ce chantier ; toutes trois sont à faire avant qu'une
église réelle confie des mineurs au produit.

---

## Ce que ce chantier n'ouvre pas

Aucune politique n'est ajoutée sur `journal_entries`, `tandem_messages`,
`weekly_checkins`, `session_progress` ni `journal_shares`. Un responsable ou un
mentor ne lit **rien** du contenu spirituel de qui que ce soit. Un test le
garde explicitement, avec son témoin positif — pour qu'une branche ajoutée un
jour rougisse au lieu de passer.

**Aucun événement de mesure n'est émis.** Le catalogue du doc 08 est fermé par
une contrainte `check` (PR #48) et ses dix noms parlent tous du binôme ou du
parcours. Détourner `partner_invited` pour compter une entrée en communauté
fausserait le funnel qu'il sert ; inventer un nom serait refusé par la base, et
à raison. Mesurer la vie des communautés demande d'abord d'amender le doc 08 —
décision éditoriale, pas effet de bord d'une migration.

---

## Écarts connus et assumés

- **Pas de QR code.** Voir décision 4.
- **Le mobile ne connaît rien de tout ceci.** Ce chantier est web-first : les
  responsables organisent depuis un navigateur, souvent sur un ordinateur, et
  les gestes en jeu (dates, listes, liens à copier) sont des gestes d'écran
  large. Rien dans le domaine partagé (`packages/domain/src/communaute.ts`) n'est
  spécifique au web, si bien qu'un écran mobile n'aurait qu'à être écrit.
- **Une seule appartenance active à la fois.** La RPC refuse une seconde
  communauté. Ce n'est pas une limite technique : la relation qu'organise ce
  produit est un rattachement supervisé à *une* communauté, l'écran en montre
  une, `App.tsx` en lit une. La borne est additive — la lever plus tard ne casse
  rien, l'inverse ne serait pas vrai.
- **Un fondateur unique qui s'en va laisse une église sans responsable.**
  `supprimer_mon_compte()` efface ses appartenances ; plus personne ne porte le
  rôle `leader`, et aucune politique ne peut plus rien écrire dans cette
  communauté. Réparable par SQL sanctionné — un `update` qui nomme un nouveau
  responsable, exactement comme l'activation — et cohérent avec la décision 1 :
  la vie institutionnelle d'une communauté n'est pas dans l'application.
- **L'écran ne montre aucune statistique agrégée.** La carte « statistiques
  anonymisées » que portait l'ancien instantané a disparu avec lui : elle
  annonçait des chiffres qu'aucune table ne calcule. Mieux vaut une absence
  qu'une promesse vide.

---

## Le piège qu'il ne faut pas redécouvrir

**Une politique qui lit une table dont la politique lit la première : la base
lève.**

Mesuré à la première exécution des tests, sur le geste le plus banal du
chantier — `insert into church_groups … returning` :

```
error: infinite recursion detected in policy for relation "church_groups"
```

Le cycle : `groups_member_read` (sur `church_groups`) interrogeait
`group_members`, dont la politique de lecture du responsable interrogeait
`church_groups`. Il ne se voit pas à la lecture d'une politique seule.

La sortie est celle du dépôt : aucune politique de `group_members` ne lit
`church_groups` en clair ; trois fonctions `security definer`
(`tandem_role_eglise_du_groupe`, `tandem_cohorte_ouverte`,
`tandem_membre_actif_du_groupe`) portent la traversée hors RLS.

Et le corollaire, déjà connu mais qui coûte cher ici : **la lecture est un
prérequis de l'écriture**. Sans `groups_church_member_read`, le responsable ne
lit pas le groupe qu'il vient de créer ; `insert … returning` rend un corps
vide, « toute écriture lit sa réponse » rapporte un échec sur un succès, et
l'UPDATE de clôture ne trouve aucune ligne **sans rien lever**.

---

## Comment c'est prouvé

`tests/rls/communaute.test.ts` — 35 tests, chacun avec son témoin positif dans
le même décor : deux églises complètes (pour l'étanchéité), une troisième restée
`pending`, trois cohortes aux trois états, cinq liens.

Huit conjoncts centraux ont été **cassés sur la base vivante** pour vérifier
qu'un test rougit :

| Mutation | Tests rouges |
|---|---|
| N'importe quel membre crée un groupe | 1 |
| Lecture des membres ouverte à tous | 1 |
| Le responsable peut modifier sa propre ligne | 1 |
| Le rôle `admin` redevient écrivable | 1 |
| Le responsable peut accepter à la place du jeune | 2 |
| Une église `pending` peut inviter | 2 |
| La lecture du groupe par son créateur disparaît | 5 |
| La RPC ne regarde plus la fenêtre de la cohorte | 7 |

Un conjonct qui ne fait rougir personne est un conjonct que rien ne tient.
