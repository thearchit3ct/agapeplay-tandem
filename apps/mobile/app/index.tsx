import { Link, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-home'
import type { EtatDeSemaine, Locale } from '@agapeplay/domain'
import { ETATS_DE_SEMAINE, invitationDouce, semaineDuBilan } from '@agapeplay/domain'
import { colors, typography } from '@/theme'
import { flushProgressQueue } from '@/offlineQueue'
import { supabase } from '@/supabase'
import { readReminderPreference, setDailyReminder } from '@/notifications'
import { basculerMesure, emettre, lireConsentementDuCompte, mesureAcceptee } from '@/mesure'
import { basculerRappelBilan, lireEtatDuBilan, poserBilan } from '@/bilan'
import type { EtatDuBilan } from '@/bilan'

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
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [mesure, setMesure] = useState(true)
  // Le bilan de fin de semaine — issue #18. `etatBilan` reste `null` tant que
  // la base n'a pas répondu : proposer une question sans savoir si elle a déjà
  // été posée, ou accueillir « de retour » quelqu'un dont on ignore la dernière
  // activité, serait affirmer plus qu'on ne sait.
  const [etatBilan, setEtatBilan] = useState<EtatDuBilan | null>(null)
  const [bilanRepondu, setBilanRepondu] = useState<EtatDeSemaine | null>(null)
  const [bilanEnCours, setBilanEnCours] = useState(false)
  const [notice, setNotice] = useState('')
  const t = useMemo(() => copy[locale], [locale])

  useFocusEffect(useCallback(() => {
    let active = true
    void supabase?.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      // Le refus de mesure suit le compte, pas l'appareil : sans cette lecture,
      // quelqu'un qui a dit non depuis son navigateur serait remesuré ici. Sans
      // session, seul le réglage local décide — il n'y a personne à qui
      // demander.
      const lecture = data.session ? lireConsentementDuCompte(data.session.user.id) : mesureAcceptee()
      void lecture.then((effectif) => { if (active) setMesure(effectif) })
    })
    // La session peut naître PENDANT que l'écran est monté — c'est exactement
    // ce que fait le lien magique ramassé par useAuthDeepLink. Sans cet
    // abonnement, l'en-tête resterait « Se connecter » jusqu'à une navigation.
    const { data: abonnement } = supabase?.auth.onAuthStateChange((_evenement, s) => { if (active) setSession(s) }) ?? { data: null }
    void flushProgressQueue()
    return () => { active = false; abonnement?.subscription.unsubscribe() }
  }, []))

  useEffect(() => { void readReminderPreference().then(setReminderEnabled) }, [])

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

  const basculerLeRappel = async () => {
    const compteId = session?.user.id
    if (!compteId || !etatBilan) return
    const pose = await basculerRappelBilan(compteId, !etatBilan.rappelBilan)
    setEtatBilan({ ...etatBilan, rappelBilan: pose })
  }

  const basculerLaMesure = async () => {
    setMesure(await basculerMesure(!mesure, session?.user.id ?? null))
  }

  const toggleReminder = async () => {
    const next = await setDailyReminder(!reminderEnabled)
    setReminderEnabled(next)
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}><Text style={styles.eyebrow}>{t.eyebrow}</Text><View style={styles.topActions}><Pressable accessibilityRole="button" accessibilityLabel={t.language} onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}><Text style={styles.locale}>{locale.toUpperCase()}</Text></Pressable><Link href="/auth" asChild><Pressable><Text style={styles.authLink}>{session ? t.signedIn : t.signIn}</Text></Pressable></Link></View></View>
      {offline && <Pressable style={styles.offline} onPress={() => setOffline(false)}><Text style={styles.offlineText}>{t.offline}</Text></Pressable>}
      <Text style={styles.greeting}>{t.greeting}</Text>
      <Text style={styles.subtitle}>{t.subtitle}</Text>

      <View style={styles.heroCard}>
        <View style={styles.cardHeader}><Text style={styles.kicker}>{t.dailySession}</Text><Text style={styles.duration}>06 MIN</Text></View>
        <View style={styles.number}><Text style={styles.numberText}>01</Text></View>
        <Text style={styles.theme}>{t.theme}</Text>
        <Text style={styles.title}>{t.sessionTitle}</Text>
        <Text style={styles.verse}>{t.verse}</Text>
        <Text style={styles.prompt}>{t.prompt}</Text>
        <Link href="/session" asChild><Pressable style={styles.primary}><Text style={styles.primaryText}>{t.start}  →</Text></Pressable></Link>
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
                <Pressable key={etat} style={styles.checkinChoice} disabled={bilanEnCours} onPress={() => void repondre(etat)}>
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
        <Link href="/journey" asChild><Pressable style={styles.navCard}><Text style={styles.navIndex}>01</Text><Text style={styles.navTitle}>{t.journey}</Text><Text style={styles.navArrow}>↗</Text></Pressable></Link>
        <Link href="/tandem" asChild><Pressable style={styles.navCard}><Text style={styles.navIndex}>02</Text><Text style={styles.navTitle}>{t.tandem}</Text><Text style={styles.navArrow}>↗</Text></Pressable></Link>
        <Pressable style={styles.navCard} onPress={() => setOffline(!offline)}><Text style={styles.navIndex}>03</Text><Text style={styles.navTitle}>{t.journal}</Text><Text style={styles.navArrow}>⌁</Text></Pressable>
        <Pressable style={styles.reminderCard} onPress={() => void toggleReminder()}><Text style={styles.navIndex}>04</Text><View style={styles.reminderCopy}><Text style={styles.navTitle}>{t.reminder}</Text><Text style={styles.reminderStatus}>{reminderEnabled ? t.reminderOn : t.reminderOff}</Text></View><Text style={styles.navArrow}>{reminderEnabled ? '●' : '○'}</Text></Pressable>
        {/* Le réglage de mesure vit ici, avec le rappel, parce que le mobile n'a
            pas d'écran de réglages — et qu'un choix qu'on ne trouve pas n'est
            pas un choix. La description tient sur deux lignes : ce qu'on compte,
            ce qu'on ne lit pas. */}
        <Pressable style={styles.navCard} accessibilityRole="switch" accessibilityState={{ checked: mesure }} onPress={() => void basculerLaMesure()}><Text style={styles.navIndex}>05</Text><View style={styles.reminderCopy}><Text style={styles.navTitle}>{t.measurement}</Text><Text style={styles.reminderStatus}>{mesure ? t.measurementOn : t.measurementOff}</Text></View><Text style={styles.navArrow}>{mesure ? '●' : '○'}</Text></Pressable>
        {/* Le rappel du bilan se règle ici, avec la mesure, et pour la même
            raison : le mobile n'a pas d'écran de réglages, et un choix qu'on ne
            trouve pas n'est pas un choix. Il écrit dans
            `notification_preferences`, sur le compte — un interrupteur local
            serait un second endroit qui dit la même chose, et le rappel coupé
            depuis le navigateur reviendrait ici. */}
        {session && etatBilan && <Pressable style={styles.navCard} accessibilityRole="switch" accessibilityState={{ checked: etatBilan.rappelBilan }} onPress={() => void basculerLeRappel()}><Text style={styles.navIndex}>06</Text><View style={styles.reminderCopy}><Text style={styles.navTitle}>{t.checkinReminder}</Text><Text style={styles.reminderStatus}>{etatBilan.rappelBilan ? t.checkinReminderOn : t.checkinReminderOff}</Text></View><Text style={styles.navArrow}>{etatBilan.rappelBilan ? '●' : '○'}</Text></Pressable>}
      </View>
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
  checkinChoice: { borderWidth: 1, borderColor: colors.ink, paddingVertical: 9, paddingHorizontal: 12 },
  checkinChoiceText: { color: colors.ink, fontFamily: typography.mono, fontSize: 11 },
  checkinPrivate: { color: colors.muted, fontFamily: typography.mono, fontSize: 9, marginTop: 12 },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 11, marginTop: 12 },
})
