-- L'espace mentor — issue #16.
--
-- L'issue demande cinq choses : la liste des participants autorisés, les
-- signaux « actif », « à relancer » et « demande d'aide », une action
-- d'encouragement, des permissions testées, et **aucune métrique de classement
-- public**. Ce fichier porte les quatre premières ; la cinquième est une
-- absence, et une absence se prouve — `tests/rls/espace-mentor.test.ts` la
-- mesure.
--
-- Le chantier #17 (`20260825230000`) a laissé la place vide exprès : « un
-- mentor ne lit rien du contenu spirituel de qui que ce soit […] l'issue #16 en
-- décidera la forme exacte ». La voici.
--
-- ---------------------------------------------------------------------------
-- Le principe qui gouverne tout ce fichier
-- ---------------------------------------------------------------------------
--
--   **Le mentor reçoit des catégories, jamais des observations.**
--
-- La matrice du doc 06 borne le mentor à « signaux minimaux si affecté » pour
-- la progression de séance, et à « non » pour le journal, les messages et le
-- bilan. La tentation, en écrivant un tableau de suivi, est de considérer que
-- « la dernière séance remonte au 3 août » est un signal minimal parce qu'il ne
-- contient aucun mot du jeune. C'est faux, et c'est la décision centrale de ce
-- chantier : une date d'activité est une observation, elle se compare d'une
-- personne à l'autre, elle se compte, et elle fabrique le classement que
-- l'issue interdit — même privé, même dans la tête d'un seul lecteur.
--
-- Ce qui sort d'ici est donc un mot parmi quatre, calculé **dans** la fonction,
-- à partir de lignes qui ne franchissent jamais sa frontière. Aucune politique
-- n'est ajoutée sur `session_progress` ni sur `weekly_checkins` : elles restent
-- own-only, et un mentor qui les interroge en direct lit toujours zéro ligne.
-- Un test le prouve dans le même décor que celui qui lit « à relancer ».
--
-- La distinction à ne pas perdre : l'interdit porte sur les **dates d'activité
-- observée**, pas sur l'horodatage d'un geste que la personne a posé
-- elle-même vers son mentor. Une demande d'aide porte son `created_at`, et le
-- mentor le lit — parce que c'est le jeune qui a frappé à la porte, et savoir
-- depuis quand il attend fait partie du geste.
--
-- ---------------------------------------------------------------------------
-- La vérification du mentor garde ce qui SORT, pas ce qui est nommé
-- ---------------------------------------------------------------------------
--
-- `mentor_profiles.verification_status` et `training_status` existaient depuis
-- le 4 août sans que rien n'en dépende. Ils deviennent opposables ici : les
-- trois chemins ouverts par ce fichier — lire ses accompagnements, recevoir une
-- demande d'aide, envoyer un encouragement — exigent tous
-- `verified` **et** `completed`.
--
-- Le point d'application est délibéré. Nommer un mentor reste possible sans
-- vérification (`mentor_assignments_leader_insert` du #17 ne demande que le
-- rôle) : nommer est une intention d'église, et une église a le droit de
-- préparer avant que la vérification n'aboutisse. Ce qui exige la vérification,
-- c'est le premier octet qui sort du jeune vers l'adulte. Le doc 06 range la
-- « validation manuelle par pièce contrôlée ou attestation d'église » dans la
-- politique produit MVP, et la section « sécurité relationnelle » ne conçoit la
-- relation supervisée que par une église qui répond de son mentor.
--
-- Conséquence assumée : un mentor nommé mais non vérifié voit un écran vide, et
-- l'écran lui dit pourquoi (sa carte de vérification est juste au-dessus). Un
-- écran vide qui s'explique vaut mieux qu'une liste de noms d'adolescents
-- rendue à quelqu'un que personne n'a encore contrôlé.

-- ===========================================================================
-- La garde d'antériorité
-- ===========================================================================
--
-- Ce fichier recopie `supprimer_mon_compte()` en entier (PostgreSQL ne connaît
-- pas le patch de corps de fonction). Recopier une fonction, c'est écraser
-- celle qui est en place : si la base porte une version antérieure à celle du
-- #17, la recopie **perd** des lignes de suppression sans rien dire.
--
-- Le jeton testé est donc `church_invitations`, que **seule** la version du #17
-- contient. Le fichier précédent testait `weekly_checkins`, présent dès la
-- version du #18 : reprendre ce jeton tel quel aurait laissé passer une base
-- restée en 20260825213000 et perdu le `delete` des liens d'invitation.

