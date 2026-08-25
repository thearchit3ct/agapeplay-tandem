/**
 * L'export des données personnelles — issue #7, deuxième critère.
 *
 * Le doc 06 promet « suppression du compte et export des données accessibles
 * dans l'application ». Tout ce qui est exporté ici est déjà lisible par le
 * compte lui-même sous des politiques `own only` : l'export n'ouvre aucune
 * porte, il rassemble ce que la personne pouvait déjà lire écran par écran et
 * le lui rend d'un seul fichier. Aucun serveur n'est nécessaire, et il n'en est
 * donc pas ajouté.
 *
 * La forme importe : les lectures sont **déclarées en données** (`SECTIONS`) et
 * l'accès à la base est **injecté** (`lire`). Deux bénéfices concrets — on voit
 * d'un coup d'œil ce que l'export contient et ce qu'il oublie, et l'assemblage
 * s'éprouve sans base ni navigateur, ce qui est la seule façon de tester le cas
 * qui compte : une lecture qui échoue.
 *
 * Car le mode d'échec redouté n'est pas l'erreur, c'est le **fichier vide**.
 * Un export qui avale une erreur rend un JSON bien formé, plus court de
 * quelques lignes, et personne ne s'en aperçoit — surtout pas quelqu'un qui
 * télécharge ses données une seule fois, au moment de partir. Toute réponse
 * anormale interrompt donc l'export, et l'écran le dit.
 *
 * ---------------------------------------------------------------------------
 * Pourquoi ce fichier vit dans le domaine depuis le 26/08/2026
 * ---------------------------------------------------------------------------
 *
 * Il est né dans `apps/web/src/export.ts`. Le mobile a reçu le même geste
 * (issue #13), et deux listes de sections auraient divergé à la première table
 * ajoutée : le fichier téléchargé depuis un téléphone serait devenu plus court
 * que celui du navigateur, sans que rien ne le signale — exactement le mode
 * d'échec que ce module refuse. Rien ici ne dépend d'un navigateur : le seul
 * morceau qui en dépendait, la remise du fichier, est resté côté web (voir
 * `apps/web/src/export.ts`), et le mobile le remplace par la feuille de
 * partage native.
 */

/** Ce à quoi la ligne se rattache : l'identifiant du compte, ou son adresse. */
export type CibleExport = 'compte' | 'adresse'

export type SectionExport = {
  /** Nom de la section dans le fichier rendu. */
  clef: string
  table: string
  /** Colonnes lues, telles quelles pour PostgREST. */
  colonnes: string
  /** Colonne qui porte la cible. */
  colonne: string
  cible: CibleExport
}

/**
 * Ce que l'export contient, dans l'ordre où le fichier le présente.
 *
 * Ce qui n'y est **pas**, et pourquoi :
 *
 * - les messages reçus. Ils sont de son binôme ; l'export d'une personne n'est
 *   pas l'export de la conversation d'une autre. Seuls les messages envoyés,
 *   filtrés sur `sender_id`, sont ses mots à elle ;
 * - le contenu éditorial des parcours, public et identique pour tous ;
 * - les signalements posés sur elle. Elle n'y a aucun accès, par conception
 *   (`reports_select_reporter` borne la lecture à l'auteur du signalement), et
 *   les lui rendre ici transformerait l'export en fuite de modération. Ses
 *   propres signalements, eux, sont bien là ;
 * - les entrées de journal que son binôme lui a partagées. Même raisonnement
 *   que pour les messages reçus : ce sont les mots d'une autre personne,
 *   ouverts pour être lus dans une relation vivante, et non des données de
 *   celle qui exporte. Ses propres partages, eux, y sont — sous la forme de ce
 *   qu'ils sont vraiment, une décision (« telle entrée, à tel tandem, tel
 *   jour ») et non une copie du texte, qui figure déjà dans la section
 *   `journal`.
 */
