/**
 * L'écran tandem mobile : la conversation, les deux gestes de protection, et le
 * chemin de retour après un blocage.
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
 * - **Bloquer et signaler, depuis le 24/08/2026.** Le web les avait depuis
 *   longtemps ; la conversation mobile est arrivée sans eux, c'est-à-dire qu'on
 *   pouvait y recevoir un message blessant sans rien pouvoir en faire. Les deux
 *   chemins d'écriture existaient déjà en base — aucune migration. Ce que
 *   l'écran a le droit de proposer est dit par `gestesDeProtection`, la
 *   troisième règle du domaine à vivre ici.
 * - **Une écriture lit sa réponse, et pas seulement son erreur.** Un UPDATE
 *   refusé par un `using` ne lève rien : il touche zéro ligne, en silence. Le
 *   cas réel n'est pas théorique — si l'autre a bloqué pendant qu'on était sur
 *   l'écran, notre blocage ne passe pas et le serveur ne le dit pas. D'où le
 *   `.select(…).maybeSingle()` sur le blocage comme sur le déblocage, et l'état
 *   posé depuis la ligne rendue plutôt que depuis ce qu'on croit avoir écrit.
 * - **`blocked_at` n'est jamais écrit d'ici.** Un trigger le pose
 *   (`20260806175000_blocage_depuis_quand.sql`) et écrase toute valeur proposée
 *   par l'appelant : une date de blocage qu'on peut choisir n'est pas une date.
 *   Les trois champs du geste sont `status`, `blocked_by`, `ended_at`, comme sur
 *   le web.
 *
 * Les confirmations sont des panneaux dans la page, pas des `Alert` :
 * `Alert.alert` ne rend rien d'utilisable sous `react-native-web`, et
 * `mobile:export` — la seule porte qui exerce vraiment Metro — passe par là.
 */