do $$
declare
  v_source text;
begin
  if to_regprocedure('public.supprimer_mon_compte()') is null then
    raise exception 'supprimer_mon_compte() introuvable : migration 20260825090000 non appliquée ?';
  end if;
  v_source := pg_get_functiondef(to_regprocedure('public.supprimer_mon_compte()'));
  if position('church_invitations' in v_source) = 0 then
    raise exception 'supprimer_mon_compte() n''est pas dans sa version du 25/08 (issue #17) : appliquez 20260825230000 avant celle-ci.';
  end if;
end;
$$;

-- ===========================================================================
-- La fonction qui dit si une relation d'accompagnement est vivante
-- ===========================================================================
--
-- Un seul prédicat, réutilisé par les deux tables de ce fichier et par les deux
-- écrans. Il répond à une question et à une seule : **entre ces deux personnes,
-- y a-t-il aujourd'hui un accompagnement accepté et un mentor vérifié ?**
--
-- Elle prend deux paramètres, alors que le motif du dépôt
-- (`tandem_membres_de_ma_communaute()`, `tandem_est_moderateur()`) est plutôt
-- « sans paramètre, pour ne pas devenir un annuaire ». Ce n'est pas une
-- entorse : elle ne rend **rien** qu'un booléen. Un annuaire est une fonction
-- qui rend des lignes qu'on n'avait pas ; celle-ci confirme ou infirme une
-- paire que l'appelant nomme déjà. Sonder l'espace des uuid pour découvrir
-- qu'une paire existe demanderait de connaître les deux identifiants — et qui
-- connaît les deux n'apprend rien.
--
-- Deux paramètres plutôt qu'un, parce que les deux côtés en ont besoin et que
-- `auth.uid()` n'est pas du même côté : le participant l'appelle pour demander
-- de l'aide (il est `p_participant_id`), le mentor pour encourager (il est
-- `p_mentor_id`). Chaque politique ajoute son propre conjonct d'identité — la
-- fonction ne la présume jamais.

create or replace function public.tandem_accompagnement_actif(
  p_mentor_id uuid,
  p_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.mentor_assignments a
    join public.mentor_profiles mp on mp.user_id = a.mentor_id
    where a.mentor_id = p_mentor_id
      and a.participant_id = p_participant_id
      and a.status = 'active'
      and mp.verification_status = 'verified'
      and mp.training_status = 'completed'
  )
$$;

comment on function public.tandem_accompagnement_actif(uuid, uuid) is
  'Vrai si ces deux personnes sont liées par une affectation « active » et que le mentor est vérifié et formé. Ne rend qu''un booléen sur une paire que l''appelant nomme déjà : ce n''est pas un annuaire. Ne présume aucune identité — chaque politique ajoute son conjonct auth.uid().';

revoke all on function public.tandem_accompagnement_actif(uuid, uuid) from public;
revoke all on function public.tandem_accompagnement_actif(uuid, uuid) from anon;
grant execute on function public.tandem_accompagnement_actif(uuid, uuid) to authenticated;

-- ===========================================================================
-- Les demandes d'aide
-- ===========================================================================
--
-- Le geste n'existait nulle part : le doc 06 accorde « demande d'aide : oui »
-- au mentor depuis le premier jour, et aucune table ne la portait.
--
-- **Une catégorie close, et pas un mot libre.** C'est la décision la plus
-- discutable du fichier, alors elle est écrite en entier. Le signalement
-- (#46, `20260825173000`) porte, lui, un `reason` de mille caractères — et le
-- motif ne se transpose pas, pour une raison de lecteur : un signalement est lu
-- par un modérateur extérieur à l'église, formé, tenu par une procédure écrite
-- (doc 22). Une demande d'aide est lue par un adulte bénévole de la communauté
-- du jeune. Ouvrir mille caractères de texte libre d'un mineur vers cet adulte,
-- hors de la conversation de tandem — qui est, elle, signalable, bloquable et
-- supprimable — fabriquerait exactement le canal que la membrane du #17 refuse,
-- et le fabriquerait en croyant rendre service.
--
-- Ce que le jeune veut dire, il le dit à son binôme, ou il le signale. Ce
-- bouton-ci dit une seule chose, et c'est déjà beaucoup : **fais-moi signe.**
--
-- **Pas de demande sans destinataire.** `mentor_id` est `not null`, et la
-- politique d'insertion exige un accompagnement actif. Une ligne écrite « au
-- cas où » par quelqu'un sans mentor serait une promesse que personne ne
-- reçoit ; l'écran, à la place, oriente — vers le binôme, vers le responsable
-- d'église, et vers les numéros du doc 22 (119, 3018, 3114, 17).
--
-- **Une seule demande ouverte à la fois** (index unique partiel). Le doc 06
-- exige que « les actions sensibles soient idempotentes » : un adolescent qui
-- appuie trois fois parce que rien ne bouge ne doit pas fabriquer trois
-- dossiers, ni apparaître comme insistant auprès de celui qu'il appelle.

create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  -- L'affectation ancre la demande dans la relation qui la rend légitime, et
  -- porte sa disparition : `cascade` (voir `supprimer_mon_compte()` plus bas).
  assignment_id uuid not null references public.mentor_assignments(id) on delete cascade,
  -- Dénormalisés exprès : les politiques comparent `auth.uid()` à une colonne
  -- de CETTE table, sans jamais relire `mentor_assignments` sous RLS. C'est la
  -- leçon du #50 — une politique qui lit une table dont la politique lit la
  -- première, la base lève `infinite recursion detected`.
  requester_id uuid not null references auth.users(id) on delete cascade,
  mentor_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('parcours', 'pratique', 'moral', 'spirituel', 'autre')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  acknowledged_at timestamptz,
  check (requester_id <> mentor_id)
);

