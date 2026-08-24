-- Ce que dit un signalement, et à quelle vitesse il faut le lire.
--
-- Jusqu'ici la raison d'un signalement était un texte libre, et dans les faits
-- une phrase figée : les deux applications écrivaient « Signalement depuis la
-- conversation » dans `reason`, littéral non traduit. Un modérateur ouvrant la
-- file lisait donc huit fois la même phrase et n'apprenait rien — ni de quoi il
-- s'agit, ni ce qui ne peut pas attendre.
--
-- Cette migration ajoute deux colonnes, et une seule des deux vient de la
-- personne qui signale.
--
-- ---------------------------------------------------------------------------
-- 1. La catégorie : ce que la personne choisit
-- ---------------------------------------------------------------------------
--
-- Six valeurs proposées à l'écran, et une septième qui ne l'est pas (voir le
-- paragraphe 3). Elles nomment chacune **une** situation : un libellé qui en
-- coudrait trois — « secret, argent ou rendez-vous » — obligerait un adolescent
-- de seize ans à traduire sa situation dans le vocabulaire de la modération,
-- ce qui est exactement le sens inverse de celui qu'on veut.
--
--   malaise     des propos qui mettent mal à l'aise
--   insistance  on insiste après un refus
--   sexuel      des propos ou des images à caractère sexuel
--   secret      on demande de garder ça pour soi, de parler ailleurs
--   danger      quelqu'un est en danger — soi, ou l'autre
--   autre       autre chose (l'argent demandé y entre, faute d'être assez
--               fréquent pour mériter sa case ; le mot libre le dira)
--
-- Ce qui **n'est pas** une catégorie, et c'est une décision : « on me propose
-- de se voir en dehors de l'application ». Dans ce produit, le tandem est
-- proposé par une église et une rencontre en présence y est normale, parfois
-- attendue. En faire un motif de signalement apprendrait à signaler le cadre
-- lui-même. Ce qui alarme est la **discrétion** demandée autour, et c'est
-- `secret` qui la porte.
--
-- Les codes sont en français là où `status` est en anglais. L'incohérence est
-- assumée et vaut mieux que son contraire : ces sept valeurs sont des notions
-- de produit dont la traduction anglaise (`boundary`, `grooming`) est du jargon
-- de modération que personne ici ne relit de la même façon. Ce qui s'affiche
-- passe de toute façon par les catalogues fr/en — jamais par ces codes.

alter table public.tandem_reports
  add column if not exists category text;

-- ---------------------------------------------------------------------------
-- 2. L'urgence : ce que le produit en déduit, et que personne ne saisit
-- ---------------------------------------------------------------------------
--
-- La question posée était « qui pose le niveau d'urgence ». Pas l'adolescent :
-- lui demander de trier sa propre urgence lui fait porter deux charges au pire
-- moment — dire ce qui se passe, puis évaluer si c'est grave. Or c'est
-- précisément le jugement que quelqu'un sous emprise fait le plus mal, et le
-- sous-estimer est le mode d'échec dominant. Un dossier `sexuel` classé « pas
-- urgent » par la personne concernée serait la pire ligne de cette table.
--
-- Pas le modérateur non plus : l'urgence doit exister **avant** qu'un humain
-- ouvre la file, sans quoi elle ne sert à rien — c'est elle qui décide de
-- l'ordre dans lequel il ouvre.
--
-- Reste le produit, et alors la colonne ne doit pas pouvoir mentir. D'où une
-- colonne **générée** plutôt qu'une colonne écrite par le client : PostgreSQL
-- refuse toute valeur proposée, mesuré ici (PostgreSQL 17.6) :
--
--     insert into … (category, urgency) values ('malaise', 'standard');
--     ERROR:  cannot insert a non-DEFAULT value into column "urgency"
--     DETAIL:  Column "urgency" is a generated column.
--
-- Il n'y a donc rien à garder : ni grant à retirer, ni politique à écrire, ni
-- contrôle applicatif à ne pas oublier. Une application compromise ne peut pas
-- déclarer « standard » un signalement de danger.
--
-- Contrepartie, dite franchement : changer la dérivation demande une migration,
-- et recalcule l'urgence des lignes déjà écrites — y compris de dossiers clos.
-- C'est acceptable parce que la trace des décisions vit dans
-- `tandem_report_audit`, qui ne porte que des statuts, et qu'un dossier clos
-- n'est plus dans la file.
--
--   immediate  sexuel, danger   — sort de l'application (voir docs/22)
--   elevee     insistance, secret
--   standard   malaise, autre, non_precise
--
-- `secret` est en « élevée » et non en « standard » : demander à un mineur de
-- taire une relation est le signal le mieux documenté de l'installation d'une
-- emprise, et il précède les autres.

alter table public.tandem_reports
  add column if not exists urgency text
  generated always as (
    case category
      when 'sexuel' then 'immediate'
      when 'danger' then 'immediate'
      when 'insistance' then 'elevee'
      when 'secret' then 'elevee'
      else 'standard'
    end
  ) stored;

