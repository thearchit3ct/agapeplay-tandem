/**
 * L'espace mentor, des deux côtés — issue #16.
 *
 * La scène, écrite avant l'écran comme le demande le doc 16 :
 *
 *   Personne : deux, et c'est le sujet. Un adulte bénévole d'une église, qui
 *              accompagne deux ou trois jeunes en plus de sa semaine ; et un
 *              jeune de seize ans à qui son église propose cet adulte.
 *   Moment   : pour lui, cinq minutes un mardi soir, entre deux choses. Pour
 *              elle, l'instant où elle décide si elle dit oui.
 *   Appareil : un téléphone, 375 px, souvent partagé à la maison.
 *   Besoin   : lui, savoir à qui faire signe — sans lire ce qui ne le regarde
 *              pas. Elle, savoir qui on lui propose, et pouvoir appeler.
 *   Risque   : que l'écran devienne un tableau de bord. Un tableau de bord
 *              compare, et comparer des adolescents entre eux est exactement
 *              ce que l'issue interdit.
 *   Preuve   : `supabase/migrations/20260826090000_espace_mentor.sql` et
 *              `tests/rls/espace-mentor.test.ts`.
 *
 * Quatre partis pris, chacun en réponse à ce risque :
 *
 * - **aucun chiffre nulle part.** Pas de compte de séances, pas de « depuis
 *   14 jours », pas de pourcentage. La base ne les rend pas ; l'écran n'a donc
 *   rien à cacher, et c'est la seule garde qui tienne ;
 * - **les signaux ne sont pas des notes.** « Fais-lui signe » est une action
 *   proposée au mentor, pas un jugement porté sur le jeune. Aucune couleur ne
 *   les hiérarchise — un rouge et un vert feraient un classement à eux seuls ;
 * - **l'ordre vient de la base**, alphabétique, et l'écran ne retrie jamais.
 *   Un tri côté client serait un tri qu'aucun test ne garde ;
 * - **ce qui manque est expliqué.** Un mentor non vérifié voit une liste vide
 *   et sa raison ; un jeune sans mentor voit vers qui se tourner, pas un vide.
 *
 * Ce que cet écran ne montrera jamais : le journal, les messages du tandem,
 * les mots du bilan. Ils n'ont pas de chemin de lecture, et quatre suites de
 * tests le mesurent depuis le 25 août.
 */
import { useState } from 'react'
import { CATEGORIES_AIDE, MOTS_ENCOURAGEMENT, gestesDuParticipant, orientationHumaine } from '@agapeplay/domain'
import type {
  Accompagnement, CategorieAide, MentorSnapshot, MonAccompagnement, MotEncouragement, SignalAccompagnement,
} from '@agapeplay/domain'
import type { Copy } from '@agapeplay/content/copy/web'
import type { MotRecu } from '../mentor'

/**
 * Les tables `Record<union, keyof Copy>` sont le motif du dépôt : `tsc -b`
 * échoue si une valeur métier arrive sans libellé, plutôt que l'écran
 * n'affiche une clé brute.
 */
const LIBELLE_SIGNAL: Record<SignalAccompagnement, keyof Copy> = {
  aide_demandee: 'signalHelp',
  nouveau: 'signalNew',
  actif: 'signalActive',
  a_relancer: 'signalToReach',
}

const LIBELLE_CATEGORIE: Record<CategorieAide, keyof Copy> = {
  parcours: 'askHelpJourney',
  pratique: 'askHelpPractical',
  spirituel: 'askHelpSpiritual',
  moral: 'askHelpMoral',
  autre: 'askHelpOther',
}

const LIBELLE_MOT: Record<MotEncouragement, keyof Copy> = {
  je_pense_a_toi: 'word_je_pense_a_toi',
  je_prie_pour_toi: 'word_je_prie_pour_toi',
  prends_ton_temps: 'word_prends_ton_temps',
  fais_moi_signe: 'word_fais_moi_signe',
  content_de_cheminer_avec_toi: 'word_content_de_cheminer_avec_toi',
  on_reprend_quand_tu_veux: 'word_on_reprend_quand_tu_veux',
}

export type ActionsMentor = {
  onEncourager: (accompagnement: Accompagnement, mot: MotEncouragement) => void
  onDireQueJaiVu: (aideId: string) => void
  onRepondre: (assignmentId: string, reponse: 'active' | 'ended') => void
  onDemanderDeLAide: (categorie: CategorieAide) => void
  onCloreMaDemande: (aideId: string) => void
}

