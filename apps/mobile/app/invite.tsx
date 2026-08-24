import { Link, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography } from '@/theme'
import { supabase } from '@/supabase'

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const [message, setMessage] = useState('Vérification de ton invitation…')
  useEffect(() => {
    let active = true
    const accept = async () => {
      if (!token || !supabase) { if (active) setMessage('Cette invitation est incomplète.'); return }
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) { if (active) setMessage('Connecte-toi pour accepter ton invitation.'); return }
      const { error } = await supabase.rpc('accept_tandem_invitation', { p_token: token })
      if (active) setMessage(error ? 'Cette invitation est invalide ou expirée.' : 'Invitation acceptée. Ton tandem est actif.')
    }
    void accept()
    return () => { active = false }
  }, [token])
  return <SafeAreaView style={styles.safe}><View style={styles.container}><Link href="/" style={styles.back}>← Accueil</Link><Text style={styles.kicker}>INVITATION PRIVÉE</Text><Text style={styles.title}>Ton tandem commence ici.</Text><Text style={styles.message}>{message}</Text><Pressable style={styles.primary} onPress={() => router.replace('/')}><Text style={styles.primaryText}>Continuer →</Text></Pressable></View></SafeAreaView>
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.paper }, container: { flex: 1, padding: 24 }, back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, marginBottom: 74 }, kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, marginTop: 16 }, message: { color: colors.muted, fontSize: 17, lineHeight: 25, marginTop: 28, maxWidth: 310 }, primary: { backgroundColor: colors.ink, padding: 16, alignSelf: 'flex-start', marginTop: 28 }, primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 } })