-- ---------------------------------------------------------------------------
-- 3. Les signalements déjà là
-- ---------------------------------------------------------------------------
--
-- Huit dossiers réels attendent une décision en production. Ils ont été posés
-- avant les catégories : personne n'a rien choisi pour eux.
--
-- Les ranger en `autre` serait une falsification douce — la table dirait que la
-- personne a choisi « autre chose », alors qu'on ne lui a jamais posé la
-- question. D'où `non_precise`, qui dit la seule chose vraie : cette ligne est
-- antérieure au choix. Ces huit dossiers gardent leur `reason` intact, restent
-- lisibles à l'écran sous un libellé qui leur est propre, et prennent l'urgence
-- « standard » — ni relégués au fond de la file, ni promus devant des dossiers
-- dont on sait, eux, ce qu'ils contiennent.
--
-- ⚠️ `non_precise` n'est proposé par aucun écran et ne doit jamais l'être : il
-- ne nomme pas une situation, il nomme une absence de question posée.

update public.tandem_reports set category = 'non_precise' where category is null;

-- `not null` seulement après le remplissage — l'ordre inverse échouerait sur
-- ces huit lignes.
alter table public.tandem_reports
  alter column category set not null;

alter table public.tandem_reports
  drop constraint if exists tandem_reports_category_check;
alter table public.tandem_reports
  add constraint tandem_reports_category_check
  check (category in ('malaise', 'insistance', 'sexuel', 'secret', 'danger', 'autre', 'non_precise'));

-- **Aucun `default` sur `category`, et c'est le point.** Une valeur par défaut
-- laisserait un client insérer sans choisir, et la colonne se remplirait toute
-- seule de la même valeur — on aurait remplacé un littéral figé par un autre.
-- L'absence de défaut fait échouer l'insert : le choix est obligatoire parce
-- que la base l'exige, pas parce qu'un écran y pense.

comment on column public.tandem_reports.category is
  'Ce que la personne qui signale a choisi. Sept valeurs, dont six seulement sont proposées : non_precise ne désigne pas une situation mais les signalements antérieurs à cette migration. Aucun défaut, délibérément — insérer sans choisir doit échouer.';

comment on column public.tandem_reports.urgency is
  'Déduite de category, jamais saisie : colonne générée, PostgreSQL refuse toute valeur proposée par un client. Décider soi-même de son urgence est la charge qu''on ne met pas sur un adolescent.';

-- ---------------------------------------------------------------------------
-- 4. Le mot libre, qui devient facultatif
-- ---------------------------------------------------------------------------
--
-- `reason` était `not null` et recevait le littéral. La catégorie prend sa
-- place ; le champ reste, en tant que **mot libre optionnel** — « tu peux
-- ajouter quelque chose, ce n'est pas obligatoire ». Le supprimer aurait
-- effacé les huit témoignages existants et retiré à la modération le seul
-- endroit où une situation se raconte avec ses propres mots.
--
-- La contrainte `check (char_length(reason) between 1 and 1000)` n'est pas
-- touchée, et il ne faut pas la toucher : sur `NULL`, `char_length` rend `NULL`,
-- le `between` rend `NULL`, et une contrainte `check` qui rend `NULL` **passe**.
-- Mesuré sur cette base plutôt que déduit. Elle continue en revanche de refuser
-- la chaîne vide, ce qui est le bon comportement — les deux applications
-- envoient `null` et non `''` quand la personne n'a rien écrit.

alter table public.tandem_reports
  alter column reason drop not null;

comment on column public.tandem_reports.reason is
  'Mot libre facultatif, écrit par la personne qui signale. NULL quand elle n''a rien ajouté ; la contrainte de longueur passe sur NULL et refuse toujours la chaîne vide. Un modérateur ne peut pas le réécrire : le grant d''écriture ne porte que sur status.';

-- ---------------------------------------------------------------------------
-- 5. Les droits : rien à faire, et pourquoi il faut quand même le lire
-- ---------------------------------------------------------------------------
--
-- `20260804000005` a accordé `select, insert` **au niveau table**, sans liste de
-- colonnes : les deux colonnes ajoutées ici sont donc lisibles et insérables par
-- `authenticated` sans un grant de plus. Vérifié après application plutôt que
-- supposé — le dépôt a déjà payé une table publique sans grant :
--
--     select privilege_type, column_name from information_schema.column_privileges
--      where table_name = 'tandem_reports' and grantee = 'authenticated'
--        and column_name in ('category', 'urgency');
--
-- En sens inverse, et c'est le vrai sujet : `20260806180000` a accordé
-- l'écriture par colonne, `grant update (status)`. Un modérateur ne peut donc
-- **pas** réécrire `category` — même refus, même message « permission denied for
-- table », que pour `reason`. C'est la même règle qu'alors : on ne réécrit pas
-- le témoignage de la personne qui a signalé. Un test le tient.
--
-- ⚠️ Corollaire pour l'application : la charge utile d'une décision de
-- modération ne nomme toujours que `status`. Y glisser `category` ou `urgency`
-- « pour rafraîchir » casserait toutes les décisions d'un coup.

-- ---------------------------------------------------------------------------
-- 6. L'ordre de la file, côté base
-- ---------------------------------------------------------------------------
--
-- L'ordre est tranché dans `packages/domain/src/moderation.ts` — c'est une règle
-- de produit, elle s'éprouve sans base. L'index, lui, existe pour que la lecture
-- de la file ne dégrade pas quand elle grandira.

create index if not exists tandem_reports_file_idx
  on public.tandem_reports (status, urgency, created_at desc);
