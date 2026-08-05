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
import type { AppState } from '../domain'
import { getJourney } from '../mockData'
import type { Copy } from '../i18n/copy'
import type { SessionStep, RemoteMessage, MentorSnapshot, ChurchSnapshot } from '../types'

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

  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" onClick={(event) => event.stopPropagation()}>
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
    </section>
  </div>
}

export function TrustDialog({ t, ageConfirmed, setAgeConfirmed, privacyAccepted, setPrivacyAccepted, termsAccepted, setTermsAccepted, onSave }: { t: Copy; ageConfirmed: boolean; setAgeConfirmed: (value: boolean) => void; privacyAccepted: boolean; setPrivacyAccepted: (value: boolean) => void; termsAccepted: boolean; setTermsAccepted: (value: boolean) => void; onSave: () => void }) {
  return <div className="auth-dialog-backdrop" role="presentation">
    <section className="auth-dialog trust-dialog" role="dialog" aria-modal="true" aria-labelledby="trust-dialog-title">
      <div className="auth-dialog-top"><span className="section-kicker">AgapePlay</span></div>
      <h2 id="trust-dialog-title">{t.trustTitle}</h2>
      <p>{t.trustDescription}</p>
      <div className="trust-checks">
        <label><input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /> <span>{t.ageConfirm}</span></label>
        <label><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} /> <span>{t.privacyConsent}</span></label>
        <label><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /> <span>{t.termsConsent}</span></label>
      </div>
      <button className="primary-button" onClick={onSave}>{t.continueTrust}<span aria-hidden="true">→</span></button>
    </section>
  </div>
}

export function SettingsDialog({ t, prefs, onToggle, onClose, onRequestDeletion }: { t: Copy; prefs: AppState['notificationPrefs']; onToggle: (key: keyof AppState['notificationPrefs'], value: boolean) => void; onClose: () => void; onRequestDeletion: () => void }) {
  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section className="auth-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title" onClick={(event) => event.stopPropagation()}>
      <div className="auth-dialog-top"><span className="section-kicker">AgapePlay</span><button className="text-button" onClick={onClose} aria-label={t.close}>×</button></div>
      <h2 id="settings-dialog-title">{t.settingsTitle}</h2>
      <p>{t.protected}</p>
      <div className="notification-settings">
        <strong>{t.notifications}</strong>
        <p>{t.notificationDescription}</p>
        <label><input type="checkbox" checked={prefs.sessions} onChange={(event) => onToggle('sessions', event.target.checked)} /> <span>{t.sessionNotifications}</span></label>
        <label><input type="checkbox" checked={prefs.messages} onChange={(event) => onToggle('messages', event.target.checked)} /> <span>{t.messageNotifications}</span></label>
        <label><input type="checkbox" checked={prefs.church} onChange={(event) => onToggle('church', event.target.checked)} /> <span>{t.churchNotifications}</span></label>
        <label><input type="checkbox" checked={prefs.absence} onChange={(event) => onToggle('absence', event.target.checked)} /> <span>{t.absenceNotifications}</span></label>
      </div>
      <div className="settings-danger-zone">
        <strong>{t.deleteAccount}</strong>
        <p>{t.deleteAccountDescription}</p>
        <button className="outline-button danger" onClick={onRequestDeletion}>{t.requestDeletion}</button>
      </div>
    </section>
  </div>
}