comment on table public.help_requests is
  'Un participant fait signe à son mentor — issue #16. Une catégorie close, aucun mot libre : le lecteur est un bénévole de la communauté du jeune, pas un modérateur formé, et un canal de texte libre hors de la conversation de tandem échapperait au blocage et au signalement. Pas de ligne sans mentor destinataire : une demande que personne ne reçoit est une promesse vide, et l''écran oriente à la place.';

comment on column public.help_requests.category is
  'Cinq réponses closes, dans la langue du schéma (français, comme tandem_reports.category). Ce n''est pas une échelle et l''ordre n''a pas de sens. « moral » est offert au même rang que les autres, et l''écran affiche les numéros du doc 22 AVANT l''envoi lorsqu''il est choisi — parce que ce produit ne surveille pas la nuit.';

comment on column public.help_requests.status is
  'open → acknowledged (le mentor a vu) → closed (le demandeur clôt). Le mentor ne clôt pas : ce n''est pas à celui qu''on appelle de décider que l''appel est terminé.';

create unique index if not exists help_requests_une_seule_ouverte_idx
  on public.help_requests (requester_id, mentor_id)
  where status = 'open';

create index if not exists help_requests_mentor_idx
  on public.help_requests (mentor_id, status, created_at desc);

alter table public.help_requests enable row level security;

-- Le demandeur lit ce qu'il a envoyé — sans quoi son écran ne pourrait pas lui
-- dire qu'il a déjà appelé, et il rappellerait dans le vide.
drop policy if exists "help_requests_requester_read" on public.help_requests;
create policy "help_requests_requester_read"
  on public.help_requests for select
  to authenticated
  using (requester_id = (select auth.uid()));

-- Le mentor destinataire lit les siennes. **Sans conjonct de vérification** :
-- la garde est à l'insertion, et une demande déjà reçue ne doit pas disparaître
-- des yeux de celui qui la traite parce que sa formation a expiré entre-temps.
-- Ce qui est fermé, c'est la porte d'entrée, pas la mémoire d'un appel.
drop policy if exists "help_requests_mentor_read" on public.help_requests;
create policy "help_requests_mentor_read"
  on public.help_requests for select
  to authenticated
  using (mentor_id = (select auth.uid()));

-- Trois conjoncts : c'est bien moi qui demande, ce n'est pas moi qui reçois, et
-- la relation existe et est vérifiée. Le troisième porte tout le poids.
drop policy if exists "help_requests_participant_insert" on public.help_requests;
create policy "help_requests_participant_insert"
  on public.help_requests for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and public.tandem_accompagnement_actif(mentor_id, requester_id)
    and exists (
      select 1 from public.mentor_assignments a
      where a.id = help_requests.assignment_id
        and a.mentor_id = help_requests.mentor_id
        and a.participant_id = help_requests.requester_id
    )
  );

