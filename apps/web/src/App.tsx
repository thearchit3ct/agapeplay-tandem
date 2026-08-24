import { useEffect, useMemo, useState } from 'react'
import { initialeDe, nomDepuisIdentite, prochaineSeance } from '@agapeplay/domain'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AppState, Locale, Session as Seance } from '@agapeplay/domain'
import { supabase, supabaseConfigured } from './lib/supabaseClient'
import { getJourney } from './mockData'
import { loadPublishedJourney } from '@agapeplay/content'
import { enqueueSync, readSyncQueue, removeSync } from './offlineQueue'
import { initialState, loadState, saveState } from './storage'
import { copy } from '@agapeplay/content/copy/web'
import { unblockAffordance } from '@agapeplay/domain'
import type { Tab, SessionStep, RemoteMessage, MentorSnapshot, ChurchSnapshot, TandemStatus } from '@agapeplay/domain'
import type { DossierModeration, StatutSignalement } from '@agapeplay/domain'
import { changerStatut, chargerDossiers, chargerJournal, estModerateur } from './moderation'
import type { LigneJournal } from './moderation'
import { chargerInvitations, revoquerInvitation } from './invitations'
import type { InvitationEmise } from './invitations'
import type { Invitation } from '@agapeplay/domain'
import {
  AuthDialog, TrustDialog, SettingsDialog, InviteDialog, UnblockDialog, MentorView, ChurchView,
  NavItem, TodayView, JourneyView, SessionFlow, JournalView, TandemView, ModerationView,
  InvitationsView,
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
  // Le nom du partenaire vient de tandem_partenaire() — seul chemin de lecture
  // du profil d'autrui — et le sien de sa propre ligne profiles. NULL/'' tant
  // que la synchronisation n'a pas répondu : l'écran invite au lieu d'inventer.
  const [remotePartnerName, setRemotePartnerName] = useState<string | null>(null)
  const [ownName, setOwnName] = useState('')
  const [remoteTandemStatus, setRemoteTandemStatus] = useState<TandemStatus | null>(null)
  const [remoteTandemBlockedBy, setRemoteTandemBlockedBy] = useState<string | null>(null)
  const [unblockOpen, setUnblockOpen] = useState(false)
  const [remoteMessages, setRemoteMessages] = useState<RemoteMessage[]>([])
  const [remoteJourney, setRemoteJourney] = useState<ReturnType<typeof getJourney> | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingSync, setPendingSync] = useState(() => readSyncQueue().length)
  const [mentorSnapshot, setMentorSnapshot] = useState<MentorSnapshot>(null)
  const [churchSnapshot, setChurchSnapshot] = useState<ChurchSnapshot>(null)
  // Espace modérateur. `moderateur` commande l'existence de l'onglet, rien de
  // plus : chaque politique en dessous rappelle tandem_est_moderateur(), si
  // bien qu'un compte qui forcerait l'onglet lirait une liste vide et verrait
  // ses décisions refusées. Le test client évite d'ouvrir une porte close.
  const [moderateur, setModerateur] = useState(false)
  const [dossiers, setDossiers] = useState<DossierModeration[]>([])
  const [moderationChargement, setModerationChargement] = useState(false)
  const [moderationErreur, setModerationErreur] = useState(false)
  const [journaux, setJournaux] = useState<Record<string, LigneJournal[] | null>>({})
  const [journalOuvert, setJournalOuvert] = useState<string | null>(null)
  const [decisionEnCours, setDecisionEnCours] = useState<string | null>(null)
  // Incrémenté par « Relire la liste ». Passer par une dépendance d'effet plutôt
  // que par un appel direct garde la garde de démontage sur un seul chemin.
  const [relectureModeration, setRelectureModeration] = useState(0)
  // Suivi des invitations. `relectureInvitations` suit le même motif que la
  // modération : le bouton et les évènements (création, annulation) poussent
  // le compteur, et l'unique effet qui écoute porte la garde de démontage.
  const [invitationsEmises, setInvitationsEmises] = useState<InvitationEmise[]>([])
  const [invitationsRecues, setInvitationsRecues] = useState<Invitation[]>([])
  const [invitationsChargement, setInvitationsChargement] = useState(false)
  const [invitationsErreur, setInvitationsErreur] = useState(false)
  const [annulationEnCours, setAnnulationEnCours] = useState<string | null>(null)
  const [relectureInvitations, setRelectureInvitations] = useState(0)
  // L'instant qui juge la péremption, figé à chaque lecture. Un `new Date()`
  // au rendu ferait qu'une invitation change d'état au milieu d'un clic — et
  // rendrait la vue impossible à éprouver.
  const [instantLecture, setInstantLecture] = useState(() => new Date())

  const t = copy[state.locale]
  const fallbackJourney = useMemo(() => getJourney(state.locale), [state.locale])
  const journey = remoteJourney ?? fallbackJourney
  // Une seule règle, partagée avec le mobile : voir packages/domain/src/blocking.ts.
  const affordance = unblockAffordance({
    status: remoteTandemStatus,
    blockedBy: remoteTandemBlockedBy,
    currentUserId: authSession?.user.id,
  })
  // Un onglet `moderation` peut survivre dans le stockage local après le
  // retrait du rôle — le retrait est immédiat côté base, par conception. On
  // retombe alors sur l'accueil au lieu d'afficher un écran qui ne lira rien.
  const activeTab: Tab = state.activeTab === 'moderation' && !moderateur ? 'today' : state.activeTab
  // La règle vit dans `packages/domain/src/parcours.ts`, avec ses tests : elle
  // décide du premier écran de la journée et elle porte une décision qu'on ne
  // relisait nulle part — ce qui arrive quand tout est fait.
  //
  // L'affirmation de type dit tout haut ce que cet écran suppose depuis
  // toujours : un parcours a au moins une séance. `prochaineSeance` rend
  // `undefined` sur un parcours vide, comme l'expression qu'elle remplace, et
  // afficher quelque chose dans ce cas-là est une question de produit ouverte,
  // pas un effet de bord de l'extraction.
  const currentSession = prochaineSeance(journey.sessions, state.completedSessionIds) as Seance
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

  // Le portail : posé à chaque changement de session, jamais mémorisé plus
  // longtemps. `tandem_est_moderateur()` n'a pas de paramètre — elle ne répond
  // que sur l'appelant — et une erreur vaut « non » : un onglet absent est plus
  // honnête qu'un onglet mort.
  useEffect(() => {
    const client = supabase
    if (!client || !authSession) {
      setModerateur(false)
      return
    }
    let cancelled = false
    void estModerateur(client).then((oui) => { if (!cancelled) setModerateur(oui) })
    return () => { cancelled = true }
  }, [authSession?.user.id])

  // Les dossiers ne se chargent qu'une fois l'onglet ouvert : rien n'oblige un
  // modérateur qui vient écrire son journal à télécharger les signalements.
  useEffect(() => {
    const client = supabase
    if (!client || !moderateur || activeTab !== 'moderation') return
    let cancelled = false
    setModerationChargement(true)
    void chargerDossiers(client).then(({ dossiers: lus, erreur }) => {
      if (cancelled) return
      setDossiers(lus)
      setModerationErreur(erreur)
      setModerationChargement(false)
    })
    return () => { cancelled = true }
  }, [moderateur, activeTab, relectureModeration])

  // Les invitations ne se lisent qu'une fois l'onglet du tandem ouvert. Comme
  // pour la modération : rien n'oblige quelqu'un qui vient écrire son journal
  // à sonder `tandem_contact_bloque` pour chaque invitation vivante — un
  // parcours séquentiel d'`auth.users` à chaque fois, coût énoncé dans
  // `20260806161500_invitation_bloquee`.
  useEffect(() => {
    const client = supabase
    if (!client || !authSession || activeTab !== 'tandem') return
    let cancelled = false
    const instant = new Date()
    setInstantLecture(instant)
    setInvitationsChargement(true)
    void chargerInvitations(client, authSession.user.id, instant).then(({ emises, recues, erreur }) => {
      if (cancelled) return
      setInvitationsEmises(emises)
      setInvitationsRecues(recues)
      setInvitationsErreur(erreur)
      setInvitationsChargement(false)
    })
    return () => { cancelled = true }
  }, [authSession?.user.id, activeTab, relectureInvitations])

  useEffect(() => {
    const client = supabase
    if (!client || !authSession) return
    let cancelled = false

    const loadRemoteState = async () => {
      const [progressResult, journalResult, profileResult] = await Promise.all([
        client.from('session_progress').select('session_id').eq('user_id', authSession.user.id),
        client.from('journal_entries').select('id, text, mood, created_at').eq('user_id', authSession.user.id).order('created_at', { ascending: false }),
        client.from('profiles').select('display_name, age_confirmed_at, privacy_consent_at, terms_consent_at, account_status').eq('id', authSession.user.id).maybeSingle(),
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

      // Jusqu'au 24/08/2026, cet upsert écrasait display_name avec « Claire »
      // à chaque chargement — le champ même que tandem_partenaire() montre au
      // partenaire. On sème depuis l'identité de connexion (Google/Microsoft,
      // sinon l'email) uniquement quand le nom est vide, et on n'y touche plus.
      const nomExistant = (profileResult.data?.display_name ?? '').trim()
      const nomAffiche = nomExistant || nomDepuisIdentite(authSession.user.user_metadata, authSession.user.email)
      if (!cancelled) setOwnName(nomAffiche)
      const profileUpsertResult = await client.from('profiles').upsert({ id: authSession.user.id, display_name: nomAffiche, locale: state.locale })
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

      // `blocked_by` fait partie de la sélection depuis le 06/08/2026 : sans
      // elle, l'écran savait qu'un tandem était bloqué mais pas par qui, et ne
      // pouvait donc montrer le chemin de déblocage qu'à celui qui a bloqué.
      // `tandems_select_member` ne regarde pas le statut : la ligne — et cette
      // colonne — restent lisibles par les deux participants même bloquées.
      const tandemResult = await client.from('tandems').select('id, status, blocked_by, created_at').or(`participant_a_id.eq.${authSession.user.id},participant_b_id.eq.${authSession.user.id}`).order('created_at', { ascending: false }).limit(1)
      const remoteTandem = tandemResult.data?.[0]
      if (tandemResult.error) {
        if (!cancelled) showNotice(t.syncError, 4200)
      } else if (remoteTandem) {
        setRemoteTandemId(remoteTandem.id)
        setRemoteTandemStatus(remoteTandem.status)
        setRemoteTandemBlockedBy(remoteTandem.blocked_by)
        const partenaireResult = await client.rpc('tandem_partenaire')
        if (!partenaireResult.error && !cancelled) {
          const ligne = (partenaireResult.data as Array<{ tandem_id: string; display_name: string | null }> | null)?.find((l) => l.tandem_id === remoteTandem.id)
          // Nom NULL = partenaire sans ligne profiles encore (left join côté
          // SQL) : on garde null, l'écran propose d'inviter plutôt qu'un vide.
          setRemotePartnerName(ligne?.display_name?.trim() || null)
        }
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
    // `blocked_by` n'est pas décoratif : la politique RLS refuse un passage à
    // `blocked` qui ne nomme pas son auteur, et c'est cette colonne qui décidera
    // ensuite qui peut lever le blocage et qui garde l'accès à l'historique.
    //
    // La réponse se lit, et pas seulement son erreur : un UPDATE écarté par le
    // `using` d'une politique ne lève rien, il touche zéro ligne en silence. Le
    // cas est réel — si l'autre a bloqué pendant qu'on était sur la page, notre
    // blocage ne passe pas. Annoncer « c'est bloqué » ici serait le pire des
    // mensonges : celui qui fait croire qu'on est protégé. (Corrigé sur mobile
    // en premier, PR #42 ; le web portait le même défaut.)
    //
    // Le revers, à ne pas perdre de vue : `returning` lit, donc il passe par
    // `tandems_select_member`. Celle-ci ne regarde que l'appartenance, jamais
    // `status` — la ligne reste lisible après le blocage, sinon un faux négatif
    // remplacerait le faux positif qu'on retire ici.
    const { data, error } = await supabase
      .from('tandems')
      .update({ status: 'blocked', blocked_by: authSession.user.id, ended_at: new Date().toISOString() })
      .eq('id', remoteTandemId)
      .select('id, status, blocked_by')
      .maybeSingle()
    if (error) {
      showNotice(t.syncError, 4200)
      return
    }
    if (!data) {
      showNotice(t.blockRefused, 4200)
      return
    }
    // L'état vient de la ligne rendue : c'est le serveur qui dit où en est la
    // relation, pas ce qu'on croit avoir écrit.
    setRemoteTandemStatus(data.status)
    setRemoteTandemBlockedBy(data.blocked_by)
    showNotice(t.blockedNotice, 4200)
  }

  const unblockTandem = async () => {
    setUnblockOpen(false)
    if (!supabase || !authSession || !remoteTandemId) {
      showNotice(t.blockNotice, 4200)
      return
    }
    // Le geste symétrique de `blockTandem`, et il doit défaire les trois champs
    // que celui-ci a posés. `blocked_by` remis à NULL n'est pas de la cosmétique :
    // `tandems_update_member` exige `auth.uid() = blocked_by` pour tout passage à
    // `blocked`, si bien qu'un `blocked_by` resté sur l'ancien bloqueur
    // empêcherait l'autre participant de bloquer un jour à son tour.
    //
    // Côté politique, la levée passe parce que `using` (ancienne ligne, encore
    // `blocked`) reconnaît `blocked_by`, et que `with check` (nouvelle ligne,
    // `active`) sort par la branche `status <> 'blocked'`.
    //
    // Et comme pour le blocage, la ligne rendue est la seule preuve que quelque
    // chose a été écrit : sans elle, le `using` a refusé sans le dire, et l'état
    // local doit rester où il est.
    const { data, error } = await supabase
      .from('tandems')
      .update({ status: 'active', blocked_by: null, ended_at: null })
      .eq('id', remoteTandemId)
      .select('id, status, blocked_by')
      .maybeSingle()
    if (error) {
      showNotice(t.syncError, 4200)
      return
    }
    if (!data) {
      showNotice(t.unblockRefused, 4200)
      return
    }
    setRemoteTandemStatus(data.status)
    setRemoteTandemBlockedBy(data.blocked_by)
    showNotice(t.unblockedNotice, 4200)
  }

  const reportTandem = async () => {
    if (!supabase || !authSession || !remoteTandemId) {
      showNotice(t.reportNotice, 4200)
      return
    }
    const { error } = await supabase.from('tandem_reports').insert({ tandem_id: remoteTandemId, reporter_id: authSession.user.id, reason: 'Signalement depuis la conversation' })
    showNotice(error ? t.syncError : t.reportSent, 4200)
  }

  const lireJournal = async (signalementId: string) => {
    const client = supabase
    if (!client) return
    const lignes = await chargerJournal(client, signalementId)
    // `null` reste `null` : « la lecture a échoué » n'est pas « aucune décision
    // n'a été prise », et l'écran doit pouvoir dire lequel des deux.
    setJournaux((precedent) => ({ ...precedent, [signalementId]: lignes }))
  }

  const basculerJournal = (signalementId: string) => {
    if (journalOuvert === signalementId) {
      setJournalOuvert(null)
      return
    }
    setJournalOuvert(signalementId)
    if (journaux[signalementId] === undefined) void lireJournal(signalementId)
  }

  const deciderModeration = async (signalementId: string, statut: StatutSignalement) => {
    const client = supabase
    if (!client) return
    setDecisionEnCours(signalementId)
    const resultat = await changerStatut(client, signalementId, statut)
    setDecisionEnCours(null)
    // `resultat` nul couvre les deux échecs, dont celui qui ne lève rien : un
    // UPDATE que le `using` refuse touche zéro ligne et rend `error: null`.
    // Sans cette branche, l'écran féliciterait pour une décision jamais prise.
    if (!resultat) {
      showNotice(t.moderationUpdateFailed, 4200)
      return
    }
    // Mise à jour sur place, sans retrier : un dossier qui saute de position
    // sous le curseur au moment du clic ferait perdre le fil. L'ordre se
    // recalcule à la relecture suivante.
    setDossiers((precedent) => precedent.map((dossier) => dossier.signalement.id === signalementId
      ? { ...dossier, signalement: { ...dossier.signalement, status: resultat.status, resolvedAt: resultat.resolvedAt } }
      : dossier))
    // La décision vient d'écrire une ligne d'audit : le journal en cache est
    // périmé. On le relit s'il est ouvert, on l'oublie sinon.
    if (journalOuvert === signalementId) void lireJournal(signalementId)
    else setJournaux((precedent) => { const suite = { ...precedent }; delete suite[signalementId]; return suite })
    showNotice(t.moderationUpdated)
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
    // display_name absent à dessein : la ligne existe déjà (créée à la
    // synchronisation) et les consentements n'ont pas à réécrire un nom.
    const { error } = await supabase.from('profiles').upsert({
      id: authSession.user.id,
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
    // La liste vient de changer sous l'écran : on la relit plutôt que d'y
    // pousser la ligne à la main. Le serveur seul connaît `expires_at`, et
    // c'est lui qui décide de l'état affiché.
    setRelectureInvitations((tour) => tour + 1)
    showNotice(t.inviteCreated, 4200)
  }

  const annulerInvitation = async (invitationId: string) => {
    const client = supabase
    if (!client) return
    setAnnulationEnCours(invitationId)
    const annulee = await revoquerInvitation(client, invitationId)
    setAnnulationEnCours(null)
    // `false` couvre les deux échecs, dont celui qui ne lève rien : un UPDATE
    // que le `using` refuse touche zéro ligne et rend `error: null`. Sans cette
    // branche, l'écran annoncerait une annulation qui n'a pas eu lieu.
    if (!annulee) {
      showNotice(t.invitationsCancelFailed, 4200)
      return
    }
    // Relecture plutôt que mise à jour sur place : contrairement à un dossier
    // de modération, une invitation annulée change de rang dans la liste, et
    // la liste est courte — le saut ne fait perdre le fil de personne.
    setRelectureInvitations((tour) => tour + 1)
    showNotice(t.invitationsCancelled, 4200)
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
          <NavItem active={activeTab === 'today'} label={t.today} onClick={() => setTab('today')} icon="✦" />
          <NavItem active={activeTab === 'journey'} label={t.journey} onClick={() => setTab('journey')} icon="◷" />
          <NavItem active={activeTab === 'tandem'} label={t.tandem} onClick={() => setTab('tandem')} icon="↗" />
          <NavItem active={activeTab === 'journal'} label={t.journal} onClick={() => setTab('journal')} icon="▤" />
          <NavItem active={activeTab === 'mentor'} label={t.mentor} onClick={() => setTab('mentor')} icon="⌁" />
          <NavItem active={activeTab === 'church'} label={t.church} onClick={() => setTab('church')} icon="⌂" />
          {/* L'onglet n'existe que pour un compte que la base reconnaît comme
              modérateur. Nommer la modération à tout le monde apprendrait déjà
              quelque chose sur qui modère. */}
          {moderateur && <NavItem active={activeTab === 'moderation'} label={t.moderation} onClick={() => setTab('moderation')} icon="⚑" />}
        </nav>

        <div className="sidebar-bottom">
          {/* Le vrai nom du compte — « Claire » et l'avatar « C » étaient
              de la maquette. Sans nom connu, le rôle seul suffit. */}
          <div className="profile-chip">
            <div className="avatar">{initialeDe(ownName)}</div>
            <div>
              <strong>{ownName || t.participant}</strong>
              {ownName && <span>{t.participant}</span>}
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
            <h1>{t.greeting}{ownName ? `, ${ownName}` : ''}</h1>
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
        {unblockOpen && <UnblockDialog t={t} onConfirm={() => void unblockTandem()} onClose={() => setUnblockOpen(false)} />}

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
            {activeTab === 'today' && (
              <TodayView
                session={currentSession}
                completedCount={completedCount}
                partnerName={remotePartnerName}
                t={t}
                onStart={() => openSession(currentSession.id)}
                onOpenJournal={() => setTab('journal')}
                onOpenTandem={() => setTab('tandem')}
              />
            )}
            {activeTab === 'journey' && <JourneyView journey={journey} completedIds={state.completedSessionIds} t={t} onStart={openSession} />}
            {activeTab === 'journal' && <JournalView entries={state.journalEntries} draft={journalDraft} setDraft={setJournalDraft} onAdd={addJournalEntry} t={t} />}
            {activeTab === 'tandem' && <TandemView partnerName={remotePartnerName} messages={remoteMessages} currentUserId={authSession?.user.id} status={remoteTandemStatus} affordance={affordance} draft={messageDraft} setDraft={setMessageDraft} onSend={() => void sendMessage()} onBlock={() => void blockTandem()} onUnblock={() => setUnblockOpen(true)} onReport={() => void reportTandem()} onInvite={() => setInviteOpen(true)} t={t} />}
            {/* Sous la conversation, pas dans un onglet à part : on vient
                voir ses invitations depuis l'endroit d'où on les a envoyées.
                Réservé aux comptes connectés — sans session, la politique ne
                rendrait rien et l'écran afficherait un vide trompeur. */}
            {activeTab === 'tandem' && authSession && <InvitationsView
              emises={invitationsEmises}
              recues={invitationsRecues}
              chargement={invitationsChargement}
              erreur={invitationsErreur}
              maintenant={instantLecture}
              annulationEnCours={annulationEnCours}
              t={t}
              onRefresh={() => setRelectureInvitations((tour) => tour + 1)}
              onCancel={(invitationId) => void annulerInvitation(invitationId)}
            />}
            {activeTab === 'mentor' && <MentorView snapshot={mentorSnapshot} t={t} />}
            {activeTab === 'church' && <ChurchView snapshot={churchSnapshot} t={t} />}
            {activeTab === 'moderation' && <ModerationView
              dossiers={dossiers}
              chargement={moderationChargement}
              erreur={moderationErreur}
              journaux={journaux}
              journalOuvert={journalOuvert}
              currentUserId={authSession?.user.id}
              decisionEnCours={decisionEnCours}
              t={t}
              onRefresh={() => setRelectureModeration((tour) => tour + 1)}
              onDecide={(signalementId, statut) => void deciderModeration(signalementId, statut)}
              onToggleJournal={basculerJournal}
            />}
          </>
        )}
      </main>
    </div>
  )
}

export default App