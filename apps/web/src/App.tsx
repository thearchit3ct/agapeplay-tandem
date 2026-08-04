import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AppState, Locale } from './domain'
import { supabase, supabaseConfigured } from './lib/supabaseClient'
import { getJourney } from './mockData'
import { initialState, loadState, saveState } from './storage'

const copy = {
  fr: {
    greeting: 'Bonjour, Claire',
    subtitle: 'Un petit pas, accompagné.',
    today: "Aujourd'hui",
    journey: 'Parcours',
    tandem: 'Tandem',
    journal: 'Journal',
    continue: 'Commencer la séance',
    resume: 'Reprendre la séance',
    completed: 'Séance terminée',
    week: 'Semaine 1 sur 6',
    private: 'Privé par défaut',
    save: 'Garder dans mon journal',
    saved: 'Ajouté à ton journal',
    write: 'Écris ce que tu gardes de ce moment…',
    send: 'Envoyer',
    share: 'Partager avec Élodie',
    shared: 'Partagé avec Élodie',
    report: 'Signaler un problème',
    block: 'Bloquer cette relation',
    settings: 'Réglages',
    notifications: 'Notifications',
    emptyJournal: 'Ton journal est un espace à toi. Rien ne sera partagé sans ton choix.',
    language: 'Langue',
    reset: 'Réinitialiser la démo',
    mock: 'Mode démonstration',
    mockDescription: 'Les données sont locales à cet appareil. Les services réels seront branchés plus tard.',
    backendReady: 'Supabase prêt · mode démonstration',
    backendReadyDescription: 'Le projet distant est configuré. L’authentification et la synchronisation seront activées ensuite.',
    backendConnected: 'Supabase connecté',
    backendConnectedDescription: 'Ton parcours et ton journal privé peuvent maintenant être synchronisés.',
    signIn: 'Se connecter',
    signedIn: 'Connecté',
    signOut: 'Se déconnecter',
    email: 'Adresse email',
    magicLinkDescription: 'Reçois un lien de connexion unique, sans mot de passe.',
    sendMagicLink: 'Recevoir mon lien',
    continueWithGoogle: 'Continuer avec Google',
    continueWithMicrosoft: 'Continuer avec Microsoft',
    orEmail: 'ou avec ton email',
    magicLinkSent: 'Lien envoyé. Consulte ta boîte mail pour continuer.',
    authError: 'Impossible de se connecter pour le moment.',
    close: 'Fermer',
    syncError: 'La synchronisation a rencontré un problème. Tes données locales restent disponibles.',
    next: 'Prochaine étape',
    action: 'À mettre en pratique',
    encouragement: 'Écris un encouragement…',
    online: 'Actif',
    protected: 'Tes espaces privés restent privés.',
    reflection: 'Réflexion',
    yourTandem: 'Ton tandem',
    privateConversation: 'Conversation privée',
    privateOnly: 'Visible uniquement par toi',
    participant: 'Participant',
    encouragementMessage: 'Un espace pour s’encourager sans devenir un outil de surveillance.',
    tandemQuote: '« On avance ensemble. »',
    prayerPhrase: 'Je garde une phrase de prière pour ce soir.',
    yesterday: 'Hier',
    present: 'Présent',
    activeStatus: 'Actif',
    reportNotice: 'Signalement localisé dans cette démo. Il sera transmis à l’église et à AgapePlay dans la version connectée.',
    blockNotice: 'Le blocage supprimera immédiatement la relation dans la version connectée.',
    ritual: 'Rituel du jour',
    daysProgress: '3 repères sur 6',
    sessionRead: 'Recevoir',
    sessionReadDescription: 'Lis doucement. Rien à réussir, seulement un moment pour être présent.',
    sessionPractice: 'Répondre',
    sessionPracticeDescription: 'Garde une phrase, une image ou une prière qui vient maintenant.',
    sessionReflectionPlaceholder: 'J’écris ce que je veux garder…',
    optional: 'Facultatif',
    beginReflection: 'Prendre ce temps',
    finishSession: 'Terminer la séance',
    backToToday: 'Revenir à aujourd’hui',
    openJournal: 'Ouvrir mon journal',
    sessionComplete: 'Tu as pris ce temps.',
    sessionCompleteDescription: 'Ce petit pas compte. Tu peux le laisser ici, ou le partager avec ton tandem quand tu le souhaites.',
    leaveSession: 'Quitter la séance',
  },
  en: {
    greeting: 'Good morning, Claire',
    subtitle: 'One small step, with someone beside you.',
    today: 'Today',
    journey: 'Journey',
    tandem: 'Tandem',
    journal: 'Journal',
    continue: 'Start session',
    resume: 'Resume session',
    completed: 'Session completed',
    week: 'Week 1 of 6',
    private: 'Private by default',
    save: 'Keep in my journal',
    saved: 'Added to your journal',
    write: 'Write what you are taking from this moment…',
    send: 'Send',
    share: 'Share with Elodie',
    shared: 'Shared with Elodie',
    report: 'Report a problem',
    block: 'Block this relationship',
    settings: 'Settings',
    notifications: 'Notifications',
    emptyJournal: 'Your journal is yours. Nothing is shared without your choice.',
    language: 'Language',
    reset: 'Reset demo',
    mock: 'Demo mode',
    mockDescription: 'Data is local to this device. Real services will be connected later.',
    backendReady: 'Supabase ready · demo mode',
    backendReadyDescription: 'The remote project is configured. Authentication and sync will be enabled next.',
    backendConnected: 'Supabase connected',
    backendConnectedDescription: 'Your journey and private journal can now be synchronized.',
    signIn: 'Sign in',
    signedIn: 'Signed in',
    signOut: 'Sign out',
    email: 'Email address',
    magicLinkDescription: 'Receive a one-time sign-in link, with no password.',
    sendMagicLink: 'Send my link',
    continueWithGoogle: 'Continue with Google',
    continueWithMicrosoft: 'Continue with Microsoft',
    orEmail: 'or with your email',
    magicLinkSent: 'Link sent. Check your inbox to continue.',
    authError: 'Unable to sign in right now.',
    close: 'Close',
    syncError: 'Sync ran into a problem. Your local data is still available.',
    next: 'Next step',
    action: 'Put it into practice',
    encouragement: 'Write an encouragement…',
    online: 'Active',
    protected: 'Your private spaces stay private.',
    reflection: 'Reflection',
    yourTandem: 'Your tandem',
    privateConversation: 'Private conversation',
    privateOnly: 'Visible only to you',
    participant: 'Participant',
    encouragementMessage: 'A space to encourage one another without becoming a monitoring tool.',
    tandemQuote: '“We are moving forward together.”',
    prayerPhrase: 'I am keeping one sentence of prayer for tonight.',
    yesterday: 'Yesterday',
    present: 'Present',
    activeStatus: 'Active',
    reportNotice: 'This demo keeps the report local. In the connected version, it will be sent to the church and AgapePlay.',
    blockNotice: 'Blocking will immediately remove the relationship in the connected version.',
    ritual: 'Today’s ritual',
    daysProgress: '3 markers out of 6',
    sessionRead: 'Receive',
    sessionReadDescription: 'Read slowly. There is nothing to achieve, only a moment to be present.',
    sessionPractice: 'Respond',
    sessionPracticeDescription: 'Keep one sentence, image, or prayer that comes to you now.',
    sessionReflectionPlaceholder: 'Write what you want to keep…',
    optional: 'Optional',
    beginReflection: 'Take this time',
    finishSession: 'Finish session',
    backToToday: 'Back to today',
    openJournal: 'Open my journal',
    sessionComplete: 'You took this time.',
    sessionCompleteDescription: 'This small step matters. Keep it here, or share it with your tandem when you are ready.',
    leaveSession: 'Leave session',
  },
} as const