export function MentorView({
  snapshot, accompagnements, propositionsEnAttente, mien, aideOuverte, motsRecus, notice, enCours, t, actions,
}: {
  /** L'instantané de vérification, inchangé depuis le 4 août. */
  snapshot: MentorSnapshot
  /** Vide pour qui n'est pas mentor, et pour un mentor non vérifié : c'est la même absence, vue d'ici. */
  accompagnements: Accompagnement[]
  /** Les affectations que le jeune n'a pas encore acceptées. Un compte, jamais une liste. */
  propositionsEnAttente: number
  /** Ce que l'appelant vit de l'autre côté, comme participant. */
  mien: MonAccompagnement | null
  aideOuverte: { id: string; categorie: CategorieAide; statut: 'open' | 'acknowledged' } | null
  motsRecus: MotRecu[]
  /** Une clé de `Copy`, pour dire ce qui vient de se passer. Jamais une erreur brute. */
  notice: keyof Copy | null
  /** L'identifiant du geste en cours, pour ne pas le jouer deux fois. */
  enCours: string | null
  t: Copy
  actions: ActionsMentor
}) {
  const estMentor = snapshot !== null

  return <section className="content-section workspace-section">
    <div className="section-header">
      <div>
        <span className="section-kicker">{t.mentorWorkspace}</span>
        <h2>{t.mentorWorkspace}</h2>
        <p>{t.mentorPrivateRule}</p>
      </div>
      <span className="workspace-glyph" aria-hidden="true">⌁</span>
    </div>

    {notice && <p className="invitation-state" role="status">{t[notice]}</p>}

    {estMentor && <>
      <div className="workspace-grid">
        <article className="workspace-card">
          <span className="section-kicker">{t.mentorVerification}</span>
          <strong>{snapshot.verificationStatus === 'verified' ? t.verifiedStatus : t.pendingStatus}</strong>
          {/* La description dit la conséquence, pas l'état une seconde fois :
              tant que la vérification n'a pas abouti, la liste ci-dessous reste
              vide, et un écran vide sans explication se lit comme une panne. */}
          <p>{snapshot.verificationStatus === 'verified' ? t.mentorFollowUpIntro : t.mentorEmpty}</p>
        </article>
        <article className="workspace-card">
          <span className="section-kicker">{t.mentorTraining}</span>
          <strong>{snapshot.trainingStatus === 'completed' ? t.completedStatus : t.requiredStatus}</strong>
          <p>{t.mentorPrivateRule}</p>
        </article>
      </div>

      <TableauDeSuivi
        accompagnements={accompagnements} propositionsEnAttente={propositionsEnAttente}
        enCours={enCours} t={t} actions={actions}
      />
    </>}

    <MonAccompagnementCarte
      mien={mien} aideOuverte={aideOuverte} motsRecus={motsRecus} enCours={enCours} t={t} actions={actions}
    />

    {!estMentor && mien === null && <div className="workspace-empty">
      <span className="workspace-empty-mark" aria-hidden="true">—</span>
      <strong>{t.workspacePending}</strong>
      <p>{t.myMentorNone}</p>
    </div>}
  </section>
}

function TableauDeSuivi({
  accompagnements, propositionsEnAttente, enCours, t, actions,
}: {
  accompagnements: Accompagnement[]
  propositionsEnAttente: number
  enCours: string | null
  t: Copy
  actions: ActionsMentor
}) {
  // Une proposition en attente n'est pas rien : dire « aucun participant ne
  // t'est encore affecté » à quelqu'un qu'on vient de nommer serait faux. Le
  // compte est dit, le nom ne l'est pas — il naît de l'acceptation.
  const attente = propositionsEnAttente > 0 && <p className="invitation-note" role="status">
    {t.mentorPendingProposal} {t.mentorPendingProposalNote}
  </p>

  if (accompagnements.length === 0) {
    return <>
      <p className="invitation-state" role="status">{t.mentorEmpty}</p>
      {attente}
    </>
  }

  return <div className="invitations-section">
    <span className="section-kicker">{t.mentorFollowUp}</span>
    <p>{t.mentorFollowUpIntro}</p>
    {attente}
    <ul className="invitation-list">
      {/* L'ordre est celui rendu par la base : alphabétique, jamais par signal.
          Aucun `sort` ici, et c'est le point — voir l'en-tête. */}
      {accompagnements.map((personne) => (
        <LigneAccompagnement
          key={personne.assignmentId} personne={personne} enCours={enCours} t={t} actions={actions}
        />
      ))}
    </ul>
  </div>
}

function LigneAccompagnement({
  personne, enCours, t, actions,
}: {
  personne: Accompagnement
  enCours: string | null
  t: Copy
  actions: ActionsMentor
}) {
  const [ouvert, setOuvert] = useState(false)

  return <li className="invitation-card etat-vivante">
    <div className="invitation-card-top">
      <strong>{personne.nom}</strong>
      {/* Le signal est un mot, sans couleur qui le hiérarchise : deux teintes
          suffiraient à faire un classement de trois personnes. */}
      <span className="status-chip">{t[LIBELLE_SIGNAL[personne.signal]]}</span>
    </div>

    {personne.aide && <p className="invitation-note" role="status">
      {t.signalHelpCategory} {t[LIBELLE_CATEGORIE[personne.aide.categorie]]}
      <button
        type="button"
        className="outline-button"
        disabled={enCours === personne.aide.id}
        onClick={() => personne.aide && actions.onDireQueJaiVu(personne.aide.id)}
      >{t.helpAcknowledge}</button>
    </p>}

    <button type="button" className="outline-button" onClick={() => setOuvert(!ouvert)}>
      {t.encourageAction}
    </button>

    {ouvert && <div className="invitation-lead" role="group" aria-label={t.encourageTitle}>
      <strong>{t.encourageTitle}</strong>
      <p>{t.encourageIntro}</p>
      {MOTS_ENCOURAGEMENT.map((mot) => (
        <button
          key={mot}
          type="button"
          className="outline-button"
          disabled={enCours === personne.assignmentId}
          onClick={() => { actions.onEncourager(personne, mot); setOuvert(false) }}
        >{t[LIBELLE_MOT[mot]]}</button>
      ))}
    </div>}
  </li>
}

