-- Communautés, groupes, cohortes et rôles — issue #17.
--
-- ===========================================================================
-- Ce qui existait, et pourquoi ce n'était rien
-- ===========================================================================
--
-- La migration `…_000007` a posé six tables — `churches`, `church_groups`,
-- `church_members`, `group_members`, `mentor_profiles`, `mentor_assignments` —
-- avec RLS, politiques SELECT prudentes et `grant select`. Mesuré avant ce
-- fichier : **aucune politique d'écriture, aucun `grant` d'écriture, aucun
-- écran**. Une église ne pouvait donc pas naître, un groupe pas se créer, un
-- rôle pas s'attribuer. Le schéma décrivait un produit que rien ne permettait
-- de vivre ; `ChurchView` affichait un instantané d'une appartenance que
-- personne ne pouvait obtenir.
--
-- Ce fichier ouvre les chemins d'écriture, un par un, chacun sous une politique
-- dont le conjonct se lit. Le principe qui les gouverne tous :
--
--   **préparer est libre, faire entrer quelqu'un ne l'est pas.**
--
-- ===========================================================================
-- Décision 1 — qui crée une communauté, et ce que vaut `pending`
-- ===========================================================================
--
-- Le produit n'a pas de back-office, et n'en aura pas pour le pilote (issue
-- #22). Deux gestes se disputaient la même colonne `status` :
--
-- - **la création** est un geste de l'application. Un responsable d'église
--   réelle doit pouvoir monter sa communauté un dimanche soir sans nous
--   appeler ; exiger un SQL sanctionné pour cela ferait de chaque pilote un
--   ticket, et d'AgapePlay un goulot. La RPC `creer_ma_communaute` porte ce
--   geste.
-- - **l'activation** (`pending` → `active`) ne l'est pas, et le suspend non
--   plus. `churches` ne reçoit dans ce fichier **aucune politique d'écriture et
--   aucun `grant` d'écriture** : la colonne `status` est inatteignable depuis
--   la Data API, pour tout le monde, y compris le fondateur. Le motif est celui
--   de `tandem_moderators` (`20260806163000`) : l'absence de droit est la
--   protection. Activer se fait depuis l'éditeur SQL du tableau de bord, qui
--   travaille en `postgres` :
--
--       update public.churches set status = 'active' where id = '<uuid>';
--
--   et suspendre est symétrique (`'suspended'`). ⚠️ Ne pas « réparer » cette
--   table en lui accordant un `grant update`.
--
-- Ce partage n'aurait aucun sens si `pending` ne retenait rien. Il retient
-- exactement les deux actes liants, et rien d'autre :
--
--   1. **faire entrer quelqu'un** — émettre un lien d'invitation, et le
--      rejoindre ;
--   2. **affecter un mentor** à un participant.
--
-- Préparer — créer des groupes, poser des dates de cohorte, clôturer — reste
-- permis dès la création. Le fondateur monte son parcours pendant que nous
-- regardons, et rien d'irréversible pour une personne ne se produit avant
-- qu'un humain ait activé. Sur un produit qui met en relation des mineurs de
-- 16-17 ans avec des mentors adultes, c'est la seule répartition défendable :
-- ce qui coûte cher à défaire est ce qui attend.
--
-- Conséquence directe et voulue : `suspended` n'est pas décoratif non plus. Une
-- église suspendue cesse à l'instant d'inviter et d'affecter — les politiques
-- relisent `churches.status` à chaque requête, sans migration ni redéploiement.

-- ===========================================================================
-- Décision 2 — les cohortes, et le bord de la fenêtre qui est un droit
-- ===========================================================================
--
-- Une cohorte n'est pas un objet de plus : c'est un groupe qui a des dates.
-- Une table dédiée aurait dupliqué, pour deux colonnes, toute la mécanique
-- d'appartenance, d'invitation et de clôture — et il aurait alors fallu
-- répondre deux fois à chaque question de droit. Deux colonnes sur
-- `church_groups` suffisent, et un groupe sans dates reste un groupe permanent.
--
-- Le chantier #49 a posé le vocabulaire : une fenêtre est d'ordinaire une règle
-- d'écran, un droit est une règle de base. Ici la fenêtre a **deux bords, et un
-- seul est un droit** :
--
-- - `starts_on` est une règle d'écran. S'inscrire à une cohorte qui commence en
--   septembre est le geste normal du mois d'août ; une base qui le refuserait
--   n'aurait rien protégé et aurait cassé l'usage.
-- - `ends_on` est un droit. La question à poser n'est pas « qu'affiche
--   l'écran ? » mais « qu'est-ce qu'une base qui accepte tout laisserait
--   passer ? » : un lien d'invitation collé dans un groupe WhatsApp en février
--   fait toujours entrer quelqu'un en décembre — dans une cohorte terminée,
--   dont les mentors sont partis et que plus personne ne regarde. Aucun écran
--   ne rattrape un lien qui circule. La base refuse.

-- ===========================================================================
-- Décision 3 — les rôles, et les deux valeurs d'enum devenues inatteignables
-- ===========================================================================
--
-- `role` énumère `member`, `mentor`, `leader`, `admin`. Ce fichier donne un
-- pouvoir à trois d'entre eux et **aucun au quatrième** :
--
-- - `leader` (responsable) écrit : il crée les groupes et les cohortes, émet
--   les liens, nomme les mentors, affecte, clôture ;
-- - `mentor` est affecté, et rien de plus **dans ce chantier**. Ce qu'un mentor
--   lira de la personne qu'il accompagne est l'issue #16 ; le doc 06 le borne
--   d'avance à « signaux minimaux si affecté », et rien ici n'ouvre le journal,
--   les messages ni les bilans ;
-- - `member` (participant) rejoint, appartient, part ;
-- - `admin` est **inatteignable**, ce qui est plus fort que muet. La RPC de
--   création n'écrit que `leader` ; la RPC de jointure n'écrit que `member` ;
--   le `with check` du responsable borne à trois valeurs. Aucun chemin de ce
--   dépôt ne peut donc écrire `admin`, et un test l'épingle. La raison est
--   l'ADR-007 : l'autorité de plateforme est `tandem_moderators`, précisément
--   parce qu'un incident grave impliquant un mineur ne doit pas être arbitré
--   par la seule communauté où il s'est produit. Un `admin` d'église serait un
--   troisième pouvoir sans mandat.
--
-- Même sort, même raison de l'écrire, pour `church_members.status = 'invited'` :
-- une adhésion naît `active` — la RPC ne s'exécute qu'une fois le jeton
-- présenté et vérifié, il n'y a donc pas d'attente à représenter. `'invited'`
-- reste dans la contrainte `check`, n'est écrit par rien, et ne doit pas être
-- pris pour un chemin existant.

-- ===========================================================================
-- Décision 4 — la membrane église ↔ tandem : aucune colonne
-- ===========================================================================
--
-- Un tandem n'appartient à aucune église, et ce fichier ne l'y relie pas.
-- Ajouter `church_id` sur `tandems` aurait fabriqué exactement la jointure que
-- la matrice du doc 06 refuse : « responsable — progression de séance : non,
-- statistique agrégée uniquement ». Une colonne ne lit rien par elle-même, mais
-- elle rend le prédicat écrivable, et l'issue #16 aurait trouvé la porte
-- ouverte au lieu d'une décision à prendre.
--
-- La relation supervisée que le doc 06 décrit — « pour les 16-17 ans, mentor
-- proposé par l'église et accepté par le jeune » — est déjà portée par
-- `mentor_assignments`, qui **nomme la paire sans toucher à la conversation**.
-- C'est la membrane, et elle est suffisante.
--
-- Écart nommé, à l'attention de #16 : rien ne relie aujourd'hui une affectation
-- au tandem qui en naît éventuellement. Les deux objets coexistent sans se
-- connaître. C'est le prix de la borne, et il est délibéré.

-- ===========================================================================
-- Les dates de cohorte
-- ===========================================================================

alter table public.church_groups
  add column if not exists starts_on date,
  add column if not exists ends_on date;

alter table public.church_groups drop constraint if exists church_groups_fenetre_coherente;
alter table public.church_groups
  add constraint church_groups_fenetre_coherente
  check (starts_on is null or ends_on is null or ends_on >= starts_on);

comment on column public.church_groups.starts_on is
  'Début annoncé d''une cohorte. Règle d''écran : on peut rejoindre avant. NULL = groupe permanent.';
comment on column public.church_groups.ends_on is
  'Fin d''une cohorte. Règle de droit : passée cette date, plus personne n''entre — un lien d''invitation survit à la cohorte qu''il désigne.';

-- ===========================================================================
-- `tandem_role_eglise` — lire son propre rôle sans ouvrir l'annuaire
-- ===========================================================================
--
-- Toutes les politiques qui suivent posent la même question : « l'appelant
-- est-il responsable de cette église ? ». Elle ne peut pas s'écrire en clair.
--
-- Deux raisons, et la seconde est fatale. D'abord les droits : une expression
-- de politique est soumise aux droits **et à la RLS** de l'appelant (mesuré
-- dans `20260806163000`). Ensuite la récursion : la politique de lecture du
-- responsable porte sur `church_members` et devrait interroger
-- `church_members` — PostgreSQL lèverait `infinite recursion detected in
-- policy`. Une fonction `security definer` coupe les deux d'un coup.
--
-- **Elle prend un paramètre, contrairement à `tandem_est_moderateur()`, et
-- c'est admissible ici** : elle ne répond que sur l'appelant, dont elle lit
-- l'identité dans `auth.uid()`. Elle ne dit rien de personne d'autre — appelée
-- sur mille identifiants d'église, elle ne rend que ce que l'appelant sait
-- déjà, son propre rôle. La variante interdite serait
-- `role_de(p_church_id, p_user_id)` : celle-là ferait de tout compte un
-- annuaire des responsables du produit, et elle n'existe pas.
--
-- `current_user` ne servirait à rien : dans une fonction `security definer` il
-- désigne le propriétaire. Repli fermé, comme partout dans ce dépôt : sans
-- identité, NULL, et NULL n'est égal à rien.

