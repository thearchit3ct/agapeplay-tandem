/**
 * Le suivi des invitations.
 *
 * La scène, écrite avant l'écran comme le demande le doc 16 :
 *
 *   Personne : quelqu'un de 16-17 ans qui a invité un adulte de confiance il y
 *              a quelques jours, ou l'inverse.
 *   Moment   : l'autre n'a pas répondu. On revient voir, un peu gêné de
 *              relancer, et on ne sait plus si le lien est encore bon.
 *   Appareil : un téléphone, souvent dans un lieu partagé — 375 px, et rien à
 *              l'écran qu'on ne veuille pas voir lu par-dessus l'épaule.
 *   Besoin   : savoir où en est chaque invitation, et pouvoir en reprendre une
 *              qu'on regrette — parce qu'on s'est trompé d'adresse, ou parce
 *              qu'on a changé d'avis sur la personne.
 *   Risque   : croire qu'une invitation vit encore alors qu'elle a expiré ;
 *              cliquer sur « annuler » et voir l'écran échouer ; découvrir
 *              qu'on ne peut plus rien sur une relation qu'on a bloquée, sans
 *              qu'on nous dise pourquoi.
 *   Preuve   : la migration `20260806161500_invitation_bloquee` et la section
 *              « Écarts connus et assumés » du doc 21.
 *
 * Chaque élément répond à l'un de ces points. L'état affiché ne recopie jamais
 * `status` — il croise le statut et `expires_at`, parce que rien en base ne
 * fait passer une invitation périmée à « expired » et qu'un écran naïf
 * afficherait « en attente » pour l'éternité. Le bouton d'annulation n'apparaît
 * que là où la politique laisserait passer l'écriture ; partout ailleurs, une
 * phrase prend sa place.
 *
 * Deux libertés que cet écran ne prend pas :
 *
 * - **Il ne nomme personne du côté des invitations reçues.** Le nom d'un
 *   inviteur n'a aucun chemin de lecture avant l'appariement —
 *   `profiles_select_own` est own-only et `tandem_partenaire()` ne parle que
 *   des tandems existants. Il le dit, plutôt que de laisser croire à un vide.
 * - **Il ne propose pas d'accepter.** L'acceptation a déjà son chemin, le lien
 *   reçu par e-mail ; en ouvrir un second obligerait à faire sortir le jeton
 *   dans le DOM pour un gain nul.
 */
import { etatInvitation, revocationInvitation } from '@agapeplay/domain'
import type { EtatInvitation, Invitation } from '@agapeplay/domain'
import type { Copy } from '@agapeplay/content/copy/web'
import type { InvitationEmise } from '../invitations'

const dateCourte = (valeur: string) => new Date(valeur).toLocaleDateString()

const libelleEtat = (etat: EtatInvitation, t: Copy) =>
  etat === 'vivante' ? t.invitationStateLive
    : etat === 'perimee' ? t.invitationStateExpired
      : etat === 'acceptee' ? t.invitationStateAccepted
        : t.invitationStateRevoked

