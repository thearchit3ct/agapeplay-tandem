/**
 * Vues et dialogues de l'application.
 *
 * Extraits d'App.tsx le 05/08/2026, qui faisait 977 lignes.
 *
 * La plupart sont des composants d'affichage : ils reçoivent tout par props et
 * se testeront un jour sans monter l'application entière. `AuthDialog` fait
 * exception — il porte son propre état et appelle Supabase directement. C'est
 * le prochain à démêler si l'on veut pouvoir éprouver la connexion.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { AppState } from '@agapeplay/domain'
import { getJourney } from '../mockData'
import type { Copy } from '@agapeplay/content/copy/web'
import type { CategorieSignalement, SessionStep, RemoteMessage, MentorSnapshot, ChurchSnapshot, TandemStatus, UnblockAffordance, PartageDuJournal, EtatDeSemaine, InvitationDouce } from '@agapeplay/domain'
import { CATEGORIES_PROPOSEES, ETATS_DE_SEMAINE, initialeDe, urgenceDe } from '@agapeplay/domain'
import type { EntreePartagee, PartageEmis } from '../partageJournal'
import { ROUTE_CONFIDENTIALITE } from './confidentialite'
import { naviguerDansLeGroupe, useDialogue } from './dialogue'

/**
 * Le lien vers la politique de confidentialité — issue #23.
 *
 * Toujours dans un onglet neuf : les trois endroits où il apparaît sont des
 * dialogues, et deux d'entre eux portent un geste en cours — une case cochée
 * qu'on n'a pas encore validée, une adresse tapée qu'on n'a pas encore
 * envoyée. Naviguer dans le même onglet perdrait ce geste, et lire ce qu'on
 * s'apprête à accepter ne doit rien coûter.
 */
function LienConfidentialite({ t }: { t: Copy }) {
  return <p className="policy-link">
    <a href={ROUTE_CONFIDENTIALITE} target="_blank" rel="noreferrer">{t.privacyPolicyLink}</a>
  </p>
}

// L'espace modérateur vit dans son propre fichier : il ne partage rien avec les
// vues ci-dessous et il porte sa propre scène de conception. Il se réexporte
// ici pour que le point d'import d'App.tsx reste unique.
export { ModerationView } from './moderation'

// Le suivi des invitations, même raison : sa scène et ses règles d'affichage
// lui sont propres, et il n'emprunte rien aux vues ci-dessous.
export { InvitationsView } from './invitations'

// L'espace église. Il est parti d'ici le 25/08/2026 (issue #17) : il n'était
// qu'un instantané en lecture, il porte désormais tous les gestes d'une
// communauté — fonder, rejoindre, ouvrir une cohorte, émettre un lien — et sa
// propre scène de conception.
export { ChurchView } from './communaute'
export type { ActionsCommunaute } from './communaute'

// L'espace mentor. Il est parti d'ici le 26/08/2026 (issue #16) : il n'était
// qu'un instantané de vérification, il porte désormais le tableau de suivi, le
// mot d'encouragement, la réponse du participant à une proposition et la
// demande d'aide — avec sa propre scène de conception.
export { MentorView } from './mentor'
export type { ActionsMentor } from './mentor'

export function AuthDialog({ t, loading, onClose }: { t: Copy; loading: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')

  const signInWithProvider = async (provider: 'google' | 'azure') => {
    if (!supabase) return
    setSending(true)
    setStatus('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setSending(false)
      setStatus(t.authError)
    }
  }

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !email.trim()) return
    setSending(true)
    setStatus('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setSending(false)
    setStatus(error ? t.authError : t.magicLinkSent)
  }

  const cadre = useDialogue<HTMLElement>(onClose)

  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section ref={cadre} className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" onClick={(event) => event.stopPropagation()}>
      <div className="auth-dialog-top"><span className="section-kicker">AgapePlay</span><button className="text-button" onClick={onClose} aria-label={t.close}>×</button></div>
      <h2 id="auth-dialog-title">{t.signIn}</h2>
      <p>{t.magicLinkDescription}</p>
      <div className="provider-grid">
        <button type="button" onClick={() => void signInWithProvider('google')} disabled={loading || sending}>{t.continueWithGoogle}</button>
        <button type="button" onClick={() => void signInWithProvider('azure')} disabled={loading || sending}>{t.continueWithMicrosoft}</button>
      </div>
      <div className="auth-divider"><span>{t.orEmail}</span></div>
      <form onSubmit={sendMagicLink}>
        <label htmlFor="auth-email">{t.email}</label>
        <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        <button className="primary-button" type="submit" disabled={loading || sending}>{sending ? '…' : t.sendMagicLink}<span aria-hidden="true">→</span></button>
      </form>
      {status && <p className="auth-status" role="status">{status}</p>}
      <LienConfidentialite t={t} />
    </section>
  </div>
}

