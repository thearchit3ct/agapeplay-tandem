import { useEffect, useMemo, useState } from 'react'
import { initialeDe, nomDepuisIdentite, prochaineSeance } from '@agapeplay/domain'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AppState, Locale, Session as Seance } from '@agapeplay/domain'
import { supabase, supabaseConfigured } from './lib/supabaseClient'
import { getJourney } from './mockData'
import { loadPublishedJourney } from '@agapeplay/content'
import { clearSyncQueue, enqueueSync, idsJournalEnAttente, readSyncQueue, removeSync } from './offlineQueue'
import { clearState, initialState, loadState, saveState } from './storage'
import { nomDuFichierExport, rassemblerExport, telechargerJson } from './export'
import type { Ligne, Reponse, SectionExport } from './export'
import { copy } from '@agapeplay/content/copy/web'
import { partageDuJournal, unblockAffordance } from '@agapeplay/domain'
import type { Tab, SessionStep, RemoteMessage, MentorSnapshot, ChurchSnapshot, TandemStatus } from '@agapeplay/domain'
import type { CategorieSignalement, DossierModeration, StatutSignalement } from '@agapeplay/domain'
import { changerStatut, chargerDossiers, chargerJournal, estModerateur } from './moderation'
import type { LigneJournal } from './moderation'
import { chargerInvitations, revoquerInvitation } from './invitations'
import { chargerPartagesEmis, chargerPartagesRecus, poserPartage, retirerPartage, supprimerEntree } from './partageJournal'
import type { EntreePartagee, PartageEmis } from './partageJournal'
import type { InvitationEmise } from './invitations'
import type { Invitation } from '@agapeplay/domain'
import {
  AuthDialog, TrustDialog, SettingsDialog, DeleteAccountDialog, InviteDialog, UnblockDialog, ReportDialog, MentorView, ChurchView,
  NavItem, TodayView, JourneyView, SessionFlow, JournalView, TandemView, ModerationView,
  InvitationsView, PartagesRecusView,
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
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Un geste de compte à la fois : l'export, la déconnexion globale et la
  // suppression se désarment mutuellement le temps de leur aller-retour.
  const [compteEnCours, setCompteEnCours] = useState(false)
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
  // `partenaire_supprime` vient de tandem_partenaire(), qui le tire de
  // auth.users.deleted_at — hors de portée de son propriétaire, contrairement à
  // profiles.account_status. Sans lui, un nom vidé passerait pour « pas encore
  // de nom » et l'écran proposerait d'inviter quelqu'un qui est déjà là.
  const [remotePartnerDeleted, setRemotePartnerDeleted] = useState(false)
  const [ownName, setOwnName] = useState('')
  const [remoteTandemStatus, setRemoteTandemStatus] = useState<TandemStatus | null>(null)
  const [remoteTandemBlockedBy, setRemoteTandemBlockedBy] = useState<string | null>(null)
  const [unblockOpen, setUnblockOpen] = useState(false)
  // Le signalement demande maintenant une catégorie — `tandem_reports.category`
  // est `not null` et sans défaut. Les deux champs vivent ici, comme l'adresse
  // de l'invitation : le dialogue les affiche, il ne les possède pas.
  const [reportOpen, setReportOpen] = useState(false)
  const [reportCategorie, setReportCategorie] = useState<CategorieSignalement | null>(null)
  const [reportNote, setReportNote] = useState('')
  const [remoteMessages, setRemoteMessages] = useState<RemoteMessage[]>([])
  // Le partage du journal — issue #11. Trois états, trois provenances :
  // `partagesEmis` vient de `journal_shares` (own only, l'autrice y voit ses
  // propres lignes), `partagesRecus` de `journal_partage_avec_moi()` (le seul
  // chemin de lecture du journal d'autrui), et `partageEnCours` désarme le
  // geste le temps de son aller-retour, comme `compteEnCours` plus haut.
  const [partagesEmis, setPartagesEmis] = useState<PartageEmis[]>([])
  const [partagesRecus, setPartagesRecus] = useState<EntreePartagee[]>([])
  const [partagesRecusErreur, setPartagesRecusErreur] = useState(false)
  const [partageEnCours, setPartageEnCours] = useState<string | null>(null)
  // Les identifiants d'entrées encore dans la file hors-ligne. Une entrée qui
  // n'existe pas côté base ne peut pas être partagée : le `exists` du
  // `with check` la refuserait, et proposer le bouton serait promettre un
  // refus. On lit la file plutôt que de le deviner.
  const [journalEnAttente, setJournalEnAttente] = useState<string[]>(() => idsJournalEnAttente())
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
      if (!cancelled) {
        setPendingSync(readSyncQueue().length)
        // La file vidée, des entrées écrites hors ligne existent enfin côté
        // base : leur geste de partage réapparaît sans qu'il faille recharger.
        setJournalEnAttente(idsJournalEnAttente())
      }
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

  // Ce que le binôme m'a partagé. Relu à chaque ouverture de l'onglet, et à
  // chaque changement de statut du tandem : c'est ainsi qu'un partage retiré
  // disparaît de l'écran du destinataire, et qu'un blocage referme le panneau.
  // La fonction cesse simplement de rendre les lignes — il n'y a rien à
  // invalider, seulement à relire.
  useEffect(() => {
    const client = supabase
    if (!client || !authSession || activeTab !== 'tandem') return
    let cancelled = false
    void chargerPartagesRecus(client).then(({ entrees, erreur }) => {
      if (cancelled) return
      setPartagesRecus(entrees)
      setPartagesRecusErreur(erreur)
    })
    return () => { cancelled = true }
  }, [authSession?.user.id, activeTab, remoteTandemStatus])

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

      // Les partages que j'ai posés, lus avec le journal : l'écran du journal
      // en a besoin dès son ouverture, c'est ce qui distingue « partager » de
      // « retirer le partage » sur chaque entrée. Aucun filtre sur `shared_by`
      // n'est écrit côté client — `journal_shares_select_author` le pose déjà.
      const partagesResult = await chargerPartagesEmis(client)
      if (!cancelled) {
        if (partagesResult.erreur) showNotice(t.syncError, 4200)
        else setPartagesEmis(partagesResult.partages)
      }

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
          const ligne = (partenaireResult.data as Array<{ tandem_id: string; display_name: string | null; partenaire_supprime: boolean }> | null)?.find((l) => l.tandem_id === remoteTandem.id)
          // Nom NULL = partenaire sans ligne profiles encore (left join côté
          // SQL) : on garde null, l'écran propose d'inviter plutôt qu'un vide.
          setRemotePartnerName(ligne?.display_name?.trim() || null)
          setRemotePartnerDeleted(ligne?.partenaire_supprime === true)
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
            setJournalEnAttente(idsJournalEnAttente())
            showNotice(t.offline, 4200)
          }
        })
        if (journalEntry) void Promise.resolve(supabase.from('journal_entries').insert({ id: journalEntry.id, user_id: authSession.user.id, text: journalEntry.text, mood: journalEntry.mood, created_at: journalEntry.createdAt })).then(({ error }) => {
          if (error) {
            enqueueSync({ id: `journal:${journalEntry.id}`, kind: 'journal_entry', payload: { id: journalEntry.id, user_id: authSession.user.id, text: journalEntry.text, mood: journalEntry.mood, created_at: journalEntry.createdAt } })
            setPendingSync(readSyncQueue().length)
            setJournalEnAttente(idsJournalEnAttente())
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
        setJournalEnAttente(idsJournalEnAttente())
        showNotice(t.offline, 4200)
      }
    })
    setJournalDraft('')
    showNotice(t.saved)
  }

  // Les trois gestes du journal — issue #11. Ce qu'ils ont en commun est plus
  // important que ce qui les sépare : **chacun lit sa réponse**. Un retrait ou
  // une suppression que la RLS refuse ne lève rien, il ne touche aucune ligne
  // (`journal_shares_select_author` et `journal_select_own` masquent la ligne à
  // l'ordre DELETE). Compter les lignes réellement rendues est la seule façon
  // de distinguer « c'est fait » de « la base a dit non sans le dire ».
  //
  // La règle qui décide de l'existence du geste vit, elle, dans
  // `packages/domain/src/partage.ts`, avec ses tests et son contraste : sur un
  // tandem bloqué, les messages restent lisibles à qui a bloqué, les partages
  // non.
  const partage = partageDuJournal({
    status: remoteTandemStatus,
    blockedBy: remoteTandemBlockedBy,
    currentUserId: authSession?.user.id,
  })

  // Les partages du tandem courant, et eux seuls.
  //
  // Une ligne de partage survit à la fermeture de sa relation — c'est une
  // décision, pas un oubli : un blocage se lève, et détruire les choix de
  // l'autrice sur un changement de statut réversible les lui ferait perdre en
  // silence. Mais `tandems_active_pair_idx` porte sur la *paire* : rien
  // n'interdit une relation terminée et une nouvelle relation vivante en même
  // temps. Sans ce filtre, l'entrée partagée du temps de la première dirait
  // « Partagé avec ton binôme » alors que le binôme actuel ne la lit pas, et
  // offrirait « retirer le partage » à la place d'un partage que
  // `journal_shares_insert_author` accepterait. Deux mensonges pour le prix
  // d'un.
  //
  // Ce que ce filtre laisse hors de l'écran, et qui est assumé : la ligne posée
  // sur une relation refermée devient invisible et non retirable d'ici. Elle
  // n'est lisible par personne — le statut la ferme — et elle part avec son
  // entrée ou avec le compte. Ni orphelin, ni fuite.
  const partagesDuTandem = partagesEmis.filter((ligne) => ligne.tandemId === remoteTandemId)

  /**
   * Efface l'entrée de tout ce que ce navigateur garde d'elle.
   *
   * `removeSync` compte autant que le reste, et c'est le piège du jour : une
   * entrée écrite hors ligne laisse un `upsert` en attente dans la file, que
   * `flushQueue` rejouerait à la prochaine connexion. Sans ce retrait, une
   * entrée supprimée réapparaîtrait quelques minutes plus tard, sans que rien
   * ne l'explique — et la suppression aurait menti.
   */
  const oublierEntreeLocale = (entryId: string) => {
    removeSync(`journal:${entryId}`)
    setPendingSync(readSyncQueue().length)
    setJournalEnAttente(idsJournalEnAttente())
    setPartagesEmis((precedents) => precedents.filter((ligne) => ligne.entreeId !== entryId))
    // Forme fonctionnelle, et non `update({ ...state, … })` comme ailleurs dans
    // ce fichier : cet appel-ci arrive **après** un aller-retour réseau, et le
    // `state` de la clôture peut avoir vieilli entre-temps — une entrée écrite
    // pendant l'attente, une fusion distante. Le réécrire tel quel effacerait
    // cette entrée de React *et* de localStorage, sans erreur ni trace.
    setState((precedent) => {
      const suivant = { ...precedent, journalEntries: precedent.journalEntries.filter((entry) => entry.id !== entryId) }
      saveState(suivant)
      return suivant
    })
  }

  const partagerEntree = async (entryId: string) => {
    const client = supabase
    if (!client || !authSession || !remoteTandemId || !partage.peutPartager) return
    setPartageEnCours(entryId)
    const { pose, poseLe } = await poserPartage(client, {
      entreeId: entryId, tandemId: remoteTandemId, auteurId: authSession.user.id,
    })
    setPartageEnCours(null)
    // Une insertion refusée par le `with check`, elle, lève bien : on ne
    // suppose donc rien, on affiche que rien n'a changé.
    if (!pose) {
      showNotice(t.shareEntryFailed, 4200)
      return
    }
    setPartagesEmis((precedents) => [
      ...precedents.filter((ligne) => ligne.entreeId !== entryId),
      { entreeId: entryId, tandemId: remoteTandemId, poseLe: poseLe ?? new Date().toISOString() },
    ])
    showNotice(t.shareEntryDone, 4200)
  }

  const retirerPartageEntree = async (entryId: string) => {
    const client = supabase
    if (!client || !authSession) return
    setPartageEnCours(entryId)
    const { retirees, erreur } = await retirerPartage(client, entryId)
    setPartageEnCours(null)
    if (erreur) {
      showNotice(t.syncError, 4200)
      return
    }
    // Zéro ligne sans erreur : la politique a masqué la ligne au DELETE. On ne
    // retire rien de l'affichage — annoncer un retrait qui n'a pas eu lieu
    // serait pire que de ne rien annoncer du tout.
    if (retirees === 0) {
      showNotice(t.unshareEntryRefused, 4200)
      return
    }
    setPartagesEmis((precedents) => precedents.filter((ligne) => ligne.entreeId !== entryId))
    showNotice(t.unshareEntryDone, 4200)
  }

  const effacerEntree = async (entryId: string) => {
    const client = supabase
    // Hors session — mode démonstration — le journal n'existe que dans ce
    // navigateur : l'effacer localement est la vérité entière, il n'y a pas de
    // ligne distante à qui demander son avis.
    if (!client || !authSession) {
      oublierEntreeLocale(entryId)
      showNotice(t.deleteEntryDone, 4200)
      return
    }
    setPartageEnCours(entryId)
    const { supprimees, erreur } = await supprimerEntree(client, entryId)
    setPartageEnCours(null)
    if (erreur) {
      showNotice(t.syncError, 4200)
      return
    }
    if (supprimees === 0) {
      showNotice(t.deleteEntryRefused, 4200)
      return
    }
    // Les partages posés sur cette entrée sont partis avec elle côté base, par
    // la clé étrangère `on delete cascade`. `oublierEntreeLocale` les retire de
    // l'affichage pour la même raison.
    oublierEntreeLocale(entryId)
    showNotice(t.deleteEntryDone, 4200)
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
        setJournalEnAttente(idsJournalEnAttente())
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
    // Le dialogue interdit déjà le clic sans catégorie ; la garde est ici parce
    // que c'est cette fonction qui écrit, et qu'une garde d'affichage ne
    // protège pas une écriture.
    if (!reportCategorie) return
    setReportOpen(false)
    if (!supabase || !authSession || !remoteTandemId) {
      showNotice(t.reportNotice, 4200)
      return
    }
    // `null` et non `''` quand la personne n'a rien écrit : la contrainte
    // `char_length(reason) between 1 and 1000` passe sur NULL — elle rend NULL,
    // et un `check` qui rend NULL passe — mais refuse la chaîne vide. Envoyer
    // `''` ferait échouer tous les signalements sans mot libre, c'est-à-dire le
    // cas courant.
    //
    // `urgency` n'est pas dans la charge utile et ne doit jamais y entrer :
    // c'est une colonne générée, et PostgreSQL refuse toute valeur proposée
    // (« cannot insert a non-DEFAULT value into column »). C'est ce refus qui
    // fait qu'une application compromise ne peut pas minorer une urgence.
    const { data, error } = await supabase
      .from('tandem_reports')
      .insert({
        tandem_id: remoteTandemId,
        reporter_id: authSession.user.id,
        category: reportCategorie,
        reason: reportNote.trim() || null,
      })
      .select('id')
      .maybeSingle()
    // Un insert refusé par un `with check` lève, contrairement à l'UPDATE — on
    // lit quand même la ligne rendue : sans elle, on annoncerait « transmis »
    // sur la seule foi d'une absence d'erreur.
    if (error || !data) {
      showNotice(t.syncError, 4200)
      return
    }
    setReportCategorie(null)
    setReportNote('')
    showNotice(t.reportSent, 4200)
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

  /**
   * L'export. Toutes les lectures passent par les politiques `own only` de la
   * personne connectée : il n'y a rien ici qu'elle ne puisse déjà lire écran
   * par écran. L'assemblage et son refus de rendre un fichier amputé vivent
   * dans `export.ts`, avec leurs tests.
   */
  const exporterMesDonnees = async () => {
    const client = supabase
    if (!client || !authSession) return
    setCompteEnCours(true)
    const lire = async (section: SectionExport): Promise<Reponse> => {
      const requete = client.from(section.table).select(section.colonnes)
      const { data, error } = await (section.cible === 'adresse'
        ? requete.ilike(section.colonne, authSession.user.email ?? '')
        : requete.eq(section.colonne, authSession.user.id))
      return { data: data as Ligne[] | null, error }
    }
    try {
      const contenu = await rassemblerExport(lire, { id: authSession.user.id, email: authSession.user.email ?? null })
      telechargerJson(nomDuFichierExport(), contenu)
      showNotice(t.exportReady)
    } catch {
      // `rassemblerExport` lève à la première anomalie plutôt que de rendre un
      // fichier plus court de quelques lignes. On ne télécharge donc rien, et
      // on le dit — un export silencieusement incomplet est le seul échec qui
      // ne se voit jamais.
      showNotice(t.exportFailed, 5200)
    } finally {
      setCompteEnCours(false)
    }
  }

  const deconnexionPartout = async () => {
    const client = supabase
    if (!client) return
    setCompteEnCours(true)
    const { error } = await client.auth.signOut({ scope: 'global' })
    setCompteEnCours(false)
    if (error) {
      showNotice(t.syncError, 4200)
      return
    }
    showNotice(t.signedOutEverywhere, 4200)
  }

  /**
   * La suppression réelle. `supprimer_mon_compte()` fait tout d'un tenant côté
   * base — données personnelles effacées, tandems terminés sauf les bloqués,
   * `auth.users` neutralisée, sessions révoquées — ou rien du tout.
   *
   * Deux choses restent à faire ici, et elles comptent autant :
   *
   *   - lire la réponse. Une erreur non lue afficherait « ton compte est
   *     supprimé » sur un compte intact, exactement le mensonge que #43 a
   *     retiré du blocage ;
   *   - vider ce navigateur. Le journal et la file de synchronisation sont
   *     aussi dans `localStorage` : une purge qui s'arrêterait à la base les
   *     laisserait au prochain qui ouvre cet ordinateur.
   */
  const supprimerMonCompte = async () => {
    const client = supabase
    if (!client || !authSession) return
    setCompteEnCours(true)
    const { error } = await client.rpc('supprimer_mon_compte')
    if (error) {
      setCompteEnCours(false)
      showNotice(t.deleteFailed, 5200)
      return
    }

    clearState()
    clearSyncQueue()
    setState(initialState)
    setPendingSync(0)
    setRemoteTandemId(null)
    setRemoteTandemStatus(null)
    setRemoteTandemBlockedBy(null)
    setRemotePartnerName(null)
    setRemotePartnerDeleted(false)
    setRemoteMessages([])
    setInvitationsEmises([])
    setInvitationsRecues([])
    setDeleteOpen(false)
    setSettingsOpen(false)

    // La révocation côté serveur a déjà eu lieu (les lignes `auth.sessions`
    // sont parties avec la fonction). Cet appel ferme la session de cet
    // onglet-ci et efface le jeton local : c'est le pendant visible, pas la
    // garantie.
    await client.auth.signOut({ scope: 'global' })
    setCompteEnCours(false)
    showNotice(t.deleteDone, 6000)
  }

  const toggleNotification = async (key: keyof AppState['notificationPrefs'], value: boolean) => {
    const notificationPrefs = { ...state.notificationPrefs, [key]: value }
    update({ ...state, notificationPrefs })
    if (supabase && authSession) {
      const { error } = await supabase.from('notification_preferences').upsert({ user_id: authSession.user.id, ...notificationPrefs, updated_at: new Date().toISOString() })
      if (error) {
        enqueueSync({ id: `notifications:${authSession.user.id}`, kind: 'notification_preferences', payload: { user_id: authSession.user.id, ...notificationPrefs, updated_at: new Date().toISOString() } })
        setPendingSync(readSyncQueue().length)
        setJournalEnAttente(idsJournalEnAttente())
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
        {settingsOpen && <SettingsDialog t={t} prefs={state.notificationPrefs} onToggle={(key, value) => void toggleNotification(key, value)} onClose={() => setSettingsOpen(false)} onExport={() => void exporterMesDonnees()} onSignOutEverywhere={() => void deconnexionPartout()} onDelete={() => setDeleteOpen(true)} busy={compteEnCours} />}
        {deleteOpen && <DeleteAccountDialog t={t} onConfirm={() => void supprimerMonCompte()} onExport={() => void exporterMesDonnees()} onClose={() => setDeleteOpen(false)} busy={compteEnCours} />}
        {inviteOpen && <InviteDialog t={t} email={inviteEmail} setEmail={setInviteEmail} link={inviteLink} onCreate={() => void createInvitation()} onClose={() => { setInviteOpen(false); setInviteLink('') }} />}
        {unblockOpen && <UnblockDialog t={t} onConfirm={() => void unblockTandem()} onClose={() => setUnblockOpen(false)} />}
        {/* Fermer sans envoyer garde le choix en place : rouvrir après une
            hésitation ne doit pas obliger à tout recommencer. Ce qui est effacé
            l'est après un envoi réussi, et là seulement. */}
        {reportOpen && <ReportDialog
          t={t}
          categorie={reportCategorie}
          note={reportNote}
          setCategorie={setReportCategorie}
          setNote={setReportNote}
          onConfirm={() => void reportTandem()}
          onClose={() => setReportOpen(false)}
        />}

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
            {activeTab === 'journal' && <JournalView
              entries={state.journalEntries}
              draft={journalDraft}
              setDraft={setJournalDraft}
              onAdd={addJournalEntry}
              partages={partagesDuTandem}
              partage={partage}
              enAttente={journalEnAttente}
              connecte={Boolean(supabase && authSession)}
              enLigne={isOnline}
              enCours={partageEnCours}
              onPartager={(entryId) => void partagerEntree(entryId)}
              onRetirer={(entryId) => void retirerPartageEntree(entryId)}
              onSupprimer={(entryId) => void effacerEntree(entryId)}
              t={t}
            />}
            {activeTab === 'tandem' && <TandemView partnerName={remotePartnerName} partnerDeleted={remotePartnerDeleted} messages={remoteMessages} currentUserId={authSession?.user.id} status={remoteTandemStatus} affordance={affordance} draft={messageDraft} setDraft={setMessageDraft} onSend={() => void sendMessage()} onBlock={() => void blockTandem()} onUnblock={() => setUnblockOpen(true)} onReport={() => setReportOpen(true)} onInvite={() => setInviteOpen(true)} t={t} />}
            {/* Ce que le binôme a partagé, sous la conversation et au-dessus
                des invitations : c'est de la relation qu'il s'agit, pas du
                journal — le journal de cette personne-là est le sien, et il
                reste dans son onglet. Affiché seulement quand un tandem
                existe : sans relation, un panneau vide n'apprendrait rien. */}
            {activeTab === 'tandem' && authSession && partage.raison !== 'aucun-tandem' && <PartagesRecusView
              entrees={partagesRecus}
              erreur={partagesRecusErreur}
              partage={partage}
              t={t}
            />}
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