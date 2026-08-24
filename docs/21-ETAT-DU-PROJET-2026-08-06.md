# État du projet — 6 août 2026

*Ce document remplace [`19-ETAT-COMPLET-DU-PROJET-2026-08-05.md`](./19-ETAT-COMPLET-DU-PROJET-2026-08-05.md),
qui décrit un état antérieur à la campagne de sécurité du 6 août. Les deux
peuvent être lus ensemble : le 19 dit ce que le produit veut être, celui-ci dit
où il en est réellement.*

Dépôt `thearchit3ct/agapeplay-tandem`, branche `main`.

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
rien n'interdit à un même compte d'avoir deux tandems `active` simultanés, et
`App.tsx` en prend un seul (`.order(...).limit(1)`). Le partage hérite de cette
hypothèse — l'écran dit « ton binôme » au singulier. La base, elle, la tient
sans ambiguïté, chaque ligne de partage nommant son tandem.

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