export function TrustDialog({ t, ageConfirmed, setAgeConfirmed, privacyAccepted, setPrivacyAccepted, termsAccepted, setTermsAccepted, onSave }: { t: Copy; ageConfirmed: boolean; setAgeConfirmed: (value: boolean) => void; privacyAccepted: boolean; setPrivacyAccepted: (value: boolean) => void; termsAccepted: boolean; setTermsAccepted: (value: boolean) => void; onSave: () => void }) {
  // Sans `onClose` : cette fenêtre n'a ni croix ni clic sur le fond, et Échap
  // n'en aura pas non plus. Le crochet n'y pose que le piège et la restitution.
  const cadre = useDialogue<HTMLElement>()

  return <div className="auth-dialog-backdrop" role="presentation">
    <section ref={cadre} className="auth-dialog trust-dialog" role="dialog" aria-modal="true" aria-labelledby="trust-dialog-title">
      <div className="auth-dialog-top"><span className="section-kicker">AgapePlay</span></div>
      <h2 id="trust-dialog-title">{t.trustTitle}</h2>
      <p>{t.trustDescription}</p>
      {/* Le lien vient AVANT les cases : c'est ici qu'on demande à quelqu'un de
          seize ans de cocher `privacyConsent`, et une politique qu'on ne peut
          lire qu'après avoir accepté n'est pas une politique. */}
      <LienConfidentialite t={t} />
      <div className="trust-checks">
        <label><input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /> <span>{t.ageConfirm}</span></label>
        <label><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} /> <span>{t.privacyConsent}</span></label>
        <label><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /> <span>{t.termsConsent}</span></label>
      </div>
      <button className="primary-button" onClick={onSave}>{t.continueTrust}<span aria-hidden="true">→</span></button>
    </section>
  </div>
}

export function SettingsDialog({ t, prefs, onToggle, onClose, onExport, onSignOutEverywhere, onDelete, busy, mesure, onToggleMesure }: { t: Copy; prefs: AppState['notificationPrefs']; onToggle: (key: keyof AppState['notificationPrefs'], value: boolean) => void; onClose: () => void; onExport: () => void; onSignOutEverywhere: () => void; onDelete: () => void; busy: boolean; mesure: boolean; onToggleMesure: (value: boolean) => void }) {
  const cadre = useDialogue<HTMLElement>(onClose)

  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section ref={cadre} className="auth-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title" onClick={(event) => event.stopPropagation()}>
      <div className="auth-dialog-top"><span className="section-kicker">AgapePlay</span><button className="text-button" onClick={onClose} aria-label={t.close}>×</button></div>
      <h2 id="settings-dialog-title">{t.settingsTitle}</h2>
      <p>{t.protected}</p>
      <LienConfidentialite t={t} />
      <div className="notification-settings">
        <strong>{t.notifications}</strong>
        <p>{t.notificationDescription}</p>
        <label><input type="checkbox" checked={prefs.sessions} onChange={(event) => onToggle('sessions', event.target.checked)} /> <span>{t.sessionNotifications}</span></label>
        <label><input type="checkbox" checked={prefs.messages} onChange={(event) => onToggle('messages', event.target.checked)} /> <span>{t.messageNotifications}</span></label>
        <label><input type="checkbox" checked={prefs.church} onChange={(event) => onToggle('church', event.target.checked)} /> <span>{t.churchNotifications}</span></label>
        <label><input type="checkbox" checked={prefs.absence} onChange={(event) => onToggle('absence', event.target.checked)} /> <span>{t.absenceNotifications}</span></label>
        {/* Le bilan a son propre interrupteur, et pas une case de plus sous
            « Séances quotidiennes » : on peut vouloir la paix en semaine et
            accepter une question le samedi. Voir la migration
            20260825213000 pour le raisonnement complet. */}
        <label><input type="checkbox" checked={prefs.weekly_checkin} onChange={(event) => onToggle('weekly_checkin', event.target.checked)} /> <span>{t.weeklyCheckinNotifications}</span></label>
      </div>
      {/* La mesure est décrite avant d'être réglable : la case seule ne dirait
          pas ce qu'on mesure, et un interrupteur qu'on ne comprend pas n'est
          pas un choix. Le texte tient en trois phrases parce qu'il s'adresse à
          quelqu'un de seize ans. */}
      <div className="settings-block">
        <strong>{t.measurement}</strong>
        <p>{t.measurementDescription}</p>
        <label><input type="checkbox" checked={mesure} onChange={(event) => onToggleMesure(event.target.checked)} /> <span>{t.measurementToggle}</span></label>
      </div>
      {/* L'export vient avant la suppression, et ce n'est pas un hasard
          d'ordre : c'est le seul moment où quelqu'un qui s'apprête à partir
          peut encore emporter ce qu'il a écrit. */}
      <div className="settings-block">
        <strong>{t.exportData}</strong>
        <p>{t.exportDescription}</p>
        <button className="outline-button" disabled={busy} onClick={onExport}>{t.exportData}</button>
      </div>
      <div className="settings-block">
        <strong>{t.signOutEverywhere}</strong>
        <p>{t.signOutEverywhereDescription}</p>
        <button className="outline-button" disabled={busy} onClick={onSignOutEverywhere}>{t.signOutEverywhere}</button>
      </div>
      <div className="settings-danger-zone">
        <strong>{t.deleteAccount}</strong>
        <p>{t.deleteAccountDescription}</p>
        {/* Le bouton n'exécute rien : il ouvre l'écran qui explique. Un geste
            irréversible ne se déclenche pas au premier clic. */}
        <button className="outline-button danger" disabled={busy} onClick={onDelete}>{t.deleteAccount}</button>
      </div>
    </section>
  </div>
}