-- Les transitions : **l'état d'origine est dans le `using`, le nouveau dans le
-- `with check`.** C'est la leçon du #49, et elle vaut d'être répétée ici parce
-- que `mentor_assignments_transitions` (#17) est le contre-exemple du dépôt —
-- tout y est dans le `with check`, donc l'état d'origine n'y est jamais
-- vérifié. Un `with check` seul autoriserait un mentor à repasser une demande
-- close en « acknowledged », c'est-à-dire à rouvrir un appel que le jeune avait
-- clos.
--
-- Deux politiques UPDATE plutôt qu'une disjonction, parce que les deux `using`
-- diffèrent et qu'une disjonction les mélangerait : PostgreSQL évalue l'union
-- des politiques permissives, et le `using` de l'une couvrirait le
-- `with check` de l'autre.
drop policy if exists "help_requests_mentor_acknowledge" on public.help_requests;
create policy "help_requests_mentor_acknowledge"
  on public.help_requests for update
  to authenticated
  using (mentor_id = (select auth.uid()) and status = 'open')
  with check (mentor_id = (select auth.uid()) and status = 'acknowledged');

drop policy if exists "help_requests_requester_close" on public.help_requests;
create policy "help_requests_requester_close"
  on public.help_requests for update
  to authenticated
  using (requester_id = (select auth.uid()) and status in ('open', 'acknowledged'))
  with check (requester_id = (select auth.uid()) and status = 'closed');

-- `acknowledged_at` n'est pas accordé : il est posé par le déclencheur
-- ci-dessous. Un horodatage que le client peut écrire est un horodatage qui ne
-- prouve rien.
grant select on public.help_requests to authenticated;
grant insert (assignment_id, requester_id, mentor_id, category) on public.help_requests to authenticated;
grant update (status) on public.help_requests to authenticated;

create or replace function public.tandem_marquer_prise_en_compte()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'acknowledged' and old.status <> 'acknowledged' then
    new.acknowledged_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

comment on function public.tandem_marquer_prise_en_compte() is
  'Pose acknowledged_at quand une demande d''aide passe à « acknowledged ». Le client n''a pas le grant sur cette colonne : un horodatage que l''appelant peut écrire ne prouve rien.';

drop trigger if exists help_requests_acknowledged_at on public.help_requests;
create trigger help_requests_acknowledged_at
  before update on public.help_requests
  for each row
  execute function public.tandem_marquer_prise_en_compte();

-- ===========================================================================
-- Les encouragements
-- ===========================================================================
--
-- Le mentor n'a **aucun** canal vers le participant : les messages sont
-- tandem-only, et le #17 a refusé de relier une affectation à un tandem. L'issue
-- demande pourtant « une action d'encouragement ». La plus petite forme qui
-- compte, donc — et « la plus petite » est ici une garantie, pas une économie.
--
-- **Des mots choisis parmi une liste close**, comme les cinq états du bilan
-- (#49). La table ne porte qu'une **clé** ; le texte vit dans
-- `packages/content/copy`, en français et en anglais, relu, et modifiable sans
-- migration. Trois conséquences, et chacune est une raison :
--
--   1. aucun contenu écrit par un adulte n'atteint un mineur hors d'un canal
--      signalable. Un champ de texte libre mentor → participant aurait été une
--      messagerie privée sans blocage, sans signalement et sans historique
--      partagé — c'est-à-dire précisément le canal que le doc 06 n'autorise que
--      « dans le tandem proposé par l'église et accepté par le jeune » ;
--   2. la base ne stocke aucune donnée sensible : une clé n'est pas une phrase ;
--   3. rien à traduire au moment de l'affichage — le participant lit dans SA
--      langue un encouragement envoyé dans une autre.
--
-- Les clés sont choisies pour n'en conditionner aucune à un résultat : aucune
-- ne félicite d'une performance, aucune ne reproche un silence. Le
-- vocabulaire du #49 — « aucun wording de honte », « jamais un écart chiffré »
-- — vaut face au mentor comme face à soi.
--
-- **Un par jour et par accompagnement** (contrainte d'unicité). Un canal à sens
-- unique, sans réponse possible, devient du harcèlement à la trentième ligne.
-- La violation de cette contrainte est un **refus réussi**, pas une panne :
-- l'écran lit sa réponse et dit « déjà envoyé aujourd'hui ».

create table if not exists public.mentor_encouragements (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mentor_assignments(id) on delete cascade,
  mentor_id uuid not null references auth.users(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  message_key text not null check (message_key in (
    'je_pense_a_toi',
    'je_prie_pour_toi',
    'prends_ton_temps',
    'fais_moi_signe',
    'content_de_cheminer_avec_toi',
    'on_reprend_quand_tu_veux'
  )),
  -- Posé par défaut et **hors du `grant insert`** : le client ne choisit pas le
  -- jour, sans quoi la contrainte quotidienne se contournerait en le datant
  -- d'hier. Motif du #17 (`mentor_assignments.status` hors du grant).
  jour date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  check (mentor_id <> participant_id)
);

comment on table public.mentor_encouragements is
  'Un mot d''encouragement du mentor vers le participant — issue #16. Une clé parmi six, jamais du texte libre : c''est ce qui empêche ce canal à sens unique de devenir une messagerie privée adulte → mineur hors de tout blocage et de tout signalement. Le texte vit dans packages/content/copy, dans les deux langues, et le participant le lit dans la sienne.';

comment on column public.mentor_encouragements.message_key is
  'Six mots clos. Aucun ne félicite d''un résultat, aucun ne reproche un silence : « aucun wording de honte » (#49) vaut face au mentor comme face à soi. Ajouter une clé ici demande de l''ajouter aussi dans packages/domain/src/mentor.ts et dans les deux catalogues de copy — le test de parité le mesure.';

comment on column public.mentor_encouragements.jour is
  'Un encouragement par jour et par accompagnement. Hors du grant insert : le client ne date pas son propre geste, sinon la contrainte se contourne en écrivant hier.';

create unique index if not exists mentor_encouragements_un_par_jour_idx
  on public.mentor_encouragements (assignment_id, jour);

create index if not exists mentor_encouragements_participant_idx
  on public.mentor_encouragements (participant_id, created_at desc);

alter table public.mentor_encouragements enable row level security;

drop policy if exists "encouragements_participant_read" on public.mentor_encouragements;
create policy "encouragements_participant_read"
  on public.mentor_encouragements for select
  to authenticated
  using (participant_id = (select auth.uid()));

-- Le mentor relit ce qu'il a envoyé — pour ne pas répéter le même mot trois
-- semaines de suite, ce qu'aucune contrainte ne peut empêcher.
drop policy if exists "encouragements_mentor_read" on public.mentor_encouragements;
create policy "encouragements_mentor_read"
  on public.mentor_encouragements for select
  to authenticated
  using (mentor_id = (select auth.uid()));

drop policy if exists "encouragements_mentor_insert" on public.mentor_encouragements;
create policy "encouragements_mentor_insert"
  on public.mentor_encouragements for insert
  to authenticated
  with check (
    mentor_id = (select auth.uid())
    and public.tandem_accompagnement_actif(mentor_id, participant_id)
    and exists (
      select 1 from public.mentor_assignments a
      where a.id = mentor_encouragements.assignment_id
        and a.mentor_id = mentor_encouragements.mentor_id
        and a.participant_id = mentor_encouragements.participant_id
    )
  );

-- Marquer comme lu. `using` et `with check` portent la même identité : ici il
-- n'y a pas de transition d'état à garder, seulement une colonne à poser.
drop policy if exists "encouragements_participant_read_at" on public.mentor_encouragements;
create policy "encouragements_participant_read_at"
  on public.mentor_encouragements for update
  to authenticated
  using (participant_id = (select auth.uid()))
  with check (participant_id = (select auth.uid()));

-- Le participant peut effacer un encouragement reçu, et le mentor ne le peut
-- pas. Le doc 06 : « possibilité de quitter une relation sans justification
-- publique ». Ce qui arrive chez quelqu'un lui appartient ; ce que le mentor a
-- envoyé ne lui appartient plus.
drop policy if exists "encouragements_participant_delete" on public.mentor_encouragements;
create policy "encouragements_participant_delete"
  on public.mentor_encouragements for delete
  to authenticated
  using (participant_id = (select auth.uid()));

grant select on public.mentor_encouragements to authenticated;
grant insert (assignment_id, mentor_id, participant_id, message_key) on public.mentor_encouragements to authenticated;
grant update (read_at) on public.mentor_encouragements to authenticated;
grant delete on public.mentor_encouragements to authenticated;

-- ===========================================================================
-- Le tableau de suivi : une fonction, quatre mots, aucune date
-- ===========================================================================
--
-- Le chemin du nom d'abord. `profiles` est own-only depuis le 4 août, et le
-- seul chemin vers le nom d'autrui est `tandem_partenaire()` (le binôme). Il en
-- fallait un second, et le raisonnement du #17 (décision 7) se rejoue mot pour
-- mot : **pas de politique SELECT sur `profiles`** — elle ouvrirait toutes les
-- colonnes, aujourd'hui et à chaque colonne ajoutée plus tard, et personne ne
-- s'en souviendrait — mais une fonction qui énumère ce qui sort.
--
-- **Sans paramètre**, donc jamais un annuaire : elle répond « les personnes que
-- j'accompagne », et rien d'autre ne peut lui être demandé.
--
-- **Seulement les affectations `active`.** Une affectation `pending` est une
-- proposition que le jeune n'a pas encore acceptée ; en rendre le nom
-- donnerait au mentor l'identité de quelqu'un qui n'a pas dit oui — et la
-- décision 5 du #17 tient précisément à ce que ce oui existe. Le mentor voit
-- ses propositions en attente par `mentor_assignments_member_read` (des uuid et
-- un statut, depuis le 4 août) : l'écran peut donc dire « une proposition
-- attend une réponse » sans nommer personne. **Le nom naît de l'acceptation.**
--
-- ---------------------------------------------------------------------------
-- Les quatre signaux, et le seuil
-- ---------------------------------------------------------------------------
--
-- Par ordre de précédence, parce qu'une personne n'a qu'un mot :
--
--   `aide_demandee` — une demande d'aide est ouverte ou prise en compte. Elle
--     passe avant tout : c'est le seul des quatre que la personne a posé
--     elle-même.
--   `nouveau` — aucune activité connue, et l'affectation a moins de 14 jours.
--     Sans ce mot, quelqu'un qui vient d'accepter serait « à relancer » dès le
--     premier jour, sur la foi d'une absence qui n'a pas encore eu le temps
--     d'exister.
--   `actif` — une activité dans les 14 derniers jours.
--   `a_relancer` — le reste.
--
-- **Quatorze jours, et pas douze.** `packages/domain/src/bilan.ts` porte
-- `ABSENCE_SEUIL_JOURS = 12`, et deux nombres voisins pour la même idée seraient
-- une dérive. Ce n'est pas la même idée, et voici la phrase : les douze jours du
-- bilan déclenchent un message que l'application adresse à la personne
-- elle-même — « content de te revoir », sans compter ce qui a manqué — tandis
-- que les quatorze jours d'ici déclenchent la sollicitation d'un tiers.
-- L'horloge du mentor doit partir **après** celle de l'application, jamais en
-- même temps : sinon un même silence produit deux relances le même jour, et la
-- seconde vient d'un adulte. Quatorze est le premier compte rond de semaines
-- strictement postérieur à douze.
--
-- **Ce que la fonction ne rend pas**, et qui a été écrit puis retiré : la date
-- de la dernière activité, le nombre de séances, le nombre de bilans, l'état de
-- la dernière semaine. Chacun aurait rendu le tableau plus « utile » et aurait
-- fabriqué la comparaison — donc le classement que l'issue interdit. Le tri
-- lui-même est **alphabétique**, jamais par signal : un tableau trié par signal
-- est un classement, quel que soit le nom qu'on lui donne, et le premier de la
-- liste est toujours le dernier de quelque chose.
--
-- La date d'entrée en accompagnement (`depuis_le`) sort, elle : c'est la date
-- d'un acte de l'église, pas une observation du jeune.

create or replace function public.tandem_mes_accompagnements()
returns table (
  assignment_id uuid,
  participant_id uuid,
  nom text,
  depuis_le timestamptz,
  signal text,
  aide_ouverte_id uuid,
  aide_categorie text,
  aide_demandee_le timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with moi as (
    -- Repli fermé : sans identité, ou sans vérification, la table est vide.
    -- Le `join` sur `mentor_profiles` est la garde de vérification, et il est
    -- ici plutôt que dans un `where` pour qu'il ne puisse pas être retiré sans
    -- que la requête cesse de compiler autour de lui.
    select mp.user_id
    from public.mentor_profiles mp
    where mp.user_id = auth.uid()
      and auth.uid() is not null
      and mp.verification_status = 'verified'
      and mp.training_status = 'completed'
  ),
  accompagnements as (
    select a.id, a.participant_id, a.created_at
    from public.mentor_assignments a
    join moi on moi.user_id = a.mentor_id
    where a.status = 'active'
  ),
  -- La demande d'aide en cours, s'il y en a une. `open` et `acknowledged`
  -- comptent toutes deux : une demande vue mais non close reste un appel.
  aide as (
    select distinct on (h.requester_id)
           h.requester_id, h.id, h.category, h.created_at
    from public.help_requests h
    join accompagnements c on c.participant_id = h.requester_id
    where h.mentor_id = (select user_id from moi)
      and h.status in ('open', 'acknowledged')
    order by h.requester_id, h.created_at desc
  ),
  -- Le seul endroit du schéma où une ligne de `session_progress` et une ligne
  -- de `weekly_checkins` sont lues pour quelqu'un d'autre. Elles ne sortent
  -- pas : `greatest(...)` est consommé trois lignes plus bas et devient un mot.
  activite as (
    select c.participant_id,
           greatest(
             coalesce((select max(sp.completed_at) from public.session_progress sp
                        where sp.user_id = c.participant_id), '-infinity'::timestamptz),
             coalesce((select max(w.updated_at) from public.weekly_checkins w
                        where w.user_id = c.participant_id), '-infinity'::timestamptz)
           ) as derniere
    from accompagnements c
  )
  select c.id,
         c.participant_id,
         coalesce(p.display_name, ''),
         c.created_at,
         case
           when aide.id is not null then 'aide_demandee'
           when act.derniere >= timezone('utc', now()) - interval '14 days' then 'actif'
           when act.derniere = '-infinity'::timestamptz
                and c.created_at >= timezone('utc', now()) - interval '14 days' then 'nouveau'
           else 'a_relancer'
         end,
         aide.id,
         aide.category,
         aide.created_at
  from accompagnements c
  left join public.profiles p on p.id = c.participant_id
  left join aide on aide.requester_id = c.participant_id
  join activite act on act.participant_id = c.participant_id
  -- Alphabétique, jamais par signal. Voir plus haut : trier par signal, c'est
  -- classer. `participant_id` départage deux homonymes de façon stable.
  order by coalesce(p.display_name, ''), c.participant_id
$$;

comment on function public.tandem_mes_accompagnements() is
  'Le tableau de suivi du mentor — issue #16. Rend, pour chaque affectation « active » de l''appelant, le nom du participant et UN MOT parmi actif / a_relancer / nouveau / aide_demandee. Aucune date d''activité, aucun compte de séances, aucun état de semaine : les lignes de session_progress et weekly_checkins sont lues DANS la fonction et n''en sortent jamais. Tri alphabétique, jamais par signal — trier par signal, c''est classer. Vide si l''appelant n''est pas un mentor vérifié et formé.';

revoke all on function public.tandem_mes_accompagnements() from public;
revoke all on function public.tandem_mes_accompagnements() from anon;
grant execute on function public.tandem_mes_accompagnements() to authenticated;

-- ===========================================================================
-- Le pendant côté participant : qui m'accompagne
-- ===========================================================================
--
-- Sans cet écran, rien de ce qui précède ne s'atteint depuis l'application.
-- La décision 5 du #17 réserve l'écriture de `active` au participant ; aucun
-- écran ne la lui offrait, donc **aucune affectation n'atteignait jamais
-- `active`** et le tableau de suivi serait resté vide en permanence.
--
-- Le participant lit déjà ses affectations (`mentor_assignments_member_read`,
-- 4 août) — mais des uuid. Il lui faut le nom de l'adulte qu'on lui propose,
-- avant d'accepter : accepter un identifiant hexadécimal n'est pas un
-- consentement. Même motif de fonction, même absence de paramètre.
--
-- Elle rend **`pending` et `active`** — contrairement à sa jumelle, qui ne rend
-- que `active`. L'asymétrie est le sujet : le jeune doit voir la proposition
-- pour y répondre ; le mentor n'a pas à connaître le nom de quelqu'un qui n'a
-- pas encore répondu. `paused` et `ended` ne sortent pas — il n'y a rien à y
-- faire, et une relation terminée n'a pas à rester affichée.
--
-- Elle ne porte **aucune garde de vérification**, et c'est délibéré : le jeune
-- a le droit de savoir qui son église lui propose, et dans quel état est la
-- vérification de cette personne. C'est même l'information qui lui manque le
-- plus pour décider. Le statut de vérification sort donc ici — vers le jeune,
-- au sujet de l'adulte — alors qu'il ne sort jamais dans l'autre sens.

create or replace function public.tandem_mon_accompagnement()
returns table (
  assignment_id uuid,
  mentor_id uuid,
  nom text,
  statut text,
  verification text,
  formation text,
  propose_le timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id,
         a.mentor_id,
         coalesce(p.display_name, ''),
         a.status,
         coalesce(mp.verification_status, 'pending'),
         coalesce(mp.training_status, 'required'),
         a.created_at
  from public.mentor_assignments a
  left join public.profiles p on p.id = a.mentor_id
  left join public.mentor_profiles mp on mp.user_id = a.mentor_id
  where a.participant_id = auth.uid()
    and auth.uid() is not null
    and a.status in ('pending', 'active')
  order by a.created_at desc
$$;

comment on function public.tandem_mon_accompagnement() is
  'Ce que le participant voit de son accompagnement — issue #16 : le nom du mentor proposé, l''état de sa vérification et de sa formation, le statut de l''affectation. Rend « pending » et « active » ; le mentor, lui, ne voit le nom que des affectations acceptées. L''asymétrie est le sujet : accepter un identifiant hexadécimal n''est pas un consentement.';

revoke all on function public.tandem_mon_accompagnement() from public;
revoke all on function public.tandem_mon_accompagnement() from anon;
grant execute on function public.tandem_mon_accompagnement() to authenticated;

-- ===========================================================================
-- La suppression de compte
-- ===========================================================================
--
-- Recopiée en entier, corps et commentaires compris. Deux lignes diffèrent de
-- la version du #17, toutes deux annotées sur place.
--
-- Ce qu'il faut lire correctement, parce qu'un commentaire qui se trompe de
-- mécanisme est pire qu'un commentaire absent : `help_requests.assignment_id`
-- et `mentor_encouragements.assignment_id` référencent `mentor_assignments` en
-- `on delete cascade`. Le `delete from public.mentor_assignments` déjà présent
-- **emporterait donc les deux tables tout seul** — à la différence de la
-- cascade vers `auth.users`, qui, elle, ne sert jamais (cette fonction ne
-- supprime pas la ligne `auth.users`, elle la neutralise).
--
-- Les deux `delete` explicites sont écrits quand même, et placés AVANT celui
-- des affectations. Non par redondance décorative : ils disent ce qui s'en va,
-- là où la cascade le tait, et ils tiennent encore le jour où quelqu'un
-- dénormaliserait `assignment_id` ou le rendrait nullable. Les tests mesurent
-- le résultat, pas le chemin.

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
  -- Ajout du 26/08/2026 (issue #16), dans les deux sens : ce qu'elle a demandé,
  -- et ce qu'on lui a demandé. Voir l'en-tête — la cascade depuis
  -- `mentor_assignments` juste en dessous ferait le travail ; ces deux lignes
  -- le disent.
  delete from public.help_requests where requester_id = v_uid or mentor_id = v_uid;
  delete from public.mentor_encouragements where mentor_id = v_uid or participant_id = v_uid;
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
  'Suppression réelle du compte de l''appelant. Sans paramètre — elle lit auth.uid() — parce qu''il n''y a personne d''autre à supprimer. Efface les données personnelles (dont les appartenances de communauté, les liens d''invitation émis, les demandes d''aide et les encouragements dans les deux sens, le consentement à la mesure et les bilans hebdomadaires), neutralise auth.users et les sessions, garde les messages laissés chez autrui, les signalements et l''audit. Ne termine pas un tandem bloqué : le blocage survit à son auteur. N''efface aucun événement de mesure : aucun ne désigne ce compte.';

revoke all on function public.supprimer_mon_compte() from public;
revoke all on function public.supprimer_mon_compte() from anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ===========================================================================
-- Ce que ce fichier n'ouvre pas
-- ===========================================================================
--
-- Aucune politique n'est ajoutée sur `journal_entries`, `tandem_messages`,
-- `weekly_checkins`, `session_progress` ni `journal_shares`. Les deux
-- dernières sont **lues** par `tandem_mes_accompagnements()`, hors RLS, et rien
-- n'en sort qu'un mot parmi quatre. Les suites `journal-prive`,
-- `conversations-privees`, `partage-journal` et `bilan-hebdomadaire` montent
-- déjà, chacune, un mentor vérifié et affecté qui ne lit rien : elles restent
-- vertes sans être amendées, et c'est la mesure la plus utile de ce fichier.
--
-- Aucun lien n'est créé entre une affectation et un tandem. L'écart nommé par
-- le #17 (décision 6) reste ouvert, et ce chantier confirme qu'il n'en avait
-- pas besoin : le mentor ne passe jamais par la conversation, il a son propre
-- canal, minuscule et à sens unique.
--
-- Aucune statistique agrégée pour le responsable. Le doc 06 la lui accorde
-- (« non, statistique agrégée uniquement »), et rien ici ne la calcule : ce
-- serait un second lecteur, un second seuil, une seconde surface. Écart nommé,
-- à rouvrir quand un pilote le demandera.
--
-- Aucun événement de mesure n'est émis par cette migration. `help_requested`
-- (`source_role`, `category`) est déjà dans le catalogue verrouillé du doc 08 et
-- reste inutilisé jusqu'ici ; c'est l'application qui l'émet, au moment du
-- geste, par `apps/web/src/mesure.ts`.
