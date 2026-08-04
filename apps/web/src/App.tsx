import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AppState, Locale } from './domain'
import { supabase, supabaseConfigured } from './lib/supabaseClient'
import { getJourney } from './mockData'
import { loadPublishedJourney } from './content'
import { enqueueSync, readSyncQueue, removeSync } from './offlineQueue'
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
    trustTitle: 'Avant de commencer',
    trustDescription: 'AgapePlay garde tes espaces personnels privés. Confirme les points suivants pour continuer.',
    ageConfirm: 'J’ai 16 ans ou plus.',
    privacyConsent: 'J’accepte la politique de confidentialité et l’usage nécessaire de mes données pour faire fonctionner mon compte.',
    termsConsent: 'J’accepte les règles d’utilisation d’AgapePlay.',
    continueTrust: 'Continuer',
    trustRequired: 'Confirme les trois points pour continuer.',
    settingsTitle: 'Réglages du compte',
    accountStatus: 'Statut du compte',
    deleteAccount: 'Demander la suppression',
    deleteAccountDescription: 'Ta demande sera traitée selon la procédure de suppression documentée. Tes données locales restent disponibles jusqu’à confirmation.',
    requestDeletion: 'Demander la suppression',
    deletionRequested: 'Demande de suppression enregistrée.',
    cancel: 'Annuler',
    notificationDescription: 'Choisis les rappels qui te servent, séparément.',
    sessionNotifications: 'Séances quotidiennes',
    messageNotifications: 'Messages du tandem',
    churchNotifications: 'Vie de l’église',
    absenceNotifications: 'Rappel après une absence',
    invite: 'Inviter mon tandem',
    inviteDescription: 'L’invitation est privée et expire après 7 jours.',
    inviteEmail: 'Email de la personne',
    createInvite: 'Créer l’invitation',
    inviteCreated: 'Invitation créée. Tu peux partager ce lien.',
    copyInvite: 'Copier le lien',
    inviteRequiresAuth: 'Connecte-toi pour créer une invitation privée.',
    inviteAccepted: 'Invitation acceptée. Votre tandem est actif.',
    inviteAcceptError: 'Cette invitation est invalide, expirée ou réservée à une autre adresse.',
    blockedStatus: 'Bloqué',
    blockedNotice: 'Cette relation est maintenant bloquée.',
    reportSent: 'Signalement transmis à la modération.',
    messageUnavailable: 'La conversation est indisponible pour le moment.',
    offline: 'Hors connexion · les changements seront synchronisés au retour.',
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
    trustTitle: 'Before you begin',
    trustDescription: 'AgapePlay keeps your personal spaces private. Confirm the following to continue.',
    ageConfirm: 'I am 16 or older.',
    privacyConsent: 'I accept the privacy policy and the data use needed to operate my account.',
    termsConsent: 'I accept AgapePlay’s terms of use.',
    continueTrust: 'Continue',
    trustRequired: 'Confirm all three points to continue.',
    settingsTitle: 'Account settings',
    accountStatus: 'Account status',
    deleteAccount: 'Request deletion',
    deleteAccountDescription: 'Your request will follow the documented deletion process. Local data stays available until confirmation.',
    requestDeletion: 'Request deletion',
    deletionRequested: 'Deletion request recorded.',
    cancel: 'Cancel',
    notificationDescription: 'Choose the reminders that serve you, separately.',
    sessionNotifications: 'Daily sessions',
    messageNotifications: 'Tandem messages',
    churchNotifications: 'Church life',
    absenceNotifications: 'Reminder after absence',
    invite: 'Invite my tandem',
    inviteDescription: 'The invitation is private and expires after 7 days.',
    inviteEmail: 'Person’s email',
    createInvite: 'Create invitation',
    inviteCreated: 'Invitation created. You can share this link.',
    copyInvite: 'Copy link',
    inviteRequiresAuth: 'Sign in to create a private invitation.',
    inviteAccepted: 'Invitation accepted. Your tandem is active.',
    inviteAcceptError: 'This invitation is invalid, expired, or reserved for another email.',
    blockedStatus: 'Blocked',
    blockedNotice: 'This relationship is now blocked.',
    reportSent: 'Report sent to moderation.',
    messageUnavailable: 'The conversation is unavailable right now.',
    offline: 'Offline · changes will sync when you are back online.',
  },
} as const

type Tab = AppState['activeTab']
type SessionStep = 'read' | 'practice' | 'complete'
type RemoteMessage = { id: string; senderId: string; body: string; createdAt: string }

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

function TrustDialog({ t, ageConfirmed, setAgeConfirmed, privacyAccepted, setPrivacyAccepted, termsAccepted, setTermsAccepted, onSave }: { t: Copy; ageConfirmed: boolean; setAgeConfirmed: (value: boolean) => void; privacyAccepted: boolean; setPrivacyAccepted: (value: boolean) => void; termsAccepted: boolean; setTermsAccepted: (value: boolean) => void; onSave: () => void }) {
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

function SettingsDialog({ t, prefs, onToggle, onClose, onRequestDeletion }: { t: Copy; prefs: AppState['notificationPrefs']; onToggle: (key: keyof AppState['notificationPrefs'], value: boolean) => void; onClose: () => void; onRequestDeletion: () => void }) {
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

function InviteDialog({ t, email, setEmail, link, onCreate, onClose }: { t: Copy; email: string; setEmail: (value: string) => void; link: string; onCreate: () => void; onClose: () => void }) {
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

function TandemView({ tandem, messages, currentUserId, status, draft, setDraft, onSend, onBlock, onReport, onInvite, t }: { tandem: AppState['tandem']; messages: RemoteMessage[]; currentUserId?: string; status: 'active' | 'paused' | 'blocked' | 'ended' | null; draft: string; setDraft: (value: string) => void; onSend: () => void; onBlock: () => void; onReport: () => void; onInvite: () => void; t: Copy }) {
  const isBlocked = status === 'blocked' || status === 'ended'
  return <section className="content-section narrow-section"><div className="section-header"><div><span className="section-kicker">{t.privateConversation}</span><h2>{t.tandem}</h2><p>{t.encouragementMessage}</p></div><div className="section-header-actions"><span className="online-badge">● {isBlocked ? t.blockedStatus : t.online}</span><button className="small-button" onClick={onInvite}>{t.invite}</button></div></div><div className="tandem-header"><div className="avatar avatar-rose avatar-large">É</div><div><h3>{tandem.name}</h3><p>{t.tandemQuote}</p></div><span className="status-chip">{isBlocked ? t.blockedStatus : t.activeStatus}</span></div><div className="message-thread">{messages.length ? messages.map((message) => <div className={`message ${message.senderId === currentUserId ? 'sent' : 'received'}`} key={message.id}>{message.body}<span>{new Date(message.createdAt).toLocaleString()}</span></div>) : <><div className="message received">{tandem.lastMessage}<span>{tandem.lastMessageAt}</span></div><div className="message sent">{t.prayerPhrase}<span>{t.yesterday}</span></div></>}</div><div className="message-composer"><input disabled={isBlocked} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSend()} placeholder={isBlocked ? t.messageUnavailable : t.encouragement} /><button disabled={isBlocked} className="primary-button compact" onClick={onSend}>{t.send}</button></div><div className="safety-actions"><button className="text-button danger" onClick={onReport}>{t.report}</button><button className="text-button" onClick={onBlock}>{t.block}</button></div></section>
}

export default App