/**
 * La confirmation avant de supprimer son compte.
 *
 * Elle ne demande pas « es-tu sûr ? » — la question n'apprend rien, et le
 * dialogue de déblocage a déjà tranché ce point dans ce dépôt. Elle énumère,
 * dans l'ordre : ce qui disparaît, ce qui reste, ce que devient un blocage
 * posé, et ce qui arrive à la connexion. Le public a seize ans : pas de
 * jargon, pas de conséquence découverte après coup.
 *
 * La case à cocher n'est pas un ornement de formulaire. Elle sépare « j'ai
 * cliqué » de « j'ai lu », et c'est la seule friction qu'on s'autorise sur un
 * geste sans retour — taper un mot magique en serait une autre, plus punitive
 * et pas plus informative.
 */
export function DeleteAccountDialog({ t, onConfirm, onExport, onClose, busy }: { t: Copy; onConfirm: () => void; onExport: () => void; onClose: () => void; busy: boolean }) {
  const [understood, setUnderstood] = useState(false)
  const cadre = useDialogue<HTMLElement>(onClose)

  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section ref={cadre} className="auth-dialog delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onClick={(event) => event.stopPropagation()}>
      <div className="auth-dialog-top"><span className="section-kicker">{t.settingsTitle}</span><button className="text-button" onClick={onClose} aria-label={t.close}>×</button></div>
      <h2 id="delete-dialog-title">{t.deleteConfirmTitle}</h2>
      <p>{t.deleteConfirmErases}</p>
      <p>{t.deleteConfirmKeeps}</p>
      <p>{t.deleteConfirmBlocked}</p>
      <p>{t.deleteConfirmSession}</p>
      <p className="delete-export-hint">{t.deleteConfirmExportFirst} <button className="text-button" disabled={busy} onClick={onExport}>{t.exportData}</button></p>
      {/* La case et les deux boutons ne se séparent pas, et restent au bord bas
          du dialogue quand il défile : sur un écran de 375 px, cinq paragraphes
          poussent autrement le geste sous le bord, et un bouton désactivé sans
          sa case visible ne dit pas ce qui lui manque. */}
      <div className="delete-decision">
        <label className="delete-understood"><input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /> <span>{t.deleteConfirmUnderstood}</span></label>
        <div className="unblock-actions">
          <button className="primary-button danger" disabled={!understood || busy} onClick={onConfirm}>{t.deleteConfirm}</button>
          <button className="text-button" onClick={onClose}>{t.deleteCancel}</button>
        </div>
      </div>
    </section>
  </div>
}

export function InviteDialog({ t, email, setEmail, link, onCreate, onClose }: { t: Copy; email: string; setEmail: (value: string) => void; link: string; onCreate: () => void; onClose: () => void }) {
  const copyLink = () => {
    if (link) void navigator.clipboard.writeText(link)
  }

  const cadre = useDialogue<HTMLElement>(onClose)

  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section ref={cadre} className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" onClick={(event) => event.stopPropagation()}>
      <div className="auth-dialog-top"><span className="section-kicker">AgapePlay</span><button className="text-button" onClick={onClose} aria-label={t.close}>×</button></div>
      <h2 id="invite-dialog-title">{t.invite}</h2>
      <p>{t.inviteDescription}</p>
      <label htmlFor="invite-email">{t.inviteEmail}</label>
      <input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
      <button className="primary-button" onClick={onCreate}>{t.createInvite}<span aria-hidden="true">→</span></button>
      {link && <div className="invite-result"><input value={link} readOnly aria-label={t.inviteCreated} /><button className="outline-button" onClick={copyLink}>{t.copyInvite}</button></div>}
    </section>
  </div>
}

/**
 * La confirmation avant de lever un blocage.
 *
 * Elle ne demande pas « es-tu sûr ? » — la question n'apprend rien. Elle dit
 * ce qui reprend, et dans quel sens : la conversation redevient possible des
 * deux côtés, l'historique redevient lisible pour les deux. Le bouton qui
 * annule est nommé, lui aussi, pour qu'on puisse renoncer sans chercher.
 */
export function UnblockDialog({ t, onConfirm, onClose }: { t: Copy; onConfirm: () => void; onClose: () => void }) {
  const cadre = useDialogue<HTMLElement>(onClose)

  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section ref={cadre} className="auth-dialog unblock-dialog" role="dialog" aria-modal="true" aria-labelledby="unblock-dialog-title" onClick={(event) => event.stopPropagation()}>
      <div className="auth-dialog-top"><span className="section-kicker">{t.privateConversation}</span><button className="text-button" onClick={onClose} aria-label={t.close}>×</button></div>
      <h2 id="unblock-dialog-title">{t.unblockTitle}</h2>
      <p>{t.unblockDescription}</p>
      <p className="unblock-reversible">{t.unblockReversible}</p>
      <div className="unblock-actions">
        <button className="primary-button" onClick={onConfirm}>{t.unblockConfirm}<span aria-hidden="true">→</span></button>
        <button className="text-button" onClick={onClose}>{t.unblockCancel}</button>
      </div>
    </section>
  </div>
}

/**
 * Le signalement, devenu une question plutôt qu'un clic.
 *
 * Jusqu'au 25/08/2026, « Signaler un problème » écrivait immédiatement une
 * ligne portant la phrase « Signalement depuis la conversation ». Deux choses
 * changent, et la seconde compte autant que la première : la modération sait
 * enfin de quoi il s'agit, et la personne qui signale voit ce qu'elle envoie
 * avant de l'envoyer.
 *
 * Le mot libre est facultatif, et l'écran le dit avec ces mots-là. Un champ
 * qu'on croit obligatoire à ce moment précis, c'est un signalement abandonné :
 * raconter est difficile, choisir une ligne ne l'est pas.
 *
 * `reportHelplineNote` n'apparaît que sur les deux catégories d'urgence
 * immédiate, et il dit ce que le produit ne fait pas — personne ne veille la
 * nuit. Le mettre sous chaque catégorie le rendrait invisible ; le taire
 * laisserait croire qu'envoyer ce formulaire est un secours.
 */
