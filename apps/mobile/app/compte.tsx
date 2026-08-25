/**
 * « Mon compte » : emporter ses données, se déconnecter partout, partir.
 *
 * Trois gestes que le web avait depuis la PR #44 et que le mobile n'avait pas
 * — c'est-à-dire qu'on pouvait vivre dans cette application sans jamais
 * pouvoir en sortir. Issue #13.
 *
 * Ce qui décide vraiment est ailleurs : `src/compte.ts` assemble l'export avec
 * la liste de sections du domaine, appelle `supprimer_mon_compte()` et vide le
 * téléphone. Cet écran ne fait que trois choses, et elles sont toutes de
 * l'ordre de l'honnêteté :
 *
 * - **la confirmation est une feuille native** depuis le 27/08/2026 — jamais un
 *   `Alert.alert`, qui ne rend rien d'utilisable sous react-native-web et que
 *   `mobile:export` attraperait. C'était un panneau poussé dans la page ; c'est
 *   maintenant `app/feuilles/suppression-compte.tsx`, présenté en `formSheet`.
 *   Les cinq phrases, leur ordre et le geste au bout n'ont pas bougé, et
 *   l'appel à `supprimer_mon_compte()` est resté ici ;
 * - **elle énumère avant de demander.** Ce qui disparaît, ce qui reste, le sort
 *   d'un blocage, le fait que les sessions se ferment : les mêmes phrases que
 *   le navigateur, parce que ce sont des engagements et non des libellés ;
 * - **rien n'est annoncé avant d'avoir été lu.** Une suppression qui échoue le
 *   dit ; le pire écran possible serait celui qui affiche « ton compte est
 *   supprimé » sur un compte intact.
 */
