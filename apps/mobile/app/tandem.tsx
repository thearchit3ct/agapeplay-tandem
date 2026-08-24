/**
 * L'écran tandem mobile : la conversation, et le chemin de retour après un
 * blocage.
 *
 * C'était une maquette figée jusqu'au 06/08/2026, puis un écran qui lisait la
 * ligne `tandems` — statut et `blocked_by` — sans jamais montrer un message.
 * Depuis le 24/08/2026 il lit `tandem_messages` et y écrit, comme le web.
 *
 * Trois choses valent d'être sues avant d'y toucher :
 *
 * - **Deux règles, deux fonctions.** `accesConversation` dit si l'historique
 *   remontera et si un envoi aboutira ; `unblockAffordance` dit qui peut lever
 *   le blocage. Les deux vivent dans `packages/domain`, le web tranche avec les
 *   mêmes, et l'écran ne fait que composer leurs réponses.
 * - **Une lecture coupée ne lève pas.** La politique `messages_select_member`
 *   filtre en silence : une personne bloquée reçoit zéro ligne et aucune
 *   erreur. Sans `peutLire`, l'écran lui afficherait « rien encore » — d'où le
 *   texte `threadClosed`, qui est la raison d'être de ce chantier.
 * - **Pas de temps réel, et pas de file hors-ligne.** Le fil se relit au
 *   retour sur l'écran (`useFocusEffect`, comme l'accueil) : c'est l'équivalent
 *   mobile du rechargement de page côté web. Un envoi qui échoue est dit et la
 *   saisie reste en place — le message n'est pas mis de côté, contrairement au
 *   web qui, lui, a une file.
 *
 * La confirmation de déblocage est un panneau dans la page, pas un `Alert` :
 * `Alert.alert` ne rend rien d'utilisable sous `react-native-web`, et
 * `mobile:export` — la seule porte qui exerce vraiment Metro — passe par là.
 */
