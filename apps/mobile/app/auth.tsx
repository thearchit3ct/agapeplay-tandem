import * as Linking from 'expo-linking'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography } from '@/theme'
import { supabase } from '@/supabase'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
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
    setStatus(error ? 'Impossible d’envoyer le lien pour le moment.' : 'Lien magique envoyé. Consulte ta boîte mail.')
  }
  const signOut = async () => { await supabase?.auth.signOut(); router.replace('/') }
  return <SafeAreaView style={styles.safe}><View style={styles.container}><Link href="/" style={styles.back}>← Aujourd’hui</Link><Text style={styles.kicker}>AGAPEPLAY / COMPTE</Text><Text style={styles.title}>Entrer dans ton espace.</Text><Text style={styles.description}>Un lien magique suffit. Aucun mot de passe à retenir.</Text><TextInput value={email} onChangeText={setEmail} placeholder="ton@email.com" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" style={styles.input} /><Pressable style={styles.primary} disabled={busy} onPress={() => void send()}><Text style={styles.primaryText}>{busy ? '…' : 'Recevoir mon lien →'}</Text></Pressable>{status ? <Text style={styles.status}>{status}</Text> : null}<Pressable onPress={() => void signOut()}><Text style={styles.signOut}>Se déconnecter</Text></Pressable></View></SafeAreaView>
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.paper }, container: { flex: 1, padding: 24 }, back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, marginBottom: 74 }, kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, marginTop: 16 }, description: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 310 }, input: { borderBottomWidth: 1, borderBottomColor: colors.ink, color: colors.ink, fontSize: 17, paddingVertical: 14, marginTop: 40 }, primary: { backgroundColor: colors.ink, padding: 16, alignSelf: 'flex-start', marginTop: 22 }, primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 }, status: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, lineHeight: 17, marginTop: 18 }, signOut: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 'auto' } })