type Tab = AppState['activeTab']
type SessionStep = 'read' | 'practice' | 'complete'

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [journalDraft, setJournalDraft] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [notice, setNotice] = useState('')
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)
  const [sessionStep, setSessionStep] = useState<SessionStep>('read')
  const [sessionReflection, setSessionReflection] = useState('')
  const [authSession, setAuthSession] = useState<Session | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)

  const t = copy[state.locale]
  const journey = useMemo(() => getJourney(state.locale), [state.locale])
  const currentSession = journey.sessions.find((session) => !state.completedSessionIds.includes(session.id)) ?? journey.sessions[0]
  const completedCount = state.completedSessionIds.length

  const showNotice = (message: string, duration = 2600) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), duration)
  }

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setAuthSession(data.session)
        setAuthLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!cancelled) setAuthSession(nextSession)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client || !authSession) return
    let cancelled = false

    const loadRemoteState = async () => {
      const [progressResult, journalResult] = await Promise.all([
        client.from('session_progress').select('session_id').eq('user_id', authSession.user.id),
        client.from('journal_entries').select('id, text, mood, created_at').eq('user_id', authSession.user.id).order('created_at', { ascending: false }),
      ])

      if (cancelled) return
      if (progressResult.error || journalResult.error) {
        setNotice(t.syncError)
        return
      }

      const remoteCompletedIds = (progressResult.data ?? []).map((row) => row.session_id)
      const remoteEntries = (journalResult.data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        text: row.text,
        mood: row.mood,
      }))

      setState((previous) => {
        const entriesById = new Map([...previous.journalEntries, ...remoteEntries].map((entry) => [entry.id, entry]))
        const next = {
          ...previous,
          completedSessionIds: [...new Set([...previous.completedSessionIds, ...remoteCompletedIds])],
          journalEntries: [...entriesById.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }
        saveState(next)
        return next
      })

      const profileResult = await client.from('profiles').upsert({ id: authSession.user.id, display_name: 'Claire', locale: state.locale })
      if (profileResult.error && !cancelled) showNotice(t.syncError, 4200)
    }

    void loadRemoteState()
    return () => { cancelled = true }
  }, [authSession?.user.id])

  const update = (next: AppState) => {
    setState(next)
    saveState(next)
  }

  const setTab = (activeTab: Tab) => update({ ...state, activeTab })

  const toggleLocale = (locale: Locale) => update({ ...state, locale })

  const completeSession = (sessionId: string, reflection = '') => {
    if (!state.completedSessionIds.includes(sessionId)) {
      const trimmedReflection = reflection.trim()
      const journalEntry = trimmedReflection
        ? { id: crypto.randomUUID(), createdAt: new Date().toISOString(), text: trimmedReflection, mood: 'Présent' }
        : null
      update({
        ...state,
        completedSessionIds: [...state.completedSessionIds, sessionId],
        journalEntries: journalEntry ? [journalEntry, ...state.journalEntries] : state.journalEntries,
      })
      if (supabase && authSession) {
        void Promise.resolve(supabase.from('session_progress').upsert({ user_id: authSession.user.id, journey_id: 'repartir-avec-jesus', session_id: sessionId })).then(({ error }) => {
          if (error) showNotice(t.syncError, 4200)
        })
        if (journalEntry) void Promise.resolve(supabase.from('journal_entries').insert({ id: journalEntry.id, user_id: authSession.user.id, text: journalEntry.text, mood: journalEntry.mood, created_at: journalEntry.createdAt })).then(({ error }) => {
          if (error) showNotice(t.syncError, 4200)
        })
      }
      showNotice(t.completed)
    }
  }

  const openSession = (sessionId: string) => {
    setOpenSessionId(sessionId)
    setSessionStep('read')
    setSessionReflection('')
  }

  const leaveSession = () => {
    setOpenSessionId(null)
    setSessionStep('read')
    setSessionReflection('')
  }

  const finishSession = () => {
    if (!openSessionId) return
    completeSession(openSessionId, sessionReflection)
    setSessionStep('complete')
  }

  const addJournalEntry = () => {
    const text = journalDraft.trim()
    if (!text) return
    const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), text, mood: 'Présent' }
    update({ ...state, journalEntries: [entry, ...state.journalEntries] })
    if (supabase && authSession) void Promise.resolve(supabase.from('journal_entries').insert({ id: entry.id, user_id: authSession.user.id, text: entry.text, mood: entry.mood, created_at: entry.createdAt })).then(({ error }) => {
      if (error) showNotice(t.syncError, 4200)
    })
    setJournalDraft('')
    showNotice(t.saved)
  }

  const sendMessage = () => {
    if (!messageDraft.trim()) return
    update({ ...state, tandem: { ...state.tandem, lastMessage: messageDraft.trim(), lastMessageAt: 'À l’instant' } })
    setMessageDraft('')
  }

  const resetDemo = () => update(initialState)

  const signOut = () => {
    if (supabase) void supabase.auth.signOut()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div>
            <strong>AgapePlay</strong>
            <span>Tandem</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Navigation principale">
          <NavItem active={state.activeTab === 'today'} label={t.today} onClick={() => setTab('today')} icon="✦" />
          <NavItem active={state.activeTab === 'journey'} label={t.journey} onClick={() => setTab('journey')} icon="◷" />
          <NavItem active={state.activeTab === 'tandem'} label={t.tandem} onClick={() => setTab('tandem')} icon="↗" />
          <NavItem active={state.activeTab === 'journal'} label={t.journal} onClick={() => setTab('journal')} icon="▤" />
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-chip">
            <div className="avatar">C</div>
            <div>
              <strong>Claire</strong>
              <span>{t.participant}</span>
            </div>
            <span className="status-dot" aria-label={t.online} />
          </div>
          <button className="quiet-button" onClick={() => setNotice(t.protected)}>{t.settings}</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t.mock}</p>
            <h1>{t.greeting}</h1>
            <p className="subtitle">{t.subtitle}</p>
          </div>
          <div className="topbar-actions">
            <div className="locale-switcher" aria-label={t.language}>
              <button className={state.locale === 'fr' ? 'active' : ''} onClick={() => toggleLocale('fr')}>FR</button>
              <button className={state.locale === 'en' ? 'active' : ''} onClick={() => toggleLocale('en')}>EN</button>
            </div>
            <div className="avatar avatar-large">C</div>
          </div>
        </header>

        <div className="demo-banner">
          <span className="demo-pulse" aria-hidden="true" />
          <div><strong>{authSession ? t.backendConnected : supabaseConfigured ? t.backendReady : t.mock}</strong><span>{authSession ? t.backendConnectedDescription : supabaseConfigured ? t.backendReadyDescription : t.mockDescription}</span></div>
          <button onClick={resetDemo}>{t.reset}</button>
        </div>

        {supabaseConfigured && <div className="auth-strip"><span>{authSession ? `${t.signedIn} · ${authSession.user.email ?? ''}` : t.signIn}</span>{authSession ? <button onClick={signOut}>{t.signOut}</button> : <button onClick={() => setAuthOpen(true)}>{t.signIn} →</button>}</div>}

        {authOpen && <AuthDialog t={t} loading={authLoading} onClose={() => setAuthOpen(false)} />}

        {notice && <div className="toast" role="status">{notice}</div>}

        {openSessionId ? (
          <SessionFlow
            session={journey.sessions.find((session) => session.id === openSessionId) ?? currentSession}
            step={sessionStep}
            reflection={sessionReflection}
            setReflection={setSessionReflection}
            t={t}
            onBegin={() => setSessionStep('practice')}
            onFinish={finishSession}
            onLeave={leaveSession}
            onOpenJournal={() => { leaveSession(); setTab('journal') }}
          />
        ) : (
          <>
            {state.activeTab === 'today' && (
              <TodayView
                session={currentSession}
                completedCount={completedCount}
                t={t}
                onStart={() => openSession(currentSession.id)}
                onOpenJournal={() => setTab('journal')}
                onOpenTandem={() => setTab('tandem')}
              />
            )}
            {state.activeTab === 'journey' && <JourneyView journey={journey} completedIds={state.completedSessionIds} t={t} onStart={openSession} />}
            {state.activeTab === 'journal' && <JournalView entries={state.journalEntries} draft={journalDraft} setDraft={setJournalDraft} onAdd={addJournalEntry} t={t} />}
            {state.activeTab === 'tandem' && <TandemView tandem={state.tandem} draft={messageDraft} setDraft={setMessageDraft} onSend={sendMessage} t={t} />}
          </>
        )}
      </main>
    </div>
  )
}

