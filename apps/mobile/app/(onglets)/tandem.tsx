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
 * - **Les confirmations sont des feuilles natives depuis le 27/08/2026.**
 *   C'étaient des panneaux poussés dans la page — jamais des `Alert.alert`, qui
 *   ne rendent rien d'utilisable sous `react-native-web` et que `mobile:export`
 *   attraperait. Elles sont maintenant des routes présentées en `formSheet`
 *   (`app/feuilles/`), c'est-à-dire la feuille de bas d'écran du système. **Rien
 *   de la logique n'a bougé** : les gardes, les écritures, les lectures de
 *   réponse, les phrases et les vibrations sont restées ici, et les feuilles ne
 *   font que demander — le fil entre les deux est `src/feuilles.ts`.
 *
 * - **Le composeur est sorti du `ScrollView` le 25/08/2026.** C'est la seule
 *   modification de structure de la finition mobile, et elle était nécessaire :
 *   une conversation dont la case de saisie défile avec le fil ne se comporte
 *   pas comme une messagerie, et sous Android en bord-à-bord le clavier la
 *   recouvrait purement et simplement. Le fil et le composeur sont désormais
 *   deux frères dans une colonne, et c'est la colonne qui remonte au-dessus du
 *   clavier : le fil se rétrécit, le composeur reste au ras du clavier. Aucune
 *   règle n'a changé — `accesConversation` gouverne toujours ce que le
 *   composeur autorise, et il reste affiché fermé plutôt que retiré.
 * - Le composeur n'a plus à s'effacer pendant une confirmation : la feuille du
 *   système passe **par-dessus** l'écran et l'assombrit, là où un panneau dans
 *   la page laissait le composeur épinglé devant le bouton de confirmation —
 *   proposant d'écrire à quelqu'un à qui l'on était en train de dire qu'on le
 *   bloquait. Un état de moins, et il a disparu parce que le contenant a changé.
 */
