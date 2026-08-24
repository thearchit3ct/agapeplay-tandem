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
 *   propres signalements, eux, sont bien là.
 */
export const SECTIONS: readonly SectionExport[] = [
  { clef: 'profil', table: 'profiles', colonnes: 'id, display_name, locale, account_status, created_at, updated_at, age_confirmed_at, privacy_consent_at, terms_consent_at, deletion_requested_at', colonne: 'id', cible: 'compte' },
  { clef: 'preferences_de_notification', table: 'notification_preferences', colonnes: 'sessions, messages, church, absence, updated_at', colonne: 'user_id', cible: 'compte' },
  { clef: 'progression', table: 'session_progress', colonnes: 'journey_id, session_id, completed_at', colonne: 'user_id', cible: 'compte' },
  { clef: 'journal', table: 'journal_entries', colonnes: 'id, text, mood, created_at', colonne: 'user_id', cible: 'compte' },
  { clef: 'tandems', table: 'tandems', colonnes: 'id, status, blocked_by, created_at, ended_at', colonne: 'participant_a_id', cible: 'compte' },
  { clef: 'messages_envoyes', table: 'tandem_messages', colonnes: 'id, tandem_id, body, created_at', colonne: 'sender_id', cible: 'compte' },
  { clef: 'invitations_emises', table: 'tandem_invitations', colonnes: 'id, invitee_email, status, created_at, expires_at, accepted_at', colonne: 'inviter_id', cible: 'compte' },
  { clef: 'invitations_recues', table: 'tandem_invitations', colonnes: 'id, status, created_at, expires_at, accepted_at', colonne: 'invitee_email', cible: 'adresse' },
  { clef: 'signalements_emis', table: 'tandem_reports', colonnes: 'id, tandem_id, message_id, reason, status, created_at, resolved_at', colonne: 'reporter_id', cible: 'compte' },
]

export type Ligne = Record<string, unknown>
export type Reponse = { data: Ligne[] | null; error: { message: string } | null }
export type Lecteur = (section: SectionExport) => Promise<Reponse>

export type ExportPersonnel = {
  genere_le: string
  compte: { id: string; email: string | null }
  limites: string[]
  donnees: Record<string, Ligne[]>
}

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

  return {
    genere_le: maintenant.toISOString(),
    compte,
    limites: limitesConnues(donnees, compte.id),
    donnees,
  }
}

/**
 * Ce que l'export ne peut pas contenir, écrit dans l'export lui-même.
 *
 * `messages_select_member` referme la lecture d'une conversation sur la
 * personne qui a été bloquée. Ses propres messages y deviennent illisibles pour
 * elle — la politique ne fait pas d'exception pour l'auteur — et le fichier
 * sortirait donc silencieusement amputé. Rien dans la réponse ne signale ce
 * manque : c'est une absence de lignes, pas une erreur. On le déduit du seul
 * indice disponible, la ligne du tandem, qui reste lisible.
 */
const limitesConnues = (donnees: Record<string, Ligne[]>, monId: string): string[] => {
  const bloquants = (donnees.tandems ?? []).filter((t) => t.status === 'blocked' && t.blocked_by !== monId)
  if (bloquants.length === 0) return []
  return [
    `Les messages de ${bloquants.length === 1 ? 'une relation' : `${bloquants.length} relations`} où quelqu’un t’a bloqué·e ne sont plus lisibles depuis ton compte : ils ne figurent pas dans ce fichier.`,
  ]
}

/**
 * Propose le fichier au téléchargement. Rien de plus : la construction du
 * contenu est ailleurs, et testée.
 */
export const telechargerJson = (nomFichier: string, contenu: unknown) => {
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  // Sans révocation, le blob reste en mémoire jusqu'au rechargement de la page.
  URL.revokeObjectURL(url)
}

export const nomDuFichierExport = (maintenant: Date = new Date()) =>
  `agapeplay-tandem-mes-donnees-${maintenant.toISOString().slice(0, 10)}.json`
