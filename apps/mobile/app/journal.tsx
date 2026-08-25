/**
 * Le journal mobile : écrire, relire, retirer — et ouvrir une entrée à son
 * binôme. Issue #13, la parité qui manquait depuis la PR #45.
 *
 * Ce qu'il faut savoir avant d'y toucher :
 *
 * - **La règle du partage vit dans le domaine.** `partageDuJournal` dit si un
 *   partage aboutirait et pourquoi ; l'écran ne fait qu'afficher sa réponse.
 *   Le cas qui compte : un tandem bloqué referme les partages **pour les deux**,
 *   y compris pour la personne qui a bloqué — contrairement à la conversation,
 *   où celle-ci garde l'historique. Ne pas « harmoniser » les deux.
 * - **Une suppression lit les lignes réellement touchées.** Un DELETE que la
 *   politique refuse ne lève rien : il touche zéro ligne, en silence. Annoncer
 *   « c'est retiré » sur un partage toujours ouvert serait le pire mensonge de
 *   cet écran-là — d'où les compteurs rendus par `src/journal.ts`.
 * - **Pas de file hors-ligne, et l'écran le dit.** Écrire demande la connexion,
 *   comme la conversation (doc 21). Une file à moitié faite promettrait un
 *   enregistrement qu'elle ne tiendrait pas.
 * - **Les confirmations sont des panneaux dans la page**, jamais `Alert.alert` :
 *   celui-ci ne rend rien d'utilisable sous react-native-web, et
 *   `mobile:export` est la seule garde Metro sans appareil.
 */