import { router, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-tandem'
import { accesConversation, gestesDeProtection, initialeDe, unblockAffordance } from '@agapeplay/domain'
import type { RemoteMessage, TandemStatus } from '@agapeplay/domain'
import { bordsDOnglet, colors, ondeClaire, toucheMinimale, typography } from '@/theme'
import { useHauteurDuClavier } from '@/clavier'
import { useGesteDeFeuille } from '@/feuilles'
import type { ChargesDeFeuille } from '@/feuilles'
import { useLangue } from '@/langue'
import { Squelette, SqueletteDeParagraphe } from '@/squelette'
import { toucherGrave, toucherLeger } from '@/toucher'
import { emettre } from '@/mesure'
import { supabase } from '@/supabase'

type RemoteTandem = { id: string; status: TandemStatus; blockedBy: string | null }

export default function TandemScreen() {
  const { langue: locale, basculer } = useLangue()
  const [session, setSession] = useState<Session | null>(null)
  const [tandem, setTandem] = useState<RemoteTandem | null>(null)
  // Via tandem_partenaire(), seul chemin de lecture du profil d'autrui. NULL
  // tant qu'on ne sait pas : l'écran dit « pas encore », il n'invente plus.
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [messages, setMessages] = useState<RemoteMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [rafraichissement, setRafraichissement] = useState(false)
  const refDefilement = useRef<ScrollView>(null)
  /**
   * Qu'un envoi de signalement soit en vol.
   *
   * Une `ref` et non un état, pour une raison qui n'est pas de commodité : la
   * fonction appelée depuis la feuille lit ce qu'elle a fermé au rendu où elle a
   * été armée. Un état posé juste avant l'`await` ne serait donc **pas** vu par
   * un second appel arrivé entre-temps — la garde ne garderait rien. Une `ref`
   * est lue et écrite au même instant, par tous les appelants.
   *
   * La feuille désarme son bouton de son côté ; celle-ci est la garde de
   * dernier ressort, du côté où l'écriture se fait.
   */
  const signalementEnVol = useRef(false)
  const t = copy[locale]

  /**
   * Ce que le composeur garde sous lui, et pourquoi les deux plateformes ne
   * demandent pas la même chose.
   *
   * Le composeur est épinglé au bas de l'écran — il ne défile pas avec le fil —
   * et il vit désormais **dans un onglet**. Or les deux implémentations de la
   * barre native ne posent pas la marge basse au même endroit (voir
   * `bordsDOnglet` dans `theme.ts`) :
   *
   * - **iOS** ne pose rien : c'est à nous de dégager la barre d'onglets, et les
   *   marges lues ici l'incluent déjà. Clavier ouvert, la mesure part du bas de
   *   l'écran et remplace la marge — le composeur se retrouve au ras des
   *   touches, ce qu'on attend d'une messagerie.
   * - **Android** l'a déjà posée, et la barre monte au-dessus du clavier
   *   (`tabBarRespectsIMEInsets`, dans le layout d'onglets) : le contenu est
   *   donc déjà au bon endroit dans les deux cas, et tout ajout ici serait une
   *   seconde marge.
   */
  const hauteurClavier = useHauteurDuClavier()
  const marges = useSafeAreaInsets()
  const margeDuComposeur = Platform.OS === 'ios' ? (hauteurClavier > 0 ? hauteurClavier : marges.bottom) : 0

  /**
   * La garde de démontage, devenue une `ref` : `load` sert désormais deux
   * appelants — l'arrivée sur l'écran et le tirer-pour-rafraîchir — et une
   * variable refermée dans l'effet ne protégerait que le premier.
   */
  const active = useRef(true)

  const load = useCallback(async () => {
    if (!supabase) { if (active.current) setLoading(false); return }
    const { data: sessionData } = await supabase.auth.getSession()
    // Garde de démontage après chaque await : l'écran peut disparaître
    // pendant la requête, et écrire dans un état démonté ne sert personne.
    if (!active.current) return
    setSession(sessionData.session)
    if (!sessionData.session) { setLoading(false); return }
    const { data, error } = await supabase
      .from('tandems')
      .select('id, status, blocked_by, created_at')
      .or(`participant_a_id.eq.${sessionData.session.user.id},participant_b_id.eq.${sessionData.session.user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
    if (!active.current) return
    if (error) setNotice(t.syncError)
    else if (data?.[0]) {
      const ligneTandem: RemoteTandem = { id: data[0].id, status: data[0].status, blockedBy: data[0].blocked_by }
      setTandem(ligneTandem)
      const partenaire = await supabase.rpc('tandem_partenaire')
      if (!active.current) return
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
      if (!active.current) return
      if (fil.error) setNotice(t.syncError)
      else setMessages((fil.data ?? []).map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at })))
    }
    setLoading(false)
    // Aucune dépendance : `t.syncError` est capturé au montage, et changer de
    // langue n'a pas à relancer une lecture — la phrase d'erreur suivante sera
    // dans la bonne langue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // `useFocusEffect` et non `useEffect(…, [])` : sans temps réel, un message
  // reçu n'apparaît que sur une relecture, et le seul geste qu'un adolescent
  // fera naturellement est de revenir sur l'écran. L'accueil suit déjà ce
  // motif.
  useFocusEffect(useCallback(() => {
    active.current = true
    void load()
    return () => { active.current = false }
  }, [load]))

  /**
   * Le tirer-pour-rafraîchir : le geste que tout le monde connaît des
   * messageries, et le seul moyen de relire le fil sans quitter l'écran. Il
   * appelle exactement la lecture ci-dessus — pas un second chemin qui
   * finirait par en diverger. C'est aussi ce qui remplace le bouton « relire »
   * que le web n'a pas.
   */
  const rafraichir = useCallback(async () => {
    setRafraichissement(true)
    await load()
    if (active.current) setRafraichissement(false)
  }, [load])

  /**
   * Le fil, ramené sur son dernier message.
   *
   * Sans temps réel, les deux moments où le bas du fil compte sont l'arrivée
   * sur l'écran et l'envoi d'un message. `scrollToEnd` amène la fin du contenu
   * défilant, qui comprend aussi les liens de protection et la note de
   * confidentialité — courts, et depuis toujours sous le fil : les derniers
   * messages restent sous les yeux.
   */
  const auDernierMessage = useCallback(() => {
    // Après le rendu, sinon la hauteur mesurée est celle d'avant le message.
    requestAnimationFrame(() => refDefilement.current?.scrollToEnd({ animated: true }))
  }, [refDefilement])

  // Une conversation s'ouvre sur ce qui vient d'être dit, pas sur son début.
  // Déclenché sur la fin du chargement et non sur `messages` : à chaque envoi,
  // `envoyer` s'en charge déjà, et réagir aux deux ferait deux défilements.
  useEffect(() => {
    if (!loading && messages.length > 0) auDernierMessage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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
    // Vibré sur la ligne rendue par le serveur, jamais sur l'appui : ce que la
    // main doit sentir, c'est que le message est **parti**.
    toucherLeger()
    setMessages((precedents) => [...precedents, { id: data.id, senderId: data.sender_id, body: data.body, createdAt: data.created_at }])
    setDraft('')
    auDernierMessage()
  }

  const bloquer = async () => {
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
    // Plus lourd que l'envoi : fermer une conversation n'est pas un geste
    // ordinaire, et la main doit le savoir.
    toucherGrave()
    setTandem({ id: data.id, status: data.status, blockedBy: data.blocked_by })
    setNotice(t.blockedNotice)
  }

  /**
   * Le signalement. La catégorie et le mot libre viennent de la feuille — c'est
   * elle qui les recueille depuis le 27/08/2026 — et la valeur rendue lui dit si
   * elle peut se refermer : `false` la laisse ouverte, saisie intacte, comme le
   * panneau restait affiché quand l'insert échouait.
   */
  const signaler = async ({ categorie, motLibre }: ChargesDeFeuille['signalement']): Promise<boolean> => {
    if (signalementEnVol.current || !categorie || !supabase || !session || !tandem) return false
    signalementEnVol.current = true
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
    signalementEnVol.current = false
    // Un insert refusé par un `with check` lève, contrairement à l'UPDATE — mais
    // on lit quand même la ligne rendue : sans elle, on annoncerait « transmis »
    // sur la foi d'une absence d'erreur.
    if (error || !data) { setNotice(t.syncError); return false }
    toucherGrave()
    // Le doc 08 autorise `category` et `channel_type` sur cet événement, et
    // rien de plus. Le mot libre reste ici : c'est la phrase de la personne.
    void emettre('report_created', { locale, proprietes: { category: categorie, channel_type: 'conversation' } })
    setNotice(t.reportSent)
    return true
  }

  const unblock = async () => {
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

  /**
   * Les trois gestes que les feuilles confirment.
   *
   * Réarmés à chaque rendu par `useGesteDeFeuille` : une fonction enregistrée
   * une seule fois figerait la session et le tandem du rendu où elle a été
   * posée, et une feuille ouverte plus tard écrirait avec des valeurs périmées.
   */
  useGesteDeFeuille('blocage', bloquer)
  useGesteDeFeuille('deblocage', unblock)
  useGesteDeFeuille('signalement', signaler)

  const blocked = tandem?.status === 'blocked' || tandem?.status === 'ended'

  const composeurVisible = tandem !== null

  return <SafeAreaView style={styles.safe} edges={bordsDOnglet}>
    {/* C'est la colonne qui remonte au-dessus du clavier, et non chacun de ses
        deux enfants : le fil, en `flex: 1`, se rétrécit d'autant, et le
        composeur se retrouve au ras du clavier — le comportement d'une
        messagerie. */}
    <View style={[styles.colonne, { paddingBottom: margeDuComposeur }]}>
      <ScrollView
        ref={refDefilement}
        style={styles.fil}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl
          refreshing={rafraichissement}
          onRefresh={() => void rafraichir()}
          colors={[colors.copper]}
          tintColor={colors.copper}
        />}
      >
        {/* Plus de lien « ← Aujourd'hui » : l'onglet est le chemin de retour. */}
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

        <Text style={styles.kicker}>{t.kicker}</Text>
        <Text style={styles.title}>{t.title}</Text>
        {/* Le vrai nom, plus jamais celui de la maquette. Sans tandem ou sans
            nom posé, la ligne d'indice ci-dessous dit déjà la situation. */}
        <View style={styles.avatar}><Text style={styles.avatarText}>{initialeDe(partnerName)}</Text></View>
        {loading
          ? <View style={styles.nomFantome}><Squelette hauteur={22} largeur={168} /><Squelette hauteur={10} largeur={92} /></View>
          : <>
              <Text style={styles.name}>{partnerName ?? t.noTandem}</Text>
              <Text style={styles.status}>{!tandem ? ' ' : blocked ? `— ${t.blockedStatus}` : `● ${t.online}`}</Text>
            </>}

        {!loading && !session && <Text style={styles.hint}>{t.signInPrompt}</Text>}
        {!loading && session && !tandem && <Text style={styles.hint}>{t.noTandem}</Text>}

        {/* Le fil pendant sa première lecture : trois bulles fantômes, alternées
            comme une conversation, et de largeurs inégales comme des phrases.
            Elles ne remplacent aucune des trois réponses possibles — fil coupé,
            fil vide, fil plein — qui gardent leurs mots. */}
        {loading && messages.length === 0 && <View style={styles.thread}>
          {[0, 1, 2].map((rang) => (
            <View key={rang} style={[styles.bubble, rang % 2 === 0 ? styles.bubbleTheirs : styles.bubbleMine, styles.bulleFantome]}>
              <SqueletteDeParagraphe lignes={rang === 1 ? 1 : 2} sombre={rang % 2 === 1} />
            </View>
          ))}
        </View>}

        {tandem && !loading && <View style={styles.thread}>
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

        {affordance !== 'hidden' && <View style={styles.panel}>
          <Text style={styles.panelKicker}>{t.blockedStatus.toUpperCase()}</Text>
          {affordance === 'unblockable' && <>
            <Text style={styles.panelText}>{t.unblockOwnerNote}</Text>
            {/* Le bouton n'ouvre plus un encadré dans la page : il présente la
                feuille du système. Ce qui suit — les phrases, l'ordre, le geste
                — est identique ; c'est le contenant qui a changé. */}
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.panelAction, pressed && styles.pressed]} android_ripple={ondeClaire} onPress={() => router.push('/feuilles/deblocage')}><Text style={styles.panelActionText}>{t.unblock}  →</Text></Pressable>
          </>}
          {/* Aucun bouton dans les deux cas suivants : la politique le refuserait
              pour l'un, personne ne peut rien pour l'autre. La phrase tient lieu
              de réponse, ce qui est plus honnête qu'un geste qui échoue. */}
          {affordance === 'blocked-by-other' && <Text style={styles.panelText}>{t.unblockOtherNote}</Text>}
          {affordance === 'frozen' && <Text style={styles.panelText}>{t.unblockFrozenNote}</Text>}
        </View>}

        {/* Les deux gestes, en bas de l'écran comme sur le web : ils ne sont pas
            la conversation, ils sont ce qu'on fait quand elle tourne mal. Le
            signalement reste offert sur une relation bloquée — c'est souvent là
            qu'il sert. Rien n'est affiché sans tandem : il n'y aurait rien à
            bloquer ni à signaler, et un bouton qui ne peut pas aboutir est une
            promesse trahie. */}
        {(gestes.peutSignaler || gestes.peutBloquer) && <View style={styles.safety}>
          {gestes.peutSignaler && <Pressable accessibilityRole="button" style={toucheMinimale} onPress={() => router.push('/feuilles/signalement')}>
            {({ pressed }) => <Text style={[styles.safetyDanger, pressed && styles.pressed]}>{t.report}</Text>}
          </Pressable>}
          {/* Le blocage se confirme, là où le web le pose sur un appui unique :
              sur un téléphone, un bouton se touche par accident, et celui-ci
              ferme une conversation. */}
          {gestes.peutBloquer && <Pressable accessibilityRole="button" style={toucheMinimale} onPress={() => router.push('/feuilles/blocage')}>
            {({ pressed }) => <Text style={[styles.safetyAction, pressed && styles.pressed]}>{t.block}</Text>}
          </Pressable>}
        </View>}

        {notice.length > 0 && <Text style={styles.notice}>{notice}</Text>}
        <Text style={styles.private}>{t.privacyNote}</Text>
      </ScrollView>

      {/* Le composeur, épinglé. Il reste **visible mais fermé** quand la relation
          ne permet plus d'écrire, comme sur le web : le retirer laisserait croire
          que la conversation n'a jamais eu de composeur, là où le placeholder dit
          qu'elle est close. */}
      {composeurVisible && <View style={styles.composer}>
        <TextInput
          style={[styles.input, !acces.peutEcrire && styles.inputClosed]}
          value={draft}
          onChangeText={setDraft}
          editable={acces.peutEcrire && !sending}
          multiline
          placeholder={acces.peutEcrire ? t.composerPlaceholder : t.composerClosed}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t.composerPlaceholder}
          // Le fil descend sur son dernier message quand la case prend le
          // clavier : sans cela, le clavier monterait devant la fin de la
          // conversation qu'on est justement en train de poursuivre.
          onFocus={auDernierMessage}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!acces.peutEcrire || sending || !draft.trim()}
          android_ripple={ondeClaire}
          style={({ pressed }) => [styles.sendButton, (!acces.peutEcrire || sending || !draft.trim()) && styles.sendButtonOff, pressed && styles.pressed]}
          onPress={() => void envoyer()}
        >
          <Text style={styles.sendButtonText}>{sending ? t.sending : `${t.send}  →`}</Text>
        </Pressable>
      </View>}
    </View>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  colonne: { flex: 1 },
  // `flex: 1` sur la ScrollView elle-même, et non sur son contenu : c'est la
  // hauteur du fil qui doit céder quand le clavier prend sa place.
  fil: { flex: 1 },
  container: { padding: 24, paddingBottom: 32 },
  topline: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 40 },
  localeTouch: { alignItems: 'flex-end', paddingLeft: 16 },
  locale: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  pressed: { opacity: 0.55 },
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
  // Épinglé sous le fil : un filet le sépare de la conversation, et il porte
  // le fond du papier pour que les bulles ne transparaissent pas dessous.
  composer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 14, gap: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper },
  // `maxHeight` : une case qui grandit sans fin finirait par manger le fil
  // au-dessus d'elle. Au-delà, la saisie défile dans la case.
  input: { borderWidth: 1, borderColor: colors.ink, padding: 12, minHeight: 52, maxHeight: 140, color: colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  inputClosed: { borderColor: colors.line, backgroundColor: colors.soft },
  sendButton: { alignSelf: 'flex-start', backgroundColor: colors.copper, paddingVertical: 13, paddingHorizontal: 18 },
  sendButtonOff: { backgroundColor: colors.line },
  sendButtonText: { color: colors.white, fontFamily: typography.mono, fontSize: 11, letterSpacing: 0.5 },
  panel: { borderWidth: 1, borderLeftWidth: 3, borderColor: colors.ink, padding: 18, marginTop: 28, maxWidth: 340 },
  panelKicker: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  panelText: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 11 },
  panelAction: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 13, paddingHorizontal: 17, marginTop: 18 },
  panelActionText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
  safety: { flexDirection: 'row', gap: 22, marginTop: 24, flexWrap: 'wrap', alignItems: 'center' },
  safetyDanger: { color: colors.copper, fontFamily: typography.mono, fontSize: 11, textDecorationLine: 'underline' },
  safetyAction: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, textDecorationLine: 'underline' },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 22, maxWidth: 320 },
  private: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 34 },
  // Les fantômes reprennent les mesures de `name` et `status` d'un côté, la
  // boîte d'une bulle de l'autre : rien ne saute quand le fil arrive.
  nomFantome: { marginTop: 20, gap: 10 },
  bulleFantome: { minWidth: 190 },
})
