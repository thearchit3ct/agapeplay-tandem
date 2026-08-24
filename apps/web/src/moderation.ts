/**
 * Les six requêtes de l'espace modérateur, et pas une de plus.
 *
 * Elles sont ici plutôt que dans le composant pour une raison précise : chacune
 * épouse une politique du schéma, et la façon dont elle est écrite *est* la
 * garde. Une colonne de trop dans un `select`, une table de repli interrogée
 * « au cas où », et l'écran rendrait un vide muet qu'on prendrait pour un bug.
 * Les commentaires disent donc à chaque fois quelle politique sert, et ce qui
 * arrive si on s'en écarte.
 *
 * Rien ici n'a besoin d'une migration : le portail
 * (`tandem_est_moderateur()`), la liste (`reports_select_moderator`), le
 * contexte (`tandem_contexte_signale`), le message
 * (`messages_select_moderator_reported`), l'écriture
 * (`grant update (status)` + `reports_update_moderator`) et le journal
 * (`report_audit_select_moderator`) sont déjà servis à `authenticated`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { assemblerDossiers } from '@agapeplay/domain'
import type { CategorieSignalement, DossierModeration, StatutSignalement, TandemStatus, UrgenceSignalement } from '@agapeplay/domain'

/** Une ligne de `tandem_report_audit`, telle que la modération la lit. */
export type LigneJournal = {
  id: string
  /** `auth.uid()` du modérateur au moment de la décision. NULL si écrit hors session. */
  moderatorId: string | null
  fromStatus: StatutSignalement
  toStatus: StatutSignalement
  changedAt: string
}

/**
 * Le compte connecté modère-t-il ?
 *
 * `tandem_est_moderateur()` est sans paramètre — elle lit `auth.uid()` — et
 * c'est délibéré : une variante `tandem_est_moderateur(uuid)` ferait de
 * n'importe quel compte un énumérateur de modérateurs, ce que l'absence de
 * `grant` sur `tandem_moderators` visait à empêcher. On ne peut donc poser la
 * question que sur soi, ce qui est exactement ce dont l'écran a besoin.
 *
 * Ce test ne *protège* rien : c'est un portail d'affichage. Chaque politique
 * en dessous rappelle la même fonction, si bien qu'un compte qui forcerait
 * l'onglet lirait une liste vide et verrait ses décisions refusées. Il évite de
 * proposer une porte qui ne s'ouvrirait pas — la même règle que le bouton de
 * déblocage.
 *
 * Une erreur vaut « non » : mieux vaut un onglet absent qu'un onglet mort.
 */
export const estModerateur = async (client: SupabaseClient): Promise<boolean> => {
  const { data, error } = await client.rpc('tandem_est_moderateur')
  return !error && data === true
}

type LigneSignalement = {
  id: string
  tandem_id: string
  message_id: string | null
  reporter_id: string
  reason: string | null
  category: CategorieSignalement
  urgency: UrgenceSignalement
  status: StatutSignalement
  created_at: string
  resolved_at: string | null
}

type LigneContexte = {
  tandem_id: string
  status: TandemStatus
  created_at: string
  blocked_at: string | null
  ended_at: string | null
}

type LigneMessage = { id: string; sender_id: string; body: string; created_at: string }

/**
 * Les dossiers, assemblés en trois lectures.
 *
 * L'ordre compte : les signalements d'abord, puisqu'eux seuls disent quels
 * messages aller chercher. Sans `message_id`, aucun repli n'est possible —
 * demander les messages par `tandem_id` ne rendrait rien, aucune politique
 * n'ouvrant les autres messages d'une conversation signalée. C'est la borne du
 * schéma, pas un manque à combler : `assemblerDossiers` rend `null` et l'écran
 * le dit.
 *
 * Le contexte passe par la vue, jamais par `tandems` : un modérateur qui
 * interrogerait la table directement obtiendrait zéro ligne **sans erreur**
 * (`tandems_select_member` ne le reconnaît pas), et on chercherait longtemps un
 * bug qui n'en est pas un.
 */