export function InviteDialog({ t, email, setEmail, link, onCreate, onClose }: { t: Copy; email: string; setEmail: (value: string) => void; link: string; onCreate: () => void; onClose: () => void }) {
  const copyLink = () => {
    if (link) void navigator.clipboard.writeText(link)
  }

  return <div className="auth-dialog-backdrop" role="presentation" onClick={onClose}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" onClick={(event) => event.stopPropagation()}>
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

export function MentorView({ snapshot, t }: { snapshot: MentorSnapshot; t: Copy }) {
  const verification = snapshot?.verificationStatus === 'verified' ? t.verifiedStatus : t.pendingStatus
  const training = snapshot?.trainingStatus === 'completed' ? t.completedStatus : t.requiredStatus

  return <section className="content-section workspace-section">
    <div className="section-header"><div><span className="section-kicker">{t.mentorWorkspace}</span><h2>{t.mentorWorkspace}</h2><p>{t.mentorPrivateRule}</p></div><span className="workspace-glyph" aria-hidden="true">⌁</span></div>
    <div className="workspace-grid">
      <article className="workspace-card"><span className="section-kicker">{t.mentorVerification}</span><strong>{verification}</strong><p>{snapshot ? t.requiredStatus : t.mentorEmpty}</p></article>
      <article className="workspace-card"><span className="section-kicker">{t.mentorTraining}</span><strong>{training}</strong><p>{t.mentorPrivateRule}</p></article>
    </div>
    {!snapshot && <div className="workspace-empty"><span className="workspace-empty-mark" aria-hidden="true">—</span><strong>{t.workspacePending}</strong><p>{t.mentorEmpty}</p></div>}
  </section>
}

export function ChurchView({ snapshot, t }: { snapshot: ChurchSnapshot; t: Copy }) {
  const roleLabels = { member: t.memberRole, mentor: t.mentorRole, leader: t.leaderRole, admin: t.adminRole }
  return <section className="content-section workspace-section">
    <div className="section-header"><div><span className="section-kicker">{t.churchWorkspace}</span><h2>{t.churchWorkspace}</h2><p>{t.aggregateStatsDescription}</p></div><span className="workspace-glyph" aria-hidden="true">⌂</span></div>
    {!snapshot ? <div className="workspace-empty"><span className="workspace-empty-mark" aria-hidden="true">—</span><strong>{t.workspacePending}</strong><p>{t.churchEmpty}</p></div> : <>
      <div className="workspace-grid">
        <article className="workspace-card"><span className="section-kicker">{t.roleLabel}</span><strong>{roleLabels[snapshot.role]}</strong><p>{t.churchWorkspace}</p></article>
        <article className="workspace-card"><span className="section-kicker">{t.churchGroups}</span><strong>{snapshot.groupCount}</strong><p>{t.groupsLabel}</p></article>
      </div>
      <div className="workspace-empty"><span className="workspace-empty-mark" aria-hidden="true">◌</span><strong>{t.aggregateStats}</strong><p>{t.statsEmpty}</p></div>
    </>}
  </section>
}

export function NavItem({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><span aria-hidden="true">{icon}</span>{label}</button>
}


export function TodayView({ session, completedCount, t, onStart, onOpenJournal, onOpenTandem }: { session: ReturnType<typeof getJourney>['sessions'][number]; completedCount: number; t: Copy; onStart: () => void; onOpenJournal: () => void; onOpenTandem: () => void }) {
  return <>
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
      <div className="tandem-mini"><div className="panel-heading"><span className="section-kicker">{t.yourTandem}</span><span className="online-badge">● {t.online}</span></div><div className="tandem-person"><div className="avatar avatar-rose">É</div><div><strong>Élodie Martin</strong><span>{t.tandemQuote}</span></div></div><button className="text-button" onClick={onOpenTandem}>{t.share} <span aria-hidden="true">→</span></button></div>
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

export function JournalView({ entries, draft, setDraft, onAdd, t }: { entries: AppState['journalEntries']; draft: string; setDraft: (value: string) => void; onAdd: () => void; t: Copy }) {
  return <section className="content-section narrow-section"><div className="section-header"><div><span className="section-kicker">{t.private}</span><h2>{t.journal}</h2><p>{t.emptyJournal}</p></div><span className="lock-mark" aria-hidden="true">⌁</span></div><div className="journal-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.write} /><div className="composer-footer"><span>{t.privateOnly}</span><button className="primary-button compact" onClick={onAdd}>{t.save} <span aria-hidden="true">→</span></button></div></div><div className="journal-list">{entries.map((entry) => <article className="journal-entry" key={entry.id}><div><span className="entry-date">{new Date(entry.createdAt).toLocaleDateString()}</span><span className="entry-mood">{t.present}</span></div><p>{entry.text}</p></article>)}</div></section>
}

export function TandemView({ tandem, messages, currentUserId, status, draft, setDraft, onSend, onBlock, onReport, onInvite, t }: { tandem: AppState['tandem']; messages: RemoteMessage[]; currentUserId?: string; status: 'active' | 'paused' | 'blocked' | 'ended' | null; draft: string; setDraft: (value: string) => void; onSend: () => void; onBlock: () => void; onReport: () => void; onInvite: () => void; t: Copy }) {
  const isBlocked = status === 'blocked' || status === 'ended'
  return <section className="content-section narrow-section"><div className="section-header"><div><span className="section-kicker">{t.privateConversation}</span><h2>{t.tandem}</h2><p>{t.encouragementMessage}</p></div><div className="section-header-actions"><span className="online-badge">● {isBlocked ? t.blockedStatus : t.online}</span><button className="small-button" onClick={onInvite}>{t.invite}</button></div></div><div className="tandem-header"><div className="avatar avatar-rose avatar-large">É</div><div><h3>{tandem.name}</h3><p>{t.tandemQuote}</p></div><span className="status-chip">{isBlocked ? t.blockedStatus : t.activeStatus}</span></div><div className="message-thread">{messages.length ? messages.map((message) => <div className={`message ${message.senderId === currentUserId ? 'sent' : 'received'}`} key={message.id}>{message.body}<span>{new Date(message.createdAt).toLocaleString()}</span></div>) : <><div className="message received">{tandem.lastMessage}<span>{tandem.lastMessageAt}</span></div><div className="message sent">{t.prayerPhrase}<span>{t.yesterday}</span></div></>}</div><div className="message-composer"><input disabled={isBlocked} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSend()} placeholder={isBlocked ? t.messageUnavailable : t.encouragement} /><button disabled={isBlocked} className="primary-button compact" onClick={onSend}>{t.send}</button></div><div className="safety-actions"><button className="text-button danger" onClick={onReport}>{t.report}</button><button className="text-button" onClick={onBlock}>{t.block}</button></div></section>
}