import { router, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-compte'
import { colors, ondeClaire, toucheMinimale, typography } from '@/theme'
import { useGesteDeFeuille } from '@/feuilles'
import { useLangue } from '@/langue'
import { revenir } from '@/retour'
import { toucherGrave, toucherLeger } from '@/toucher'
import { supabase } from '@/supabase'
import { deconnexionPartout, emporterMesDonnees, supprimerMonCompte } from '@/compte'

export default function CompteScreen() {
  const { langue: locale, basculer } = useLangue()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Un seul geste en vol à la fois : deux exports simultanés écriraient le même
  // fichier, et un export lancé pendant une suppression rassemblerait les
  // données d'un compte en train de disparaître.
  const [enCours, setEnCours] = useState<'export' | 'deconnexion' | 'suppression' | null>(null)
  const [notice, setNotice] = useState('')
  const t = copy[locale]

  useFocusEffect(useCallback(() => {
    let actif = true
    void supabase?.auth.getSession().then(({ data }) => {
      if (!actif) return
      setSession(data.session)
      setLoading(false)
    })
    return () => { actif = false }
  }, []))

  useEffect(() => {
    if (!notice) return
    const minuterie = setTimeout(() => setNotice(''), 5200)
    return () => clearTimeout(minuterie)
  }, [notice])

  const emporter = async () => {
    if (!session || enCours) return
    setEnCours('export')
    const resultat = await emporterMesDonnees({ id: session.user.id, email: session.user.email ?? null })
    setEnCours(null)
    // Trois issues distinctes, trois phrases : un fichier assemblé qu'aucune
    // application ne peut recevoir n'est pas un export raté, et le dire ainsi
    // ferait croire à une perte de données.
    if (resultat === 'echec-assemblage') { setNotice(t.exportFailed); return }
    if (resultat === 'sans-partage') { setNotice(t.exportNoSharing); return }
    // Le fichier est assemblé et proposé : c'est cela que la main confirme.
    toucherLeger()
    setNotice(t.exportReady)
  }

  const partirDePartout = async () => {
    if (!session || enCours) return
    setEnCours('deconnexion')
    const ferme = await deconnexionPartout()
    setEnCours(null)
    if (!ferme) { setNotice(t.signOutFailed); return }
    setSession(null)
    setNotice(t.signedOutEverywhere)
  }

  const supprimer = async () => {
    if (!session || enCours) return
    setEnCours('suppression')
    const supprime = await supprimerMonCompte()
    setEnCours(null)
    if (!supprime) { setNotice(t.deleteFailed); return }
    // Le geste le plus lourd de l'application, et le seul qui ne se défait pas.
    toucherGrave()
    setSession(null)
    setNotice(t.deleteDone)
    // Retour à l'accueil : rester sur un écran de compte qui n'a plus de compte
    // laisserait des boutons sans objet sous les yeux de quelqu'un qui vient de
    // partir. `replace` et non `push` — il n'y a rien vers quoi revenir.
    router.replace('/')
  }

  // Réarmé à chaque rendu : la feuille doit appeler la fonction qui voit la
  // session courante, pas celle du rendu où elle a été ouverte.
  useGesteDeFeuille('suppression-compte', supprimer)

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}>
        {/* Dépiler, et non naviguer vers l'accueil : voir `src/retour.ts`. */}
        <Pressable accessibilityRole="button" style={[styles.backTouch, toucheMinimale]} onPress={revenir}>
          {({ pressed }) => <Text style={[styles.back, pressed && styles.pressed]}>← {t.today}</Text>}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.language}
          style={[styles.localeTouch, toucheMinimale]}
          onPress={basculer}
        >
          {({ pressed }) => <Text style={[styles.locale, pressed && styles.pressed]}>{locale.toUpperCase()}</Text>}
        </Pressable>
      </View>

      <Text style={styles.kicker}>{t.kicker}</Text>
      <Text style={styles.title}>{t.title}</Text>

      {!loading && !session && <Text style={styles.hint}>{t.signInPrompt}</Text>}

      {session && <>
        <Text style={styles.account}>{t.account} · {session.user.email ?? ''}</Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t.exportData}</Text>
          <Text style={styles.blockText}>{t.exportDescription}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={enCours !== null}
            android_ripple={ondeClaire}
            style={({ pressed }) => [styles.action, enCours !== null && styles.actionOff, pressed && styles.pressed]}
            onPress={() => void emporter()}
          ><Text style={styles.actionText}>{enCours === 'export' ? t.exportWorking : `${t.exportData}  →`}</Text></Pressable>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t.signOutEverywhere}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={enCours !== null}
            style={toucheMinimale}
            onPress={() => void partirDePartout()}
          >{({ pressed }) => <Text style={[styles.link, pressed && styles.pressed]}>{t.signOutEverywhere}</Text>}</Pressable>
        </View>

        <View style={styles.blockDanger}>
          <Text style={styles.blockTitle}>{t.deleteAccount}</Text>
          <Text style={styles.blockText}>{t.deleteAccountDescription}</Text>
          {/* Ce qui va se passer est énuméré avant la question, comme avant —
              mais dans la feuille du système, qui le présente par-dessus cet
              écran. La phrase pendant l'appel (`deleteWorking`) s'affiche ici,
              sur le bouton lui-même : la feuille s'est déjà refermée à ce
              moment-là, pour que le retour à l'accueil ne se fasse pas sous
              elle. */}
          <Pressable
            accessibilityRole="button"
            disabled={enCours !== null}
            style={toucheMinimale}
            onPress={() => router.push('/feuilles/suppression-compte')}
          >{({ pressed }) => <Text style={[styles.danger, pressed && styles.pressed]}>{enCours === 'suppression' ? t.deleteWorking : t.deleteAccount}</Text>}</Pressable>
        </View>
      </>}

      {notice.length > 0 && <Text style={styles.notice}>{notice}</Text>}
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 24, paddingBottom: 48 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  backTouch: { alignSelf: 'flex-start' },
  back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11 },
  localeTouch: { alignItems: 'flex-end', paddingLeft: 16 },
  locale: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  pressed: { opacity: 0.55 },
  kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 36, lineHeight: 41, marginTop: 16 },
  account: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 18 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 18, maxWidth: 320 },
  block: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 20, marginTop: 30, maxWidth: 340 },
  blockDanger: { borderTopWidth: 1, borderTopColor: colors.copper, paddingTop: 20, marginTop: 30, maxWidth: 340 },
  blockTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  blockText: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  action: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 13, paddingHorizontal: 17, marginTop: 16 },
  actionOff: { backgroundColor: colors.line },
  actionText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
  link: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, marginTop: 12, textDecorationLine: 'underline' },
  danger: { color: colors.copper, fontFamily: typography.mono, fontSize: 11, marginTop: 14, textDecorationLine: 'underline' },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 26, maxWidth: 320 },
})
