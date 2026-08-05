import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AppState, Locale } from '@agapeplay/domain'
import { supabase, supabaseConfigured } from './lib/supabaseClient'
import { getJourney } from './mockData'
import { loadPublishedJourney } from '@agapeplay/content'
import { enqueueSync, readSyncQueue, removeSync } from './offlineQueue'
import { initialState, loadState, saveState } from './storage'
import { copy } from './i18n/copy'
import type { Tab, SessionStep, RemoteMessage, MentorSnapshot, ChurchSnapshot } from '@agapeplay/domain'
import {
  AuthDialog, TrustDialog, SettingsDialog, InviteDialog, MentorView, ChurchView,
  NavItem, TodayView, JourneyView, SessionFlow, JournalView, TandemView,
} from './views'



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
  const [trustOpen, setTrustOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [remoteTandemId, setRemoteTandemId] = useState<string | null>(null)
  const [remoteTandemStatus, setRemoteTandemStatus] = useState<'active' | 'paused' | 'blocked' | 'ended' | null>(null)
  const [remoteMessages, setRemoteMessages] = useState<RemoteMessage[]>([])
  const [remoteJourney, setRemoteJourney] = useState<ReturnType<typeof getJourney> | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingSync, setPendingSync] = useState(() => readSyncQueue().length)
  const [mentorSnapshot, setMentorSnapshot] = useState<MentorSnapshot>(null)
  const [churchSnapshot, setChurchSnapshot] = useState<ChurchSnapshot>(null)

  const t = copy[state.locale]
  const fallbackJourney = useMemo(() => getJourney(state.locale), [state.locale])
  const journey = remoteJourney ?? fallbackJourney
  const currentSession = journey.sessions.find((session) => !state.completedSessionIds.includes(session.id)) ?? journey.sessions[0]
  const completedCount = state.completedSessionIds.length

  const showNotice = (message: string, duration = 2600) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), duration)
  }

  useEffect(() => {
    const client = supabase
    if (!client) return
    let cancelled = false
    void loadPublishedJourney(client, state.locale).then((nextJourney) => {
      if (!cancelled) setRemoteJourney(nextJourney)
    })
    return () => { cancelled = true }
  }, [state.locale])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client || !authSession || !isOnline) return
    let cancelled = false

    const flushQueue = async () => {
      for (const operation of readSyncQueue()) {
        if (cancelled) return
        let error: unknown = null
        if (operation.kind === 'session_progress') {
          error = (await client.from('session_progress').upsert(operation.payload as { user_id: string; journey_id: string; session_id: string })).error
        } else if (operation.kind === 'journal_entry') {
          error = (await client.from('journal_entries').upsert(operation.payload as { id: string; user_id: string; text: string; mood: string; created_at: string })).error
        } else if (operation.kind === 'tandem_message') {
          error = (await client.from('tandem_messages').upsert(operation.payload as { id: string; tandem_id: string; sender_id: string; body: string })).error
        } else {
          error = (await client.from('notification_preferences').upsert(operation.payload as { user_id: string; sessions: boolean; messages: boolean; church: boolean; absence: boolean; updated_at: string })).error
        }
        if (error) break
        removeSync(operation.id)
      }
      if (!cancelled) setPendingSync(readSyncQueue().length)
    }

    void flushQueue()
    return () => { cancelled = true }
  }, [authSession?.user.id, isOnline])

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
      const [progressResult, journalResult, profileResult] = await Promise.all([
        client.from('session_progress').select('session_id').eq('user_id', authSession.user.id),
        client.from('journal_entries').select('id, text, mood, created_at').eq('user_id', authSession.user.id).order('created_at', { ascending: false }),
        client.from('profiles').select('age_confirmed_at, privacy_consent_at, terms_consent_at, account_status').eq('id', authSession.user.id).maybeSingle(),
      ])

      if (cancelled) return
      if (progressResult.error || journalResult.error || profileResult.error) {
        setNotice(t.syncError)
        return
      }

      if (!profileResult.data?.age_confirmed_at || !profileResult.data.privacy_consent_at || !profileResult.data.terms_consent_at) {
        setTrustOpen(true)
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

      const profileUpsertResult = await client.from('profiles').upsert({ id: authSession.user.id, display_name: 'Claire', locale: state.locale })
      if (profileUpsertResult.error && !cancelled) showNotice(t.syncError, 4200)

      const preferencesResult = await client.from('notification_preferences').select('sessions, messages, church, absence').eq('user_id', authSession.user.id).maybeSingle()
      if (preferencesResult.data && !preferencesResult.error && !cancelled) {
        setState((previous) => ({ ...previous, notificationPrefs: { ...previous.notificationPrefs, ...preferencesResult.data } }))
      }

      const [mentorResult, membershipResult] = await Promise.all([
        client.from('mentor_profiles').select('verification_status, training_status').eq('user_id', authSession.user.id).maybeSingle(),
        client.from('church_members').select('church_id, role').eq('user_id', authSession.user.id).eq('status', 'active').limit(1),
      ])
      if (!cancelled) {
        setMentorSnapshot(mentorResult.data ? { verificationStatus: mentorResult.data.verification_status, trainingStatus: mentorResult.data.training_status } : null)
        const membership = membershipResult.data?.[0]
        if (membership) {
          const groupMembershipResult = await client.from('group_members').select('group_id').eq('user_id', authSession.user.id)
          setChurchSnapshot({ churchId: membership.church_id, role: membership.role, groupCount: groupMembershipResult.data?.length ?? 0 })
        } else {
          setChurchSnapshot(null)
        }
      }

      const tandemResult = await client.from('tandems').select('id, status, created_at').or(`participant_a_id.eq.${authSession.user.id},participant_b_id.eq.${authSession.user.id}`).order('created_at', { ascending: false }).limit(1)
      const remoteTandem = tandemResult.data?.[0]
      if (tandemResult.error) {
        if (!cancelled) showNotice(t.syncError, 4200)
      } else if (remoteTandem) {
        setRemoteTandemId(remoteTandem.id)
        setRemoteTandemStatus(remoteTandem.status)
        const messagesResult = await client.from('tandem_messages').select('id, sender_id, body, created_at').eq('tandem_id', remoteTandem.id).order('created_at', { ascending: true })
        if (messagesResult.error) {
          if (!cancelled) showNotice(t.syncError, 4200)
        } else {
          setRemoteMessages((messagesResult.data ?? []).map((message) => ({ id: message.id, senderId: message.sender_id, body: message.body, createdAt: message.created_at })))
        }
      }

      const invitationToken = new URLSearchParams(window.location.search).get('invite')
      if (invitationToken) {
        const invitationResult = await client.rpc('accept_tandem_invitation', { p_token: invitationToken })
        window.history.replaceState({}, '', window.location.pathname)
        if (!cancelled) showNotice(invitationResult.error ? t.inviteAcceptError : t.inviteAccepted, 4200)
      }
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
          if (error) {
            enqueueSync({ id: `progress:${authSession.user.id}:${sessionId}`, kind: 'session_progress', payload: { user_id: authSession.user.id, journey_id: 'repartir-avec-jesus', session_id: sessionId } })
            setPendingSync(readSyncQueue().length)
            showNotice(t.offline, 4200)
          }
        })
        if (journalEntry) void Promise.resolve(supabase.from('journal_entries').insert({ id: journalEntry.id, user_id: authSession.user.id, text: journalEntry.text, mood: journalEntry.mood, created_at: journalEntry.createdAt })).then(({ error }) => {
          if (error) {
            enqueueSync({ id: `journal:${journalEntry.id}`, kind: 'journal_entry', payload: { id: journalEntry.id, user_id: authSession.user.id, text: journalEntry.text, mood: journalEntry.mood, created_at: journalEntry.createdAt } })
            setPendingSync(readSyncQueue().length)
            showNotice(t.offline, 4200)
          }
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
      if (error) {
        enqueueSync({ id: `journal:${entry.id}`, kind: 'journal_entry', payload: { id: entry.id, user_id: authSession.user.id, text: entry.text, mood: entry.mood, created_at: entry.createdAt } })
        setPendingSync(readSyncQueue().length)
        showNotice(t.offline, 4200)
      }
    })
    setJournalDraft('')
    showNotice(t.saved)
  }

  const sendMessage = async () => {
    const body = messageDraft.trim()
    if (!body || remoteTandemStatus === 'blocked' || remoteTandemStatus === 'ended') return
    if (supabase && authSession && remoteTandemId) {
      const messageId = crypto.randomUUID()
      const { data, error } = await supabase.from('tandem_messages').insert({ id: messageId, tandem_id: remoteTandemId, sender_id: authSession.user.id, body }).select('id, sender_id, body, created_at').single()
      if (error || !data) {
        enqueueSync({ id: `message:${messageId}`, kind: 'tandem_message', payload: { id: messageId, tandem_id: remoteTandemId, sender_id: authSession.user.id, body } })
        setPendingSync(readSyncQueue().length)
        showNotice(t.messageUnavailable, 4200)
        return
      }
      setRemoteMessages((previous) => [...previous, { id: data.id, senderId: data.sender_id, body: data.body, createdAt: data.created_at }])
      setMessageDraft('')
      return
    }
    if (!body) return
    update({ ...state, tandem: { ...state.tandem, lastMessage: body, lastMessageAt: 'À l’instant' } })
    setMessageDraft('')
  }

  const blockTandem = async () => {
    if (!supabase || !authSession || !remoteTandemId) {
      showNotice(t.blockNotice, 4200)
      return
    }
    const { error } = await supabase.from('tandems').update({ status: 'blocked', ended_at: new Date().toISOString() }).eq('id', remoteTandemId)
    if (error) {
      showNotice(t.syncError, 4200)
      return
    }
    setRemoteTandemStatus('blocked')
    showNotice(t.blockedNotice, 4200)
  }

  const reportTandem = async () => {
    if (!supabase || !authSession || !remoteTandemId) {
      showNotice(t.reportNotice, 4200)
      return
    }
    const { error } = await supabase.from('tandem_reports').insert({ tandem_id: remoteTandemId, reporter_id: authSession.user.id, reason: 'Signalement depuis la conversation' })
    showNotice(error ? t.syncError : t.reportSent, 4200)
  }

  const resetDemo = () => update(initialState)

  const signOut = () => {
    if (supabase) void supabase.auth.signOut()
  }

  const saveTrust = async () => {
    if (!supabase || !authSession) return
    if (!ageConfirmed || !privacyAccepted || !termsAccepted) {
      showNotice(t.trustRequired, 4200)
      return
    }
    const now = new Date().toISOString()
    const { error } = await supabase.from('profiles').upsert({
      id: authSession.user.id,
      display_name: 'Claire',
      locale: state.locale,
      age_confirmed_at: now,
      privacy_consent_at: now,
      terms_consent_at: now,
      account_status: 'active',
    })
    if (error) {
      showNotice(t.syncError, 4200)
      return
    }
    setTrustOpen(false)
  }

  const requestDeletion = async () => {
    if (!supabase || !authSession) return
    const { error } = await supabase.from('profiles').update({ account_status: 'deletion_requested', deletion_requested_at: new Date().toISOString() }).eq('id', authSession.user.id)
    if (error) {
      showNotice(t.syncError, 4200)
      return
    }
    setSettingsOpen(false)
    showNotice(t.deletionRequested, 4200)
  }

  const toggleNotification = async (key: keyof AppState['notificationPrefs'], value: boolean) => {
    const notificationPrefs = { ...state.notificationPrefs, [key]: value }
    update({ ...state, notificationPrefs })
    if (supabase && authSession) {
      const { error } = await supabase.from('notification_preferences').upsert({ user_id: authSession.user.id, ...notificationPrefs, updated_at: new Date().toISOString() })
      if (error) {
        enqueueSync({ id: `notifications:${authSession.user.id}`, kind: 'notification_preferences', payload: { user_id: authSession.user.id, ...notificationPrefs, updated_at: new Date().toISOString() } })
        setPendingSync(readSyncQueue().length)
        showNotice(t.offline, 4200)
      }
    }
  }

  const createInvitation = async () => {
    if (!supabase || !authSession) {
      showNotice(t.inviteRequiresAuth, 4200)
      return
    }
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    const { data, error } = await supabase.from('tandem_invitations').insert({ inviter_id: authSession.user.id, invitee_email: email }).select('token').single()
    if (error || !data) {
      showNotice(t.syncError, 4200)
      return
    }
    setInviteLink(`${window.location.origin}/?invite=${data.token}`)
    showNotice(t.inviteCreated, 4200)
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
          <NavItem active={state.activeTab === 'mentor'} label={t.mentor} onClick={() => setTab('mentor')} icon="⌁" />
          <NavItem active={state.activeTab === 'church'} label={t.church} onClick={() => setTab('church')} icon="⌂" />
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
          <button className="quiet-button" onClick={() => setSettingsOpen(true)}>{t.settings}</button>
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

        {(!isOnline || pendingSync > 0) && <div className="offline-banner" role="status">{t.offline}{pendingSync > 0 ? ` · ${pendingSync}` : ''}</div>}

        {supabaseConfigured && <div className="auth-strip"><span>{authSession ? `${t.signedIn} · ${authSession.user.email ?? ''}` : t.signIn}</span>{authSession ? <button onClick={signOut}>{t.signOut}</button> : <button onClick={() => setAuthOpen(true)}>{t.signIn} →</button>}</div>}

        {authOpen && <AuthDialog t={t} loading={authLoading} onClose={() => setAuthOpen(false)} />}
        {trustOpen && <TrustDialog t={t} ageConfirmed={ageConfirmed} setAgeConfirmed={setAgeConfirmed} privacyAccepted={privacyAccepted} setPrivacyAccepted={setPrivacyAccepted} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} onSave={() => void saveTrust()} />}
        {settingsOpen && <SettingsDialog t={t} prefs={state.notificationPrefs} onToggle={(key, value) => void toggleNotification(key, value)} onClose={() => setSettingsOpen(false)} onRequestDeletion={() => void requestDeletion()} />}
        {inviteOpen && <InviteDialog t={t} email={inviteEmail} setEmail={setInviteEmail} link={inviteLink} onCreate={() => void createInvitation()} onClose={() => { setInviteOpen(false); setInviteLink('') }} />}

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
            {state.activeTab === 'tandem' && <TandemView tandem={state.tandem} messages={remoteMessages} currentUserId={authSession?.user.id} status={remoteTandemStatus} draft={messageDraft} setDraft={setMessageDraft} onSend={() => void sendMessage()} onBlock={() => void blockTandem()} onReport={() => void reportTandem()} onInvite={() => setInviteOpen(true)} t={t} />}
            {state.activeTab === 'mentor' && <MentorView snapshot={mentorSnapshot} t={t} />}
            {state.activeTab === 'church' && <ChurchView snapshot={churchSnapshot} t={t} />}
          </>
        )}
      </main>
    </div>
  )
}

export default App