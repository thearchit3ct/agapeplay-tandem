/**
 * L'espace modérateur.
 *
 * La scène, écrite avant l'écran comme le demande le doc 16 :
 *
 *   Personne : un modérateur plateforme, adulte, extérieur à l'église où
 *              l'incident s'est produit (ADR-007).
 *   Moment   : il ouvre l'onglet sans savoir ce qui l'attend. Peut-être rien,
 *              peut-être un adolescent qui a écrit qu'on insiste après un refus.
 *   Appareil : un ordinateur le plus souvent, un téléphone parfois — la même
 *              contrainte de 375 px que le reste du produit.
 *   Besoin   : voir ce qui attend une décision, lire ce qui est signalé avec son
 *              contexte, décider, et savoir que la décision est enregistrée.
 *   Risque   : décider sans contexte ; croire avoir décidé alors que rien n'a
 *              bougé ; prendre l'absence de noms pour un écran incomplet.
 *   Preuve   : les migrations `role_moderateur` et `suivi_moderation`, et la
 *              section « Écarts connus et assumés » du doc 21.
 *
 * Chaque élément répond à l'un de ces points. Le bandeau du haut désamorce le
 * dernier risque en le disant d'emblée — l'absence de noms est une décision, et
 * un modérateur qui la prend pour une panne ira la « réparer ». Les boutons de
 * décision ne s'affichent que pour les transitions que la base accepte
 * réellement, et l'écran attend la ligne revenue avant de dire « enregistré ».
 *
 * Depuis le 25/08/2026, chaque dossier porte une catégorie choisie par la
 * personne et une urgence que la base en déduit ; la file les range dans cet
 * ordre. Le repli « quand un dossier sort de l'application » est ici, et non
 * dans un document qu'on irait lire un autre jour : une procédure d'escalade
 * qu'on doit chercher au moment de décider n'est pas une procédure. Ce qu'il
 * dit tient en trois lignes, dont l'aveu qui compte le plus — rien n'est
 * détecté tout seul.
 *
 * Rien n'est purement décoratif ici : un dossier de modération n'a pas besoin
 * d'ornement.
 */
import { transitionsPossibles } from '@agapeplay/domain'
import type { CategorieSignalement, DossierModeration, StatutSignalement, TandemStatus, UrgenceSignalement } from '@agapeplay/domain'
import type { Copy } from '@agapeplay/content/copy/web'
import type { LigneJournal } from '../moderation'

const dateCourte = (valeur: string) => new Date(valeur).toLocaleDateString()
const dateLongue = (valeur: string) => new Date(valeur).toLocaleString()

const libelleStatut = (statut: StatutSignalement, t: Copy) =>
  statut === 'open' ? t.statusOpen : statut === 'reviewing' ? t.statusReviewing : t.statusResolved

/**
 * Les sept catégories, la septième comprise.
 *
 * `non_precise` n'est proposé à personne — mais huit dossiers réels le portent,
 * et un écran qui l'ignorerait afficherait un vide à leur place. Le libellé dit
 * ce qui s'est passé (« signalement antérieur aux catégories ») plutôt que de
 * laisser croire à une donnée manquante.
 */
const libelleCategorie = (categorie: CategorieSignalement, t: Copy) => {
  if (categorie === 'malaise') return t.categoryMalaise
  if (categorie === 'insistance') return t.categoryInsistance
  if (categorie === 'secret') return t.categorySecret
  if (categorie === 'sexuel') return t.categorySexuel
  if (categorie === 'danger') return t.categoryDanger
  if (categorie === 'autre') return t.categoryAutre
  return t.categoryNonPrecise
}

/**
 * L'urgence est du vocabulaire de modération, et c'est le seul endroit du
 * produit où on s'y autorise : elle n'est lue que par un modérateur. La
 * personne qui signale, elle, ne voit jamais ces trois mots — elle choisit une
 * situation, la base en déduit le reste.
 */
const libelleUrgence = (urgence: UrgenceSignalement, t: Copy) =>
  urgence === 'immediate' ? t.urgencyImmediate : urgence === 'elevee' ? t.urgencyElevee : t.urgencyStandard

/**
 * Les quatre états de `tandems.status`, dits en toutes lettres.
 *
 * `activeStatus` et `blockedStatus` existent déjà, mais ils qualifient un
 * tandem dans l'écran de conversation — « Actif », « Bloqué » — et rendaient ici
 * « La relation : Actif ». Quatre libellés dédiés, accordés, plutôt qu'un
 * emprunt qui boite.
 */
