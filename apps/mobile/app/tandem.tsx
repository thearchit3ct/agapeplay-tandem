/**
 * L'écran tandem mobile, et le chemin de retour après un blocage.
 *
 * C'était une maquette figée jusqu'au 06/08/2026. Elle lit désormais la ligne
 * `tandems` — statut et `blocked_by` — parce que c'est la seule façon de ne
 * montrer le déblocage qu'à celui qui a bloqué. La règle elle-même n'est pas
 * ici : `unblockAffordance` vit dans `packages/domain` et le web tranche avec
 * la même fonction.
 *
 * La confirmation est un panneau dans la page, pas un `Alert` : `Alert.alert`
 * ne rend rien d'utilisable sous `react-native-web`, et `mobile:export` — la
 * seule porte qui exerce vraiment Metro — passe par là.
 */
import { Link } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { copy } from '@agapeplay/content/copy/mobile-tandem'
import { unblockAffordance } from '@agapeplay/domain'
import type { Locale, TandemStatus } from '@agapeplay/domain'
import { colors, typography } from '@/theme'
import { supabase } from '@/supabase'

type RemoteTandem = { id: string; status: TandemStatus; blockedBy: string | null }

export default function TandemScreen() {
  const [locale, setLocale] = useState<Locale>('fr')
  const [session, setSession] = useState<Session | null>(null)
  const [tandem, setTandem] = useState<RemoteTandem | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')
  const t = copy[locale]

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!supabase) { if (active) setLoading(false); return }
      const { data: sessionData } = await supabase.auth.getSession()
      // Garde de démontage après chaque await : l'écran peut disparaître
      // pendant la requête, et écrire dans un état démonté ne sert personne.
      if (!active) return
      setSession(sessionData.session)
      if (!sessionData.session) { setLoading(false); return }
      const { data, error } = await supabase
        .from('tandems')
        .select('id, status, blocked_by, created_at')
        .or(`participant_a_id.eq.${sessionData.session.user.id},participant_b_id.eq.${sessionData.session.user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
      if (!active) return
      if (error) setNotice(t.syncError)
      else if (data?.[0]) setTandem({ id: data[0].id, status: data[0].status, blockedBy: data[0].blocked_by })
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  // Le web efface ses messages au bout de quelques secondes ; ici il n'y a pas
  // de `showNotice`, et une phrase laissée là finirait par annoncer la reprise
  // d'une conversation qu'on a quittée depuis longtemps.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4200)
    return () => clearTimeout(timer)
  }, [notice])

  const affordance = unblockAffordance({
    status: tandem?.status ?? null,
    blockedBy: tandem?.blockedBy ?? null,
    currentUserId: session?.user.id,
  })

  const unblock = async () => {
    setConfirming(false)
    if (!supabase || !tandem) return
    // Les trois champs que le blocage avait posés, défaits ensemble : laisser
    // `blocked_by` en place interdirait à l'autre participant de bloquer
    // un jour à son tour, la politique exigeant `auth.uid() = blocked_by`.
    const { error } = await supabase
      .from('tandems')
      .update({ status: 'active', blocked_by: null, ended_at: null })
      .eq('id', tandem.id)
    if (error) { setNotice(t.syncError); return }
    setTandem({ ...tandem, status: 'active', blockedBy: null })
    setNotice(t.unblockedNotice)
  }

  const blocked = tandem?.status === 'blocked' || tandem?.status === 'ended'

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}>
        <Link href="/" style={styles.back}>← {t.today}</Link>
        <Pressable accessibilityRole="button" accessibilityLabel={t.language} onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}><Text style={styles.locale}>{locale.toUpperCase()}</Text></Pressable>
      </View>

      <Text style={styles.kicker}>{t.kicker}</Text>
      <Text style={styles.title}>{t.title}</Text>
      <View style={styles.avatar}><Text style={styles.avatarText}>É</Text></View>
      <Text style={styles.name}>Élodie Martin</Text>
      <Text style={styles.status}>{loading ? t.loading : blocked ? `— ${t.blockedStatus}` : `● ${t.online}`}</Text>

      {!loading && !session && <Text style={styles.hint}>{t.signInPrompt}</Text>}
      {!loading && session && !tandem && <Text style={styles.hint}>{t.noTandem}</Text>}

      <View style={styles.message}><Text style={styles.messageText}>{t.lastMessage}</Text><Text style={styles.time}>{t.lastMessageAt}</Text></View>

      {affordance !== 'hidden' && !confirming && <View style={styles.panel}>
        <Text style={styles.panelKicker}>{t.blockedStatus.toUpperCase()}</Text>
        {affordance === 'unblockable' && <>
          <Text style={styles.panelText}>{t.unblockOwnerNote}</Text>
          <Pressable style={styles.panelAction} onPress={() => setConfirming(true)}><Text style={styles.panelActionText}>{t.unblock}  →</Text></Pressable>
        </>}
        {/* Aucun bouton dans les deux cas suivants : la politique le refuserait
            pour l'un, personne ne peut rien pour l'autre. La phrase tient lieu
            de réponse, ce qui est plus honnête qu'un geste qui échoue. */}
        {affordance === 'blocked-by-other' && <Text style={styles.panelText}>{t.unblockOtherNote}</Text>}
        {affordance === 'frozen' && <Text style={styles.panelText}>{t.unblockFrozenNote}</Text>}
      </View>}

      {confirming && <View style={styles.panel}>
        <Text style={styles.panelKicker}>{t.unblockTitle}</Text>
        <Text style={styles.panelText}>{t.unblockDescription}</Text>
        <Text style={styles.panelText}>{t.unblockReversible}</Text>
        <Pressable style={styles.panelAction} onPress={() => void unblock()}><Text style={styles.panelActionText}>{t.unblockConfirm}  →</Text></Pressable>
        <Pressable onPress={() => setConfirming(false)}><Text style={styles.panelCancel}>{t.unblockCancel}</Text></Pressable>
      </View>}

      {notice.length > 0 && <Text style={styles.notice}>{notice}</Text>}
      <Text style={styles.private}>{t.privacyNote}</Text>
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
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 42, marginTop: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.copper, justifyContent: 'center', alignItems: 'center', marginTop: 34 },
  avatarText: { color: colors.white, fontFamily: typography.display, fontSize: 30 },
  name: { color: colors.ink, fontFamily: typography.display, fontSize: 25, marginTop: 14 },
  status: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, marginTop: 6 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 18, maxWidth: 320 },
  message: { borderWidth: 1, borderColor: colors.line, padding: 18, marginTop: 36, maxWidth: 320 },
  messageText: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  time: { color: colors.muted, fontFamily: typography.mono, fontSize: 9, marginTop: 12 },
  panel: { borderWidth: 1, borderLeftWidth: 3, borderColor: colors.ink, padding: 18, marginTop: 28, maxWidth: 340 },
  panelKicker: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  panelText: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 11 },
  panelAction: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 13, paddingHorizontal: 17, marginTop: 18 },
  panelActionText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
  panelCancel: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 14, textDecorationLine: 'underline' },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 22, maxWidth: 320 },
  private: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 34 },
})
