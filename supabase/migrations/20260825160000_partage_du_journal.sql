-- Le partage explicite d'une entrée de journal — issue #11, trois critères
-- restants : partager, retirer, supprimer.
--
-- L'état de départ : `journal_entries` est own-only de bout en bout depuis la
-- migration `…_000001`, et `tests/rls/journal-prive.test.ts` en fait la preuve —
-- « le mentor n'a aucune porte, non pas parce qu'on la lui ferme, mais parce
-- qu'on ne lui en a jamais ouvert ». La base sait déjà effacer une entrée
-- (`journal_delete_own`) ; c'est l'écran qui n'avait pas le geste. Ce qui
-- manque vraiment ici, c'est le partage : la matrice du doc 06 range le journal
-- privé en « binôme : non **par défaut** », et ce « par défaut » n'avait aucun
-- chemin pour être levé.
--
-- ---------------------------------------------------------------------------
-- Le destinataire, et pourquoi il n'est pas nommé
-- ---------------------------------------------------------------------------
--
-- Le partage vise **le binôme du tandem, et lui seul**. La même matrice dit
-- « mentor : non » et « responsable : non » sans nuance : il ne s'agit donc pas
-- d'un partage à qui l'on veut dont le binôme serait le premier cas, mais d'un
-- unique chemin, et le schéma doit le dire plutôt que le promettre.
--
-- D'où la colonne `tandem_id` **à la place** d'un `shared_with uuid`. Trois
-- conséquences, toutes voulues :
--
--   - il n'existe aucune valeur de cette colonne qui désigne un mentor. Un
--     `shared_with` aurait accepté n'importe quel identifiant et se serait
--     reposé sur une garde à ne jamais relâcher ; ici il n'y a rien à
--     relâcher, c'est la forme de la table qui refuse ;
--   - le partage est adossé à la relation, pas à une personne flottante : il
--     hérite du statut du tandem, et la question « que devient le partage quand
--     la relation se ferme ? » devient exprimable en SQL (voir plus bas) ;
--   - la clé primaire `(entry_id, tandem_id)` interdit le doublon : partager
--     deux fois la même entrée au même binôme n'est pas un second partage.
--
-- Le partage porte sur **une entrée**, jamais sur le journal. Geste par entrée,
-- retrait par entrée. C'est la raison d'être de `entry_id` en clé, et c'est ce
-- qui rend le retrait aussi granulaire que l'octroi.
--
-- ---------------------------------------------------------------------------
-- Comment le destinataire lit — et pourquoi ce n'est PAS une politique
-- ---------------------------------------------------------------------------
--
-- La forme qui vient d'abord à l'esprit est une seconde politique SELECT sur
-- `journal_entries` : « ou bien il existe un partage vers un tandem dont je
-- suis membre ». On ne la prend pas, pour trois raisons qui se cumulent.
--
--   1. Cette politique consulterait `journal_shares` **sous les droits de
--      l'appelant et sous la RLS de `journal_shares`** — le piège déjà consigné
--      dans `20260824100000`. Il faudrait donc de toute façon une fonction
--      `security definer` pour la porter : autant que la fonction *soit* le
--      chemin, au lieu d'être la béquille d'un chemin.
--   2. La garde la plus permissive fixe le niveau. Les politiques sont
--      permissives et s'additionnent : ajouter une seconde politique SELECT sur
--      `journal_entries` rendrait la phrase « aucune politique n'ouvre cette
--      table à autrui » définitivement fausse, et toute lecture future du
--      fichier devrait recomposer mentalement l'union des deux. Sur la table la
--      plus intime du produit, ce coût-là est le mauvais.
--   3. Une politique SELECT s'applique aussi aux UPDATE et DELETE dès qu'ils
--      lisent. Élargir la lecture de `journal_entries`, c'est élargir la
--      surface de tout ce qui la lit, y compris ce qui n'est pas encore écrit.
--
-- Donc : **`journal_entries` garde ses quatre politiques own-only, inchangées**,
-- et le destinataire lit par `journal_partage_avec_moi()` — `security definer`,
-- `search_path` figé, identité par `auth.uid()` (dans une fonction
-- `security definer`, `current_user` désigne le propriétaire : une garde fondée
-- dessus serait morte), et **sans paramètre**, comme `tandem_partenaire()` et
-- `supprimer_mon_compte()` avant elle. Sans paramètre, elle ne sait répondre
-- que sur les partages qui visent l'appelant ; avec un `p_tandem_id` ou un
-- `p_user_id`, elle deviendrait une sonde à essayer sur les identifiants
-- d'autrui.
--
-- ---------------------------------------------------------------------------
-- Le partage meurt avec la relation — et c'est l'inverse des messages
-- ---------------------------------------------------------------------------
--
-- La fonction de lecture exige `t.status in ('active', 'paused')`. Un tandem
-- bloqué ou terminé referme donc les partages, **pour les deux personnes, y
-- compris celle qui a bloqué**.
--
-- C'est délibérément le contraire de `messages_select_member`, refait par
-- `20260806012728`, qui garde l'historique lisible à qui a posé le blocage —
-- « qui bloque a souvent besoin de l'historique pour signaler ». Les deux
-- règles ne se contredisent pas, elles portent sur deux choses différentes :
--
--   - la conversation est un objet commun, écrit à deux ; en retirer la lecture
--     à la personne qui vient de se protéger la punirait de son geste ;
--   - une entrée de journal reste, elle, la propriété entière de son auteur.
--     Le partage n'est pas un don définitif, c'est une fenêtre ouverte dans une
--     relation vivante. Quand la relation cesse d'être vivante, la fenêtre se
--     ferme — et le sens du blocage, sur un produit qui met en relation des
--     mineurs de 16-17 ans, est précisément « je ne veux plus rien donner à
--     lire à cette personne ».
--
-- On **n'efface pas** les lignes de partage au blocage. Le blocage se lève ; un
-- effacement, non. Détruire les choix de l'auteur sur un changement de statut
-- réversible lui ferait perdre en silence ce qu'il avait décidé. La ligne
-- survit, la lecture se referme, et l'écran le dit avec des mots
-- (`packages/domain/src/partage.ts` décide lesquels).
--
-- Ce que le retrait ne peut pas faire, et que l'écran dit à l'auteur : ce que
-- le binôme a déjà lu, il l'a lu. Retirer un partage ferme la suite, ça ne
-- rembobine pas. On ne garde donc aucune pierre tombale d'un partage retiré :
-- une ligne « entrée retirée » apprendrait au destinataire qu'il y avait
-- quelque chose et qu'on le lui a repris — plus d'information que l'auteur n'a
-- choisi d'en donner. Le retrait est une vraie suppression de ligne.
--
-- ---------------------------------------------------------------------------
-- Et à la suppression de compte
-- ---------------------------------------------------------------------------
--
-- `supprimer_mon_compte()` (migration `20260825090000`) fait
-- `delete from public.journal_entries where user_id = v_uid`. La clé étrangère
-- `entry_id → journal_entries on delete cascade` emporte donc **tous les
-- partages émis** par la personne, sans qu'il faille ajouter une ligne à cette
-- fonction : un journal est à la personne, il part, et les fenêtres qu'il avait
-- ouvertes partent avec lui. `tests/rls/partage-journal.test.ts` le prouve au
-- lieu de le supposer — la cascade est un mécanisme, pas une intention, et une
-- clé étrangère qu'on rendrait un jour `on delete set null` casserait cette
-- promesse en silence.
--
-- Les partages **reçus**, eux, restent : ce sont les entrées d'une autre
-- personne, et la décision de les avoir partagées est la sienne. C'est
-- exactement la ligne écrite dans `20260825090000` — « on efface la personne,
-- on garde la relation et la trace ». Aucune fuite n'en découle : la même
-- fonction passe le tandem à `ended`, ce qui referme la lecture par la clause
-- de statut ci-dessus. Sauf s'il était bloqué — auquel cas il reste `blocked`,
-- et la lecture est fermée aussi. Les deux chemins mènent au même endroit.
--
-- Aucun orphelin non plus : les deux clés étrangères de `journal_shares` sont
-- `on delete cascade`, et aucune ligne ne peut survivre à l'entrée ou au tandem
-- qu'elle nomme.

