import { Link } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography } from '@/theme'
import { queueProgress } from '@/offlineQueue'
import { emettre } from '@/mesure'
import { supabase } from '@/supabase'
import { trancheDuree } from '@agapeplay/domain'

export default function SessionScreen() {
  const [done, setDone] = useState(false)
  // L'instant d'arrivée sur l'écran, pour n'en garder qu'une tranche (doc 08).
  // Une `ref` et non un état : elle ne s'affiche nulle part, et un état
  // déclencherait un rendu au montage pour rien.
  const ouvertA = useRef(Date.now())
  const finish = async () => {
    const user = (await supabase?.auth.getUser())?.data.user
    if (user) await queueProgress({ id: `${user.id}:repartir-avec-jesus:01`, userId: user.id, sessionId: 'repartir-avec-jesus-01', journeyId: 'repartir-avec-jesus' })
    setDone(true)
    // L'émission vient après l'enregistrement et n'attend rien : la séance est
    // terminée pour la personne, quoi qu'il arrive à la mesure. `locale: 'fr'`
    // parce que cet écran-ci est écrit en dur en français — le déclarer `en`
    // serait plus faux que de le déclarer tel qu'il est.
    void emettre('session_completed', {
      locale: 'fr',
      journeyId: 'repartir-avec-jesus',
      proprietes: { day: 1, duration_bucket: trancheDuree(Date.now() - ouvertA.current) },
    })
  }
  return <SafeAreaView style={styles.safe}><View style={styles.container}><Link href="/" style={styles.back}>← Aujourd’hui</Link><Text style={styles.kicker}>ÉTAPE 01 / 03</Text><Text style={styles.title}>Repartir avec Jésus</Text><Text style={styles.verse}>« Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos. »</Text><View style={styles.rule} /><Text style={styles.body}>Lis doucement. Rien à réussir, seulement un moment pour être présent.</Text><Pressable style={styles.primary} onPress={() => void finish()}><Text style={styles.primaryText}>{done ? 'Séance enregistrée ✓' : 'Terminer la séance →'}</Text></Pressable><Text style={styles.footer}>Ton journal reste privé.</Text></View></SafeAreaView>
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.paper }, container: { flex: 1, padding: 24 }, back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, marginBottom: 74 }, kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, marginTop: 16 }, verse: { color: colors.ink, fontFamily: typography.display, fontSize: 22, lineHeight: 31, marginTop: 32 }, rule: { width: 64, borderTopWidth: 2, borderTopColor: colors.copper, marginTop: 34 }, body: { color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 24, maxWidth: 300 }, primary: { backgroundColor: colors.ink, padding: 16, alignSelf: 'flex-start', marginTop: 28 }, primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11 }, footer: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 'auto' } })
