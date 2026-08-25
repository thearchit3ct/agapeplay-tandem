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
import type { Journey } from '@agapeplay/domain'
import { bordsDOnglet, colors, ondeEncre, toucheMinimale, typography } from '@/theme'
import { Appui } from '@/appui'
import { useLangue } from '@/langue'
import { Squelette, SqueletteDeParagraphe } from '@/squelette'
import { chargerParcours } from '@/parcours'

export default function JourneyScreen() {
  const { langue: locale, basculer } = useLangue()
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

  return <SafeAreaView style={styles.safe} edges={bordsDOnglet}>
    <ScrollView contentContainerStyle={styles.container}>
      {/* Plus de lien « ← Aujourd'hui » : l'onglet est le chemin de retour, et
          deux façons de revenir au même endroit en font une de trop. Reste la
          bascule de langue, seule dans sa rangée. */}
      <View style={styles.topline}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.language}
          style={[styles.localeTouch, toucheMinimale]}
          onPress={basculer}
        >
          {({ pressed }) => <Text style={[styles.locale, pressed && styles.pressed]}>{locale.toUpperCase()}</Text>}
        </Pressable>
      </View>

      <Text style={styles.kicker}>{parcours?.eyebrow ?? t.kicker}</Text>
      {/* Pendant la lecture, la forme du titre plutôt que le mot « chargement » :
          l'écran ne se réorganise pas quand le vrai titre arrive. Le parcours
          absent, lui, garde sa phrase — c'est une réponse, pas une attente. */}
      {chargement && !parcours
        ? <View style={styles.titreFantome}><Squelette hauteur={34} largeur="86%" /><Squelette hauteur={34} largeur="54%" /></View>
        : <Text style={styles.title}>{parcours?.title ?? t.journey}</Text>}
      {parcours && <Text style={styles.description}>{parcours.description}</Text>}
      {chargement && !parcours && <View style={styles.descriptionFantome}><SqueletteDeParagraphe lignes={2} /></View>}
      {!chargement && !parcours && <Text style={styles.description}>{t.notDownloaded}</Text>}

      {/* Trois rangées fantômes : la forme d'une liste de séances, avec son
          numéro à gauche. Trois et pas dix — un squelette annonce, il ne
          promet pas un compte. */}
      {chargement && !parcours && [0, 1, 2].map((rang) => (
        <View key={rang} style={styles.row}>
          <View style={styles.badgeFantome}><Squelette hauteur={48} largeur={48} /></View>
          <View style={styles.rowCopy}><Squelette hauteur={10} largeur="42%" /><View style={styles.rowTitreFantome}><Squelette hauteur={18} largeur="78%" /></View></View>
        </View>
      ))}

      {/* La rangée s'OUVRE vers la séance, elle ne la pousse pas depuis le bord.
          `Link.AppleZoom` est la transition à élément partagé d'Apple, portée par
          expo-router 57 : la rangée touchée grandit jusqu'à devenir l'écran, et
          le geste de retour la ramène à sa place — interruptible, piloté au
          doigt, rendu par UIKit.

          **iOS 18 et au-delà, et nulle part ailleurs.** Sur Android, sur iOS 17
          et sur le web, `Link.AppleZoom` se replie sur un `Slot` : il rend son
          enfant tel quel, et la pile garde sa transition de plateforme — le
          glissement latéral d'Android reste ce qu'Android attend. Aucune
          imitation en JavaScript n'a été écrite pour combler l'écart : une
          fausse transition à élément partagé, calculée hors du fil natif,
          décroche du doigt dès que la liste est longue, et c'est précisément le
          genre de faux natif que cette phase corrige.

          C'est ici que la transition tombe le plus juste : la rangée entière est
          déjà le lien, il n'y a donc rien à restructurer pour que la surface qui
          grandit soit celle qu'on a touchée. */}
      {(parcours?.sessions ?? []).map((seance) => (
        <Link key={seance.id} href={{ pathname: '/session', params: { jour: String(seance.day) } }} asChild>
          <Link.AppleZoom>
            <Appui style={({ pressed }) => [styles.row, pressed && styles.pressed]} android_ripple={ondeEncre}>
              <View style={styles.badge}><Text style={styles.badgeText}>{String(seance.day).padStart(2, '0')}</Text></View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowKicker}>{t.sessionLabel} {seance.day} · {seance.duration} {t.minutes}</Text>
                <Text style={styles.rowTitle}>{seance.title}</Text>
              </View>
              <Text style={styles.rowArrow}>↗</Text>
            </Appui>
          </Link.AppleZoom>
        </Link>
      ))}
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 24, paddingBottom: 48 },
  topline: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 40 },
  localeTouch: { alignItems: 'flex-end', paddingLeft: 16 },
  locale: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  pressed: { opacity: 0.55 },
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
  // Les mesures des fantômes suivent celles du vrai contenu : c'est ce qui fait
  // qu'aucune ligne ne saute au moment où le parcours arrive.
  titreFantome: { marginTop: 16, gap: 9 },
  descriptionFantome: { marginTop: 16, marginBottom: 30 },
  badgeFantome: { marginRight: 16 },
  rowTitreFantome: { marginTop: 8 },
})