export function ReportDialog({
  t, categorie, note, setCategorie, setNote, onConfirm, onClose,
}: {
  t: Copy
  categorie: CategorieSignalement | null
  note: string
  setCategorie: (valeur: CategorieSignalement) => void
  setNote: (valeur: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  const libelles: Record<CategorieSignalement, string> = {
    malaise: t.categoryMalaise,
    insistance: t.categoryInsistance,
    secret: t.categorySecret,
    sexuel: t.categorySexuel,
    danger: t.categoryDanger,
    autre: t.categoryAutre,
    non_precise: t.categoryNonPrecise,
  }
  // L'urgence se calcule ici sur ce que la personne vient de choisir, avant que
  // la ligne existe : c'est la seule raison d'être de `urgenceDe` côté client.
  // La colonne générée reste la seule à faire foi une fois la ligne écrite.
  const urgence = categorie ? urgenceDe(categorie) : null

  const cadre = useDialogue<HTMLElement>(onClose)

  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section ref={cadre} className="auth-dialog report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" onClick={(event) => event.stopPropagation()}>
      <div className="auth-dialog-top"><span className="section-kicker">{t.report}</span><button className="text-button" onClick={onClose} aria-label={t.close}>×</button></div>
      <h2 id="report-dialog-title">{t.reportTitle}</h2>
      <p>{t.reportDescription}</p>

      <div className="report-categories" role="radiogroup" aria-labelledby="report-dialog-title">
        {/* Un seul arrêt de tabulation pour tout le groupe : c'est ce que
            `role="radiogroup"` promet, et les flèches font le reste. Sans choix
            posé, c'est la première catégorie qui porte l'arrêt. */}
        {CATEGORIES_PROPOSEES.map((valeur, rang) => (
          <button
            key={valeur}
            type="button"
            role="radio"
            aria-checked={categorie === valeur}
            tabIndex={categorie === null ? (rang === 0 ? 0 : -1) : (categorie === valeur ? 0 : -1)}
            className={`report-category${categorie === valeur ? ' choisie' : ''}`}
            onClick={() => setCategorie(valeur)}
            onKeyDown={(event) => naviguerDansLeGroupe(
              event, rang, CATEGORIES_PROPOSEES.length, (cible) => setCategorie(CATEGORIES_PROPOSEES[cible]),
            )}
          >{libelles[valeur]}</button>
        ))}
      </div>

      {urgence === 'immediate' && <p className="report-helpline">{t.reportHelplineNote}</p>}
      {urgence === 'immediate' && <p className="report-urgent">{t.reportUrgentNote}</p>}

      <label className="report-note-label" htmlFor="report-note">{t.reportNoteLabel}</label>
      <textarea
        id="report-note"
        className="report-note"
        value={note}
        maxLength={1000}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t.reportNotePlaceholder}
      />

      <div className="unblock-actions">
        {/* Sans catégorie, il n'y a rien à envoyer : la base refuserait l'insert
            — `category` est `not null` et sans défaut — et l'écran n'a aucune
            raison de laisser partir une requête qu'il sait perdue. */}
        <button className="primary-button" disabled={!categorie} onClick={onConfirm}>{t.reportConfirm}<span aria-hidden="true">→</span></button>
        <button className="text-button" onClick={onClose}>{t.reportCancel}</button>
      </div>
    </section>
  </div>
}

export function NavItem({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  // `aria-current="page"` et non la seule classe `active` : la classe se voit,
  // elle ne s'entend pas. C'est la seule façon pour un lecteur d'écran de dire
  // lequel des sept onglets est ouvert.
  return <button className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}><span aria-hidden="true">{icon}</span>{label}</button>
}


/**
 * Les cinq réponses, et le texte de chacune.
 *
 * La table est ici et pas dans le domaine : le domaine décide du vocabulaire
 * (`ETATS_DE_SEMAINE`, épinglé par ses tests), les écrans décident des mots. Le
 * typage `Record<EtatDeSemaine, …>` fait échouer `tsc -b` le jour où une
 * réponse s'ajoute sans son libellé — une réponse muette serait un bouton vide.
 */
const LIBELLE_ETAT: Record<EtatDeSemaine, keyof Copy> = {
  paisible: 'checkinCalm',
  dense: 'checkinFull',
  rude: 'checkinHard',
  ailleurs: 'checkinElsewhere',
  incertain: 'checkinUnsure',
}

/**
 * Le mot d'accueil après une absence — troisième critère de l'issue #18.
 *
 * Ce qu'il ne dit pas est ce qui compte. Pas de durée (« ça fait douze
 * jours »), pas de comptage (« tu as manqué deux semaines »), pas de reproche
 * déguisé en enthousiasme (« on t'attendait ! »), pas de bouton qui presse.
 * Rien de tout cela n'est affichable ici, parce que rien de tout cela n'est
 * calculé : `repriseApresAbsence` rend un booléen et pas un écart, exprès.
 *
 * Ce qu'il dit : que rien n'a bougé, et qu'on reprend où l'on veut. C'est la
 * seule information réellement utile à quelqu'un qui rouvre l'application après
 * trois semaines — la peur, à cet âge, est d'avoir perdu sa place.
 */
export function RepriseNote({ t, onStart }: { t: Copy; onStart: () => void }) {
  return <section className="side-note gentle-note">
    <span className="section-kicker">{t.today}</span>
    <h3>{t.resumeTitle}</h3>
    <p>{t.resumeBody}</p>
    <button className="text-button" onClick={onStart}>{t.resumeAction} <span aria-hidden="true">→</span></button>
  </section>
}

/**
 * Le bilan de fin de semaine — premier critère de l'issue #18.
 *
 * Une question, cinq réponses, et deux façons d'en sortir : répondre, ou
 * « une autre fois ». Pas de croix qui ferme sans rien dire, pas de « plus
 * tard » qui promette un retour dans l'heure.
 *
 * « Une autre fois » écarte la carte **pour cette visite seulement**, et ce
 * choix se défend : refuser une fois pour toutes, c'est ce que fait
 * l'interrupteur des réglages, qui porte ce nom et qui se retrouve. Un écart
 * qu'on écrirait dans le stockage ferait une troisième mémoire du même choix,
 * plus discrète et impossible à retrouver quand on change d'avis.
 *
 * Une fois répondue, la carte devient une ligne d'accusé de réception qui reste
 * le temps de la visite — le temps de corriger un clic manqué — puis disparaît.
 * Elle ne revient pas avant le samedi suivant : reposer une question déjà
 * répondue est la forme la plus banale du harcèlement doux.
 */
export function BilanCard({ t, repondu, enCours, note, onRepondre, onCorriger, onEcarter, onOpenJournal }: {
  t: Copy
  /** La réponse posée pendant cette visite, ou `null` tant qu'il n'y en a pas. */
  repondu: EtatDeSemaine | null
  /** Une réponse est en vol : les cinq boutons se désarment ensemble. */
  enCours: boolean
  /** Ce qui empêche d'enregistrer — hors ligne, pas de compte — ou une chaîne vide. */
  note: string
  onRepondre: (etat: EtatDeSemaine) => void
  onCorriger: () => void
  onEcarter: () => void
  onOpenJournal: () => void
}) {
  return <section className="prompt-panel checkin-panel">
    <div className="panel-heading"><span className="section-kicker">{t.checkinTitle}</span><span className="private-label">⌁ {t.private}</span></div>
    {repondu
      ? <>
          <h3>{t.checkinSaved}</h3>
          <p>{t[LIBELLE_ETAT[repondu]]}</p>
          <div className="checkin-footer">
            <button className="text-button" onClick={onCorriger}>{t.checkinChange}</button>
            <button className="text-button" onClick={onOpenJournal}>{t.openJournal} ↗</button>
          </div>
          {/* Proposé APRÈS la réponse, jamais à la place : la question du bilan
              se répond en un geste, et glisser un champ de texte au milieu la
              transformerait en devoir. La note, elle, est une entrée de journal
              ordinaire — donc partageable, effaçable et exportable par les
              chemins qui existent déjà. */}
          <p className="journal-note">{t.checkinNote}</p>
        </>
      : <>
          <h3>{t.checkinQuestion}</h3>
          <p>{t.checkinIntro}</p>
          <div className="checkin-choices">{ETATS_DE_SEMAINE.map((etat) => (
            <button className="small-button" key={etat} disabled={enCours || Boolean(note)} onClick={() => onRepondre(etat)}>{t[LIBELLE_ETAT[etat]]}</button>
          ))}</div>
          {/* Pas de bouton là où la base refuserait — la règle du journal, et
              la même ici : hors ligne ou sans compte, rien ne s'enregistrerait
              et le dire vaut mieux que promettre. */}
          {note && <p className="journal-note" role="status">{note}</p>}
          <div className="checkin-footer"><button className="text-button" onClick={onEcarter}>{t.checkinLater}</button></div>
        </>}
  </section>
}

export function TodayView({ session, completedCount, partnerName, t, invitation, bilanRepondu, bilanEnCours, bilanNote, onStart, onOpenJournal, onOpenTandem, onRepondreBilan, onCorrigerBilan, onEcarterBilan }: { session: ReturnType<typeof getJourney>['sessions'][number]; completedCount: number; partnerName: string | null; t: Copy; invitation: InvitationDouce; bilanRepondu: EtatDeSemaine | null; bilanEnCours: boolean; bilanNote: string; onStart: () => void; onOpenJournal: () => void; onOpenTandem: () => void; onRepondreBilan: (etat: EtatDeSemaine) => void; onCorrigerBilan: () => void; onEcarterBilan: () => void }) {
  return <>
    {/* Une invitation douce au plus, jamais deux — la précédence est tranchée
        dans `invitationDouce` et testée là-bas. Quelqu'un qui revient après
        trois semaines remplit les deux conditions en même temps, et empiler un
        mot d'accueil et une question à remplir ferait de son retour une
        formalité. L'accusé de réception, lui, survit à la réponse : ce n'est
        plus une invitation. */}
    {invitation.forme === 'reprise'
      ? <RepriseNote t={t} onStart={onStart} />
      : (invitation.forme === 'bilan' || bilanRepondu)
        ? <BilanCard t={t} repondu={bilanRepondu} enCours={bilanEnCours} note={bilanNote} onRepondre={onRepondreBilan} onCorriger={onCorrigerBilan} onEcarter={onEcarterBilan} onOpenJournal={onOpenJournal} />
        : null}
    <section className="hero-grid">
      <article className="session-card">
        <div className="session-card-top"><span className="pill">{session.theme}</span><span className="duration">{session.duration} min</span></div>
        <div className="ritual-label"><span>{t.ritual}</span><span>{t.daysProgress}</span></div>
        <div className="session-number">0{session.day}</div>
        <h2>{session.title}</h2>
        <p className="verse">{session.verse}</p>
        <div className="session-footer"><span>{t.week}</span><span>{completedCount} / 3 séances testées</span></div>
        <button className="primary-button" onClick={onStart}>{completedCount ? t.resume : t.continue}<span aria-hidden="true">→</span></button>
      </article>
      <aside className="side-note">
        <span className="section-kicker">{t.next}</span>
        <h3>{t.action}</h3>
        <p>{session.action}</p>
        <button className="text-button" onClick={onOpenJournal}>{t.save} <span aria-hidden="true">↗</span></button>
      </aside>
    </section>

    <section className="lower-grid">
      <div className="prompt-panel"><div className="panel-heading"><span className="section-kicker">{t.reflection}</span><span className="private-label">⌁ {t.private}</span></div><h3>{session.prompt}</h3><button className="outline-button" onClick={onOpenJournal}>{t.write}<span aria-hidden="true">→</span></button></div>
      {/* Le vrai nom du partenaire, via tandem_partenaire() — plus jamais un
          nom de maquette. Sans tandem (ou nom pas encore posé), on invite au
          lieu d'inventer, et le badge « actif » n'est plus affirmé à vide. */}
      <div className="tandem-mini"><div className="panel-heading"><span className="section-kicker">{t.yourTandem}</span>{partnerName && <span className="online-badge">● {t.online}</span>}</div>{partnerName
        ? <div className="tandem-person"><div className="avatar avatar-rose">{initialeDe(partnerName)}</div><div><strong>{partnerName}</strong><span>{t.tandemRole}</span></div></div>
        : <div className="tandem-person"><div className="avatar avatar-rose">?</div><div><span>{t.noTandemYet}</span></div></div>}<button className="text-button" onClick={onOpenTandem}>{partnerName ? t.share : t.invite} <span aria-hidden="true">→</span></button></div>
    </section>
  </>
}

export function JourneyView({ journey, completedIds, t, onStart }: { journey: ReturnType<typeof getJourney>; completedIds: string[]; t: Copy; onStart: (sessionId: string) => void }) {
  return <section className="content-section"><div className="section-header"><div><span className="section-kicker">{journey.eyebrow}</span><h2>{journey.title}</h2><p>{journey.description}</p></div><span className="journey-duration">{journey.duration}</span></div><div className="progress-track"><span style={{ width: `${Math.min(100, (completedIds.length / 6) * 100)}%` }} /></div><div className="session-list">{journey.sessions.map((session) => { const done = completedIds.includes(session.id); return <article className={`session-row ${done ? 'done' : ''}`} key={session.id}><div className="day-badge">{done ? '✓' : `0${session.day}`}</div><div className="session-row-copy"><span>{session.theme} · {session.duration} min</span><h3>{session.title}</h3><p>{session.prompt}</p></div><button className={done ? 'completed-button' : 'small-button'} onClick={done ? undefined : () => onStart(session.id)}>{done ? t.completed : t.continue}</button></article> })}</div></section>
}

export function SessionFlow({ session, step, reflection, setReflection, t, onBegin, onFinish, onLeave, onOpenJournal }: { session: ReturnType<typeof getJourney>['sessions'][number]; step: SessionStep; reflection: string; setReflection: (value: string) => void; t: Copy; onBegin: () => void; onFinish: () => void; onLeave: () => void; onOpenJournal: () => void }) {
  const stepIndex = step === 'read' ? 1 : step === 'practice' ? 2 : 3

  return <section className="session-flow content-section">
    <div className="session-flow-top"><button className="text-button" onClick={onLeave}>← {t.leaveSession}</button><span>{session.duration} min · {stepIndex}/3</span></div>
    <div className="flow-progress" aria-label={`${stepIndex} / 3`}><span style={{ width: `${(stepIndex / 3) * 100}%` }} /></div>
    {step === 'read' && <div className="flow-step"><span className="section-kicker">{t.sessionRead}</span><h2>{session.title}</h2><p className="flow-description">{t.sessionReadDescription}</p><div className="flow-verse">{session.verse}</div><div className="flow-actions"><button className="primary-button" onClick={onBegin}>{t.beginReflection}<span aria-hidden="true">→</span></button></div></div>}
    {step === 'practice' && <div className="flow-step"><span className="section-kicker">{t.sessionPractice}</span><h2>{session.prompt}</h2><p className="flow-description">{t.sessionPracticeDescription}</p><div className="flow-prompt"><span>{t.optional}</span><textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder={t.sessionReflectionPlaceholder} /></div><div className="flow-actions"><button className="primary-button" onClick={onFinish}>{t.finishSession}<span aria-hidden="true">→</span></button></div></div>}
    {step === 'complete' && <div className="flow-step flow-done"><div className="flow-mark" aria-hidden="true">✓</div><span className="section-kicker">{t.sessionComplete}</span><h2>{session.title}</h2><p className="flow-description">{t.sessionCompleteDescription}</p><div className="flow-actions"><button className="primary-button" onClick={onLeave}>{t.backToToday}<span aria-hidden="true">→</span></button><button className="text-button" onClick={onOpenJournal}>{t.openJournal} ↗</button></div></div>}
  </section>
}

/**
 * Le journal, et les trois gestes que l'issue #11 lui ajoute : partager une
 * entrée avec son binôme, retirer ce partage, effacer l'entrée.
 *
 * La règle de cette vue : **pas de bouton là où la base refuserait**, et une
 * phrase à la place. C'est la même règle que le panneau de déblocage — « un
 * bouton qui échoue est une promesse trahie » — et elle vaut ici pour quatre
 * refus différents, qui n'ont ni la même cause ni le même remède :
 *
 *   - pas de binôme : il n'y a personne à qui ouvrir quoi que ce soit ;
 *   - relation bloquée ou terminée : `journal_shares_insert_author` refuse, et
 *     les partages déjà posés ne s'ouvrent plus ;
 *   - hors ligne : ces trois gestes ne passent pas par la file de
 *     synchronisation. Mettre un partage en attente reviendrait à afficher
 *     « partagé » sur une décision que le serveur n'a pas encore acceptée ;
 *   - entrée pas encore synchronisée : elle n'existe pas côté base, et le
 *     `exists` du `with check` la refuserait.
 *
 * Le geste « supprimer », lui, reste offert hors session : en mode
 * démonstration le journal n'existe que dans ce navigateur, et l'effacer
 * localement est la vérité entière.
 */
export function JournalView({ entries, draft, setDraft, onAdd, t, partages, partage, enAttente, connecte, enLigne, enCours, onPartager, onRetirer, onSupprimer }: {
  entries: AppState['journalEntries']; draft: string; setDraft: (value: string) => void; onAdd: () => void; t: Copy
  partages: PartageEmis[]
  partage: PartageDuJournal
  /** Identifiants d'entrées encore dans la file hors-ligne. */
  enAttente: string[]
  /** Une session distante existe : les gestes parlent à la base. */
  connecte: boolean
  enLigne: boolean
  /** L'entrée dont un geste est en vol ; les autres restent utilisables. */
  enCours: string | null
  onPartager: (entryId: string) => void; onRetirer: (entryId: string) => void; onSupprimer: (entryId: string) => void
}) {
  const partageParEntree = new Map(partages.map((ligne) => [ligne.entreeId, ligne]))
  // Les gestes distants n'aboutissent qu'en ligne. Hors session, il n'y a pas
  // de distant : la suppression locale reste possible.
  const gestesPossibles = !connecte || enLigne
  const noteDeRefus = connecte && !enLigne ? t.shareOfflineNote
    : partage.raison === 'aucun-tandem' ? t.shareNoTandem
    : partage.raison === 'bloque' ? t.shareBlockedNote
    : partage.raison === 'termine' ? t.shareEndedNote
    : ''

  return <section className="content-section narrow-section">
    <div className="section-header"><div><span className="section-kicker">{t.private}</span><h2>{t.journal}</h2><p>{t.emptyJournal}</p></div><span className="lock-mark" aria-hidden="true">⌁</span></div>
    <div className="journal-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.write} /><div className="composer-footer"><span>{t.privateOnly}</span><button className="primary-button compact" onClick={onAdd}>{t.save} <span aria-hidden="true">→</span></button></div></div>

    {noteDeRefus && <p className="journal-note" role="status">{noteDeRefus}</p>}

    <div className="journal-list">{entries.map((entry) => {
      const partagee = partageParEntree.get(entry.id)
      const attendSaSynchronisation = enAttente.includes(entry.id)
      const occupe = enCours === entry.id
      return <article className="journal-entry" key={entry.id}>
        <div><span className="entry-date">{new Date(entry.createdAt).toLocaleDateString()}</span><span className="entry-mood">{t.present}</span></div>
        <p>{entry.text}</p>
        {/* Dit à l'autrice ce que son binôme peut lire, et depuis quand. Un
            partage muet serait une porte ouverte qu'on oublie. */}
        {partagee && <p className="entry-shared">{t.sharedEntry} · {t.sharedOn} {new Date(partagee.poseLe).toLocaleDateString()}</p>}
        <div className="entry-actions">
          {partagee
            ? <button className="text-button" disabled={!gestesPossibles || occupe} onClick={() => onRetirer(entry.id)}>{t.unshareEntry}</button>
            : partage.peutPartager && gestesPossibles && !attendSaSynchronisation
              ? <button className="text-button" disabled={occupe} onClick={() => onPartager(entry.id)}>{t.shareEntry}</button>
              : null}
          <button className="text-button danger" disabled={!gestesPossibles || occupe} onClick={() => onSupprimer(entry.id)}>{t.deleteEntry}</button>
        </div>
        {attendSaSynchronisation && !partagee && <p className="entry-note">{t.sharePendingNote}</p>}
      </article>
    })}</div>

    {/* Ce que le retrait ne peut pas faire. Dit une fois, sous la liste, plutôt
        qu'à chaque entrée : c'est une propriété du geste, pas une alerte. */}
    {partages.length > 0 && <p className="journal-note">{t.unshareEntryReminder}</p>}
  </section>
}

/**
 * Ce que le binôme a partagé, sous la conversation.
 *
 * Ces entrées ne viennent pas de `journal_entries` — cette table reste
 * own-only, aucune politique n'y ouvre quoi que ce soit à autrui — mais de
 * `journal_partage_avec_moi()`, qui est le seul chemin.
 *
 * Le vide y a deux sens, et les confondre serait mentir : « il ne m'a rien
 * partagé » et « la relation est fermée, ce qui l'était ne s'ouvre plus ». La
 * fonction rend zéro ligne dans les deux cas ; c'est `partage.raison` qui
 * tranche, et le panneau dit lequel des deux.
 */
export function PartagesRecusView({ entrees, erreur, partage, t }: {
  entrees: EntreePartagee[]; erreur: boolean; partage: PartageDuJournal; t: Copy
}) {
  return <section className="content-section narrow-section">
    <div className="section-header"><div><span className="section-kicker">{t.private}</span><h2>{t.sharedWithMe}</h2></div><span className="lock-mark" aria-hidden="true">⌁</span></div>
    {erreur
      ? <p className="journal-note" role="status">{t.syncError}</p>
      : entrees.length
        ? <div className="journal-list">{entrees.map((entree) => <article className="journal-entry" key={entree.entreeId}>
            <div><span className="entry-date">{new Date(entree.ecritLe).toLocaleDateString()}</span><span className="entry-mood">{entree.humeur}</span></div>
            <p>{entree.texte}</p>
            <p className="entry-shared">{t.sharedOn} {new Date(entree.partageLe).toLocaleDateString()}</p>
          </article>)}</div>
        : <p className="journal-note">{partage.peutPartager ? t.sharedWithMeEmpty : t.sharedWithMeClosed}</p>}
  </section>
}

export function TandemView({ partnerName, partnerDeleted, messages, currentUserId, status, affordance, draft, setDraft, onSend, onBlock, onUnblock, onReport, onInvite, t }: { partnerName: string | null; partnerDeleted: boolean; messages: RemoteMessage[]; currentUserId?: string; status: TandemStatus | null; affordance: UnblockAffordance; draft: string; setDraft: (value: string) => void; onSend: () => void; onBlock: () => void; onUnblock: () => void; onReport: () => void; onInvite: () => void; t: Copy }) {
  // `isClosed` décide de la messagerie, `affordance` décide du déblocage. Les
  // deux ne se recouvrent pas : `ended` coupe la conversation sans être un
  // blocage qu'on puisse lever, et une ligne gelée est bloquée sans porte.
  const isEnded = status === 'ended'
  const isClosed = status === 'blocked' || isEnded
  // Jusqu'au 25/08/2026, `ended` empruntait le vocabulaire du blocage : le
  // binôme d'un compte supprimé lisait « Bloqué » et pouvait comprendre que
  // quelqu'un l'avait écarté. Une relation terminée a maintenant ses mots.
  const closedLabel = isEnded ? t.endedStatus : t.blockedStatus
  // Un nom vide sur un compte supprimé n'est pas « pas encore de nom » :
  // `partenaire_supprime` vient de la base et tranche entre les deux.
  const displayedName = partnerDeleted ? t.partnerDeleted : partnerName ?? t.noTandemYet

  return <section className="content-section narrow-section"><div className="section-header"><div><span className="section-kicker">{t.privateConversation}</span><h2>{t.tandem}</h2><p>{t.encouragementMessage}</p></div><div className="section-header-actions"><span className="online-badge">● {isClosed ? closedLabel : t.online}</span><button className="small-button" onClick={onInvite}>{t.invite}</button></div></div><div className="tandem-header"><div className="avatar avatar-rose avatar-large">{initialeDe(partnerDeleted ? null : partnerName)}</div><div><h3>{displayedName}</h3><p>{t.tandemRole}</p></div><span className="status-chip">{isClosed ? closedLabel : t.activeStatus}</span></div><div className="message-thread">{messages.length ? messages.map((message) => <div className={`message ${message.senderId === currentUserId ? 'sent' : 'received'}`} key={message.id}>{message.body}<span>{new Date(message.createdAt).toLocaleString()}</span></div>) : <div className="message-empty">{t.emptyThread}</div>}</div><div className="message-composer"><input disabled={isClosed} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSend()} placeholder={isClosed ? t.messageUnavailable : t.encouragement} /><button disabled={isClosed} className="primary-button compact" onClick={onSend}>{t.send}</button></div>

    {/* `affordance` rend `hidden` sur une relation terminée — il n'y a rien à
        lever. Le panneau ci-dessous est donc le sien, et il dit ce qui est
        possible ensuite plutôt que de laisser un écran muet. */}
    {isEnded && <div className="block-panel" role="status">
      <span className="section-kicker">{t.endedStatus}</span>
      <p>{t.tandemEndedNote}</p>
    </div>}

    {affordance !== 'hidden' && <div className="block-panel" role="status">
      <span className="section-kicker">{t.blockedStatus}</span>
      {affordance === 'unblockable' && <>
        <p>{t.unblockOwnerNote}</p>
        <button className="outline-button" onClick={onUnblock}>{t.unblock}<span aria-hidden="true">→</span></button>
      </>}
      {/* Pas de bouton ici : la politique le refuserait, et un bouton qui
          échoue est une promesse trahie. La phrase remplace le geste. */}
      {affordance === 'blocked-by-other' && <p>{t.unblockOtherNote}</p>}
      {affordance === 'frozen' && <p>{t.unblockFrozenNote}</p>}
    </div>}

    <div className="safety-actions"><button className="text-button danger" onClick={onReport}>{t.report}</button>{!isClosed && <button className="text-button" onClick={onBlock}>{t.block}</button>}</div></section>
}
