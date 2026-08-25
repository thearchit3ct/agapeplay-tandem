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
 * - **la confirmation est un panneau dans la page**, jamais `Alert.alert` — qui
 *   ne rend rien d'utilisable sous react-native-web, et que `mobile:export`
 *   attraperait ;
 * - **elle énumère avant de demander.** Ce qui disparaît, ce qui reste, le sort
 *   d'un blocage, le fait que les sessions se ferment : les mêmes phrases que
 *   le navigateur, parce que ce sont des engagements et non des libellés ;
 * - **rien n'est annoncé avant d'avoir été lu.** Une suppression qui échoue le
 *   dit ; le pire écran possible serait celui qui affiche « ton compte est
 *   supprimé » sur un compte intact.
 */
import { Link, router, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-compte'
import type { Locale } from '@agapeplay/domain'
import { colors, typography } from '@/theme'
import { supabase } from '@/supabase'
import { deconnexionPartout, emporterMesDonnees, supprimerMonCompte } from '@/compte'

export default function CompteScreen() {
  const [locale, setLocale] = useState<Locale>('fr')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Un seul geste en vol à la fois : deux exports simultanés écriraient le même
  // fichier, et un export lancé pendant une suppression rassemblerait les
  // données d'un compte en train de disparaître.
  const [enCours, setEnCours] = useState<'export' | 'deconnexion' | 'suppression' | null>(null)
  const [confirmation, setConfirmation] = useState(false)
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
    setConfirmation(false)
    setSession(null)
    setNotice(t.deleteDone)
    // Retour à l'accueil : rester sur un écran de compte qui n'a plus de compte
    // laisserait des boutons sans objet sous les yeux de quelqu'un qui vient de
    // partir. `replace` et non `push` — il n'y a rien vers quoi revenir.
    router.replace('/')
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}>
        <Link href="/" style={styles.back}>← {t.today}</Link>
        <Pressable accessibilityRole="button" accessibilityLabel={t.language} onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}><Text style={styles.locale}>{locale.toUpperCase()}</Text></Pressable>
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
            style={[styles.action, enCours !== null && styles.actionOff]}
            onPress={() => void emporter()}
          ><Text style={styles.actionText}>{enCours === 'export' ? t.exportWorking : `${t.exportData}  →`}</Text></Pressable>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t.signOutEverywhere}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={enCours !== null}
            onPress={() => void partirDePartout()}
          ><Text style={styles.link}>{t.signOutEverywhere}</Text></Pressable>
        </View>

        <View style={styles.blockDanger}>
          <Text style={styles.blockTitle}>{t.deleteAccount}</Text>
          <Text style={styles.blockText}>{t.deleteAccountDescription}</Text>
          {!confirmation && <Pressable
            accessibilityRole="button"
            disabled={enCours !== null}
            onPress={() => setConfirmation(true)}
          ><Text style={styles.danger}>{t.deleteAccount}</Text></Pressable>}

          {/* Ce qui va se passer, énuméré avant la question. L'ordre est celui
              du web : ce qui part, ce qui reste, le blocage, les sessions — et
              la proposition d'emporter ses données d'abord, qui est la seule
              chose encore réversible à ce moment-là. */}
          {confirmation && <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t.deleteConfirmTitle}</Text>
            <Text style={styles.panelText}>{t.deleteConfirmErases}</Text>
            <Text style={styles.panelText}>{t.deleteConfirmKeeps}</Text>
            <Text style={styles.panelText}>{t.deleteConfirmBlocked}</Text>
            <Text style={styles.panelText}>{t.deleteConfirmSession}</Text>
            <Text style={styles.panelNote}>{t.deleteConfirmExportFirst}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={enCours !== null}
              style={[styles.action, enCours !== null && styles.actionOff]}
              onPress={() => void supprimer()}
            ><Text style={styles.actionText}>{enCours === 'suppression' ? t.deleteWorking : `${t.deleteConfirm}  →`}</Text></Pressable>
            <Pressable onPress={() => setConfirmation(false)}><Text style={styles.panelCancel}>{t.deleteCancel}</Text></Pressable>
          </View>}
        </View>
      </>}

      {notice.length > 0 && <Text style={styles.notice}>{notice}</Text>}
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
  panel: { borderWidth: 1, borderLeftWidth: 3, borderColor: colors.ink, padding: 18, marginTop: 18 },
  panelTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  panelText: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 12 },
  panelNote: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 16 },
  panelCancel: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 14, textDecorationLine: 'underline' },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 26, maxWidth: 320 },
})