import { Link, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-tandem'
import { accesConversation, initialeDe, unblockAffordance } from '@agapeplay/domain'
import type { Locale, RemoteMessage, TandemStatus } from '@agapeplay/domain'
import { colors, typography } from '@/theme'
import { supabase } from '@/supabase'

type RemoteTandem = { id: string; status: TandemStatus; blockedBy: string | null }

export default function TandemScreen() {
  const [locale, setLocale] = useState<Locale>('fr')
  const [session, setSession] = useState<Session | null>(null)
  const [tandem, setTandem] = useState<RemoteTandem | null>(null)
  // Via tandem_partenaire(), seul chemin de lecture du profil d'autrui. NULL
  // tant qu'on ne sait pas : l'écran dit « pas encore », il n'invente plus.
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [messages, setMessages] = useState<RemoteMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')
  const t = copy[locale]

  // `useFocusEffect` et non `useEffect(…, [])` : sans temps réel, un message
  // reçu n'apparaît que sur une relecture, et le seul geste qu'un adolescent
  // fera naturellement est de revenir sur l'écran. L'accueil suit déjà ce
  // motif. Aucun bouton « relire » : le web n'en a pas sur la conversation.
  useFocusEffect(useCallback(() => {
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
      else if (data?.[0]) {
        const ligneTandem: RemoteTandem = { id: data[0].id, status: data[0].status, blockedBy: data[0].blocked_by }
        setTandem(ligneTandem)
        const partenaire = await supabase.rpc('tandem_partenaire')
        if (!active) return
        if (!partenaire.error) {
          const ligne = (partenaire.data as Array<{ tandem_id: string; display_name: string | null }> | null)?.find((l) => l.tandem_id === ligneTandem.id)
          setPartnerName(ligne?.display_name?.trim() || null)
        }
        // Lu même quand `peutLire` est faux : la réponse serait vide, mais
        // c'est le serveur qui décide, pas l'écran. Le client ne s'autorise à
        // rien de plus fermé que la politique — jamais l'inverse non plus.
        const fil = await supabase
          .from('tandem_messages')
          .select('id, sender_id, body, created_at')
          .eq('tandem_id', ligneTandem.id)
          .order('created_at', { ascending: true })
        if (!active) return
        if (fil.error) setNotice(t.syncError)
        else setMessages((fil.data ?? []).map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at })))
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
    // Aucune dépendance : `t.syncError` est capturé au montage, et changer de
    // langue n'a pas à relancer une lecture — la phrase d'erreur suivante sera
    // dans la bonne langue.
  }, []))

  // Le web efface ses messages au bout de quelques secondes ; ici il n'y a pas
  // de `showNotice`, et une phrase laissée là finirait par annoncer la reprise
  // d'une conversation qu'on a quittée depuis longtemps.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4200)
    return () => clearTimeout(timer)
  }, [notice])

  const vue = { status: tandem?.status ?? null, blockedBy: tandem?.blockedBy ?? null, currentUserId: session?.user.id }
  const affordance = unblockAffordance(vue)
  const acces = accesConversation(vue)

  const envoyer = async () => {
    const body = draft.trim()
    if (!body || sending || !supabase || !session || !tandem || !acces.peutEcrire) return
    setSending(true)
    // L'écriture lit sa réponse. Un insert refusé par un `with check` lève,
    // mais on ne s'en remet pas au seul `error` : sans `data`, on n'a pas la
    // ligne réelle — et c'est elle, avec son `created_at` du serveur, qui va
    // dans le fil. Un objet fabriqué ici afficherait l'heure du téléphone.
    const { data, error } = await supabase
      .from('tandem_messages')
      .insert({ tandem_id: tandem.id, sender_id: session.user.id, body })
      .select('id, sender_id, body, created_at')
      .single()
    setSending(false)
    if (error || !data) {
      // La saisie reste en place : sans file hors-ligne, la vider perdrait le
      // message pour de bon. C'est l'écart assumé avec le web.
      setNotice(t.sendError)
      return
    }
    setMessages((precedents) => [...precedents, { id: data.id, senderId: data.sender_id, body: data.body, createdAt: data.created_at }])
    setDraft('')
  }

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
      {/* Le vrai nom, plus jamais celui de la maquette. Sans tandem ou sans
          nom posé, la ligne d'indice ci-dessous dit déjà la situation. */}
      <View style={styles.avatar}><Text style={styles.avatarText}>{initialeDe(partnerName)}</Text></View>
      <Text style={styles.name}>{partnerName ?? (loading ? '…' : t.noTandem)}</Text>
      <Text style={styles.status}>{loading ? t.loading : !tandem ? ' ' : blocked ? `— ${t.blockedStatus}` : `● ${t.online}`}</Text>

      {!loading && !session && <Text style={styles.hint}>{t.signInPrompt}</Text>}
      {!loading && session && !tandem && <Text style={styles.hint}>{t.noTandem}</Text>}

      {tandem && <View style={styles.thread}>
        {/* Trois cas, et le troisième est le seul qui se voit vraiment : une
            lecture coupée par la politique rend une liste vide, exactement
            comme une conversation qui n'a jamais commencé. */}
        {!acces.peutLire
          ? <Text style={styles.threadNote}>{t.threadClosed}</Text>
          : messages.length === 0
            ? <Text style={styles.threadNote}>{t.emptyThread}</Text>
            : messages.map((message) => {
              const deMoi = message.senderId === session?.user.id
              return <View key={message.id} style={[styles.bubble, deMoi ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.author, deMoi && styles.authorMine]}>{deMoi ? t.me : partnerName ?? t.tandem}</Text>
                <Text style={[styles.body, deMoi && styles.bodyMine]}>{message.body}</Text>
                <Text style={[styles.time, deMoi && styles.timeMine]}>{new Date(message.createdAt).toLocaleString()}</Text>
              </View>
            })}
      </View>}

      {tandem && <View style={styles.composer}>
        {/* Le composeur reste visible mais fermé, comme sur le web : le retirer
            laisserait croire que la conversation n'a jamais eu de composeur,
            là où le placeholder dit qu'elle est close. */}
        <TextInput
          style={[styles.input, !acces.peutEcrire && styles.inputClosed]}
          value={draft}
          onChangeText={setDraft}
          editable={acces.peutEcrire && !sending}
          multiline
          placeholder={acces.peutEcrire ? t.composerPlaceholder : t.composerClosed}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t.composerPlaceholder}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!acces.peutEcrire || sending || !draft.trim()}
          style={[styles.sendButton, (!acces.peutEcrire || sending || !draft.trim()) && styles.sendButtonOff]}
          onPress={() => void envoyer()}
        >
          <Text style={styles.sendButtonText}>{sending ? t.sending : `${t.send}  →`}</Text>
        </Pressable>
      </View>}

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
  thread: { marginTop: 36, gap: 12 },
  threadNote: { color: colors.muted, fontSize: 14, lineHeight: 21, maxWidth: 320, borderLeftWidth: 2, borderLeftColor: colors.line, paddingLeft: 14 },
  bubble: { padding: 15, maxWidth: 300 },
  bubbleTheirs: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.ink },
  author: { color: colors.muted, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  authorMine: { color: colors.soft },
  body: { color: colors.ink, fontSize: 16, lineHeight: 23, marginTop: 7 },
  bodyMine: { color: colors.white },
  time: { color: colors.muted, fontFamily: typography.mono, fontSize: 9, marginTop: 10 },
  timeMine: { color: colors.soft },
  composer: { marginTop: 26, gap: 12, maxWidth: 340 },
  input: { borderWidth: 1, borderColor: colors.ink, padding: 14, minHeight: 74, color: colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  inputClosed: { borderColor: colors.line, backgroundColor: colors.soft },
  sendButton: { alignSelf: 'flex-start', backgroundColor: colors.copper, paddingVertical: 13, paddingHorizontal: 18 },
  sendButtonOff: { backgroundColor: colors.line },
  sendButtonText: { color: colors.white, fontFamily: typography.mono, fontSize: 11, letterSpacing: 0.5 },
  panel: { borderWidth: 1, borderLeftWidth: 3, borderColor: colors.ink, padding: 18, marginTop: 28, maxWidth: 340 },
  panelKicker: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  panelText: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 11 },
  panelAction: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 13, paddingHorizontal: 17, marginTop: 18 },
  panelActionText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
  panelCancel: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 14, textDecorationLine: 'underline' },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 22, maxWidth: 320 },
  private: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 34 },
})