import { Link, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-journal'
import { partageDuJournal } from '@agapeplay/domain'
import type { Locale } from '@agapeplay/domain'
import { colors, typography } from '@/theme'
import { emettre } from '@/mesure'
import { supabase } from '@/supabase'
import {
  chargerJournal, chargerPartagesEmis, chargerPartagesRecus, ecrireEntree,
  lireTandemCourant, poserPartage, retirerPartage, supprimerEntree,
} from '@/journal'
import type { EntreeDeJournal, EntreePartagee, TandemCourant } from '@/journal'

export default function JournalScreen() {
  const [locale, setLocale] = useState<Locale>('fr')
  const [session, setSession] = useState<Session | null>(null)
  const [entrees, setEntrees] = useState<EntreeDeJournal[]>([])
  const [partages, setPartages] = useState<Set<string>>(new Set())
  const [recus, setRecus] = useState<EntreePartagee[]>([])
  const [tandem, setTandem] = useState<TandemCourant>(null)
  const [brouillon, setBrouillon] = useState('')
  const [ecriture, setEcriture] = useState(false)
  // L'entrée dont la suppression est en train d'être confirmée. Une seule à la
  // fois : deux panneaux ouverts poseraient deux questions contraires.
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const t = copy[locale]

  // `useFocusEffect` comme l'accueil et la conversation : sans temps réel, un
  // partage retiré depuis le navigateur n'apparaît qu'à une relecture, et le
  // seul geste naturel est de revenir sur l'écran.
  useFocusEffect(useCallback(() => {
    let actif = true
    const charger = async () => {
      if (!supabase) { if (actif) setLoading(false); return }
      const { data } = await supabase.auth.getSession()
      if (!actif) return
      setSession(data.session)
      if (!data.session) { setLoading(false); return }
      // Les quatre lectures partent ensemble : elles répondent à la même
      // question — que montrer — et une seule en retard laisserait l'écran
      // proposer de partager ce qui l'est déjà.
      const [journal, emis, recusLus, tandemLu] = await Promise.all([
        chargerJournal(),
        chargerPartagesEmis(),
        chargerPartagesRecus(),
        lireTandemCourant(data.session.user.id),
      ])
      if (!actif) return
      setEntrees(journal.entrees)
      setPartages(emis.entrees)
      setRecus(recusLus.entrees)
      setTandem(tandemLu)
      // Une lecture en panne se dit. Sans cela, un journal illisible
      // s'afficherait comme un journal vide, et l'écran inviterait à écrire une
      // première entrée à quelqu'un qui en a cent.
      if (journal.erreur || emis.erreur) setNotice(t.loadFailed)
      setLoading(false)
    }
    void charger()
    return () => { actif = false }
    // Aucune dépendance : `t.loadFailed` est capturé au montage, et changer de
    // langue n'a pas à relancer une lecture.
  }, []))

  useEffect(() => {
    if (!notice) return
    const minuterie = setTimeout(() => setNotice(''), 4600)
    return () => clearTimeout(minuterie)
  }, [notice])

  const partage = partageDuJournal({
    status: tandem?.status ?? null,
    blockedBy: null,
    currentUserId: session?.user.id,
  })

  const ecrire = async () => {
    const texte = brouillon.trim()
    const compteId = session?.user.id
    if (!texte || ecriture || !compteId) return
    setEcriture(true)
    const entree = await ecrireEntree(compteId, texte)
    setEcriture(false)
    // L'écriture lit sa réponse : sans la ligne rendue, on afficherait une
    // entrée portant l'heure du téléphone et un identifiant qui n'existe pas.
    if (!entree) { setNotice(t.saveFailed); return }
    setEntrees((precedentes) => [entree, ...precedentes])
    // Vidée seulement maintenant : sur un échec, le texte reste sous les yeux
    // de la personne — il n'y a pas de file pour le rattraper.
    setBrouillon('')
    setNotice(t.saved)
  }

  const basculerLePartage = async (entree: EntreeDeJournal) => {
    const compteId = session?.user.id
    if (!compteId || !tandem || enCours) return
    setEnCours(entree.id)
    if (partages.has(entree.id)) {
      const { retirees, erreur } = await retirerPartage(entree.id)
      setEnCours(null)
      if (erreur) { setNotice(t.shareEntryFailed); return }
      // Zéro ligne retirée sans erreur : la politique a filtré en silence.
      if (retirees === 0) { setNotice(t.unshareEntryRefused); return }
      setPartages((precedents) => { const suite = new Set(precedents); suite.delete(entree.id); return suite })
      setNotice(t.unshareEntryDone)
      return
    }
    const pose = await poserPartage({ entreeId: entree.id, tandemId: tandem.id, auteurId: compteId })
    setEnCours(null)
    if (!pose) { setNotice(t.shareEntryFailed); return }
    setPartages((precedents) => new Set(precedents).add(entree.id))
    // Le même événement que le web pose sur ce geste, et les mêmes propriétés :
    // `share_type` et rien d'autre — surtout pas ce qui a été partagé. Sans
    // `journeyId` en revanche : cet écran ne charge pas le parcours, et lui en
    // faire lire un pour étiqueter un événement serait payer une requête pour
    // une colonne facultative. Écart nommé plutôt que deviné.
    void emettre('share_created', { locale, proprietes: { share_type: 'journal_entry' } })
    setNotice(t.shareEntryDone)
  }

  const supprimer = async (entreeId: string) => {
    setASupprimer(null)
    if (enCours) return
    setEnCours(entreeId)
    const { supprimees, erreur } = await supprimerEntree(entreeId)
    setEnCours(null)
    if (erreur) { setNotice(t.deleteEntryRefused); return }
    if (supprimees === 0) { setNotice(t.deleteEntryRefused); return }
    setEntrees((precedentes) => precedentes.filter((entree) => entree.id !== entreeId))
    // Le partage posé dessus est parti avec l'entrée (`on delete cascade`) :
    // le garder à l'écran ferait croire qu'il reste quelque chose d'ouvert.
    setPartages((precedents) => { const suite = new Set(precedents); suite.delete(entreeId); return suite })
    setNotice(t.deleteEntryDone)
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}>
        <Link href="/" style={styles.back}>← {t.today}</Link>
        <Pressable accessibilityRole="button" accessibilityLabel={t.language} onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}><Text style={styles.locale}>{locale.toUpperCase()}</Text></Pressable>
      </View>

      <Text style={styles.kicker}>{t.kicker}</Text>
      <Text style={styles.title}>{t.title}</Text>
      <Text style={styles.intro}>{t.intro}</Text>

      {!loading && !session && <Text style={styles.hint}>{t.signInPrompt}</Text>}

      {session && <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={brouillon}
          onChangeText={setBrouillon}
          editable={!ecriture}
          multiline
          maxLength={10000}
          placeholder={t.placeholder}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t.placeholder}
        />
        <Pressable
          accessibilityRole="button"
          disabled={ecriture || !brouillon.trim()}
          style={[styles.primary, (ecriture || !brouillon.trim()) && styles.primaryOff]}
          onPress={() => void ecrire()}
        ><Text style={styles.primaryText}>{ecriture ? t.saving : `${t.save}  →`}</Text></Pressable>
        <Text style={styles.footnote}>{t.offlineNote}</Text>
      </View>}

      {/* Pourquoi le partage n'est pas proposé, quand il ne l'est pas. Sans
          cette phrase, l'absence de bouton et un panneau vide seraient deux
          façons de laisser croire qu'il n'y a jamais rien eu. */}
      {session && partage.raison === 'aucun-tandem' && <Text style={styles.hint}>{t.shareNoTandem}</Text>}
      {session && partage.raison === 'bloque' && <Text style={styles.hint}>{t.shareBlockedNote}</Text>}
      {session && partage.raison === 'termine' && <Text style={styles.hint}>{t.shareEndedNote}</Text>}

      {session && entrees.length === 0 && !loading && <Text style={styles.hint}>{t.empty}</Text>}

      {entrees.map((entree) => {
        const ouverte = partages.has(entree.id)
        return <View key={entree.id} style={styles.entry}>
          <View style={styles.entryHead}>
            <Text style={styles.entryDate}>{new Date(entree.ecritLe).toLocaleDateString()}</Text>
            {/* L'humeur affichée est traduite, la colonne ne l'est pas : le
                produit n'a qu'une valeur, écrite en français par défaut. Voir
                `src/journal.ts`. */}
            <Text style={styles.entryMood}>{t.present}</Text>
          </View>
          <Text style={styles.entryText}>{entree.texte}</Text>
          {ouverte && <Text style={styles.entryShared}>{t.sharedEntry}</Text>}
          <View style={styles.entryActions}>
            {partage.peutPartager && <Pressable
              accessibilityRole="button"
              disabled={enCours === entree.id}
              onPress={() => void basculerLePartage(entree)}
            ><Text style={styles.entryAction}>{ouverte ? t.unshareEntry : t.shareEntry}</Text></Pressable>}
            <Pressable accessibilityRole="button" onPress={() => setASupprimer(entree.id)}>
              <Text style={styles.entryDanger}>{t.deleteEntry}</Text>
            </Pressable>
          </View>
          {/* Dit sous l'entrée ouverte, et nulle part ailleurs : c'est là que
              la phrase répond à un geste possible. */}
          {ouverte && <Text style={styles.footnote}>{t.unshareEntryReminder}</Text>}
          {aSupprimer === entree.id && <View style={styles.panel}>
            <Text style={styles.panelText}>{t.deleteEntryWarning}</Text>
            <Pressable style={styles.panelAction} onPress={() => void supprimer(entree.id)}><Text style={styles.panelActionText}>{t.deleteEntryConfirm}  →</Text></Pressable>
            <Pressable onPress={() => setASupprimer(null)}><Text style={styles.panelCancel}>{t.deleteEntryCancel}</Text></Pressable>
          </View>}
        </View>
      })}

      {session && <View style={styles.received}>
        <Text style={styles.sectionTitle}>{t.sharedWithMe}</Text>
        {/* Une liste vide ne dit pas la même chose selon la relation : sur un
            tandem fermé, la fonction cesse simplement de rendre les lignes. */}
        {!partage.peutPartager && partage.raison !== 'aucun-tandem'
          ? <Text style={styles.hint}>{t.sharedWithMeClosed}</Text>
          : recus.length === 0
            ? <Text style={styles.hint}>{t.sharedWithMeEmpty}</Text>
            : recus.map((entree) => <View key={entree.entreeId} style={styles.entry}>
              <View style={styles.entryHead}>
                <Text style={styles.entryDate}>{new Date(entree.ecritLe).toLocaleDateString()}</Text>
                <Text style={styles.entryMood}>{entree.humeur}</Text>
              </View>
              <Text style={styles.entryText}>{entree.texte}</Text>
              <Text style={styles.footnote}>{t.sharedOn} {new Date(entree.partageLe).toLocaleDateString()}</Text>
            </View>)}
      </View>}

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
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 38, lineHeight: 43, marginTop: 16 },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 14, maxWidth: 320 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 18, maxWidth: 320 },
  composer: { marginTop: 26, gap: 12, maxWidth: 340 },
  input: { borderWidth: 1, borderColor: colors.ink, padding: 14, minHeight: 96, color: colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  primary: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 13, paddingHorizontal: 18 },
  primaryOff: { backgroundColor: colors.line },
  primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11, letterSpacing: 0.5 },
  footnote: { color: colors.muted, fontFamily: typography.mono, fontSize: 9, lineHeight: 15, marginTop: 10, maxWidth: 320 },
  entry: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 18, marginTop: 24 },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
  entryDate: { color: colors.muted, fontFamily: typography.mono, fontSize: 10 },
  entryMood: { color: colors.copper, fontFamily: typography.mono, fontSize: 10 },
  entryText: { color: colors.ink, fontSize: 16, lineHeight: 24, marginTop: 12 },
  entryShared: { color: colors.copper, fontFamily: typography.mono, fontSize: 9, marginTop: 12, letterSpacing: 0.6 },
  entryActions: { flexDirection: 'row', gap: 20, marginTop: 14, flexWrap: 'wrap' },
  entryAction: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, textDecorationLine: 'underline' },
  entryDanger: { color: colors.copper, fontFamily: typography.mono, fontSize: 11, textDecorationLine: 'underline' },
  panel: { borderWidth: 1, borderLeftWidth: 3, borderColor: colors.ink, padding: 16, marginTop: 16, maxWidth: 340 },
  panelText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  panelAction: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 12, paddingHorizontal: 16, marginTop: 16 },
  panelActionText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
  panelCancel: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 13, textDecorationLine: 'underline' },
  received: { marginTop: 44 },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  notice: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 26, maxWidth: 320 },
})
