/**
 * Le parcours : ce qui a été publié, et non ce qu'une maquette imaginait.
 *
 * Jusqu'au 26/08/2026, cet écran listait trois titres écrits en dur. Il lit
 * maintenant le contenu publié par `chargerParcours`, avec le cache du
 * téléphone : une fois le parcours ouvert, il se relit en avion. C'est le
 * critère « séance déjà téléchargée lisible hors ligne » de l'issue #13.
 *
 * Ce que l'écran ne fait pas : inventer. Sans contenu — ni réseau, ni cache —
 * il le dit et n'affiche rien d'autre.
 */
import { Link, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-parcours'
import type { Journey, Locale } from '@agapeplay/domain'
import { colors, typography } from '@/theme'
import { chargerParcours } from '@/parcours'

export default function JourneyScreen() {
  const [locale, setLocale] = useState<Locale>('fr')
  const [parcours, setParcours] = useState<Journey | null>(null)
  const [chargement, setChargement] = useState(true)
  const t = copy[locale]

  // Rechargé à chaque focus ET à chaque changement de langue : le cache garde
  // les deux langues côte à côte, si bien qu'un passage à l'anglais hors ligne
  // rend l'anglais s'il a déjà été lu, et rien sinon — ce que l'écran dit.
  useFocusEffect(useCallback(() => {
    let actif = true
    setChargement(true)
    void chargerParcours(locale).then((lu) => {
      if (!actif) return
      setParcours(lu)
      setChargement(false)
    })
    return () => { actif = false }
  }, [locale]))

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}>
        <Link href="/" style={styles.back}>← {t.today}</Link>
        <Pressable accessibilityRole="button" accessibilityLabel={t.language} onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}><Text style={styles.locale}>{locale.toUpperCase()}</Text></Pressable>
      </View>

      <Text style={styles.kicker}>{parcours?.eyebrow ?? t.kicker}</Text>
      <Text style={styles.title}>{parcours?.title ?? (chargement ? t.loading : t.journey)}</Text>
      {parcours && <Text style={styles.description}>{parcours.description}</Text>}
      {!chargement && !parcours && <Text style={styles.description}>{t.notDownloaded}</Text>}

      {(parcours?.sessions ?? []).map((seance) => (
        <Link key={seance.id} href={{ pathname: '/session', params: { jour: String(seance.day) } }} asChild>
          <Pressable style={styles.row}>
            <View style={styles.badge}><Text style={styles.badgeText}>{String(seance.day).padStart(2, '0')}</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowKicker}>{t.sessionLabel} {seance.day} · {seance.duration} {t.minutes}</Text>
              <Text style={styles.rowTitle}>{seance.title}</Text>
            </View>
            <Text style={styles.rowArrow}>↗</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 24, paddingBottom: 48 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 54 },
  back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11 },
  locale: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 38, lineHeight: 43, marginTop: 16 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 16, marginBottom: 30, maxWidth: 320 },
  row: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 20, flexDirection: 'row', alignItems: 'center' },
  badge: { width: 48, height: 48, borderWidth: 1, borderColor: colors.ink, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  badgeText: { color: colors.ink, fontFamily: typography.mono, fontSize: 12 },
  rowCopy: { flex: 1 },
  rowKicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 9, letterSpacing: 0.7 },
  rowTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22, marginTop: 6 },
  rowArrow: { color: colors.ink, fontSize: 18 },
})
