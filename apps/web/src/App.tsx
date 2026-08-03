import { useMemo, useState } from 'react'
import type { AppState, Locale } from './domain'
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
  },
} as const

type Tab = AppState['activeTab']

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [journalDraft, setJournalDraft] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [notice, setNotice] = useState('')

  const t = copy[state.locale]
  const journey = useMemo(() => getJourney(state.locale), [state.locale])
  const currentSession = journey.sessions.find((session) => !state.completedSessionIds.includes(session.id)) ?? journey.sessions[0]
  const completedCount = state.completedSessionIds.length

  const update = (next: AppState) => {
    setState(next)
    saveState(next)
  }

  const setTab = (activeTab: Tab) => update({ ...state, activeTab })

  const toggleLocale = (locale: Locale) => update({ ...state, locale })

  const completeSession = (sessionId: string) => {
    if (!state.completedSessionIds.includes(sessionId)) {
      update({ ...state, completedSessionIds: [...state.completedSessionIds, sessionId] })
      setNotice(t.completed)
      window.setTimeout(() => setNotice(''), 2600)
    }
  }

  const addJournalEntry = () => {
    const text = journalDraft.trim()
    if (!text) return
    update({
      ...state,
      journalEntries: [
        { id: crypto.randomUUID(), createdAt: new Date().toISOString(), text, mood: 'Présent' },
        ...state.journalEntries,
      ],
    })
    setJournalDraft('')
    setNotice(t.saved)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const sendMessage = () => {
    if (!messageDraft.trim()) return
    update({ ...state, tandem: { ...state.tandem, lastMessage: messageDraft.trim(), lastMessageAt: 'À l’instant' } })
    setMessageDraft('')
  }

  const resetDemo = () => update(initialState)

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
          <div><strong>{t.mock}</strong><span>{t.mockDescription}</span></div>
          <button onClick={resetDemo}>{t.reset}</button>
        </div>

        {notice && <div className="toast" role="status">{notice}</div>}

        {state.activeTab === 'today' && (
          <TodayView
            session={currentSession}
            completedCount={completedCount}
            t={t}
            onComplete={() => completeSession(currentSession.id)}
            onOpenJournal={() => setTab('journal')}
            onOpenTandem={() => setTab('tandem')}
          />
        )}
        {state.activeTab === 'journey' && <JourneyView journey={journey} completedIds={state.completedSessionIds} t={t} onComplete={completeSession} />}
        {state.activeTab === 'journal' && <JournalView entries={state.journalEntries} draft={journalDraft} setDraft={setJournalDraft} onAdd={addJournalEntry} t={t} />}
        {state.activeTab === 'tandem' && <TandemView tandem={state.tandem} draft={messageDraft} setDraft={setMessageDraft} onSend={sendMessage} t={t} />}
      </main>
    </div>
  )
}

function NavItem({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><span aria-hidden="true">{icon}</span>{label}</button>
}

type Copy = (typeof copy)['fr'] | (typeof copy)['en']

function TodayView({ session, completedCount, t, onComplete, onOpenJournal, onOpenTandem }: { session: ReturnType<typeof getJourney>['sessions'][number]; completedCount: number; t: Copy; onComplete: () => void; onOpenJournal: () => void; onOpenTandem: () => void }) {
  return <>
    <section className="hero-grid">
      <article className="session-card">
        <div className="session-card-top"><span className="pill">{session.theme}</span><span className="duration">{session.duration} min</span></div>
        <div className="session-number">0{session.day}</div>
        <h2>{session.title}</h2>
        <p className="verse">{session.verse}</p>
        <div className="session-footer"><span>{t.week}</span><span>{completedCount} / 3 séances testées</span></div>
        <button className="primary-button" onClick={onComplete}>{completedCount ? t.resume : t.continue}<span aria-hidden="true">→</span></button>
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

function JourneyView({ journey, completedIds, t, onComplete }: { journey: ReturnType<typeof getJourney>; completedIds: string[]; t: Copy; onComplete: (sessionId: string) => void }) {
  return <section className="content-section"><div className="section-header"><div><span className="section-kicker">{journey.eyebrow}</span><h2>{journey.title}</h2><p>{journey.description}</p></div><span className="journey-duration">{journey.duration}</span></div><div className="progress-track"><span style={{ width: `${Math.min(100, (completedIds.length / 6) * 100)}%` }} /></div><div className="session-list">{journey.sessions.map((session) => { const done = completedIds.includes(session.id); return <article className={`session-row ${done ? 'done' : ''}`} key={session.id}><div className="day-badge">{done ? '✓' : `0${session.day}`}</div><div className="session-row-copy"><span>{session.theme} · {session.duration} min</span><h3>{session.title}</h3><p>{session.prompt}</p></div><button className={done ? 'completed-button' : 'small-button'} onClick={done ? undefined : () => onComplete(session.id)}>{done ? t.completed : t.continue}</button></article> })}</div></section>
}

function JournalView({ entries, draft, setDraft, onAdd, t }: { entries: AppState['journalEntries']; draft: string; setDraft: (value: string) => void; onAdd: () => void; t: Copy }) {
  return <section className="content-section narrow-section"><div className="section-header"><div><span className="section-kicker">{t.private}</span><h2>{t.journal}</h2><p>{t.emptyJournal}</p></div><span className="lock-mark" aria-hidden="true">⌁</span></div><div className="journal-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.write} /><div className="composer-footer"><span>{t.privateOnly}</span><button className="primary-button compact" onClick={onAdd}>{t.save} <span aria-hidden="true">→</span></button></div></div><div className="journal-list">{entries.map((entry) => <article className="journal-entry" key={entry.id}><div><span className="entry-date">{new Date(entry.createdAt).toLocaleDateString()}</span><span className="entry-mood">{t.present}</span></div><p>{entry.text}</p></article>)}</div></section>
}

function TandemView({ tandem, draft, setDraft, onSend, t }: { tandem: AppState['tandem']; draft: string; setDraft: (value: string) => void; onSend: () => void; t: Copy }) {
  return <section className="content-section narrow-section"><div className="section-header"><div><span className="section-kicker">{t.privateConversation}</span><h2>{t.tandem}</h2><p>{t.encouragementMessage}</p></div><span className="online-badge">● {t.online}</span></div><div className="tandem-header"><div className="avatar avatar-rose avatar-large">É</div><div><h3>{tandem.name}</h3><p>{t.tandemQuote}</p></div><span className="status-chip">{t.activeStatus}</span></div><div className="message-thread"><div className="message received">{tandem.lastMessage}<span>{tandem.lastMessageAt}</span></div><div className="message sent">{t.prayerPhrase}<span>{t.yesterday}</span></div></div><div className="message-composer"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSend()} placeholder={t.encouragement} /><button className="primary-button compact" onClick={onSend}>{t.send}</button></div><div className="safety-actions"><button className="text-button danger" onClick={() => window.alert(t.reportNotice)}>{t.report}</button><button className="text-button" onClick={() => window.alert(t.blockNotice)}>{t.block}</button></div></section>
}

export default App
