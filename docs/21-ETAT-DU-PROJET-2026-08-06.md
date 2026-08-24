# État du projet — 6 août 2026

*Ce document remplace [`19-ETAT-COMPLET-DU-PROJET-2026-08-05.md`](./19-ETAT-COMPLET-DU-PROJET-2026-08-05.md),
qui décrit un état antérieur à la campagne de sécurité du 6 août. Les deux
peuvent être lus ensemble : le 19 dit ce que le produit veut être, celui-ci dit
où il en est réellement.*

Dépôt `thearchit3ct/agapeplay-tandem`, branche `main`.

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
npm test          # 50 tests, aucune base requise, ~1 s
npm run test:rls  # 107 tests sur une vraie base Postgres locale, ~90 s
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

### 3. Aucune interface de modération

La base est prête et éprouvée. Mais **nommer un modérateur et lire les
signalements se font à la main dans l'éditeur SQL**. C'est le chantier le plus
rentable maintenant que le socle existe.

Rappel de conception à ne pas défaire : `tandem_moderators` n'a **ni grant ni
politique**, volontairement. Un `grant select` publierait la liste des
modérateurs à tout compte authentifié. La table se consulte par
`tandem_est_moderateur()`, sans paramètre — avec un paramètre, elle deviendrait
un énumérateur.

### 4. Aucun écran pour les invitations en attente

On peut inviter. Une invitation en attente ne se voit ni ne se révoque depuis
l'application.

### 5. Le mobile n'a jamais tourné sur un appareil

Il compile, Metro le résout, les écrans existent — personne ne les a vus
s'afficher. Il ne lit par ailleurs que **deux** tables (`tandems`,
`session_progress`) contre onze côté web : son retard est réel, pas cosmétique.

`npm run mobile:export` est la seule commande qui exerce vraiment Metro et
prouve la résolution des workspaces. `mobile:typecheck` ne prouve rien là-dessus.

### 6. Dette, réelle mais pas urgente

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
| Une invitation antérieure à un blocage reste visible du bloqueur | La politique concernée gouverne aussi le `select … for update` de la RPC d'acceptation ; la resserrer casserait des acceptations légitimes de façon peu visible. À traiter par péremption ou côté interface. |
| Sur une paire bloquée, l'inviteur ne peut plus révoquer son invitation | Elle reste `pending` jusqu'à péremption. Le chemin de retour sanctionné est de lever le blocage. |
| La lecture d'un dossier de modération ne laisse aucune trace | Seules les décisions en laissent. Tracer les consultations est une décision séparée. |
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
- **Dans une fonction `security definer`, `current_user` désigne le
  propriétaire**, pas l'appelant. Une garde fondée dessus est morte ;
  `auth.uid()` est le bon signal.
- Une politique qui interroge sa propre table produit une **récursion infinie**.

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