-- ---------------------------------------------------------------------------
-- La table
-- ---------------------------------------------------------------------------

create table if not exists public.journal_shares (
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  tandem_id uuid not null references public.tandems(id) on delete cascade,
  -- Redondante avec `journal_entries.user_id` — et c'est le but. Elle porte la
  -- politique de lecture et de retrait de l'auteur sans faire consulter
  -- `journal_entries` depuis une politique de `journal_shares`, c'est-à-dire
  -- sans rejouer la lecture croisée qu'on évite partout ailleurs. Le `with
  -- check` d'insertion garantit qu'elle vaut bien l'auteur de l'entrée.
  shared_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (entry_id, tandem_id)
);

comment on table public.journal_shares is
  'Partages explicites d''entrées de journal. Une ligne = une entrée ouverte à un tandem, révocable en la supprimant. Le destinataire est le tandem, jamais une personne nommée : aucune valeur de tandem_id ne peut désigner un mentor. La lecture par le destinataire passe uniquement par journal_partage_avec_moi() ; journal_entries reste own-only.';

comment on column public.journal_shares.tandem_id is
  'Le tandem à qui l''entrée est ouverte. Le partage hérite du statut de la relation : bloqué ou terminé, il ne s''ouvre plus — la ligne, elle, survit, parce qu''un blocage se lève.';

comment on column public.journal_shares.shared_by is
  'L''auteur de l''entrée, seul à voir et à retirer ses partages. Vérifié à l''insertion contre journal_entries.user_id.';

-- La lecture du destinataire part du tandem ; celle de l'auteur, de lui-même.
-- La clé primaire couvre déjà `entry_id`.
create index if not exists journal_shares_tandem_idx
  on public.journal_shares (tandem_id, created_at desc);

create index if not exists journal_shares_author_idx
  on public.journal_shares (shared_by, created_at desc);

alter table public.journal_shares enable row level security;

-- ---------------------------------------------------------------------------
-- Qui voit, qui pose, qui retire
-- ---------------------------------------------------------------------------
--
-- Trois politiques, aucune pour le destinataire : il ne lit pas cette table.
-- Elle ne lui apprendrait rien qu'il ne voie déjà par la fonction, et un SELECT
-- ouvert au tandem exposerait les `entry_id` de partages refermés par un
-- blocage — la liste de ce qu'on lui a repris.
--
-- Pas de `grant update` non plus : un partage n'a rien de modifiable. Il existe
-- ou il n'existe pas.

drop policy if exists "journal_shares_select_author" on public.journal_shares;
create policy "journal_shares_select_author"
  on public.journal_shares for select
  to authenticated
  using ((select auth.uid()) = shared_by);

-- Les trois conjoncts disent trois choses distinctes, et aucun n'est
-- redondant :
--   - `shared_by = auth.uid()` : on ne partage pas au nom d'un autre ;
--   - l'entrée doit être la sienne. La clé étrangère ne dit rien de la
--     propriété : sans ce `exists`, n'importe quel `entry_id` deviné passerait,
--     et un identifiant d'entrée circule (il est dans l'export de son auteur) ;
--   - le tandem doit être le sien et vivant. `status in ('active', 'paused')`
--     est la même porte que `messages_insert_member` : on n'ouvre pas une
--     fenêtre sur une relation qu'on a bloquée ou terminée.
--
-- Ces deux `exists` consultent des tables que l'appelant a **le droit de lire**
-- (`journal_select_own`, `tandems_select_member`) : le piège de la lecture
-- croisée ne s'applique pas ici, et la RLS de ces tables renforce le prédicat
-- au lieu de le trahir — une ligne invisible rend le `exists` faux, donc ferme.
drop policy if exists "journal_shares_insert_author" on public.journal_shares;
create policy "journal_shares_insert_author"
  on public.journal_shares for insert
  to authenticated
  with check (
    (select auth.uid()) = shared_by
    and exists (
      select 1 from public.journal_entries e
      where e.id = entry_id
        and e.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.tandems t
      where t.id = tandem_id
        and (select auth.uid()) in (t.participant_a_id, t.participant_b_id)
        and t.status in ('active', 'paused')
    )
  );

-- Le retrait, à toute heure et quel que soit l'état du tandem : c'est le geste
-- de reprise, il ne se conditionne pas à la relation. `journal_shares_select_author`
-- borne déjà ce qu'un DELETE peut voir — un retrait tenté sur le partage d'un
-- autre ne lève pas, il ne touche aucune ligne. L'écran lit donc le compte de
-- lignes, jamais l'absence d'erreur.
drop policy if exists "journal_shares_delete_author" on public.journal_shares;
create policy "journal_shares_delete_author"
  on public.journal_shares for delete
  to authenticated
  using ((select auth.uid()) = shared_by);

-- `grant` explicites : sans eux la Data API rend 401 quelles que soient les
-- politiques. Pas d'`update`, comme dit plus haut.
grant select, insert, delete on public.journal_shares to authenticated;

-- ---------------------------------------------------------------------------
-- Ce que le destinataire lit
-- ---------------------------------------------------------------------------
--
-- ⚠️ `create or replace function` refuse de changer le type de retour ; le
-- `drop` explicite rend le fichier rejouable, ce que fait la boucle de
-- vérification par mutation après chaque restauration. Même piège que pour
-- `tandem_partenaire()` dans `20260825090000`.
drop function if exists public.journal_partage_avec_moi();

create function public.journal_partage_avec_moi()
returns table (
  entree_id uuid,
  tandem_id uuid,
  texte text,
  humeur text,
  ecrit_le timestamptz,
  partage_le timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.entry_id,
         s.tandem_id,
         e.text,
         e.mood,
         e.created_at,
         s.created_at
  from public.journal_shares s
  join public.journal_entries e on e.id = s.entry_id
  join public.tandems t on t.id = s.tandem_id
  where auth.uid() is not null
    -- Le conjonct central : on ne lit que les partages posés sur un tandem où
    -- l'on figure soi-même. C'est lui qui remplace la politique qu'on n'a pas
    -- écrite, et c'est lui que la vérification par mutation casse pour
    -- s'assurer qu'un test rougit.
    and (t.participant_a_id = auth.uid() or t.participant_b_id = auth.uid())
    -- L'auteur est participant de son propre tandem : sans cette ligne, la
    -- fonction lui rendrait ses propres entrées, et le panneau « ce que ton
    -- binôme t'a partagé » lui montrerait ses mots comme venant de l'autre. Ce
    -- n'est pas une fuite, c'est un écran qui ment — et le dépôt refuse les
    -- deux.
    and s.shared_by <> auth.uid()
    -- Le partage meurt avec la relation. Voir l'en-tête : c'est ici l'inverse
    -- de `messages_select_member`, qui garde la lecture à qui a bloqué.
    and t.status in ('active', 'paused')
  order by s.created_at desc;
$$;

comment on function public.journal_partage_avec_moi() is
  'Les entrées de journal qu''un binôme a explicitement partagées avec l''appelant. Seul chemin de lecture du journal d''autrui : journal_entries reste own-only, aucune politique n''y est ajoutée. Sans paramètre — elle lit auth.uid() — pour ne pas devenir une sonde sur les identifiants d''autrui. Ne rend rien sur un tandem bloqué ou terminé, ni à l''auteur du partage lui-même. Rend zéro ligne sans identité.';

revoke all on function public.journal_partage_avec_moi() from public;
revoke all on function public.journal_partage_avec_moi() from anon;
grant execute on function public.journal_partage_avec_moi() to authenticated;