const libelleRelation = (statut: TandemStatus, t: Copy) =>
  statut === 'active' ? t.relationActive
    : statut === 'blocked' ? t.relationBlocked
      : statut === 'paused' ? t.relationPaused
        : t.relationEnded

/**
 * Le libellé d'une décision dépend d'où l'on part, pas seulement d'où l'on va :
 * passer à `reviewing` depuis `open` se dit « prendre en charge », depuis
 * `resolved` cela se dit « rouvrir ». Le même changement de colonne, deux gestes
 * différents pour la personne qui le fait.
 */
const libelleDecision = (depuis: StatutSignalement, vers: StatutSignalement, t: Copy) => {
  if (vers === 'resolved') return t.moderationClose
  return depuis === 'resolved' ? t.moderationReopen : t.moderationTake
}

export function ModerationView({
  dossiers, chargement, erreur, journaux, journalOuvert, currentUserId, decisionEnCours, t,
  onRefresh, onDecide, onToggleJournal,
}: {
  dossiers: DossierModeration[]
  chargement: boolean
  erreur: boolean
  /** `undefined` = pas encore lu, `null` = lecture refusée ou en échec. */
  journaux: Record<string, LigneJournal[] | null>
  journalOuvert: string | null
  currentUserId?: string
  /** L'identifiant du signalement dont une décision est en vol, pour ne pas la doubler. */
  decisionEnCours: string | null
  t: Copy
  onRefresh: () => void
  onDecide: (signalementId: string, statut: StatutSignalement) => void
  onToggleJournal: (signalementId: string) => void
}) {
  const enAttente = dossiers.filter((dossier) => dossier.signalement.status === 'open').length

  return <section className="content-section moderation-section">
    <div className="section-header">
      <div>
        <span className="section-kicker">{t.moderation}</span>
        <h2>{t.moderationTitle}</h2>
        <p>{t.moderationDescription}</p>
      </div>
      <div className="section-header-actions">
        <button className="small-button" onClick={onRefresh}>{t.moderationRefresh}</button>
      </div>
    </div>

    {/* Dit avant qu'on ait le temps de le prendre pour un défaut. */}
    <p className="moderation-note">{t.moderationNoIdentity}</p>

    {/* La procédure d'escalade, là où la décision se prend — pas dans un
        document qu'on ira lire un autre jour. Ce qui est ici tient en trois
        lignes : ce qui sort de l'application, vers qui, et l'aveu qui compte
        le plus — rien n'est détecté tout seul. Le reste est versionné. */}
    <details className="moderation-escalation">
      <summary>{t.moderationEscalationTitle}</summary>
      <p>{t.moderationEscalationImmediate}</p>
      <p className="moderation-escalation-note">{t.moderationEscalationNote}</p>
    </details>

    {chargement && <p className="moderation-state" role="status">{t.moderationLoading}</p>}
    {erreur && !chargement && <p className="moderation-state" role="alert">{t.moderationError}</p>}

    {!chargement && !erreur && dossiers.length === 0 && (
      <div className="workspace-empty">
        <span className="workspace-empty-mark" aria-hidden="true">—</span>
        <strong>{t.moderationEmpty}</strong>
        <p>{t.moderationDescription}</p>
      </div>
    )}

    {!chargement && !erreur && dossiers.length > 0 && <>
      <p className="moderation-count">{dossiers.length} {t.moderationCount} · {enAttente} {t.moderationOpenCount}</p>
      <div className="moderation-list">
        {dossiers.map((dossier) => (
          <DossierCarte
            key={dossier.signalement.id}
            dossier={dossier}
            journal={journaux[dossier.signalement.id]}
            journalVisible={journalOuvert === dossier.signalement.id}
            currentUserId={currentUserId}
            decisionEnCours={decisionEnCours === dossier.signalement.id}
            t={t}
            onDecide={onDecide}
            onToggleJournal={onToggleJournal}
          />
        ))}
      </div>
    </>}
  </section>
}