export function InvitationsView({
  emises, recues, chargement, erreur, maintenant, annulationEnCours, t, onRefresh, onCancel,
}: {
  emises: InvitationEmise[]
  /** Les invitations reçues, celles d'un inviteur bloqué déjà retirées côté requête. */
  recues: Invitation[]
  chargement: boolean
  erreur: boolean
  /** L'instant qui sert de juge à la péremption, figé par l'appelant le temps d'un rendu. */
  maintenant: Date
  /** L'identifiant de l'invitation dont l'annulation est en vol, pour ne pas la doubler. */
  annulationEnCours: string | null
  t: Copy
  onRefresh: () => void
  onCancel: (invitationId: string) => void
}) {
  return <section className="content-section narrow-section invitations-section">
    <div className="section-header">
      <div>
        <span className="section-kicker">{t.invitationsKicker}</span>
        <h2>{t.invitationsTitle}</h2>
        <p>{t.invitationsDescription}</p>
      </div>
      <div className="section-header-actions">
        <button className="small-button" onClick={onRefresh}>{t.invitationsRefresh}</button>
      </div>
    </div>

    {chargement && <p className="invitation-state" role="status">{t.invitationsLoading}</p>}
    {erreur && !chargement && <p className="invitation-state" role="alert">{t.invitationsError}</p>}

    {!chargement && !erreur && <>
      <span className="section-kicker">{t.invitationsSent}</span>
      {emises.length === 0
        ? <p className="invitation-absent">{t.invitationsEmpty}</p>
        : <div className="invitation-list">
            {emises.map((invitation) => (
              <InvitationEmiseCarte
                key={invitation.id}
                invitation={invitation}
                etat={etatInvitation(invitation, maintenant)}
                enCours={annulationEnCours === invitation.id}
                t={t}
                onCancel={onCancel}
              />
            ))}
          </div>}

      {/* Rien à dire quand il n'y a rien : une section « Reçues — aucune »
          n'apprendrait qu'une chose, qu'on peut recevoir des invitations, et
          l'apprendrait à chaque ouverture. */}
      {recues.length > 0 && <>
        <span className="section-kicker">{t.invitationsReceived}</span>
        <p className="invitation-lead">{t.invitationsReceivedNoIdentity}</p>
        <div className="invitation-list">
          {recues.map((invitation) => {
            const etat = etatInvitation(invitation, maintenant)
            return <article className={`invitation-card etat-${etat}`} key={invitation.id}>
              <div className="invitation-card-top">
                <span className="status-chip">{libelleEtat(etat, t)}</span>
                <span className="invitation-dates">{t.invitationsSentOn} {dateCourte(invitation.creeeLe)}</span>
              </div>
              <strong>{t.invitationsReceivedOne}</strong>
              {etat === 'vivante'
                ? <p className="invitation-note">{t.invitationsReceivedHint} ({t.invitationsExpiresOn} {dateCourte(invitation.expireLe)})</p>
                : <p className="invitation-note">{t.invitationsExpiredNote}</p>}
            </article>
          })}
        </div>
      </>}
    </>}
  </section>
}

function InvitationEmiseCarte({
  invitation, etat, enCours, t, onCancel,
}: {
  invitation: InvitationEmise
  etat: EtatInvitation
  enCours: boolean
  t: Copy
  onCancel: (invitationId: string) => void
}) {
  const revocation = revocationInvitation(etat, invitation.contactBloque)

  return <article className={`invitation-card etat-${etat}`}>
    <div className="invitation-card-top">
      <span className="status-chip">{libelleEtat(etat, t)}</span>
      <span className="invitation-dates">{t.invitationsSentOn} {dateCourte(invitation.creeeLe)}</span>
    </div>

    {/* L'adresse est la seule chose qui distingue deux invitations l'une de
        l'autre — c'est elle qu'on vient vérifier quand on croit s'être trompé
        de destinataire. */}
    <strong className="invitation-address">{invitation.adresse}</strong>

    <p className="invitation-dates">
      {etat === 'vivante' && <>{t.invitationsExpiresOn} {dateCourte(invitation.expireLe)}</>}
      {etat === 'perimee' && <>{t.invitationsExpiredOn} {dateCourte(invitation.expireLe)}</>}
      {etat === 'acceptee' && invitation.accepteeLe && <>{t.invitationsAcceptedOn} {dateCourte(invitation.accepteeLe)}</>}
    </p>

    {revocation === 'revocable' && <button
      className="outline-button"
      disabled={enCours}
      onClick={() => onCancel(invitation.id)}
    >{t.invitationsCancel}</button>}

    {/* Pas de bouton ici : le `with check` d'`invitations_update_participant`
        lèverait, et un bouton qui échoue est une promesse trahie — la même
        règle que le déblocage. La phrase remplace le geste, et dit le chemin
        de retour au lieu de laisser deviner. */}
    {revocation === 'bloquee' && <p className="invitation-note">{t.invitationsBlockedNote}</p>}

    {revocation === 'sans-objet' && etat === 'perimee' && <p className="invitation-note">{t.invitationsExpiredNote}</p>}
  </article>
}