/**
 * Le côté participant. Il vit sur le même écran que le tableau du mentor, et
 * pas sur celui du tandem : la conversation du binôme et la relation à l'église
 * sont deux membranes que le #17 sépare exprès, et les recoller visuellement
 * suffirait à les faire confondre.
 */
function MonAccompagnementCarte({
  mien, aideOuverte, motsRecus, enCours, t, actions,
}: {
  mien: MonAccompagnement | null
  aideOuverte: { id: string; categorie: CategorieAide; statut: 'open' | 'acknowledged' } | null
  motsRecus: MotRecu[]
  enCours: string | null
  t: Copy
  actions: ActionsMentor
}) {
  const [panneau, setPanneau] = useState(false)
  const [categorie, setCategorie] = useState<CategorieAide | null>(null)
  const gestes = gestesDuParticipant(mien, aideOuverte !== null)

  if (mien === null && motsRecus.length === 0) {
    return <div className="invitations-section">
      <span className="section-kicker">{t.myMentorTitle}</span>
      {/* Jamais un vide muet : le doc 22 liste des recours réels, et c'est le
          moment de les donner. */}
      <p>{t.noMentorGuidance}</p>
    </div>
  }

  return <div className="invitations-section">
    <span className="section-kicker">{t.myMentorTitle}</span>

    {mien && <>
      <p>{gestes.repondre ? t.myMentorProposed : t.myMentorActive} <strong>{mien.nom}</strong></p>

      {gestes.repondre && <div className="invitation-card-top">
        <button
          type="button" className="primary-button compact" disabled={enCours === mien.assignmentId}
          onClick={() => actions.onRepondre(mien.assignmentId, 'active')}
        >{t.myMentorAccept}</button>
        <button
          type="button" className="outline-button" disabled={enCours === mien.assignmentId}
          onClick={() => actions.onRepondre(mien.assignmentId, 'ended')}
        >{t.myMentorDecline}</button>
        <p>{t.myMentorDeclineNote}</p>
      </div>}

      {/* Dit avant d'accepter, pas après : c'est ce qui manque le plus pour
          décider, et le taire ferait passer une attente pour un défaut. */}
      {mien.verification !== 'verified' && <p className="invitation-state" role="status">
        {t.myMentorNotVerifiedYet}
      </p>}
    </>}

    {motsRecus.length > 0 && <ul className="invitation-list">
      {motsRecus.map((mot) => (
        <li key={mot.id} className="invitation-card etat-vivante">{t[LIBELLE_MOT[mot.mot]]}</li>
      ))}
    </ul>}

    {aideOuverte && <p className="invitation-state" role="status">
      {t.askHelpOpen}
      <button
        type="button" className="outline-button" disabled={enCours === aideOuverte.id}
        onClick={() => actions.onCloreMaDemande(aideOuverte.id)}
      >{t.askHelpClose}</button>
    </p>}

    {gestes.orienter && <p>{t.noMentorGuidance}</p>}

    {gestes.demanderDeLAide && !panneau && <button
      type="button" className="outline-button" onClick={() => setPanneau(true)}
    >{t.askHelpAction}</button>}

    {panneau && <div className="invitation-lead" role="group" aria-label={t.askHelpTitle}>
      <strong>{t.askHelpTitle}</strong>
      <p>{t.askHelpIntro}</p>
      <div role="radiogroup" aria-label={t.askHelpTitle}>
        {CATEGORIES_AIDE.map((valeur) => (
          <button
            key={valeur} type="button" className="outline-button"
            role="radio" aria-checked={categorie === valeur}
            onClick={() => setCategorie(valeur)}
          >{t[LIBELLE_CATEGORIE[valeur]]}</button>
        ))}
      </div>
      {/* Avant l'envoi, jamais après : personne ne veille la nuit, et il vaut
          mieux le dire pendant qu'on hésite (doc 22). */}
      {categorie && orientationHumaine(categorie) && <p className="invitation-state" role="alert">
        {t.askHelpHelpline}
      </p>}
      <button
        type="button" className="primary-button compact" disabled={!categorie || enCours === 'aide'}
        onClick={() => { if (categorie) { actions.onDemanderDeLAide(categorie); setPanneau(false); setCategorie(null) } }}
      >{t.askHelpSend}</button>
    </div>}
  </div>
}