function DossierCarte({
  dossier, journal, journalVisible, currentUserId, decisionEnCours, t, onDecide, onToggleJournal,
}: {
  dossier: DossierModeration
  journal: LigneJournal[] | null | undefined
  journalVisible: boolean
  currentUserId?: string
  decisionEnCours: boolean
  t: Copy
  onDecide: (signalementId: string, statut: StatutSignalement) => void
  onToggleJournal: (signalementId: string) => void
}) {
  const { signalement, contexte, message } = dossier

  return <article className={`moderation-case statut-${signalement.status}`}>
    <div className="moderation-case-top">
      <span className="status-chip">{libelleStatut(signalement.status, t)}</span>
      {/* L'urgence porte la classe de sa valeur : ce qui est immédiat doit se
          voir d'un coup d'œil dans une liste, avant d'être lu. */}
      <span className={`urgency-chip urgence-${signalement.urgence}`}>{libelleUrgence(signalement.urgence, t)}</span>
      <span className="moderation-dates">
        {t.moderationReportedAt} {dateCourte(signalement.createdAt)}
        {signalement.resolvedAt && ` · ${t.moderationClosedAt} ${dateCourte(signalement.resolvedAt)}`}
      </span>
    </div>

    <span className="section-kicker">{t.moderationCategory}</span>
    <p className="moderation-category">{libelleCategorie(signalement.categorie, t)}</p>

    <span className="section-kicker">{t.moderationReason}</span>
    {/* `reason` est facultatif depuis que la catégorie porte le sens : une
        absence se dit, comme pour le message et le contexte. Rendu tel quel,
        un `null` afficherait un bloc vide sous un intertitre — l'écran aurait
        l'air cassé là où il ne manque rien. */}
    {signalement.reason
      ? <p className="moderation-reason">{signalement.reason}</p>
      : <p className="moderation-absent">{t.moderationNoReason}</p>}

    <span className="section-kicker">{t.moderationMessage}</span>
    {message
      ? <blockquote className="moderation-message">
          <p>{message.body}</p>
          <footer>
            {message.origine === 'signalant' ? t.moderationFromReporter : t.moderationFromOther}
            {' · '}{dateLongue(message.createdAt)}
          </footer>
        </blockquote>
      /* Pas de repli par `tandem_id` : aucune politique n'ouvre les autres
         messages de la conversation, et une requête muette passerait pour un
         bug. On dit la borne. */
      : <p className="moderation-absent">{t.moderationNoMessage}</p>}

    <span className="section-kicker">{t.moderationContext}</span>
    {contexte
      ? <ul className="moderation-context">
          <li><span>{libelleRelation(contexte.status, t)}</span></li>
          <li>{t.moderationRelationOpened} {dateCourte(contexte.createdAt)}</li>
          {contexte.blockedAt && <li>{t.moderationRelationBlocked} {dateCourte(contexte.blockedAt)}</li>}
          {contexte.endedAt && <li>{t.moderationRelationEnded} {dateCourte(contexte.endedAt)}</li>}
        </ul>
      : <p className="moderation-absent">{t.moderationNoContext}</p>}

    <div className="moderation-actions">
      {/* La première transition rendue par `transitionsPossibles` est celle
          qu'on attend d'un dossier dans cet état — prendre en charge ce qui est
          neuf, clore ce qui est en cours, rouvrir ce qui a été clos. Elle porte
          donc l'accent, et clore un dossier qu'on n'a pas encore ouvert reste
          possible sans être le geste mis en avant. */}
      {transitionsPossibles(signalement.status).map((cible, rang) => (
        <button
          key={cible}
          className={rang === 0 ? 'primary-button compact' : 'outline-button'}
          disabled={decisionEnCours}
          onClick={() => onDecide(signalement.id, cible)}
        >{libelleDecision(signalement.status, cible, t)}</button>
      ))}
      <button
        className="text-button"
        aria-expanded={journalVisible}
        onClick={() => onToggleJournal(signalement.id)}
      >{t.moderationTrail}</button>
    </div>

    {journalVisible && <div className="moderation-trail">
      <p className="moderation-trail-note">{t.moderationTrailNote}</p>
      {journal === undefined && <p className="moderation-state" role="status">{t.moderationLoading}</p>}
      {/* `null` et liste vide ne disent pas la même chose : « la lecture a
          échoué » n'est pas « aucune décision n'a été prise ». */}
      {journal === null && <p className="moderation-state" role="alert">{t.moderationError}</p>}
      {journal?.length === 0 && <p className="moderation-absent">{t.moderationTrailEmpty}</p>}
      {journal && journal.length > 0 && <ol>
        {journal.map((ligne) => <li key={ligne.id}>
          <span>{dateLongue(ligne.changedAt)}</span>
          {libelleStatut(ligne.fromStatus, t)} → {libelleStatut(ligne.toStatus, t)}
          {/* Jamais l'uuid : « toi » ou « un autre modérateur ». Le journal dit
              qui a modéré quoi, et cette liste-là n'a pas à sortir du serveur
              sous une forme qu'on puisse recopier. */}
          {' '}<em>{ligne.moderatorId
            ? (ligne.moderatorId === currentUserId ? t.moderationTrailByMe : t.moderationTrailByOther)
            : t.moderationTrailUnknown}</em>
        </li>)}
      </ol>}
    </div>}
  </article>
}
