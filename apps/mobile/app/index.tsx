import { Link, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-home'
import type { EtatDeSemaine, Journey, Locale } from '@agapeplay/domain'
import { ETATS_DE_SEMAINE, invitationDouce, prochaineSeance, semaineDuBilan } from '@agapeplay/domain'
import { colors, ondeClaire, ondeEncre, toucheMinimale, typography } from '@/theme'
import { toucherAbouti, toucherLeger } from '@/toucher'
import { flushProgressQueue } from '@/offlineQueue'
import { supabase } from '@/supabase'
import { synchroniserRappels } from '@/notifications'
import type { EtatDesRappels, TextesDeRappel } from '@/notifications'
import { jetonRetenu } from '@/invitations'
import { basculerMesure, emettre, lireConsentementDuCompte, mesureAcceptee } from '@/mesure'
import { chargerParcours } from '@/parcours'
import { basculerRappel, lireEtatDuBilan, poserBilan } from '@/bilan'
import type { ClefDeRappel, EtatDuBilan } from '@/bilan'

/**
 * Les cinq réponses et leurs mots. Le domaine décide du vocabulaire, l'écran
 * des libellés — et le typage fait échouer `mobile:typecheck` le jour où une
 * réponse s'ajoute sans le sien.
 */
const LIBELLE_ETAT: Record<EtatDeSemaine, 'checkinCalm' | 'checkinFull' | 'checkinHard' | 'checkinElsewhere' | 'checkinUnsure'> = {
  paisible: 'checkinCalm',
  dense: 'checkinFull',
  rude: 'checkinHard',
  ailleurs: 'checkinElsewhere',
  incertain: 'checkinUnsure',
}

export default function HomeScreen() {
  const [locale, setLocale] = useState<Locale>('fr')
  const [offline, setOffline] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  // « Posée » tant qu'on n'a pas constaté le contraire : aucune phrase sur les
  // rappels n'apparaît avant une tentative réelle de planification.
  const [etatRappels, setEtatRappels] = useState<EtatDesRappels>('posee')
  // Un jeton d'invitation reçu par lien et pas encore joué.
  const [invitationEnAttente, setInvitationEnAttente] = useState(false)
  const [mesure, setMesure] = useState(true)
  // Le parcours publié, lu depuis la base ou depuis le cache de ce téléphone.
  // `null` tant qu'on ne sait pas : la carte affiche alors ce qu'elle sait, et
  // rien d'inventé — elle portait jusqu'ici un verset de maquette.
  const [parcours, setParcours] = useState<Journey | null>(null)
  const [parcoursLu, setParcoursLu] = useState(false)
  // Le bilan de fin de semaine — issue #18. `etatBilan` reste `null` tant que
  // la base n'a pas répondu : proposer une question sans savoir si elle a déjà
  // été posée, ou accueillir « de retour » quelqu'un dont on ignore la dernière
  // activité, serait affirmer plus qu'on ne sait.
  const [etatBilan, setEtatBilan] = useState<EtatDuBilan | null>(null)
  const [bilanRepondu, setBilanRepondu] = useState<EtatDeSemaine | null>(null)
  const [bilanEnCours, setBilanEnCours] = useState(false)
  const [notice, setNotice] = useState('')
  const [rafraichissement, setRafraichissement] = useState(false)
  const t = useMemo(() => copy[locale], [locale])

  /**
   * La garde de démontage, devenue une `ref` : ce que lisait l'effet de focus
   * est désormais lu aussi par le tirer-pour-rafraîchir, et une variable
   * refermée dans l'effet ne protégerait que le premier appelant.
   */
  const monte = useRef(true)

  /**
   * Tout ce qu'on relit en arrivant sur l'accueil. Sorti de `useFocusEffect`
   * pour que le geste de rafraîchissement emprunte exactement le même chemin —
   * un second chemin de rechargement finirait par diverger de celui-ci.
   *
   * L'état du bilan n'est pas ici : il a son propre effet, accroché au compte,
   * et le lire aux deux endroits en ferait deux lectures à chaque montage.
   */
  const relire = useCallback(() => {
    void supabase?.auth.getSession().then(({ data }) => {
      if (!monte.current) return
      setSession(data.session)
      // Le refus de mesure suit le compte, pas l'appareil : sans cette lecture,
      // quelqu'un qui a dit non depuis son navigateur serait remesuré ici. Sans
      // session, seul le réglage local décide — il n'y a personne à qui
      // demander.
      const lecture = data.session ? lireConsentementDuCompte(data.session.user.id) : mesureAcceptee()
      void lecture.then((effectif) => { if (monte.current) setMesure(effectif) })
    })
    // Le bandeau hors ligne dit ce qui reste réellement en file, et plus un
    // état de maquette qu'un appui allumait : une promesse de synchronisation
    // doit être adossée à quelque chose qui attend vraiment.
    void flushProgressQueue().then((restants) => { if (monte.current) setOffline(restants > 0) })
    // Une invitation retenue mais pas encore jouée doit se voir : le lien peut
    // avoir été ouvert avant toute connexion, ou l'écran quitté en route.
    void jetonRetenu().then((recu) => { if (monte.current) setInvitationEnAttente(recu !== null) })
  }, [])

  useFocusEffect(useCallback(() => {
    monte.current = true
    relire()
    // La session peut naître PENDANT que l'écran est monté — c'est exactement
    // ce que fait le lien magique ramassé par useAuthDeepLink. Sans cet
    // abonnement, l'en-tête resterait « Se connecter » jusqu'à une navigation.
    // Il vit dans l'effet et non dans `relire` : un abonnement posé à chaque
    // rafraîchissement s'empilerait sans jamais se défaire.
    const { data: abonnement } = supabase?.auth.onAuthStateChange((_evenement, s) => { if (monte.current) setSession(s) }) ?? { data: null }
    return () => { monte.current = false; abonnement?.subscription.unsubscribe() }
  }, [relire]))

  /**
   * Le tirer-pour-rafraîchir. Il ajoute la relecture du bilan à `relire` :
   * l'effet qui s'en charge d'ordinaire n'écoute que le changement de compte,
   * et un rafraîchissement se fait sur le même compte.
   */
  const rafraichir = useCallback(async () => {
    setRafraichissement(true)
    relire()
    const compteId = session?.user.id
    if (compteId) {
      const etat = await lireEtatDuBilan(compteId)
      if (monte.current) setEtatBilan(etat)
    }
    if (monte.current) setRafraichissement(false)
  }, [relire, session?.user.id])

  // L'état du bilan suit le compte : il se relit quand la session change, et
  // pas au montage — sans compte il n'y a rien à lire, et la carte le dit.
  // Garde de démontage comme partout : la réponse peut arriver après un départ
  // d'écran.
  useEffect(() => {
    const compteId = session?.user.id
    if (!compteId) {
      setEtatBilan(null)
      return
    }
    let actif = true
    void lireEtatDuBilan(compteId).then((etat) => { if (actif) setEtatBilan(etat) })
    return () => { actif = false }
  }, [session?.user.id])

  // Le contenu publié suit la langue de l'écran, et se relit à chaque
  // changement : le cache garde les deux langues côte à côte, si bien qu'un
  // passage à l'anglais hors ligne rend l'anglais s'il a déjà été lu.
  useEffect(() => {
    let actif = true
    void chargerParcours(locale).then((lu) => {
      if (!actif) return
      setParcours(lu)
      setParcoursLu(true)
    })
    return () => { actif = false }
  }, [locale])

  // La séance à proposer : la première non terminée, l'ordre du contenu publié
  // faisant foi (`prochaineSeance`, domaine, testé).
  const seance = parcours ? prochaineSeance(parcours.sessions, etatBilan?.seancesFaites ?? []) : undefined

  /**
   * Ce que diront les notifications, dans la langue de l'écran au moment où
   * elles sont posées.
   *
   * Le mobile n'a pas de langue persistée — `locale` est un état d'écran — et
   * une notification, elle, survit à la session. Le choix est donc explicite :
   * changer de langue replanifie les rappels (voir la dépendance de l'effet
   * ci-dessous), plutôt que de laisser une notification française arriver sur
   * une application passée à l'anglais.
   */
  const textesDeRappel: TextesDeRappel = useMemo(() => ({
    seance: { titre: t.reminderSessionNotifTitle, corps: t.reminderSessionNotifBody },
    bilan: { titre: t.reminderCheckinNotifTitle, corps: t.reminderCheckinNotifBody },
  }), [t])

  // Les rappels de l'appareil suivent les préférences du compte, et se
  // replanifient dès qu'elles sont lues : c'est ainsi qu'un rappel coupé
  // depuis le navigateur cesse ici. Aucune permission n'est demandée dans cet
  // effet — une question système surgie sans geste est le meilleur moyen
  // d'obtenir un refus définitif ; l'interrupteur, lui, la demande.
  useEffect(() => {
    if (!etatBilan) return
    let actif = true
    void synchroniserRappels(
      { sessions: etatBilan.rappelSeance, weekly_checkin: etatBilan.rappelBilan },
      textesDeRappel,
    ).then((etat) => { if (actif) setEtatRappels(etat) })
    return () => { actif = false }
  }, [etatBilan?.rappelSeance, etatBilan?.rappelBilan, textesDeRappel])

  const invitation = etatBilan
    ? invitationDouce({
        maintenant: new Date(),
        derniereActivite: etatBilan.derniereActivite,
        semainesFaites: etatBilan.semainesFaites,
        rappelBilan: etatBilan.rappelBilan,
        rappelAbsence: etatBilan.rappelAbsence,
      })
    : { forme: 'aucune' as const }

  const repondre = async (etat: EtatDeSemaine) => {
    const compteId = session?.user.id
    if (!compteId) return
    const semaine = semaineDuBilan(new Date())
    setBilanEnCours(true)
    const pose = await poserBilan(compteId, semaine, etat)
    setBilanEnCours(false)
    // L'écriture lit sa réponse avant que l'écran ne dise « c'est noté ».
    if (!pose) {
      setNotice(t.checkinFailed)
      return
    }
    // Un bilan posé est un aboutissement, pas un envoi : la nuance haptique
    // le dit.
    toucherAbouti()
    setBilanRepondu(etat)
    setEtatBilan((precedent) => precedent && {
      ...precedent,
      semainesFaites: [...precedent.semainesFaites, semaine],
      derniereActivite: new Date(),
    })
    // Émis après la réponse de la base, jamais avant : `week` porte la semaine
    // couverte et non la date du jour — le bilan se répond jusqu'au vendredi
    // suivant, et `occurred_at` ne dirait donc pas quelle semaine a été
    // accompagnée. Rien du contenu ne passe : il n'y en a pas.
    void emettre('weekly_checkin_completed', { locale, proprietes: { week: semaine } })
    setNotice(t.checkinSaved)
  }

  /**
   * Les deux interrupteurs de rappel passent par ici, et par le même chemin :
   * la préférence s'écrit sur le compte, on relit ce que la base a retenu, et
   * l'appareil replanifie d'après cette lecture — jamais d'après ce qu'on
   * espérait écrire. Une écriture refusée laisse donc l'interrupteur en place.
   *
   * La permission système est demandée ici, et seulement ici : c'est le geste
   * qui la justifie.
   */
  const basculerLeRappel = async (clef: ClefDeRappel) => {
    const compteId = session?.user.id
    if (!compteId || !etatBilan) return
    const avant = clef === 'sessions' ? etatBilan.rappelSeance : etatBilan.rappelBilan
    const pose = await basculerRappel(compteId, clef, !avant)
    if (!pose) { setNotice(t.checkinFailed); return }
    // Un interrupteur qui bascule pour de bon — après lecture de ce que la
    // base a retenu, jamais sur l'appui.
    toucherLeger()
    setEtatBilan({ ...etatBilan, rappelBilan: pose.rappelBilan, rappelSeance: pose.rappelSeance })
    setEtatRappels(await synchroniserRappels(
      { sessions: pose.rappelSeance, weekly_checkin: pose.rappelBilan },
      textesDeRappel,
      { demanderPermission: true },
    ))
  }

  const basculerLaMesure = async () => {
    setMesure(await basculerMesure(!mesure, session?.user.id ?? null))
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl
        refreshing={rafraichissement}
        onRefresh={() => void rafraichir()}
        colors={[colors.copper]}
        tintColor={colors.copper}
      />}
    >
      <View style={styles.topline}><Text style={styles.eyebrow}>{t.eyebrow}</Text><View style={styles.topActions}><Pressable accessibilityRole="button" accessibilityLabel={t.language} style={toucheMinimale} onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}>{({ pressed }) => <Text style={[styles.locale, pressed && styles.pressed]}>{locale.toUpperCase()}</Text>}</Pressable><Link href="/auth" asChild><Pressable style={toucheMinimale}>{({ pressed }) => <Text style={[styles.authLink, pressed && styles.pressed]}>{session ? t.signedIn : t.signIn}</Text>}</Pressable></Link></View></View>
      {offline && <Pressable style={({ pressed }) => [styles.offline, pressed && styles.pressed]} android_ripple={ondeEncre} onPress={() => setOffline(false)}><Text style={styles.offlineText}>{t.offline}</Text></Pressable>}
      {invitationEnAttente && <Link href="/invite" asChild><Pressable style={({ pressed }) => [styles.offline, pressed && styles.pressed]} android_ripple={ondeEncre}><Text style={styles.offlineText}>{t.pendingInvite}  →</Text></Pressable></Link>}
      <Text style={styles.greeting}>{t.greeting}</Text>
      <Text style={styles.subtitle}>{t.subtitle}</Text>

      {/* La carte du jour dit le contenu publié, ou dit qu'elle ne l'a pas.
          Elle portait jusqu'au 26/08/2026 un titre et un verset écrits en dur,
          qui n'étaient ni le parcours publié ni ce que le web affiche. */}
      <View style={styles.heroCard}>
        <View style={styles.cardHeader}><Text style={styles.kicker}>{t.dailySession}</Text>{seance && <Text style={styles.duration}>{seance.duration} {t.minutes}</Text>}</View>
        {seance
          ? <>
              <View style={styles.number}><Text style={styles.numberText}>{String(seance.day).padStart(2, '0')}</Text></View>
              <Text style={styles.theme}>{seance.theme}</Text>
              <Text style={styles.title}>{seance.title}</Text>
              <Text style={styles.verse}>{seance.verse}</Text>
              <Text style={styles.prompt}>{seance.prompt}</Text>
              <Link href={{ pathname: '/session', params: { jour: String(seance.day) } }} asChild><Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} android_ripple={ondeClaire}><Text style={styles.primaryText}>{t.start}  →</Text></Pressable></Link>
            </>
          : <Text style={styles.verse}>{parcoursLu ? t.sessionNotDownloaded : t.sessionLoading}</Text>}
      </View>

      {/* Une invitation douce au plus — la précédence est tranchée dans
          `invitationDouce`, avec ses tests. Après une longue absence, on
          accueille sans rien demander ; la question attendra le prochain
          passage. */}
      {invitation.forme === 'reprise' && <View style={styles.gentleCard}>
        <Text style={styles.kickerDark}>{t.resumeTitle}</Text>
        <Text style={styles.gentleBody}>{t.resumeBody}</Text>
      </View>}
      {(invitation.forme === 'bilan' || bilanRepondu) && <View style={styles.gentleCard}>
        <Text style={styles.kickerDark}>{t.checkinTitle}</Text>
        {bilanRepondu
          ? <Text style={styles.gentleBody}>{t.checkinSaved}  {t[LIBELLE_ETAT[bilanRepondu]]}</Text>
          : <>
              <Text style={styles.gentleBody}>{t.checkinQuestion}</Text>
              <View style={styles.checkinChoices}>{ETATS_DE_SEMAINE.map((etat) => (
                <Pressable key={etat} style={({ pressed }) => [styles.checkinChoice, pressed && styles.pressed]} android_ripple={ondeEncre} disabled={bilanEnCours} onPress={() => void repondre(etat)}>
                  <Text style={styles.checkinChoiceText}>{t[LIBELLE_ETAT[etat]]}</Text>
                </Pressable>
              ))}</View>
              <Text style={styles.checkinPrivate}>{t.checkinPrivate}</Text>
            </>}
      </View>}
      {/* Sans compte, rien ne s'enregistrerait : on le dit plutôt que d'offrir
          un bouton qui ne tiendrait pas. Même règle que le journal côté web. */}
      {!session && <Text style={styles.measurementNote}>{t.checkinSignedOut}</Text>}
      {notice !== '' && <Pressable onPress={() => setNotice('')}><Text style={styles.notice}>{notice}</Text></Pressable>}

      <View style={styles.navGrid}>
        <Link href="/journey" asChild><Pressable style={({ pressed }) => [styles.navCard, pressed && styles.pressed]} android_ripple={ondeEncre}><Text style={styles.navIndex}>01</Text><Text style={styles.navTitle}>{t.journey}</Text><Text style={styles.navArrow}>↗</Text></Pressable></Link>
        <Link href="/tandem" asChild><Pressable style={({ pressed }) => [styles.navCard, pressed && styles.pressed]} android_ripple={ondeEncre}><Text style={styles.navIndex}>02</Text><Text style={styles.navTitle}>{t.tandem}</Text><Text style={styles.navArrow}>↗</Text></Pressable></Link>
        <Link href="/journal" asChild><Pressable style={({ pressed }) => [styles.navCard, pressed && styles.pressed]} android_ripple={ondeEncre}><Text style={styles.navIndex}>03</Text><Text style={styles.navTitle}>{t.journal}</Text><Text style={styles.navArrow}>↗</Text></Pressable></Link>
        <Link href="/compte" asChild><Pressable style={({ pressed }) => [styles.navCard, pressed && styles.pressed]} android_ripple={ondeEncre}><Text style={styles.navIndex}>04</Text><Text style={styles.navTitle}>{t.account}</Text><Text style={styles.navArrow}>↗</Text></Pressable></Link>
        {/* Le rappel de séance écrit `notification_preferences.sessions`, sur
            le compte — comme le bilan juste en dessous, et pour la même
            raison : un interrupteur local serait un second endroit qui dit la
            même chose, et le rappel coupé depuis le navigateur reviendrait
            ici. Sans compte, il n'y a rien où l'écrire, et la carte ne
            s'affiche pas plutôt que de promettre un réglage sans mémoire. */}
        {session && etatBilan && <Pressable style={({ pressed }) => [styles.reminderCard, pressed && styles.pressed]} android_ripple={ondeEncre} accessibilityRole="switch" accessibilityState={{ checked: etatBilan.rappelSeance }} onPress={() => void basculerLeRappel('sessions')}><Text style={styles.navIndex}>05</Text><View style={styles.reminderCopy}><Text style={styles.navTitle}>{t.reminder}</Text><Text style={styles.reminderStatus}>{etatBilan.rappelSeance ? t.reminderOn : t.reminderOff}</Text></View><Text style={styles.navArrow}>{etatBilan.rappelSeance ? '●' : '○'}</Text></Pressable>}
        {/* Le réglage de mesure vit ici, avec le rappel, parce que le mobile n'a
            pas d'écran de réglages — et qu'un choix qu'on ne trouve pas n'est
            pas un choix. La description tient sur deux lignes : ce qu'on compte,
            ce qu'on ne lit pas. */}
        <Pressable style={({ pressed }) => [styles.navCard, pressed && styles.pressed]} android_ripple={ondeEncre} accessibilityRole="switch" accessibilityState={{ checked: mesure }} onPress={() => void basculerLaMesure()}><Text style={styles.navIndex}>06</Text><View style={styles.reminderCopy}><Text style={styles.navTitle}>{t.measurement}</Text><Text style={styles.reminderStatus}>{mesure ? t.measurementOn : t.measurementOff}</Text></View><Text style={styles.navArrow}>{mesure ? '●' : '○'}</Text></Pressable>
        {/* Le rappel du bilan se règle ici, avec la mesure, et pour la même
            raison : le mobile n'a pas d'écran de réglages, et un choix qu'on ne
            trouve pas n'est pas un choix. Il écrit dans
            `notification_preferences`, sur le compte — un interrupteur local
            serait un second endroit qui dit la même chose, et le rappel coupé
            depuis le navigateur reviendrait ici. */}
        {session && etatBilan && <Pressable style={({ pressed }) => [styles.navCard, pressed && styles.pressed]} android_ripple={ondeEncre} accessibilityRole="switch" accessibilityState={{ checked: etatBilan.rappelBilan }} onPress={() => void basculerLeRappel('weekly_checkin')}><Text style={styles.navIndex}>07</Text><View style={styles.reminderCopy}><Text style={styles.navTitle}>{t.checkinReminder}</Text><Text style={styles.reminderStatus}>{etatBilan.rappelBilan ? t.checkinReminderOn : t.checkinReminderOff}</Text></View><Text style={styles.navArrow}>{etatBilan.rappelBilan ? '●' : '○'}</Text></Pressable>}
      </View>
      {/* Dit seulement quand un rappel est demandé et que l'appareil n'a pas
          pu le poser : le réglage reste vrai sur le compte, c'est la
          planification qui manque, et la phrase ne dit rien de plus. */}
      {etatBilan && (etatBilan.rappelSeance || etatBilan.rappelBilan) && etatRappels !== 'posee' && <Text style={styles.measurementNote}>{
        etatRappels === 'permission-a-demander' ? t.reminderNeedsPermission
          : etatRappels === 'permission-refusee' ? t.reminderDenied
            : t.reminderUnavailable
      }</Text>}
      <Text style={styles.measurementNote}>{t.measurementDescription}</Text>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 24, paddingBottom: 48 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 },
  eyebrow: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1.4 },
  locale: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  authLink: { color: colors.copper, fontFamily: typography.mono, fontSize: 10 },
  greeting: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, maxWidth: 330 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 28, maxWidth: 310 },
  offline: { borderWidth: 1, borderColor: colors.copper, padding: 11, marginBottom: 20 },
  offlineText: { color: colors.copper, fontFamily: typography.mono, fontSize: 10 },
  heroCard: { backgroundColor: colors.ink, padding: 22, minHeight: 380 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  duration: { color: colors.soft, fontFamily: typography.mono, fontSize: 10 },
  number: { marginTop: 28, borderWidth: 1, borderColor: '#454540', width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: colors.white, fontFamily: typography.mono, fontSize: 20 },
  theme: { color: colors.soft, fontFamily: typography.mono, fontSize: 11, marginTop: 22 },
  title: { color: colors.white, fontFamily: typography.display, fontSize: 32, lineHeight: 36, marginTop: 8 },
  verse: { color: colors.soft, fontFamily: typography.display, fontSize: 17, lineHeight: 24, marginTop: 18 },
  prompt: { color: '#aeadA5', fontSize: 13, lineHeight: 20, marginTop: 20 },
  primary: { alignSelf: 'flex-start', backgroundColor: colors.copper, paddingVertical: 14, paddingHorizontal: 18, marginTop: 25 },
  primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11, letterSpacing: .5 },
  navGrid: { gap: 10, marginTop: 12 },
  navCard: { borderWidth: 1, borderColor: colors.line, padding: 17, minHeight: 76, flexDirection: 'row', alignItems: 'center' },
  navIndex: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, width: 32 },
  navTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20, flex: 1 },
  navArrow: { color: colors.ink, fontSize: 20 },
  reminderCard: { borderWidth: 1, borderColor: colors.copper, padding: 17, minHeight: 76, flexDirection: 'row', alignItems: 'center' },
  reminderCopy: { flex: 1 },
  reminderStatus: { color: colors.muted, fontFamily: typography.mono, fontSize: 9, marginTop: 5 },
  measurementNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
  gentleCard: { borderWidth: 1, borderColor: colors.line, padding: 18, marginTop: 12 },
  kickerDark: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  gentleBody: { color: colors.ink, fontSize: 15, lineHeight: 22, marginTop: 10 },
  checkinChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  checkinChoice: { borderWidth: 1, borderColor: colors.ink, paddingVertical: 13, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  checkinChoiceText: { color: colors.ink, fontFamily: typography.mono, fontSize: 11 },
  checkinPrivate: { color: colors.muted, fontFamily: typography.mono, fontSize: 9, marginTop: 12 },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 11, marginTop: 12 },
  pressed: { opacity: 0.55 },
})