import { Link, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-tandem'
import { CATEGORIES_PROPOSEES, accesConversation, gestesDeProtection, initialeDe, unblockAffordance, urgenceDe } from '@agapeplay/domain'
import type { CategorieSignalement, Locale, RemoteMessage, TandemStatus } from '@agapeplay/domain'
import { colors, typography } from '@/theme'
import { supabase } from '@/supabase'

type RemoteTandem = { id: string; status: TandemStatus; blockedBy: string | null }

/**
 * Le libellé d'une catégorie proposée.
 *
 * Le type d'entrée est volontairement plus étroit que `CategorieSignalement` :
 * le mobile ne propose que les six catégories de `CATEGORIES_PROPOSEES`, et son
 * catalogue de textes ne connaît pas `non_precise` — qui ne nomme pas une
 * situation mais les signalements antérieurs aux catégories, et n'est affiché
 * que dans l'espace modérateur, côté web. Une catégorie ajoutée un jour sans
 * son libellé fera échouer `tsc`, pas l'écran.
 */
type CategorieProposee = Exclude<CategorieSignalement, 'non_precise'>

const libelleCategorie = (categorie: CategorieProposee, t: typeof copy.fr | typeof copy.en) => {
  if (categorie === 'malaise') return t.categoryMalaise
  if (categorie === 'insistance') return t.categoryInsistance
  if (categorie === 'secret') return t.categorySecret
  if (categorie === 'sexuel') return t.categorySexuel
  if (categorie === 'danger') return t.categoryDanger
  return t.categoryAutre
}

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
  // Un seul panneau à la fois, et c'est une machine plutôt que deux booléens :
  // deux confirmations ouvertes ensemble poseraient deux questions contraires.
  const [panneau, setPanneau] = useState<'aucun' | 'blocage' | 'deblocage' | 'signalement'>('aucun')
  // `signalement` dit qu'un envoi est en vol, `panneau === 'signalement'` dit
  // que le formulaire est ouvert. Les deux se ressemblent et ne se recouvrent
  // pas : le panneau reste affiché pendant l'envoi, et c'est le bouton de
  // confirmation qui se désarme.
  const [signalement, setSignalement] = useState(false)
  const [categorie, setCategorie] = useState<CategorieSignalement | null>(null)
  const [motLibre, setMotLibre] = useState('')
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
  const gestes = gestesDeProtection(vue)

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

  const bloquer = async () => {
    setPanneau('aucun')
    if (!supabase || !session || !tandem) return
    // Les trois mêmes champs que le web, et pas un de plus : `blocked_by` n'est
    // pas décoratif — la politique refuse un passage à `blocked` qui ne nomme
    // pas son auteur, et c'est cette colonne qui décidera ensuite qui peut
    // lever le blocage et qui garde l'historique. `blocked_at`, lui, appartient
    // au trigger.
    const { data, error } = await supabase
      .from('tandems')
      .update({ status: 'blocked', blocked_by: session.user.id, ended_at: new Date().toISOString() })
      .eq('id', tandem.id)
      .select('id, status, blocked_by')
      .maybeSingle()
    if (error) { setNotice(t.syncError); return }
    // Zéro ligne, aucune erreur : le `using` a refusé, en silence. Le cas se
    // produit si l'autre a bloqué pendant qu'on était sur l'écran. Annoncer
    // « c'est bloqué » ici serait un mensonge, et le pire des mensonges — celui
    // qui fait croire qu'on est protégé.
    if (!data) { setNotice(t.blockRefused); return }
    // L'état vient de la ligne rendue : c'est le serveur qui dit où en est la
    // relation, et l'écran se remet à jour sans re-scan. `accesConversation`
    // referme alors le composeur, `unblockAffordance` ouvre la porte de retour,
    // et le fil reste lisible — bloquer ne prend pas l'historique à celui qui a
    // bloqué, il en a souvent besoin pour signaler.
    setTandem({ id: data.id, status: data.status, blockedBy: data.blocked_by })
    setNotice(t.blockedNotice)
  }

  const signaler = async () => {
    if (signalement || !categorie || !supabase || !session || !tandem) return
    setSignalement(true)
    // Ce qui part est un **code** — `malaise`, `secret`, `danger`… — et non le
    // libellé affiché : la donnée que lit la modération ne doit pas dépendre de
    // la langue de l'écran. C'est ce que l'ancien littéral français protégeait
    // maladroitement, et que la contrainte `check` de `20260825173000` garantit
    // maintenant.
    //
    // Le mot libre part à `null` quand il est vide, jamais à `''` : la
    // contrainte de longueur passe sur NULL et refuse la chaîne vide.
    //
    // `urgency` n'est pas envoyée et ne peut pas l'être : colonne générée,
    // PostgreSQL refuse toute valeur proposée par un client.
    //
    // Aucun `message_id` non plus : le web n'en envoie pas, et l'espace de
    // modération sait dire « ce signalement ne pointe pas un message précis ».
    // Un signalement au message est une décision produit, pas une variante.
    const { data, error } = await supabase
      .from('tandem_reports')
      .insert({
        tandem_id: tandem.id,
        reporter_id: session.user.id,
        category: categorie,
        reason: motLibre.trim() || null,
      })
      .select('id')
      .maybeSingle()
    setSignalement(false)
    // Un insert refusé par un `with check` lève, contrairement à l'UPDATE — mais
    // on lit quand même la ligne rendue : sans elle, on annoncerait « transmis »
    // sur la foi d'une absence d'erreur.
    if (error || !data) { setNotice(t.syncError); return }
    setPanneau('aucun')
    setCategorie(null)
    setMotLibre('')
    setNotice(t.reportSent)
  }

  const unblock = async () => {
    setPanneau('aucun')
    if (!supabase || !tandem) return
    // Les trois champs que le blocage avait posés, défaits ensemble : laisser
    // `blocked_by` en place interdirait à l'autre participant de bloquer
    // un jour à son tour, la politique exigeant `auth.uid() = blocked_by`.
    const { data, error } = await supabase
      .from('tandems')
      .update({ status: 'active', blocked_by: null, ended_at: null })
      .eq('id', tandem.id)
      .select('id, status, blocked_by')
      .maybeSingle()
    if (error) { setNotice(t.syncError); return }
    // Même silence que pour le blocage, et même remède : sans ligne rendue,
    // rien n'a bougé côté serveur et l'écran doit le dire.
    if (!data) { setNotice(t.unblockRefused); return }
    setTandem({ id: data.id, status: data.status, blockedBy: data.blocked_by })
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

      {affordance !== 'hidden' && panneau === 'aucun' && <View style={styles.panel}>
        <Text style={styles.panelKicker}>{t.blockedStatus.toUpperCase()}</Text>
        {affordance === 'unblockable' && <>
          <Text style={styles.panelText}>{t.unblockOwnerNote}</Text>
          <Pressable style={styles.panelAction} onPress={() => setPanneau('deblocage')}><Text style={styles.panelActionText}>{t.unblock}  →</Text></Pressable>
        </>}
        {/* Aucun bouton dans les deux cas suivants : la politique le refuserait
            pour l'un, personne ne peut rien pour l'autre. La phrase tient lieu
            de réponse, ce qui est plus honnête qu'un geste qui échoue. */}
        {affordance === 'blocked-by-other' && <Text style={styles.panelText}>{t.unblockOtherNote}</Text>}
        {affordance === 'frozen' && <Text style={styles.panelText}>{t.unblockFrozenNote}</Text>}
      </View>}

      {panneau === 'deblocage' && <View style={styles.panel}>
        <Text style={styles.panelKicker}>{t.unblockTitle}</Text>
        <Text style={styles.panelText}>{t.unblockDescription}</Text>
        <Text style={styles.panelText}>{t.unblockReversible}</Text>
        <Pressable style={styles.panelAction} onPress={() => void unblock()}><Text style={styles.panelActionText}>{t.unblockConfirm}  →</Text></Pressable>
        <Pressable onPress={() => setPanneau('aucun')}><Text style={styles.panelCancel}>{t.unblockCancel}</Text></Pressable>
      </View>}

      {/* Le blocage se confirme, là où le web le pose sur un appui unique : sur
          un téléphone, un bouton se touche par accident, et celui-ci ferme une
          conversation. Le panneau dit ce qui change, puis ce qui reste
          réversible — le même ordre que le déblocage juste au-dessus. */}
      {panneau === 'blocage' && <View style={styles.panel}>
        <Text style={styles.panelKicker}>{t.blockTitle}</Text>
        <Text style={styles.panelText}>{t.blockDescription}</Text>
        <Text style={styles.panelText}>{t.blockReversible}</Text>
        <Pressable style={styles.panelAction} onPress={() => void bloquer()}><Text style={styles.panelActionText}>{t.blockConfirm}  →</Text></Pressable>
        <Pressable onPress={() => setPanneau('aucun')}><Text style={styles.panelCancel}>{t.blockCancel}</Text></Pressable>
      </View>}


      {/* Le signalement, devenu une question. Panneau dans la page et non
          `Alert.alert` : celui-ci ne rend rien d'utilisable sous
          react-native-web, et `mobile:export` est la seule garde Metro sans
          appareil. C'est la même règle que la confirmation de blocage.

          Le mot libre est facultatif et l'écran le dit : à ce moment-là,
          raconter est difficile, choisir une ligne ne l'est pas — et un champ
          qu'on croit obligatoire est un signalement abandonné. */}
      {panneau === 'signalement' && <View style={styles.panel}>
        <Text style={styles.panelKicker}>{t.report}</Text>
        <Text style={styles.panelTitle}>{t.reportTitle}</Text>
        <Text style={styles.panelText}>{t.reportDescription}</Text>

        <View style={styles.categories}>
          {CATEGORIES_PROPOSEES.map((valeur) => (
            <Pressable
              key={valeur}
              accessibilityRole="radio"
              accessibilityState={{ selected: categorie === valeur }}
              style={[styles.category, categorie === valeur && styles.categoryChosen]}
              onPress={() => setCategorie(valeur)}
            >
              <Text style={[styles.categoryText, categorie === valeur && styles.categoryTextChosen]}>{libelleCategorie(valeur, t)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Dit sur les deux seules catégories d'urgence immédiate, et nulle part
            ailleurs : sous chacune il deviendrait invisible, absent il
            laisserait croire qu'envoyer ce formulaire est un secours. */}
        {categorie && urgenceDe(categorie) === 'immediate' && <>
          <Text style={styles.panelAlert}>{t.reportHelplineNote}</Text>
          <Text style={styles.panelText}>{t.reportUrgentNote}</Text>
        </>}

        <Text style={styles.panelLabel}>{t.reportNoteLabel}</Text>
        <TextInput
          style={styles.noteInput}
          value={motLibre}
          onChangeText={setMotLibre}
          maxLength={1000}
          multiline
          placeholder={t.reportNotePlaceholder}
          placeholderTextColor={colors.muted}
        />

        {/* Sans catégorie il n'y a rien à envoyer : `category` est `not null` et
            sans défaut, la base refuserait l'insert. */}
        <Pressable
          accessibilityRole="button"
          disabled={!categorie || signalement}
          style={[styles.panelAction, (!categorie || signalement) && styles.panelActionOff]}
          onPress={() => void signaler()}
        ><Text style={styles.panelActionText}>{signalement ? t.reporting : t.reportConfirm}  →</Text></Pressable>
        <Pressable onPress={() => setPanneau('aucun')}><Text style={styles.panelCancel}>{t.reportCancel}</Text></Pressable>
      </View>}

      {/* Les deux gestes, en bas de l'écran comme sur le web : ils ne sont pas
          la conversation, ils sont ce qu'on fait quand elle tourne mal. Le
          signalement reste offert sur une relation bloquée — c'est souvent là
          qu'il sert. Rien n'est affiché sans tandem : il n'y aurait rien à
          bloquer ni à signaler, et un bouton qui ne peut pas aboutir est une
          promesse trahie. */}
      {(gestes.peutSignaler || gestes.peutBloquer) && panneau === 'aucun' && <View style={styles.safety}>
        {gestes.peutSignaler && <Pressable accessibilityRole="button" onPress={() => setPanneau('signalement')}>
          <Text style={styles.safetyDanger}>{t.report}</Text>
        </Pressable>}
        {gestes.peutBloquer && <Pressable accessibilityRole="button" onPress={() => setPanneau('blocage')}>
          <Text style={styles.safetyAction}>{t.block}</Text>
        </Pressable>}
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
  panelTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 24, marginTop: 10 },
  panelLabel: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 0.5, marginTop: 20 },
  // L'avertissement des lignes d'urgence : encadré, pas coloré en rouge — la
  // palette du produit n'a pas de rouge, et en inventer un ici ferait de cet
  // écran une alarme là où il doit rester tenable à lire.
  panelAlert: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 16, borderLeftWidth: 2, borderLeftColor: colors.copper, paddingLeft: 12 },
  categories: { marginTop: 18, gap: 8 },
  category: { borderWidth: 1, borderColor: colors.line, padding: 13 },
  categoryChosen: { borderColor: colors.ink, backgroundColor: colors.white },
  categoryText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  categoryTextChosen: { color: colors.ink },
  noteInput: { borderWidth: 1, borderColor: colors.line, padding: 13, minHeight: 74, marginTop: 9, color: colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  panelActionOff: { backgroundColor: colors.line },
  panelAction: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 13, paddingHorizontal: 17, marginTop: 18 },
  panelActionText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
  safety: { flexDirection: 'row', gap: 22, marginTop: 30, flexWrap: 'wrap' },
  safetyDanger: { color: colors.copper, fontFamily: typography.mono, fontSize: 11, textDecorationLine: 'underline' },
  safetyAction: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, textDecorationLine: 'underline' },
  safetyOff: { color: colors.line },
  panelCancel: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 14, textDecorationLine: 'underline' },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 22, maxWidth: 320 },
  private: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 34 },
})
