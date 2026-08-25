/**
 * Entrer dans son espace : une adresse, un lien magique.
 *
 * Depuis le 25/08/2026, l'écran défile et remonte sa case au-dessus du clavier
 * (`useChampAuDessusDuClavier`). Le champ était jusque-là posé dans une `View`
 * fixe : sur un téléphone Android — donc en bord-à-bord, où la fenêtre ne se
 * redimensionne plus — le clavier recouvrait la case et le bouton d'envoi, sans
 * rien à faire pour les atteindre. C'est le défaut rapporté par le fondateur
 * après essai de l'APK.
 */
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, ondeClaire, presse, toucheMinimale, typography } from '@/theme'
import { useChampAuDessusDuClavier } from '@/clavier'
import { revenir } from '@/retour'
import { toucherLeger } from '@/toucher'
import { supabase } from '@/supabase'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const { espacement, refDefilement, remonter } = useChampAuDessusDuClavier()

  const send = async () => {
    if (!supabase || !email.trim()) return
    setBusy(true)
    // `createURL` rend l'adresse de CE contexte d'exécution : `agapeplay:///`
    // dans un build installé, `exp://<hôte>:<port>/--/` dans Expo Go. La valeur
    // codée en dur ne couvrait que le premier cas — et l'hôte doit figurer
    // dans la liste d'autorisation du projet Supabase, sinon gotrue rabat en
    // silence vers le site_url (mesuré : un lien vers localhost:3000, impasse
    // sur téléphone).
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: Linking.createURL('/') } })
    setBusy(false)
    // Vibré sur la réponse, jamais sur l'appui : la main doit apprendre que le
    // lien est **parti**, et non qu'on a touché un bouton.
    if (!error) toucherLeger()
    setStatus(error ? 'Impossible d’envoyer le lien pour le moment.' : 'Lien magique envoyé. Consulte ta boîte mail.')
  }

  const signOut = async () => { await supabase?.auth.signOut(); router.replace('/') }

  return <SafeAreaView style={styles.safe}>
    <ScrollView
      ref={refDefilement}
      contentContainerStyle={[styles.container, { paddingBottom: 24 + espacement }]}
      // `handled` et non `always` : un appui sur le bouton d'envoi passe sans
      // qu'il faille d'abord fermer le clavier — c'est le double appui qui
      // fait dire d'une application qu'elle ne répond pas — mais un appui dans
      // le vide referme bien le clavier.
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Dépiler, et non naviguer vers l'accueil : voir `src/retour.ts`. */}
      <Pressable accessibilityRole="button" style={[styles.backTouch, toucheMinimale]} android_ripple={{ color: 'rgba(17,17,17,0.10)' }} onPress={revenir}>
        {({ pressed }) => <Text style={[styles.back, pressed && styles.pressed]}>← Aujourd’hui</Text>}
      </Pressable>
      <Text style={styles.kicker}>AGAPEPLAY / COMPTE</Text>
      <Text style={styles.title}>Entrer dans ton espace.</Text>
      <Text style={styles.description}>Un lien magique suffit. Aucun mot de passe à retenir.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        onFocus={remonter}
        placeholder="ton@email.com"
        placeholderTextColor={colors.muted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        // Le clavier propose « OK » plutôt qu'un retour à la ligne, et cet OK
        // envoie : sur une saisie à un seul champ, c'est le geste attendu.
        returnKeyType="send"
        onSubmitEditing={() => void send()}
        style={styles.input}
      />
      <Pressable
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        android_ripple={ondeClaire}
        disabled={busy}
        onPress={() => void send()}
      >
        <Text style={styles.primaryText}>{busy ? '…' : 'Recevoir mon lien →'}</Text>
      </Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <View style={styles.pied}>
        <Pressable style={toucheMinimale} onPress={() => void signOut()}>
          {({ pressed }) => <Text style={[styles.signOut, pressed && styles.pressed]}>Se déconnecter</Text>}
        </Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  // `flexGrow` et non `flex` : le contenu remplit l'écran quand il est court —
  // ce qui garde « Se déconnecter » en bas — et s'étire quand le clavier
  // ajoute son espacement, au lieu de comprimer le reste.
  container: { flexGrow: 1, padding: 24 },
  backTouch: { alignSelf: 'flex-start', marginBottom: 40 },
  back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11 },
  kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, marginTop: 16 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 310 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.ink, color: colors.ink, fontSize: 17, paddingVertical: 14, marginTop: 40 },
  primary: { backgroundColor: colors.ink, paddingVertical: 16, paddingHorizontal: 20, alignSelf: 'flex-start', marginTop: 22, minHeight: 48, justifyContent: 'center' },
  primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 },
  status: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 17, marginTop: 18 },
  pied: { marginTop: 'auto', paddingTop: 32 },
  signOut: { color: colors.muted, fontFamily: typography.mono, fontSize: 10 },
  pressed: { opacity: 0.55 },
})