export const SECTIONS: readonly SectionExport[] = [
  { clef: 'profil', table: 'profiles', colonnes: 'id, display_name, locale, account_status, created_at, updated_at, age_confirmed_at, privacy_consent_at, terms_consent_at, deletion_requested_at', colonne: 'id', cible: 'compte' },
  { clef: 'preferences_de_notification', table: 'notification_preferences', colonnes: 'sessions, messages, church, absence, weekly_checkin, updated_at', colonne: 'user_id', cible: 'compte' },
  // Le consentement à la mesure y figure depuis le 25/08/2026 : c'est un choix
  // de la personne, et le seul endroit où ce choix est écrit sous son nom. Les
  // ÉVÉNEMENTS de mesure, eux, n'y sont pas et ne peuvent pas y être — voir
  // `A_PROPOS_DE_LA_MESURE` plus bas.
  { clef: 'preference_de_mesure', table: 'mesure_preferences', colonnes: 'mesure, updated_at', colonne: 'user_id', cible: 'compte' },
  { clef: 'progression', table: 'session_progress', colonnes: 'journey_id, session_id, completed_at', colonne: 'user_id', cible: 'compte' },
  { clef: 'journal', table: 'journal_entries', colonnes: 'id, text, mood, created_at', colonne: 'user_id', cible: 'compte' },
  // Les bilans de fin de semaine, depuis le 25/08/2026 (issue #18). Une semaine
  // et un mot : c'est tout ce que la table porte, et tout ce qui sort ici. La
  // note écrite en marge d'un bilan n'a pas de ligne à elle — c'est une entrée
  // de journal, déjà présente dans la section au-dessus.
  { clef: 'bilans_hebdomadaires', table: 'weekly_checkins', colonnes: 'week_key, state, created_at, updated_at', colonne: 'user_id', cible: 'compte' },
  { clef: 'partages_du_journal', table: 'journal_shares', colonnes: 'entry_id, tandem_id, created_at', colonne: 'shared_by', cible: 'compte' },
  // La vie de communauté, depuis le 25/08/2026 (issue #17). Trois sections, et
  // une quatrième volontairement amputée :
  //
  // - `communaute` : son adhésion, son rôle, la date de son entrée ;
  // - `cohortes` : les groupes qu'elle a rejoints ;
  // - `accompagnements` : les affectations de mentor où elle figure, des deux
  //   côtés — mentor comme participant. Comme `tandems`, la table est lue deux
  //   fois (voir `SECTION_ACCOMPAGNEMENTS_MENTOR`) ;
  // - `liens_d_invitation_emis` : les liens qu'un responsable a émis, **sans
  //   leur jeton**. Le jeton est bien lisible par elle — c'est elle qui l'a
  //   créé — mais un fichier d'export circule : on l'envoie à un juriste, on le
  //   dépose sur un cloud, on l'oublie dans un dossier de téléchargements. Y
  //   écrire des jetons vivants ferait d'un fichier de transparence une clé
  //   d'entrée dans une communauté de mineurs. Le compte des entrées et la
  //   date de péremption suffisent à dire ce qu'elle a fait ; le jeton, lui,
  //   se relit dans l'application tant qu'il vit.
  { clef: 'communaute', table: 'church_members', colonnes: 'church_id, role, status, created_at', colonne: 'user_id', cible: 'compte' },
  { clef: 'cohortes', table: 'group_members', colonnes: 'group_id, created_at', colonne: 'user_id', cible: 'compte' },
  { clef: 'accompagnements', table: 'mentor_assignments', colonnes: 'id, church_id, group_id, mentor_id, participant_id, status, created_at', colonne: 'participant_id', cible: 'compte' },
  // Issue #16. Les deux gestes de l'espace mentor entrent ici du côté où la
  // personne les a posés ; le côté reçu est ajouté par les deux sections
  // miroir plus bas, comme pour les accompagnements. Aucune des deux tables ne
  // porte de texte libre : ce qui sort est une catégorie et une clé.
  { clef: 'demandes_d_aide_emises', table: 'help_requests', colonnes: 'id, assignment_id, mentor_id, category, status, created_at, acknowledged_at', colonne: 'requester_id', cible: 'compte' },
  { clef: 'encouragements_recus', table: 'mentor_encouragements', colonnes: 'id, assignment_id, mentor_id, message_key, jour, created_at', colonne: 'participant_id', cible: 'compte' },
  { clef: 'liens_d_invitation_emis', table: 'church_invitations', colonnes: 'church_id, group_id, status, uses, max_uses, expires_at, created_at', colonne: 'created_by', cible: 'compte' },
  { clef: 'tandems', table: 'tandems', colonnes: 'id, status, blocked_by, created_at, ended_at', colonne: 'participant_a_id', cible: 'compte' },
  { clef: 'messages_envoyes', table: 'tandem_messages', colonnes: 'id, tandem_id, body, created_at', colonne: 'sender_id', cible: 'compte' },
  { clef: 'invitations_emises', table: 'tandem_invitations', colonnes: 'id, invitee_email, status, created_at, expires_at, accepted_at', colonne: 'inviter_id', cible: 'compte' },
  { clef: 'invitations_recues', table: 'tandem_invitations', colonnes: 'id, status, created_at, expires_at, accepted_at', colonne: 'invitee_email', cible: 'adresse' },
  // `category` et `urgency` depuis le 25/08/2026 : ce que la personne a choisi
  // fait partie de ce qu'elle a écrit, et l'urgence qu'on en a déduite fait
  // partie de ce qu'on a fait de son signalement. Les taire rendrait l'export
  // moins fidèle que la table.
  { clef: 'signalements_emis', table: 'tandem_reports', colonnes: 'id, tandem_id, message_id, category, urgency, reason, status, created_at, resolved_at', colonne: 'reporter_id', cible: 'compte' },
]

