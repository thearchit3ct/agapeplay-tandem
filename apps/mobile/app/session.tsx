/**
 * Une séance : celle qui a été publiée, lue depuis le téléphone s'il le faut.
 *
 * Jusqu'au 26/08/2026, cet écran affichait un verset écrit en dur et
 * enregistrait toujours la même séance — `repartir-avec-jesus-01` — quel que
 * soit le jour ouvert. Il lit maintenant le parcours publié (`chargerParcours`,
 * avec le cache du téléphone) et enregistre **la séance réellement lue**.
 *
 * Ce qui n'a pas changé, et qui compte :
 *
 * - **la progression passe par la file.** `queueProgress` garde l'ordre sous la
 *   main jusqu'au prochain envoi réussi : terminer une séance dans le métro
 *   n'est pas perdu. La clé de file porte l'identifiant de la séance, si bien
 *   que terminer deux fois la même n'écrit qu'une entrée ;
 * - **l'émission de mesure n'attend rien** et vient après l'enregistrement : la
 *   séance est terminée pour la personne, quoi qu'il arrive à la mesure.
 */
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-parcours'
import { trancheDuree } from '@agapeplay/domain'
import type { Journey, Locale } from '@agapeplay/domain'
import { colors, ondeClaire, toucheMinimale, typography } from '@/theme'
import { toucherAbouti } from '@/toucher'
import { queueProgress } from '@/offlineQueue'
import { emettre } from '@/mesure'
import { chargerParcours } from '@/parcours'
import { supabase } from '@/supabase'

export default function SessionScreen() {
  const { jour } = useLocalSearchParams<{ jour?: string }>()
  const [locale, setLocale] = useState<Locale>('fr')
  const [parcours, setParcours] = useState<Journey | null>(null)
  const [chargement, setChargement] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [termine, setTermine] = useState(false)
  // L'instant d'arrivée sur l'écran, pour n'en garder qu'une tranche (doc 08).
  // Une `ref` et non un état : elle ne s'affiche nulle part, et un état
  // déclencherait un rendu au montage pour rien.
  const ouvertA = useRef(Date.now())
  const t = copy[locale]

  useFocusEffect(useCallback(() => {
    let actif = true
    setChargement(true)
    void chargerParcours(locale).then((lu) => {
      if (!actif) return
      setParcours(lu)
      setChargement(false)
    })
    void supabase?.auth.getSession().then(({ data }) => { if (actif) setSession(data.session) })
    return () => { actif = false }
  }, [locale]))

  // Le jour demandé, ou le premier du parcours : arriver depuis l'accueil ne
  // nomme aucun jour, et ouvrir « la séance » veut alors dire la première.
  const demande = Number.parseInt(jour ?? '', 10)
  const seance = parcours?.sessions.find((une) => une.day === demande) ?? parcours?.sessions[0] ?? null

  const terminer = async () => {
    if (!seance || !parcours || termine) return
    const compteId = session?.user.id
    if (compteId) {
      // La clé de file porte le compte et la séance : reterminer la même
      // séance remplace l'opération en attente au lieu d'en empiler une
      // seconde (`queueProgress` déduplique sur `id`).
      await queueProgress({
        id: `${compteId}:${parcours.id}:${seance.id}`,
        userId: compteId,
        sessionId: seance.id,
        journeyId: parcours.id,
      })
    }
    // Terminer une séance est l'aboutissement de l'écran : c'est le geste qui
    // mérite le plus la vibration, et il n'y en a qu'une par séance —
    // `termine` garde la porte.
    toucherAbouti()
    setTermine(true)
    void emettre('session_completed', {
      locale,
      journeyId: parcours.id,
      proprietes: { day: seance.day, duration_bucket: trancheDuree(Date.now() - ouvertA.current) },
    })
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}>
        <Link href="/" asChild>
          <Pressable style={[styles.backTouch, toucheMinimale]}>
            {({ pressed }) => <Text style={[styles.back, pressed && styles.pressed]}>← {t.today}</Text>}
          </Pressable>
        </Link>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.language}
          style={[styles.localeTouch, toucheMinimale]}
          onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
        >
          {({ pressed }) => <Text style={[styles.locale, pressed && styles.pressed]}>{locale.toUpperCase()}</Text>}
        </Pressable>
      </View>

      {!seance
        ? <>
            <Text style={styles.kicker}>{t.kicker}</Text>
            <Text style={styles.title}>{chargement ? t.loading : t.journey}</Text>
            <Text style={styles.body}>{chargement ? '' : parcours ? t.unknownSession : t.notDownloaded}</Text>
          </>
        : <>
            <Text style={styles.kicker}>{t.sessionLabel} {String(seance.day).padStart(2, '0')} · {seance.duration} {t.minutes}</Text>
            <Text style={styles.title}>{seance.title}</Text>
            <Text style={styles.verse}>{seance.verse}</Text>
            <View style={styles.rule} />
            <Text style={styles.body}>{seance.prompt}</Text>
            <Text style={styles.body}>{seance.action}</Text>
            <Pressable accessibilityRole="button" android_ripple={ondeClaire} style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => void terminer()}>
              <Text style={styles.primaryText}>{termine ? t.finished : `${t.finish} →`}</Text>
            </Pressable>
            {/* Dit après coup, et seulement à qui a un compte : sans session,
                rien n'est mis en file — la file porte un identifiant de compte
                — et promettre un envoi serait faux. */}
            {termine && session && <Text style={styles.footer}>{t.finishQueued}</Text>}
            {!session && !chargement && <Text style={styles.footer}>{t.signInPrompt}</Text>}
          </>}

      <Text style={styles.footer}>{t.privacyNote}</Text>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 24, paddingBottom: 48 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 58 },
  backTouch: { alignSelf: 'flex-start' },
  back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11 },
  localeTouch: { alignItems: 'flex-end', paddingLeft: 16 },
  locale: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  pressed: { opacity: 0.55 },
  kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, marginTop: 16 },
  verse: { color: colors.ink, fontFamily: typography.display, fontSize: 22, lineHeight: 31, marginTop: 32 },
  rule: { width: 64, borderTopWidth: 2, borderTopColor: colors.copper, marginTop: 34 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 24, maxWidth: 320 },
  primary: { backgroundColor: colors.ink, padding: 16, alignSelf: 'flex-start', marginTop: 28 },
  primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
  footer: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 26, maxWidth: 320 },
})
