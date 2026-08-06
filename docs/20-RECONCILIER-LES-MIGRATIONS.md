# Réconcilier les migrations avec le projet distant

*À faire une seule fois, après le renommage des sept migrations d'origine.*

## Pourquoi

Les sept premières migrations portaient un préfixe à **huit** chiffres
(`20260804_000001_…`). Le CLI Supabase n'en lit que **quatorze** : il tronquait
la version à `20260804`, prenait les sept fichiers pour une seule et même
migration, et cassait sur collision de clé primaire au deuxième. Mesuré : la
base locale s'arrêtait à **3 tables sur 18** — assez pour qu'un test de sécurité
passe au vert sur des tables absentes.

Elles sont désormais nommées `20260804000001_…` à `20260804000007_…`, sans
qu'une ligne de leur contenu ait changé. Le dépôt sait de nouveau reconstruire
la base : c'est ce qui rend possibles les tests, un environnement de recette, et
tout futur déploiement propre.

**Mais le projet distant garde en mémoire les anciennes versions.** Tant que
cette réconciliation n'est pas faite, `supabase db push` croira que les sept
migrations n'ont jamais été appliquées et tentera de les rejouer — sur une base
où leurs tables existent déjà.

## Ce que la réconciliation fait, et ne fait pas

`supabase migration repair` **écrit uniquement dans la table
`supabase_migrations.schema_migrations`**, qui est le journal de ce qui a été
appliqué. Il ne rejoue aucun SQL, ne crée ni ne supprime aucune table. C'est une
mise à jour de comptabilité, pas une modification du schéma.

## La marche à suivre

### 1. Se lier au projet et regarder l'écart

```bash
supabase link --project-ref <ref-du-projet>
supabase migration list
```

Trois colonnes : `Local`, `Remote`, `Time`. Attendez-vous à voir les sept
nouvelles versions en local seulement, et une ou plusieurs versions anciennes en
distant seulement.

**Ne passez pas à l'étape suivante sans avoir lu cette sortie.** Elle est la
seule source de vérité sur ce que le distant croit avoir appliqué — ce document
ne peut pas le deviner.

### 2. Retirer du journal les versions qui n'existent plus

Pour chaque version présente en `Remote` mais absente en `Local` :

```bash
supabase migration repair --status reverted <version-ancienne>
```

### 3. Déclarer appliquées les sept versions renommées

Leur schéma est **déjà en place** sur le distant — seul leur nom a changé. On le
dit au journal, sans rien rejouer :

```bash
supabase migration repair --status applied 20260804000001
supabase migration repair --status applied 20260804000002
supabase migration repair --status applied 20260804000003
supabase migration repair --status applied 20260804000004
supabase migration repair --status applied 20260804000005
supabase migration repair --status applied 20260804000006
supabase migration repair --status applied 20260804000007
```

### 4. Vérifier avant d'aller plus loin

```bash
supabase migration list
```

Les sept doivent apparaître des deux côtés. Les deux suivantes —
`20260806012728_blocage_effectif` et `20260806150000_appariement_possible` —
doivent apparaître en local seulement : elles n'ont jamais été appliquées.

### 5. Appliquer les deux migrations en attente

```bash
supabase db push
```

⚠️ **`blocage_effectif` lève un avertissement** s'il trouve des tandems déjà
bloqués : leur colonne `blocked_by` vaut NULL, ils sont gelés, et le dégel est
un geste humain décrit dans l'en-tête de cette migration. Lisez la sortie plutôt
que de la faire défiler.

⚠️ **Ordre avec le web** : `blocage_effectif` doit être appliquée **avant** de
déployer le site, parce que le bouton « Bloquer » renseigne désormais
`blocked_by` et que la politique l'exige. L'inverse casse le blocage.

## Ce qui empêche la rechute

`tests/migrations.test.ts` refuse tout préfixe qui ne fait pas quatorze
chiffres, toute version en double, et tout désordre entre l'ordre des noms et
celui des versions. Il tourne dans `npm test`, sans base ni Docker, en une
demi-seconde.