create or replace function public.tandem_role_eglise(p_church_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.church_members m
  where auth.uid() is not null
    and m.church_id = p_church_id
    and m.user_id = auth.uid()
    and m.status = 'active'
$$;

comment on function public.tandem_role_eglise(uuid) is
  'Le rôle ACTIF de l''appelant dans cette église, ou NULL. Paramètre admissible parce qu''elle ne répond que sur auth.uid() : jamais un annuaire. Seul moyen d''interroger church_members depuis une politique sans récursion ni ouverture de lecture.';

revoke all on function public.tandem_role_eglise(uuid) from public;
revoke all on function public.tandem_role_eglise(uuid) from anon;
grant execute on function public.tandem_role_eglise(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Et trois sœurs, pour un cycle que la base a refusé
-- ---------------------------------------------------------------------------
--
-- Les politiques de `group_members` posent la même question à propos d'un
-- **groupe** : « l'appelant est-il responsable de l'église de ce groupe ? ».
-- Écrite en clair, elle donne `exists (select 1 from public.church_groups …)`,
-- et la base a répondu, à la première mutation mesurée :
--
--     error: infinite recursion detected in policy for relation "church_groups"
--
-- Le cycle est réel et il ne se voit pas à la lecture d'une politique seule :
-- `groups_member_read` (sur `church_groups`) interroge `group_members`, dont la
-- politique de lecture du responsable interrogeait `church_groups`. Il a suffi
-- d'un `insert … returning` sur `church_groups` pour le déclencher — c'est-à-dire
-- du geste le plus banal du chantier.
--
-- La sortie est celle du dépôt : aucune politique de `group_members` ne lit
-- plus `church_groups` en clair. Les trois fonctions ci-dessous portent la
-- traversée, hors RLS, et le cycle disparaît avec elle.
--
-- `tandem_membre_actif_du_groupe` prend **deux** paramètres, dont l'identifiant
-- d'une autre personne : c'est la forme dont `tandem_est_moderateur()` dit du
-- mal, et elle serait un annuaire si elle répondait à tout le monde. Elle ne
-- répond qu'aux responsables de l'église concernée — le premier conjonct de son
-- corps — c'est-à-dire à ceux qui lisent déjà cette liste par
-- `church_members_leader_read`. Elle n'apprend donc rien à personne.

create or replace function public.tandem_role_eglise_du_groupe(p_group_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.church_groups g
  join public.church_members m on m.church_id = g.church_id
  where auth.uid() is not null
    and g.id = p_group_id
    and m.user_id = auth.uid()
    and m.status = 'active'
$$;

comment on function public.tandem_role_eglise_du_groupe(uuid) is
  'Le rôle ACTIF de l''appelant dans l''église à laquelle ce groupe appartient, ou NULL. Ne répond que sur auth.uid(). Existe pour que les politiques de group_members n''interrogent pas church_groups : ce cycle a été mesuré, il lève « infinite recursion ».';

create or replace function public.tandem_cohorte_ouverte(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.tandem_role_eglise_du_groupe(p_group_id) is not null
     and exists (
       select 1 from public.church_groups g
       where g.id = p_group_id
         and g.status = 'active'
         and (g.ends_on is null or g.ends_on >= (timezone('utc', now()))::date)
     );
$$;

comment on function public.tandem_cohorte_ouverte(uuid) is
  'Ce groupe accepte-t-il encore quelqu''un ? Statut « active » ET fenêtre non refermée (décision 2). Rend false à qui n''appartient pas à l''église : la réponse ne renseigne que ceux qui voyaient déjà le groupe.';

create or replace function public.tandem_membre_actif_du_groupe(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.tandem_role_eglise_du_groupe(p_group_id) = 'leader'
     and exists (
       select 1
       from public.church_groups g
       join public.church_members m on m.church_id = g.church_id
       where g.id = p_group_id
         and m.user_id = p_user_id
         and m.status = 'active'
     );
$$;

comment on function public.tandem_membre_actif_du_groupe(uuid, uuid) is
  'Cette personne est-elle membre actif de l''église de ce groupe ? Deux paramètres, donc réservée : ne répond qu''aux responsables de cette église, qui lisent déjà cette liste. Rend false à tout autre appelant, pour ne pas devenir un annuaire.';

revoke all on function public.tandem_role_eglise_du_groupe(uuid) from public;
revoke all on function public.tandem_role_eglise_du_groupe(uuid) from anon;
grant execute on function public.tandem_role_eglise_du_groupe(uuid) to authenticated;
revoke all on function public.tandem_cohorte_ouverte(uuid) from public;
revoke all on function public.tandem_cohorte_ouverte(uuid) from anon;
grant execute on function public.tandem_cohorte_ouverte(uuid) to authenticated;
revoke all on function public.tandem_membre_actif_du_groupe(uuid, uuid) from public;
revoke all on function public.tandem_membre_actif_du_groupe(uuid, uuid) from anon;
grant execute on function public.tandem_membre_actif_du_groupe(uuid, uuid) to authenticated;

-- ===========================================================================
-- Fonder une communauté
-- ===========================================================================
--
-- `security definer` par nécessité : `churches` n'a aucun `grant insert` et
-- n'en recevra pas (décision 1), et `church_members` non plus (décision 5).
-- La fonction est donc le seul chemin, ce qui est le but — deux lignes
-- naissent ensemble ou aucune ne naît, et il n'existe pas d'église sans
-- responsable au premier instant.
--
-- Une seule appartenance active à la fois. Ce n'est pas une limite technique :
-- la relation que ce produit organise est un rattachement supervisé à **une**
-- communauté, l'écran en montre une, et `App.tsx` en lit une. Autoriser
-- l'appartenance multiple demanderait de décider laquelle est « la sienne »,
-- question qu'aucun écran ne pose aujourd'hui. La borne est additive : la
-- lever plus tard ne casse rien, l'inverse ne serait pas vrai.

create or replace function public.creer_ma_communaute(p_nom text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_nom text := btrim(coalesce(p_nom, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'identite_absente' using errcode = '28000';
  end if;
  if char_length(v_nom) < 2 or char_length(v_nom) > 120 then
    raise exception 'nom_invalide';
  end if;
  if exists (select 1 from public.church_members m where m.user_id = v_uid and m.status = 'active') then
    raise exception 'deja_dans_une_communaute';
  end if;

  -- `status` n'est pas donné : la valeur par défaut est `pending`, et c'est le
  -- cœur de la décision 1. L'écrire ici, même à `pending`, laisserait croire
  -- que la fonction a son mot à dire sur cette colonne.
  insert into public.churches (name) values (v_nom) returning id into v_id;
  insert into public.church_members (church_id, user_id, role, status)
  values (v_id, v_uid, 'leader', 'active');
  return v_id;
end;
$$;

comment on function public.creer_ma_communaute(text) is
  'Fonde une communauté au nom de l''appelant, qui en devient responsable. L''église naît « pending » : elle peut préparer ses groupes, pas faire entrer quelqu''un. L''activation est un geste SQL sanctionné, hors application.';

revoke all on function public.creer_ma_communaute(text) from public;
revoke all on function public.creer_ma_communaute(text) from anon;
grant execute on function public.creer_ma_communaute(text) to authenticated;

-- ===========================================================================
-- Les groupes et les cohortes
-- ===========================================================================
--
-- ⚠️ `groups_church_member_read` n'est pas une politique de confort. Sans elle,
-- **le responsable ne peut pas lire le groupe qu'il vient de créer** :
-- `groups_member_read` ne reconnaît que les membres du groupe
-- (`group_members`), et un responsable n'y est pas. Trois conséquences, toutes
-- silencieuses :
--
--   1. `insert … returning` rend un corps vide — PostgREST passe par un SELECT
--      pour le rendre — et « toute écriture lit sa réponse » rapporterait un
--      échec sur un succès ;
--   2. l'UPDATE de clôture ne trouverait aucune ligne, **sans rien lever** ;
--   3. l'écran serait vide juste après l'action qui l'a rempli.
--
-- La lecture est donc un prérequis de l'écriture, et elle est accordée à tout
-- membre actif de l'église : savoir quels parcours existent chez soi est la
-- première chose qu'on vient chercher.

drop policy if exists "groups_church_member_read" on public.church_groups;
create policy "groups_church_member_read"
  on public.church_groups for select
  to authenticated
  using (public.tandem_role_eglise(church_id) is not null);

drop policy if exists "groups_leader_insert" on public.church_groups;
create policy "groups_leader_insert"
  on public.church_groups for insert
  to authenticated
  with check (public.tandem_role_eglise(church_id) = 'leader');

-- `using` **et** `with check` : le premier dit quelles lignes on peut prendre,
-- le second ce qu'elles ont le droit de devenir. Les deux nomment le même
-- conjonct, ce qui interdit de déplacer un groupe vers une église dont on ne
-- serait pas responsable. Rien n'empêche en revanche de le déplacer entre deux
-- églises que l'on dirige — cas sans conséquence, et sans écran.
drop policy if exists "groups_leader_update" on public.church_groups;
create policy "groups_leader_update"
  on public.church_groups for update
  to authenticated
  using (public.tandem_role_eglise(church_id) = 'leader')
  with check (public.tandem_role_eglise(church_id) = 'leader');

-- `grant` colonnaires : l'écriture se borne à ce qui se modifie. `id`,
-- `church_id` et `created_at` restent hors de portée à l'UPDATE — une cohorte
-- ne change pas d'église et ne se réécrit pas une date de naissance.
grant insert (church_id, name, starts_on, ends_on) on public.church_groups to authenticated;
grant update (name, status, starts_on, ends_on) on public.church_groups to authenticated;

-- ===========================================================================
-- Les membres, et le rôle qu'un responsable peut changer
-- ===========================================================================
--
-- Décision 5 : **aucune politique INSERT sur `church_members`, aucun `grant
-- insert`.** On n'entre dans une communauté que par la RPC, c'est-à-dire par un
-- jeton. Une politique d'insertion, si étroite fût-elle, aurait à dire ce qui
-- autorise l'entrée ; le seul prédicat honnête étant « avoir présenté un lien
-- valide », il n'est pas exprimable dans un `with check` qui ne voit que la
-- ligne écrite. La RPC est donc le chemin, et l'absence de droit est ce qui
-- garantit qu'il est le seul.

drop policy if exists "church_members_leader_read" on public.church_members;
create policy "church_members_leader_read"
  on public.church_members for select
  to authenticated
  using (public.tandem_role_eglise(church_id) = 'leader');

-- Le responsable nomme les mentors et retire les adhésions. Deux bornes dans
-- le `with check` :
--
-- - `role in ('member', 'mentor', 'leader')` — `admin` reste inatteignable
--   (décision 3), et c'est ici que se joue l'essentiel de cette promesse ;
-- - `user_id <> auth.uid()` — **on ne modifie pas sa propre ligne.** Un
--   responsable qui se rétrograde ferait une église sans pilote, réparable
--   seulement par SQL sanctionné ; le refuser coûte un conjonct et évite un
--   appel au support. Le geste légitime existe : nommer un autre responsable,
--   qui pourra retirer le premier.
--
-- Le `using` porte le même conjonct que le `with check`, et pas seulement par
-- symétrie : la leçon de la PR #49 est qu'un `with check` d'UPDATE ne se teste
-- pas seul, parce que la lecture tient déjà la porte. Les deux sont ouverts
-- ensemble et éprouvés ensemble.
drop policy if exists "church_members_leader_update" on public.church_members;
create policy "church_members_leader_update"
  on public.church_members for update
  to authenticated
  using (
    public.tandem_role_eglise(church_id) = 'leader'
    and user_id <> (select auth.uid())
  )
  with check (
    public.tandem_role_eglise(church_id) = 'leader'
    and user_id <> (select auth.uid())
    and role in ('member', 'mentor', 'leader')
    and status in ('active', 'revoked')
  );

grant update (role, status) on public.church_members to authenticated;

-- ---------------------------------------------------------------------------
-- La liste des membres, avec des noms — et pourquoi ce n'est pas une politique
-- ---------------------------------------------------------------------------
--
-- `church_members_leader_read` rend au responsable une liste d'**uuid**.
-- `profiles` est own-only depuis `…_000001` : personne ne lit le nom de
-- personne. Un écran de gestion qui affiche seize identifiants hexadécimaux
-- n'est pas un écran de gestion, et le doc 06 accorde justement au responsable
-- le « profil public minimal — oui si groupe ».
--
-- Deux façons de le donner, et le choix n'est pas indifférent :
--
-- - une **politique SELECT** sur `profiles` pour les responsables. Refusée.
--   `profiles` est la table la plus sensible du schéma après le journal — elle
--   porte les dates de consentement, l'état du compte, la demande de
--   suppression — et une politique y ouvre *toutes* les colonnes, aujourd'hui
--   et à chaque colonne ajoutée plus tard. Personne ne se souviendrait, en
--   ajoutant un champ, qu'un responsable d'église le lira ;
-- - une **fonction** qui rend exactement les cinq colonnes utiles. Retenue.
--   Le motif est celui de `tandem_partenaire()` : ce qui sort est énuméré une
--   fois, ici, et une colonne ajoutée à `profiles` n'en sort pas toute seule.
--
-- **Sans paramètre**, comme `tandem_est_moderateur()` : elle répond « les
-- membres de la communauté que je dirige ». Une variante prenant un
-- `church_id` ferait de tout compte un annuaire des membres de n'importe
-- quelle église — et la borne d'une seule appartenance active rend le
-- paramètre inutile de toute façon.
--
-- Elle ne rend **rien** à qui n'est pas responsable : repli fermé, table vide.

create or replace function public.tandem_membres_de_ma_communaute()
returns table (user_id uuid, role text, statut text, nom text, entre_le timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.user_id, m.role, m.status, coalesce(p.display_name, ''), m.created_at
  from public.church_members m
  join public.church_members moi
    on moi.church_id = m.church_id
   and moi.user_id = auth.uid()
   and moi.role = 'leader'
   and moi.status = 'active'
  left join public.profiles p on p.id = m.user_id
  where auth.uid() is not null
  order by m.created_at asc
$$;

comment on function public.tandem_membres_de_ma_communaute() is
  'Les membres de la communauté que l''appelant dirige : identifiant, rôle, statut, nom d''affichage, date d''entrée. Sans paramètre, pour ne pas devenir un annuaire d''église. Énumère ce qui sort de profiles plutôt que d''y ouvrir une politique — une colonne ajoutée à profiles ne sortira pas d''elle-même.';

revoke all on function public.tandem_membres_de_ma_communaute() from public;
revoke all on function public.tandem_membres_de_ma_communaute() from anon;
grant execute on function public.tandem_membres_de_ma_communaute() to authenticated;

-- ===========================================================================
-- Les liens d'invitation
-- ===========================================================================
--
-- Décision 6 — une invitation d'église n'est pas une invitation de tandem, et
-- on ne détourne pas la seconde pour faire la première.
--
-- `tandem_invitations` est **nominative** : elle porte `invitee_email`, elle
-- s'adresse à une personne, elle s'accepte une fois. Un lien de communauté est
-- l'inverse — il se lit à voix haute un dimanche, il se colle dans un groupe de
-- messagerie, il ne connaît personne d'avance. Trois conséquences de schéma :
--
--   1. **pas d'adresse**, donc pas de vérification d'identité à l'acceptation ;
--   2. **plusieurs usages**, donc `max_uses` et `uses`, tous deux bornés — un
--      lien anonyme sans plafond est une porte ouverte qu'on a oublié de
--      compter ;
--   3. **une péremption serrée et plafonnée** : 30 jours par défaut, 90 au
--      maximum, contrainte `check` à l'appui. Un client qui demanderait l'an
--      3000 est refusé par la base, pas par l'écran.
--
-- Et surtout : **un lien ne confère que `member`.** Jamais `mentor`, jamais
-- `leader`. C'est la borne la plus importante de tout ce fichier. Un lien qui
-- fabriquerait des mentors fabriquerait des adultes référents de mineurs par
-- simple circulation d'URL — et rien ne rattrape une URL partie. Le doc 06 dit
-- « mentor proposé par l'église » : proposé par quelqu'un, nommément, parmi des
-- membres déjà entrés. C'est le rôle de `church_members_leader_update`.

create table if not exists public.church_invitations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  -- NULL = on rejoint la communauté sans cohorte. Non NULL = on rejoint la
  -- communauté **et** cette cohorte, d'un seul geste.
  group_id uuid references public.church_groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'revoked')),
  max_uses integer not null default 50 check (max_uses between 1 and 500),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz not null default timezone('utc', now()) + interval '30 days',
  created_at timestamptz not null default timezone('utc', now()),
  constraint church_invitations_plafond check (uses <= max_uses),
  constraint church_invitations_peremption check (
    expires_at > created_at and expires_at <= created_at + interval '90 days'
  )
);

create index if not exists church_invitations_church_idx
  on public.church_invitations (church_id, created_at desc);

comment on table public.church_invitations is
  'Liens d''invitation d''une communauté. Anonymes et multi-usage, contrairement aux invitations de tandem qui sont nominatives. Ne confèrent JAMAIS que le rôle « member » : un lien qui fabriquerait des mentors circulerait sans rattrapage possible.';
comment on column public.church_invitations.uses is
  'Compteur d''entrées réelles. Écrit par la seule RPC rejoindre_une_communaute() : aucun grant ne l''expose.';

alter table public.church_invitations enable row level security;

-- Le jeton est dans cette table. La lecture est donc réservée au responsable,
-- qui l'a émis : un membre qui pourrait lire les liens de son église pourrait
-- les faire circuler hors du cadre où on les a donnés.
drop policy if exists "church_invitations_leader_read" on public.church_invitations;
create policy "church_invitations_leader_read"
  on public.church_invitations for select
  to authenticated
  using (public.tandem_role_eglise(church_id) = 'leader');

-- Premier des deux actes liants (décision 1) : `churches.status = 'active'`
-- est exigé. Une église en attente prépare, elle n'invite pas.
drop policy if exists "church_invitations_leader_insert" on public.church_invitations;
create policy "church_invitations_leader_insert"
  on public.church_invitations for insert
  to authenticated
  with check (
    public.tandem_role_eglise(church_id) = 'leader'
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.churches c
      where c.id = church_id and c.status = 'active'
    )
    and (
      group_id is null
      or exists (
        select 1 from public.church_groups g
        where g.id = group_id
          and g.church_id = church_invitations.church_id
          and g.status = 'active'
          and (g.ends_on is null or g.ends_on >= (timezone('utc', now()))::date)
      )
    )
  );

-- Révoquer, et rien d'autre. Deux bornes, et la seconde est la moins évidente :
--
-- - le `grant` colonnaire ne porte que `status`, donc ni le jeton, ni le
--   plafond, ni la date de péremption ne se réécrivent. Un lien qu'on
--   regretterait se reprend ; il ne se prolonge pas ;
-- - `status = 'revoked'` dans le `with check` : **la révocation est
--   définitive.** Sans ce conjonct, la contrainte `check` laisse repasser un
--   lien de `revoked` à `pending` — c'est-à-dire remettre en service une URL
--   qu'on avait reprise, et qui a continué de circuler pendant ce temps. On ne
--   remet pas un lien en vie, on en émet un autre : le nouveau porte un jeton
--   que personne n'a jamais eu.
drop policy if exists "church_invitations_leader_update" on public.church_invitations;
create policy "church_invitations_leader_update"
  on public.church_invitations for update
  to authenticated
  using (public.tandem_role_eglise(church_id) = 'leader')
  with check (public.tandem_role_eglise(church_id) = 'leader' and status = 'revoked');

grant select on public.church_invitations to authenticated;
grant insert (church_id, group_id, created_by, max_uses, expires_at) on public.church_invitations to authenticated;
grant update (status) on public.church_invitations to authenticated;

-- ===========================================================================
-- Rejoindre une communauté
-- ===========================================================================
--
-- Décision 7 — `security definer`, là où `accept_tandem_invitation` est
-- `security invoker` (migration `…_000004`). La différence n'est pas un
-- relâchement, c'est la conséquence du reste :
--
-- - côté tandem, l'invitée **peut lire son invitation** avant d'accepter —
--   `invitations_select_participant` la reconnaît à son adresse. Tout se joue
--   donc sous RLS ordinaire, et c'est mieux ainsi ;
-- - côté église, celui qui présente un jeton n'est encore rien. Il ne lit ni
--   `church_invitations` (réservée au responsable), ni `churches` (réservée aux
--   membres), ni le groupe visé. La RPC est le seul point d'où l'on peut
--   vérifier un jeton sans avoir d'abord publié les jetons.
--
-- `for update` sur la ligne d'invitation, comme `accept_tandem_invitation` :
-- sans ce verrou, deux acceptations simultanées liraient le même `uses` et le
-- plafond ne voudrait plus rien dire.
--
-- Idempotence (doc 06, « les actions sensibles sont idempotentes ») : quelqu'un
-- qui rouvre le lien du dimanche est déjà membre. On rend son `church_id` sans
-- lever et **sans incrémenter `uses`** — un compteur qui compte les clics au
-- lieu des personnes épuiserait un lien avec une seule assemblée.

create or replace function public.rejoindre_une_communaute(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.church_invitations;
  v_statut_eglise text;
  v_groupe public.church_groups;
  v_statut_membre text;
begin
  if v_uid is null then
    raise exception 'identite_absente' using errcode = '28000';
  end if;

  select * into v_invitation
  from public.church_invitations
  where token = p_token
    and status = 'pending'
    and expires_at > timezone('utc', now())
  for update;

  if not found then raise exception 'invitation_introuvable'; end if;
  if v_invitation.uses >= v_invitation.max_uses then raise exception 'invitation_epuisee'; end if;

  -- Second acte liant : une église en attente ou suspendue ne reçoit personne,
  -- même par un lien émis quand elle était active.
  select c.status into v_statut_eglise from public.churches c where c.id = v_invitation.church_id;
  if v_statut_eglise is distinct from 'active' then raise exception 'communaute_inactive'; end if;

  if v_invitation.group_id is not null then
    select * into v_groupe from public.church_groups g where g.id = v_invitation.group_id;
    if v_groupe.status <> 'active' then raise exception 'cohorte_close'; end if;
    -- Le bord droit de la fenêtre, en droit (décision 2). `timezone('utc', …)`
    -- et non `current_date` : tout ce dépôt raisonne en UTC, et une comparaison
    -- au fuseau du serveur ferait basculer le refus une heure trop tôt ou trop
    -- tard selon la machine.
    if v_groupe.ends_on is not null and v_groupe.ends_on < (timezone('utc', now()))::date then
      raise exception 'cohorte_terminee';
    end if;
  end if;

  select m.status into v_statut_membre
  from public.church_members m
  where m.church_id = v_invitation.church_id and m.user_id = v_uid;

  if v_statut_membre = 'revoked' then
    -- On ne revient pas par un lien qui circule. Le retrait a été un geste
    -- nommé du responsable ; le défaire est un geste nommé aussi
    -- (`church_members_leader_update`), pas un effet de bord d'une URL.
    raise exception 'adhesion_revoquee';
  elsif v_statut_membre is null then
    if exists (
      select 1 from public.church_members m
      where m.user_id = v_uid and m.status = 'active' and m.church_id <> v_invitation.church_id
    ) then
      raise exception 'deja_dans_une_communaute';
    end if;

    insert into public.church_members (church_id, user_id, role, status)
    values (v_invitation.church_id, v_uid, 'member', 'active');

    update public.church_invitations
       set uses = uses + 1
     where id = v_invitation.id;
  end if;

  -- Tenté dans tous les cas, y compris sur une adhésion déjà existante : c'est
  -- ce qui permet à un membre de rejoindre une seconde cohorte de son église
  -- avec un second lien.
  if v_invitation.group_id is not null then
    insert into public.group_members (group_id, user_id)
    values (v_invitation.group_id, v_uid)
    on conflict do nothing;
  end if;

  return v_invitation.church_id;
end;
$$;

comment on function public.rejoindre_une_communaute(text) is
  'Entre dans une communauté par un lien. security definer parce que celui qui présente le jeton ne peut encore rien lire — ni l''invitation, ni l''église, ni le groupe. Confère « member », jamais plus. Idempotente : rejoindre deux fois n''use qu''une place. Refuse une église non active, une cohorte close ou terminée, une adhésion révoquée.';

revoke all on function public.rejoindre_une_communaute(text) from public;
revoke all on function public.rejoindre_une_communaute(text) from anon;
grant execute on function public.rejoindre_une_communaute(text) to authenticated;

-- ===========================================================================
-- L'appartenance aux groupes
-- ===========================================================================

drop policy if exists "group_members_leader_read" on public.group_members;
create policy "group_members_leader_read"
  on public.group_members for select
  to authenticated
  using (public.tandem_role_eglise_du_groupe(group_id) = 'leader');

-- Le responsable range un membre dans une cohorte, et trois choses doivent être
-- vraies ensemble : c'est bien sa cohorte, elle accepte encore quelqu'un, et la
-- personne rangée appartient déjà à l'église. Trois conjoncts, trois fonctions,
-- chacun lisible seul — et aucun qui interroge `church_groups` en clair, pour
-- la raison de cycle expliquée plus haut.
drop policy if exists "group_members_leader_insert" on public.group_members;
create policy "group_members_leader_insert"
  on public.group_members for insert
  to authenticated
  with check (
    public.tandem_role_eglise_du_groupe(group_id) = 'leader'
    and public.tandem_cohorte_ouverte(group_id)
    and public.tandem_membre_actif_du_groupe(group_id, group_members.user_id)
  );

-- Deux raisons de sortir d'une cohorte, donc deux disjoints : le responsable
-- retire, et **on part soi-même**. Le second tient au doc 06, « possibilité de
-- quitter une relation sans justification publique » : une personne qui veut
-- s'en aller n'a pas à demander la permission de celui qui l'a fait entrer.
drop policy if exists "group_members_leave_or_leader_delete" on public.group_members;
create policy "group_members_leave_or_leader_delete"
  on public.group_members for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.tandem_role_eglise_du_groupe(group_id) = 'leader'
  );

grant insert (group_id, user_id) on public.group_members to authenticated;
grant delete on public.group_members to authenticated;

-- ===========================================================================
-- Les affectations de mentor
-- ===========================================================================
--
-- Décision 8 — **le responsable propose, le jeune accepte.** Le doc 06 est
-- explicite : « pour les 16-17 ans, mentor proposé par l'église et accepté par
-- le jeune ». C'était jusqu'ici une phrase de documentation ; le défaut de la
-- colonne `status` la rend opposable.
--
-- Une affectation naît donc `pending` — la valeur par défaut change ici, et
-- `status` n'est pas dans le `grant insert` : aucun chemin ne permet de créer
-- une affectation déjà active. Ensuite, et c'est le point :
--
--   **seul le participant peut écrire `active`.**
--
-- Le responsable peut suspendre (`paused`) et mettre fin (`ended`). Le mentor
-- peut mettre fin. Ni l'un ni l'autre ne peut accepter à la place du jeune. La
-- disjonction ci-dessous se lit branche par branche, et l'union est voulue : un
-- responsable qui serait aussi le mentor cumule ses deux jeux de transitions —
-- et n'obtient toujours pas `active`.

alter table public.mentor_assignments alter column status set default 'pending';

comment on column public.mentor_assignments.status is
  'Naît « pending » : une affectation est une proposition. Seul le participant peut écrire « active » — le doc 06 exige que le jeune accepte, et c''est la politique qui le tient, pas l''écran.';

drop policy if exists "mentor_assignments_leader_read" on public.mentor_assignments;
create policy "mentor_assignments_leader_read"
  on public.mentor_assignments for select
  to authenticated
  using (public.tandem_role_eglise(church_id) = 'leader');

-- Troisième acte liant : `churches.status = 'active'` est exigé. Mettre un
-- adulte en face d'un mineur est précisément ce qui ne doit pas se produire
-- avant qu'un humain ait regardé la communauté.
drop policy if exists "mentor_assignments_leader_insert" on public.mentor_assignments;
create policy "mentor_assignments_leader_insert"
  on public.mentor_assignments for insert
  to authenticated
  with check (
    public.tandem_role_eglise(church_id) = 'leader'
    and exists (select 1 from public.churches c where c.id = church_id and c.status = 'active')
    -- Le mentor porte le rôle `mentor` dans CETTE église. Un mentor vérifié
    -- ailleurs n'est pas un mentor ici.
    and exists (
      select 1 from public.church_members m
      where m.church_id = mentor_assignments.church_id
        and m.user_id = mentor_assignments.mentor_id
        and m.status = 'active' and m.role = 'mentor'
    )
    and exists (
      select 1 from public.church_members p
      where p.church_id = mentor_assignments.church_id
        and p.user_id = mentor_assignments.participant_id
        and p.status = 'active'
    )
    and (
      group_id is null
      or exists (
        select 1 from public.church_groups g
        where g.id = group_id
          and g.church_id = mentor_assignments.church_id
          and g.status = 'active'
          and (g.ends_on is null or g.ends_on >= (timezone('utc', now()))::date)
      )
    )
  );

drop policy if exists "mentor_assignments_transitions" on public.mentor_assignments;
create policy "mentor_assignments_transitions"
  on public.mentor_assignments for update
  to authenticated
  using (
    public.tandem_role_eglise(church_id) = 'leader'
    or (select auth.uid()) in (mentor_id, participant_id)
  )
  with check (
    ((select auth.uid()) = participant_id and status in ('active', 'ended'))
    or ((select auth.uid()) = mentor_id and status = 'ended')
    or (public.tandem_role_eglise(church_id) = 'leader' and status in ('paused', 'ended'))
  );

grant insert (church_id, group_id, mentor_id, participant_id) on public.mentor_assignments to authenticated;
grant update (status) on public.mentor_assignments to authenticated;

-- ===========================================================================
-- Clôture et rétention
-- ===========================================================================
--
-- Clôturer une cohorte, c'est un `update … set status = 'closed'`, et ce que
-- cela produit tient entièrement dans des règles de droit déjà écrites plus
-- haut — rien n'est laissé à l'écran :
--
-- - **plus personne n'entre** : `group_members_leader_insert` exige
--   `g.status = 'active'`, la RPC lève `cohorte_close`, et
--   `church_invitations_leader_insert` refuse d'émettre un lien vers elle ;
-- - **plus aucun mentor n'y est affecté** : le dernier conjonct de
--   `mentor_assignments_leader_insert` ;
-- - **les liens déjà émis vers elle cessent de valoir**, sans qu'il faille les
--   révoquer un par un. C'est le point qui justifie que la clôture soit un
--   droit : un lien est une chose qui a quitté nos mains.
--
-- Ce que la clôture **ne fait pas**, et c'est délibéré : elle n'efface ni les
-- appartenances, ni les affectations. Une cohorte close reste lisible par ceux
-- qui l'ont vécue et par le responsable. Effacer les membres à la clôture
-- reviendrait à retirer à quelqu'un la trace d'un parcours qu'il a fait ; le
-- geste qui efface une trace de ce genre appartient à la personne, et il existe
-- déjà : `supprimer_mon_compte()`.
--
-- **La politique de rétention**, écrite ici pour qu'on puisse la citer :
--
--   1. les données de communauté d'une personne (adhésion, appartenances aux
--      groupes, affectations, liens qu'elle a émis) vivent tant que son compte
--      vit, et partent avec lui — c'est la fonction ci-dessous, et les tests la
--      mesurent ;
--   2. une cohorte close est conservée telle quelle, indéfiniment, tant que les
--      comptes qui la composent existent ;
--   3. **aucune purge automatique n'est promise**, et il ne faut pas en
--      supposer une. Ce dépôt n'a aucun `pg_cron`, aucune tâche planifiée,
--      aucun ordonnanceur. Promettre une durée qu'aucun mécanisme ne tient
--      serait pire que de n'en promettre aucune.
--
-- Écart nommé, borné, non résolu ici : la dette de la PR #44 — la durée de
-- conservation des messages signalés (doc 06 : « conservation limitée et
-- documentée des messages signalés ») — reste ouverte, et la clôture des
-- cohortes en hérite. Elle demande un ordonnanceur, donc une décision d'infra
-- qui déborde ce chantier. Elle est nommée dans `docs/26`, avec ce qu'il
-- faudrait pour la solder.

-- ===========================================================================
-- La suppression de compte
-- ===========================================================================
--
-- La fonction est **recopiée en entier**, corps et commentaires compris :
-- PostgreSQL ne connaît pas le patch de corps de fonction. Une seule ligne
-- diffère de la version du 25/08 (`20260825213000`) — le `delete` sur
-- `church_invitations` — et elle est annotée sur place.
--
-- Pourquoi une seule ligne, alors que ce fichier ajoute une table et cinq
-- chemins d'écriture : les appartenances (`church_members`, `group_members`,
-- `mentor_assignments`) y étaient **déjà** effacées depuis `20260825090000`,
-- et ce fichier n'a créé aucune donnée de personne ailleurs. Vérifié plutôt
-- que supposé : `tests/rls/communaute.test.ts` mesure qu'il ne reste rien.
--
-- Le cas qui manquait est le lien d'invitation. `created_by` référence
-- `auth.users` en `on delete cascade`, et cette cascade ne servira jamais :
-- cette fonction ne supprime pas la ligne `auth.users`, elle la neutralise. Un
-- lien survivant à son émetteur serait une URL vivante attachée à une pierre
-- tombale — et personne pour la révoquer, puisque la lecture est réservée au
-- responsable qui n'est plus là.
--
-- ⚠️ Écart nommé et assumé : un fondateur unique qui s'en va laisse une église
-- **sans responsable**. Ses lignes `church_members` partent, plus personne ne
-- porte le rôle `leader`, et aucune politique ne peut plus rien écrire dans
-- cette communauté. C'est réparable — un SQL sanctionné nomme un nouveau
-- responsable, exactement comme il active une église — et c'est cohérent avec
-- la décision 1 : la vie institutionnelle d'une communauté n'est pas dans
-- l'application. Ce n'est pas un défaut à découvrir un jour de panique ; c'est
-- écrit ici et dans `docs/26`.

do $$
declare
  v_source text;
begin
  if to_regprocedure('public.supprimer_mon_compte()') is null then
    raise exception 'supprimer_mon_compte() introuvable : migration 20260825090000 non appliquée ?';
  end if;
  v_source := pg_get_functiondef(to_regprocedure('public.supprimer_mon_compte()'));
  if position('weekly_checkins' in v_source) = 0 then
    raise exception 'supprimer_mon_compte() n''est pas dans sa version du 25/08 (issue #18) : appliquez 20260825213000 avant celle-ci.';
  end if;
end;
$$;

create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  -- Repli fermé, comme `tandem_est_moderateur()` : sans identité, on ne
  -- supprime rien. Le `grant` ne suffit pas à porter cette garde — il ne dit
  -- rien d'un rôle `authenticated` sans claims, qui est précisément la
  -- situation où `auth.uid()` vaut NULL et où un `where user_id = v_uid`
  -- silencieux ne toucherait aucune ligne… tout en laissant les `update` sans
  -- clause d'identité faire leur œuvre. On lève avant d'en arriver là.
  if v_uid is null then
    raise exception 'identite_absente' using errcode = '28000';
  end if;

  -- L'adresse d'abord : les invitations reçues se retrouvent par elle, et le
  -- bloc `auth` plus bas va l'effacer.
  select u.email into v_email from auth.users u where u.id = v_uid;

  -- 1. Ce qui n'est qu'à elle, et qui part sans discussion.
  delete from public.journal_entries where user_id = v_uid;
  delete from public.session_progress where user_id = v_uid;
  delete from public.notification_preferences where user_id = v_uid;
  delete from public.church_members where user_id = v_uid;
  delete from public.group_members where user_id = v_uid;
  delete from public.mentor_profiles where user_id = v_uid;
  delete from public.mentor_assignments where mentor_id = v_uid or participant_id = v_uid;
  -- Ajout du 25/08/2026 (issue #17) : les liens d'invitation qu'elle a émis.
  -- Un lien est utilisable par quiconque le détient ; le laisser vivre après le
  -- départ de celui qui l'a émis, c'est laisser une porte que plus personne ne
  -- peut ni voir ni refermer — la lecture est réservée aux responsables.
  delete from public.church_invitations where created_by = v_uid;
  -- Un modérateur qui s'en va cesse d'être modérateur. Le retrait est immédiat
  -- côté base, par conception (voir `20260806163000`).
  delete from public.tandem_moderators where user_id = v_uid;
  -- Ajout du 25/08/2026 (issue #20) : le consentement à la mesure est une
  -- donnée de la personne, et il part avec elle. Les ÉVÉNEMENTS, eux, ne sont
  -- pas touchés — aucun prédicat ne pourrait les désigner, et c'est le résultat
  -- recherché. Voir `docs/25`, section « supprimer ».
  delete from public.mesure_preferences where user_id = v_uid;
  -- Ajout du 25/08/2026 (issue #18) : les bilans de fin de semaine. La clé
  -- étrangère vers `auth.users` est `on delete cascade` et ne servira jamais —
  -- cette fonction ne supprime pas la ligne `auth.users`, elle la neutralise.
  -- Ce `delete` est donc le seul chemin par lequel ces lignes s'en vont.
  delete from public.weekly_checkins where user_id = v_uid;

  -- 2. Les invitations : toute ligne qui porte son identifiant ou son adresse.
  --
  -- Les deux sens comptent. Celles qu'elle a émises contiennent l'adresse d'un
  -- tiers, confiée pour un usage qui n'a plus lieu d'être ; celles qu'elle a
  -- reçues contiennent la sienne, dans la liste de quelqu'un d'autre.
  -- L'anonymisation aurait été le choix inverse — elle laisse à l'inviteur une
  -- ligne portant une adresse inventée, c'est-à-dire un écran qui ment. Une
  -- ligne absente ne ment pas : la personne invitée n'est plus là.
  delete from public.tandem_invitations
   where inviter_id = v_uid
      or accepted_by = v_uid
      or lower(invitee_email) = lower(coalesce(v_email, '@'));

  -- 3. Les tandems : on termine, **sauf ceux qui sont bloqués**.
  --
  -- Le conjonct `status <> 'blocked'` n'est pas une précaution de style, c'est
  -- la garde la plus tranchante de cette fonction. `messages_select_member`
  -- referme la lecture de l'historique sur la personne bloquée
  -- (`t.status <> 'blocked' or auth.uid() = t.blocked_by`) : faire passer une
  -- ligne bloquée à `ended` lui rouvrirait la conversation entière. Autrement
  -- dit, quelqu'un qui a été bloqué reprendrait la lecture au moment où celui
  -- qui l'a bloqué s'en va — le pire moment possible. **Le blocage survit à son
  -- auteur.** La ligne reste `blocked`, gelée pour les deux.
  update public.tandems
     set status = 'ended',
         ended_at = coalesce(ended_at, timezone('utc', now()))
   where (participant_a_id = v_uid or participant_b_id = v_uid)
     and status <> 'blocked';

  -- 4. Le profil devient la pierre tombale décrite plus haut. Les dates de
  -- consentement partent avec le reste : elles ne prouvent plus rien pour un
  -- compte qui n'existe plus, et ce sont des données de la personne.
  update public.profiles
     set display_name = '',
         account_status = 'deleted',
         deletion_requested_at = coalesce(deletion_requested_at, timezone('utc', now())),
         deleted_at = timezone('utc', now()),
         age_confirmed_at = null,
         privacy_consent_at = null,
         terms_consent_at = null,
         updated_at = timezone('utc', now())
   where id = v_uid;

  -- 5. Les moyens de se connecter, et les sessions déjà ouvertes.
  --
  -- `auth.identities` porte l'adresse et les métadonnées du fournisseur
  -- (Google, Microsoft) : on efface les lignes, pas seulement leur contenu.
  -- `auth.sessions` emporte `auth.refresh_tokens` par cascade — c'est la
  -- révocation côté serveur, celle qui ne dépend pas de la bonne volonté du
  -- client. La déconnexion globale demandée par l'application en est le
  -- pendant visible, pas la garantie.
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;

  update auth.users
     set email = null,
         phone = null,
         encrypted_password = null,
         -- Lu par `nomDepuisIdentite` côté client : ces métadonnées portent un
         -- vrai nom, les vider n'a rien de cosmétique.
         raw_user_meta_data = '{}'::jsonb,
         -- `raw_app_meta_data` n'est PAS touchée : elle porte `provider` et
         -- `providers`, données de contrôle de GoTrue et non données de la
         -- personne. Ni la purge ni le blocage de connexion n'en dépendent, et
         -- la plus petite empreinte possible dans `auth.*` est ce qui rend le
         -- contrôle de droits ci-dessus simple à tenir.
         banned_until = timezone('utc', now()) + interval '100 years',
         deleted_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where id = v_uid;
end;
$$;

comment on function public.supprimer_mon_compte() is
  'Suppression réelle du compte de l''appelant. Sans paramètre — elle lit auth.uid() — parce qu''il n''y a personne d''autre à supprimer. Efface les données personnelles (dont les appartenances de communauté, les liens d''invitation émis, le consentement à la mesure et les bilans hebdomadaires), neutralise auth.users et les sessions, garde les messages laissés chez autrui, les signalements et l''audit. Ne termine pas un tandem bloqué : le blocage survit à son auteur. N''efface aucun événement de mesure : aucun ne désigne ce compte.';

revoke all on function public.supprimer_mon_compte() from public;
revoke all on function public.supprimer_mon_compte() from anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ===========================================================================
-- Ce que ce fichier n'ouvre pas
-- ===========================================================================
--
-- Aucune politique n'est ajoutée sur `journal_entries`, `tandem_messages`,
-- `weekly_checkins`, `session_progress` ni `journal_shares`. Un responsable ou
-- un mentor de ce fichier ne lit **rien** du contenu spirituel de qui que ce
-- soit — ni journal, ni message, ni bilan, ni progression. La matrice du doc 06
-- l'exige (« mentor : signaux minimaux si affecté », « responsable : non,
-- statistique agrégée uniquement »), l'issue #16 en décidera la forme exacte,
-- et ce chantier pose des fondations qui ne l'empêchent pas — sans rien
-- préempter.
--
-- Aucun événement de mesure n'est émis non plus. Le catalogue du doc 08 est
-- fermé par une contrainte `check` (`analytics_events_nom_connu`, PR #48) et
-- ses dix noms parlent tous du binôme ou du parcours. Détourner
-- `partner_invited` pour compter une entrée en communauté fausserait le funnel
-- qu'il sert ; inventer un nom serait refusé par la base, et à raison. Mesurer
-- la vie des communautés demande d'abord d'amender le doc 08 — décision
-- éditoriale, pas effet de bord de ce fichier.