export const chargerDossiers = async (
  client: SupabaseClient,
): Promise<{ dossiers: DossierModeration[]; erreur: boolean }> => {
  const echec = { dossiers: [], erreur: true }

  const [signalements, contextes] = await Promise.all([
    client
      .from('tandem_reports')
      // `urgency` est relue, jamais recalculée : la colonne générée de
      // `20260825173000` est la seule autorité, et `urgenceDe` n'existe que
      // pour l'écran de signalement, avant que la ligne existe.
      .select('id, tandem_id, message_id, reporter_id, reason, category, urgency, status, created_at, resolved_at')
      .order('created_at', { ascending: false }),
    client
      .from('tandem_contexte_signale')
      .select('tandem_id, status, created_at, blocked_at, ended_at'),
  ])
  if (signalements.error || contextes.error) return echec

  const lignes = (signalements.data ?? []) as LigneSignalement[]
  const identifiants = [...new Set(lignes.map((ligne) => ligne.message_id).filter((id): id is string => Boolean(id)))]

  // `in()` sur une liste vide produit une requête qui ne rend rien mais part
  // quand même. Aucun message signalé, aucune requête.
  let messages: LigneMessage[] = []
  if (identifiants.length > 0) {
    const resultat = await client
      .from('tandem_messages')
      .select('id, sender_id, body, created_at')
      .in('id', identifiants)
    if (resultat.error) return echec
    messages = (resultat.data ?? []) as LigneMessage[]
  }

  return {
    erreur: false,
    dossiers: assemblerDossiers(
      lignes.map((ligne) => ({
        id: ligne.id,
        tandemId: ligne.tandem_id,
        messageId: ligne.message_id,
        reporterId: ligne.reporter_id,
        reason: ligne.reason,
        categorie: ligne.category,
        urgence: ligne.urgency,
        status: ligne.status,
        createdAt: ligne.created_at,
        resolvedAt: ligne.resolved_at,
      })),
      ((contextes.data ?? []) as LigneContexte[]).map((ligne) => ({
        tandemId: ligne.tandem_id,
        status: ligne.status,
        createdAt: ligne.created_at,
        blockedAt: ligne.blocked_at,
        endedAt: ligne.ended_at,
      })),
      messages.map((ligne) => ({
        id: ligne.id,
        senderId: ligne.sender_id,
        body: ligne.body,
        createdAt: ligne.created_at,
      })),
    ),
  }
}

/**
 * Le journal des décisions d'un dossier.
 *
 * Chargé à l'ouverture d'un dossier, et non avec la liste : un journal se lit
 * quand on regarde le dossier, et la lecture n'a de toute façon aucun effet —
 * consulter ne laisse pas de trace, seules les décisions en laissent (écart
 * assumé, doc 21).
 */
export const chargerJournal = async (
  client: SupabaseClient,
  signalementId: string,
): Promise<LigneJournal[] | null> => {
  const { data, error } = await client
    .from('tandem_report_audit')
    .select('id, moderator_id, from_status, to_status, changed_at')
    .eq('report_id', signalementId)
    .order('changed_at', { ascending: false })
  if (error) return null
  return (data ?? []).map((ligne) => ({
    id: ligne.id as string,
    moderatorId: ligne.moderator_id as string | null,
    fromStatus: ligne.from_status as StatutSignalement,
    toStatus: ligne.to_status as StatutSignalement,
    changedAt: ligne.changed_at as string,
  }))
}

/**
 * La décision : un seul champ écrit, et une réponse qu'on lit vraiment.
 *
 * **`status` seul dans la charge utile, jamais autre chose.** Le droit
 * d'écriture est un `grant update (status)` : PostgreSQL refuse tout UPDATE qui
 * *nomme* une autre colonne, y compris mélangée à celle-ci, avec un
 * « permission denied for table ». Ajouter `resolved_at` ici — même à la bonne
 * valeur — casserait donc toutes les décisions. Depuis le 25/08/2026 la même
 * borne protège `category` : un modérateur ne réécrit pas ce que la personne a
 * choisi, exactement comme il ne réécrit pas son mot libre. La date de clôture est posée
 * par le trigger `before update`, et c'est ce qui en fait une date plutôt
 * qu'une déclaration.
 *
 * **Le `select` de retour n'est pas cosmétique.** Un UPDATE que le `using` de
 * `reports_update_moderator` refuse ne lève rien : il touche zéro ligne, et
 * PostgREST rend `error: null`. Sans lire la ligne revenue, l'écran afficherait
 * « décision enregistrée » alors que rien n'aurait bougé — le cas se produit dès
 * qu'un rôle de modérateur est retiré entre le chargement de la page et le clic,
 * et le retrait est immédiat par conception. `null` en retour vaut donc échec,
 * au même titre qu'une erreur.
 */
export const changerStatut = async (
  client: SupabaseClient,
  signalementId: string,
  statut: StatutSignalement,
): Promise<{ status: StatutSignalement; resolvedAt: string | null } | null> => {
  const { data, error } = await client
    .from('tandem_reports')
    .update({ status: statut })
    .eq('id', signalementId)
    .select('id, status, resolved_at')
    .maybeSingle()
  if (error || !data) return null
  return { status: data.status as StatutSignalement, resolvedAt: (data.resolved_at as string | null) ?? null }
}
