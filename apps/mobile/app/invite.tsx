/**
 * L'écran d'invitation : le bout du chemin d'un lien reçu.
 *
 * Deux liens y arrivent, et ils ne confèrent pas la même chose — un binôme,
 * une communauté. `jetonDuLien` a déjà tranché lequel est lequel (domaine,
 * testé) ; cet écran joue le jeton et dit ce qui s'est passé.
 *
 * Ce qui a changé le 26/08/2026 (issue #13) :
 *
 * - **le jeton ne vient plus seulement du paramètre de route.** Le lien
 *   réellement envoyé aux gens est celui du web ; il est ramassé à l'ouverture
 *   par `useLiensDInvitation` et retenu. Le paramètre `?token=` reste lu, pour
 *   les liens `agapeplay:///invite?token=…` déjà en circulation ;
 * - **une invitation ouverte sans compte n'est plus perdue.** Elle attend la
 *   connexion — l'écran le dit — et se joue dès que la session naît, ce que
 *   l'abonnement `onAuthStateChange` permet de voir sans quitter l'écran ;
 * - **le jeton est consommé avant de connaître le résultat.** Les deux issues
 *   sont terminales : une tentative qui échoue ne doit pas se rejouer à chaque
 *   rendu ni ressurgir au prochain démarrage.
 */
import { Link, router, useLocalSearchParams } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { copy } from '@agapeplay/content/copy/mobile-invite'
import type { FormeDeLien, Locale, RefusDAdhesion } from '@agapeplay/domain'
import { colors, typography } from '@/theme'
import { emettre } from '@/mesure'
import { supabase } from '@/supabase'
import { accepterInvitationTandem, jetonRetenu, oublierJeton, rejoindreLaCommunaute, retenirJeton } from '@/invitations'

type Copie = typeof copy.fr

/**
 * Les refus de la RPC, dits avec des mots. Le `Record` typé fait échouer `tsc`
 * le jour où la base ajoute un code sans qu'on ait écrit sa phrase — un refus
 * muet laisserait quelqu'un devant un écran qui n'a pas bougé.
 */
const LIBELLE_REFUS: Record<RefusDAdhesion, keyof Copie> = {
  invitation_introuvable: 'joinRefusedNotFound',
  invitation_epuisee: 'joinRefusedExhausted',
  communaute_inactive: 'joinRefusedInactive',
  cohorte_close: 'joinRefusedClosed',
  cohorte_terminee: 'joinRefusedEnded',
  adhesion_revoquee: 'joinRefusedRevoked',
  deja_dans_une_communaute: 'joinRefusedAlready',
  // Ne devrait pas remonter : l'écran n'appelle pas sans session. Sa phrase
  // existe quand même — un refus prévu par la base et muet à l'écran est le
  // pire des deux mondes.
  identite_absente: 'joinRefusedUnknown',
  inconnu: 'joinRefusedUnknown',
}

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const [locale, setLocale] = useState<Locale>('fr')
  const [forme, setForme] = useState<FormeDeLien>('tandem')
  const [message, setMessage] = useState('')
  /**
   * Le jeton n'est joué qu'une fois, quoi qu'il arrive.
   *
   * Deux chemins mènent ici — la lecture de session au montage et
   * `onAuthStateChange`, qui émet `INITIAL_SESSION` juste après l'abonnement —
   * et sur un compte déjà connecté, les deux partent. Sans verrou, la RPC
   * était appelée deux fois : la seconde échouait, et son refus écrasait
   * l'annonce de succès (« Tu appartiens déjà à une communauté » juste après
   * l'avoir rejointe), pendant que `partner_accepted` était émis en double.
   *
   * Une `ref` et non un état : la valeur doit être lue et posée dans le même
   * bloc synchrone, avant le premier `await`, sinon les deux appelants passent
   * tous les deux. Le verrou est posé **après** la garde de session, pour
   * qu'une visite sans compte laisse la place à la connexion qui suit.
   */
  const dejaJoue = useRef(false)
  const t = copy[locale]

  useEffect(() => {
    let actif = true

    const jouer = async (session: Session | null) => {
      // Le paramètre de route est retenu comme les autres : ainsi le chemin de
      // lecture est unique, et une invitation ouverte sans compte par ce
      // chemin-là attend aussi la connexion.
      if (token) await retenirJeton({ forme: 'tandem', jeton: token })
      const recu = await jetonRetenu()
      if (!actif) return
      if (!recu) { setMessage(t.incomplete); return }
      setForme(recu.forme)

      if (!session) { setMessage(t.signInPrompt); return }
      if (dejaJoue.current) return
      dejaJoue.current = true

      setMessage(t.checking)
      // Consommé avant de connaître le résultat : voir l'en-tête.
      await oublierJeton()
      if (!actif) return

      if (recu.forme === 'tandem') {
        const accepte = await accepterInvitationTandem(recu.jeton)
        if (!actif) return
        // Étape 6 du funnel du doc 08, sous la garde de démontage comme
        // l'affichage : un écran démonté pendant l'aller-retour ne déclenche
        // rien.
        if (accepte) void emettre('partner_accepted', { locale })
        setMessage(accepte ? t.tandemAccepted : t.tandemRefused)
        return
      }

      const resultat = await rejoindreLaCommunaute(recu.jeton)
      if (!actif) return
      setMessage('refus' in resultat ? t[LIBELLE_REFUS[resultat.refus]] : t.communityJoined)
    }

    void supabase?.auth.getSession().then(({ data }) => jouer(data.session))
    // La session peut naître PENDANT que l'écran est ouvert — c'est le cas
    // exact de quelqu'un qui ouvre un lien, se connecte, puis revient. Sans cet
    // abonnement, l'invitation resterait en attente sous les yeux d'une
    // personne désormais connectée.
    const { data: abonnement } = supabase?.auth.onAuthStateChange((_evenement, session) => {
      if (session) void jouer(session)
    }) ?? { data: null }

    return () => { actif = false; abonnement?.subscription.unsubscribe() }
  }, [token])

  return <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <View style={styles.topline}>
        <Link href="/" style={styles.back}>← {t.today}</Link>
        <Pressable accessibilityRole="button" accessibilityLabel={t.language} onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}><Text style={styles.locale}>{locale.toUpperCase()}</Text></Pressable>
      </View>
      <Text style={styles.kicker}>{t.kicker}</Text>
      <Text style={styles.title}>{forme === 'communaute' ? t.communityTitle : t.tandemTitle}</Text>
      <Text style={styles.message}>{message || t.checking}</Text>
      <Pressable style={styles.primary} onPress={() => router.replace('/')}><Text style={styles.primaryText}>{t.continue} →</Text></Pressable>
    </View>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1, padding: 24 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 74 },
  back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11 },
  locale: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, marginTop: 16 },
  message: { color: colors.muted, fontSize: 17, lineHeight: 25, marginTop: 28, maxWidth: 310 },
  primary: { backgroundColor: colors.ink, padding: 16, alignSelf: 'flex-start', marginTop: 28 },
  primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
})