export type Ligne = Record<string, unknown>
export type Reponse = { data: Ligne[] | null; error: { message: string } | null }
export type Lecteur = (section: SectionExport) => Promise<Reponse>

export type ExportPersonnel = {
  genere_le: string
  compte: { id: string; email: string | null }
  a_propos_de_la_mesure: string
  limites: string[]
  donnees: Record<string, Ligne[]>
}

/**
 * Pourquoi les événements de mesure ne sont pas dans ce fichier.
 *
 * La question se pose, et la réponse n'est pas « on a oublié » : c'est la
 * conséquence directe du dispositif. `analytics_events` ne porte aucune colonne
 * qui désigne un compte — l'identifiant qu'elle contient naît sur l'appareil et
 * n'est relié à personne. Il n'existe donc **aucun prédicat** capable de
 * sélectionner « les événements de cette personne », ni pour les exporter, ni
 * pour les supprimer, ni pour quiconque les chercherait.
 *
 * C'est écrit dans l'export lui-même plutôt que dans la seule documentation :
 * quelqu'un qui télécharge ses données une fois, au moment de partir, doit
 * pouvoir constater sur pièce que l'absence est un choix, pas un trou.
 */
export const A_PROPOS_DE_LA_MESURE =
  'Les événements de mesure du produit ne figurent pas dans ce fichier : ils ne sont reliés à aucun compte, pas même au tien. Rien ne permet de retrouver les tiens — c’est ce qui rend la mesure anonyme. Ton choix de participer ou non, lui, est dans « preference_de_mesure ».'

/**
 * Deux tandems m'appartiennent : celui où je suis A et celui où je suis B. La
 * table `tandems` est donc lue deux fois, une par colonne, et les deux
 * réponses fusionnées — PostgREST ne compose pas un `or` depuis cette forme
 * déclarative, et lui en ajouter une serait plus de machinerie que de valeur.
 */
const SECTION_TANDEMS_B: SectionExport = {
  clef: 'tandems', table: 'tandems',
  colonnes: 'id, status, blocked_by, created_at, ended_at',
  colonne: 'participant_b_id', cible: 'compte',
}

/**
 * Deux accompagnements m'appartiennent aussi : celui où je suis le participant
 * et celui où je suis le mentor. Même raison qu'au-dessus, même remède —
 * PostgREST ne compose pas un `or` depuis cette forme déclarative, et les deux
 * lectures fusionnent. Contrairement aux messages, aucune des deux n'est « les
 * données d'un tiers » : une affectation est un lien, elle appartient
 * pleinement aux deux personnes qu'elle nomme.
 */
const SECTION_ACCOMPAGNEMENTS_MENTOR: SectionExport = {
  clef: 'accompagnements', table: 'mentor_assignments',
  colonnes: 'id, church_id, group_id, mentor_id, participant_id, status, created_at',
  colonne: 'mentor_id', cible: 'compte',
}

/**
 * Les deux miroirs de l'espace mentor — issue #16, même motif que ci-dessus.
 *
 * Une demande d'aide et un encouragement nomment deux personnes, et
 * appartiennent aux deux : celui qui a appelé et celui qui a été appelé, celui
 * qui a écrit et celui qui a reçu. Les clefs distinguent les deux sens plutôt
 * que de les fondre, parce que « ce que j'ai demandé » et « ce qu'on m'a
 * demandé » ne se lisent pas de la même façon dans un fichier d'export.
 */