function AuthDialog({ t, loading, onClose }: { t: Copy; loading: boolean; onClose: () => void }) {
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

function NavItem({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><span aria-hidden="true">{icon}</span>{label}</button>
}

type Copy = (typeof copy)['fr'] | (typeof copy)['en']

function TodayView({ session, completedCount, t, onStart, onOpenJournal, onOpenTandem }: { session: ReturnType<typeof getJourney>['sessions'][number]; completedCount: number; t: Copy; onStart: () => void; onOpenJournal: () => void; onOpenTandem: () => void }) {
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

function JourneyView({ journey, completedIds, t, onStart }: { journey: ReturnType<typeof getJourney>; completedIds: string[]; t: Copy; onStart: (sessionId: string) => void }) {
  return <section className="content-section"><div className="section-header"><div><span className="section-kicker">{journey.eyebrow}</span><h2>{journey.title}</h2><p>{journey.description}</p></div><span className="journey-duration">{journey.duration}</span></div><div className="progress-track"><span style={{ width: `${Math.min(100, (completedIds.length / 6) * 100)}%` }} /></div><div className="session-list">{journey.sessions.map((session) => { const done = completedIds.includes(session.id); return <article className={`session-row ${done ? 'done' : ''}`} key={session.id}><div className="day-badge">{done ? '✓' : `0${session.day}`}</div><div className="session-row-copy"><span>{session.theme} · {session.duration} min</span><h3>{session.title}</h3><p>{session.prompt}</p></div><button className={done ? 'completed-button' : 'small-button'} onClick={done ? undefined : () => onStart(session.id)}>{done ? t.completed : t.continue}</button></article> })}</div></section>
}

function SessionFlow({ session, step, reflection, setReflection, t, onBegin, onFinish, onLeave, onOpenJournal }: { session: ReturnType<typeof getJourney>['sessions'][number]; step: SessionStep; reflection: string; setReflection: (value: string) => void; t: Copy; onBegin: () => void; onFinish: () => void; onLeave: () => void; onOpenJournal: () => void }) {
  const stepIndex = step === 'read' ? 1 : step === 'practice' ? 2 : 3

  return <section className="session-flow content-section">
    <div className="session-flow-top"><button className="text-button" onClick={onLeave}>← {t.leaveSession}</button><span>{session.duration} min · {stepIndex}/3</span></div>
    <div className="flow-progress" aria-label={`${stepIndex} / 3`}><span style={{ width: `${(stepIndex / 3) * 100}%` }} /></div>
    {step === 'read' && <div className="flow-step"><span className="section-kicker">{t.sessionRead}</span><h2>{session.title}</h2><p className="flow-description">{t.sessionReadDescription}</p><div className="flow-verse">{session.verse}</div><div className="flow-actions"><button className="primary-button" onClick={onBegin}>{t.beginReflection}<span aria-hidden="true">→</span></button></div></div>}
    {step === 'practice' && <div className="flow-step"><span className="section-kicker">{t.sessionPractice}</span><h2>{session.prompt}</h2><p className="flow-description">{t.sessionPracticeDescription}</p><div className="flow-prompt"><span>{t.optional}</span><textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder={t.sessionReflectionPlaceholder} /></div><div className="flow-actions"><button className="primary-button" onClick={onFinish}>{t.finishSession}<span aria-hidden="true">→</span></button></div></div>}
    {step === 'complete' && <div className="flow-step flow-done"><div className="flow-mark" aria-hidden="true">✓</div><span className="section-kicker">{t.sessionComplete}</span><h2>{session.title}</h2><p className="flow-description">{t.sessionCompleteDescription}</p><div className="flow-actions"><button className="primary-button" onClick={onLeave}>{t.backToToday}<span aria-hidden="true">→</span></button><button className="text-button" onClick={onOpenJournal}>{t.openJournal} ↗</button></div></div>}
  </section>
}

function JournalView({ entries, draft, setDraft, onAdd, t }: { entries: AppState['journalEntries']; draft: string; setDraft: (value: string) => void; onAdd: () => void; t: Copy }) {
  return <section className="content-section narrow-section"><div className="section-header"><div><span className="section-kicker">{t.private}</span><h2>{t.journal}</h2><p>{t.emptyJournal}</p></div><span className="lock-mark" aria-hidden="true">⌁</span></div><div className="journal-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.write} /><div className="composer-footer"><span>{t.privateOnly}</span><button className="primary-button compact" onClick={onAdd}>{t.save} <span aria-hidden="true">→</span></button></div></div><div className="journal-list">{entries.map((entry) => <article className="journal-entry" key={entry.id}><div><span className="entry-date">{new Date(entry.createdAt).toLocaleDateString()}</span><span className="entry-mood">{t.present}</span></div><p>{entry.text}</p></article>)}</div></section>
}

function TandemView({ tandem, draft, setDraft, onSend, t }: { tandem: AppState['tandem']; draft: string; setDraft: (value: string) => void; onSend: () => void; t: Copy }) {
  return <section className="content-section narrow-section"><div className="section-header"><div><span className="section-kicker">{t.privateConversation}</span><h2>{t.tandem}</h2><p>{t.encouragementMessage}</p></div><span className="online-badge">● {t.online}</span></div><div className="tandem-header"><div className="avatar avatar-rose avatar-large">É</div><div><h3>{tandem.name}</h3><p>{t.tandemQuote}</p></div><span className="status-chip">{t.activeStatus}</span></div><div className="message-thread"><div className="message received">{tandem.lastMessage}<span>{tandem.lastMessageAt}</span></div><div className="message sent">{t.prayerPhrase}<span>{t.yesterday}</span></div></div><div className="message-composer"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSend()} placeholder={t.encouragement} /><button className="primary-button compact" onClick={onSend}>{t.send}</button></div><div className="safety-actions"><button className="text-button danger" onClick={() => window.alert(t.reportNotice)}>{t.report}</button><button className="text-button" onClick={() => window.alert(t.blockNotice)}>{t.block}</button></div></section>
}

export default App