const SECTION_AIDES_RECUES: SectionExport = {
  clef: 'demandes_d_aide_recues', table: 'help_requests',
  colonnes: 'id, assignment_id, requester_id, category, status, created_at, acknowledged_at',
  colonne: 'mentor_id', cible: 'compte',
}

const SECTION_ENCOURAGEMENTS_EMIS: SectionExport = {
  clef: 'encouragements_emis', table: 'mentor_encouragements',
  colonnes: 'id, assignment_id, participant_id, message_key, jour, created_at',
  colonne: 'mentor_id', cible: 'compte',
}

const exiger = (section: SectionExport, reponse: Reponse): Ligne[] => {
  if (reponse.error) {
    throw new Error(`export interrompu : la lecture de « ${section.clef} » a échoué (${reponse.error.message})`)
  }
  // `data` nul sans erreur n'arrive pas en fonctionnement normal — PostgREST
  // rend un tableau vide sur une table sans ligne. Le traiter comme « rien à
  // exporter » serait exactement le fichier vide qu'on refuse : on lève.
  if (!reponse.data) {
    throw new Error(`export interrompu : la lecture de « ${section.clef} » n’a rien rendu, pas même une liste vide`)
  }
  return reponse.data
}

/**
 * Rassemble l'export. Lève à la première anomalie ; ne rend jamais un fichier
 * partiel sans le dire.
 */
export const rassemblerExport = async (
  lire: Lecteur,
  compte: { id: string; email: string | null },
  maintenant: Date = new Date(),
): Promise<ExportPersonnel> => {
  const donnees: Record<string, Ligne[]> = {}
  for (const section of SECTIONS) {
    donnees[section.clef] = exiger(section, await lire(section))
  }
  donnees.tandems = [...donnees.tandems, ...exiger(SECTION_TANDEMS_B, await lire(SECTION_TANDEMS_B))]
  donnees.accompagnements = [
    ...donnees.accompagnements,
    ...exiger(SECTION_ACCOMPAGNEMENTS_MENTOR, await lire(SECTION_ACCOMPAGNEMENTS_MENTOR)),
  ]
  // Les deux sens de l'espace mentor. Sous leur propre clef, et non fusionnés :
  // voir le commentaire des sections.
  donnees.demandes_d_aide_recues = exiger(SECTION_AIDES_RECUES, await lire(SECTION_AIDES_RECUES))
  donnees.encouragements_emis = exiger(SECTION_ENCOURAGEMENTS_EMIS, await lire(SECTION_ENCOURAGEMENTS_EMIS))

  return {
    genere_le: maintenant.toISOString(),
    compte,
    a_propos_de_la_mesure: A_PROPOS_DE_LA_MESURE,
    limites: limitesConnues(donnees, compte.id),
    donnees,
  }
}

/**
 * Ce que l'export ne peut pas contenir, écrit dans l'export lui-même.
 *
 * `messages_select_member` referme la lecture d'une conversation sur toute
 * personne qui n'est pas celle ayant posé le blocage. Ses propres messages y
 * deviennent illisibles pour elle — la politique ne fait pas d'exception pour
 * l'auteur — et le fichier sortirait donc silencieusement amputé. Rien dans la
 * réponse ne signale ce manque : c'est une absence de lignes, pas une erreur.
 * On le déduit du seul indice disponible, la ligne du tandem, qui reste
 * lisible.
 *
 * La phrase ne nomme personne, et c'est mesuré. Une ligne gelée d'avant la
 * migration `20260806012728` porte `status = 'blocked'` avec `blocked_by` NULL :
 * le schéma dit explicitement qu'il ne sait pas qui a bloqué. Elle entre bien
 * dans le compte — les messages sont réellement illisibles, pour les deux — mais
 * écrire « quelqu'un t'a bloqué·e » y serait une affirmation que la base ne
 * peut pas soutenir.
 */
const limitesConnues = (donnees: Record<string, Ligne[]>, monId: string): string[] => {
  const fermes = (donnees.tandems ?? []).filter((t) => t.status === 'blocked' && t.blocked_by !== monId)
  if (fermes.length === 0) return []
  return [
    `Les messages de ${fermes.length === 1 ? 'une relation bloquée' : `${fermes.length} relations bloquées`} ne sont plus lisibles depuis ton compte : ils ne figurent pas dans ce fichier.`,
  ]
}

export const nomDuFichierExport = (maintenant: Date = new Date()) =>
  `agapeplay-tandem-mes-donnees-${maintenant.toISOString().slice(0, 10)}.json`
