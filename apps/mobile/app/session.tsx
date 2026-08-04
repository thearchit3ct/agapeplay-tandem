import { Link } from 'expo-router'
import { SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { colors, typography } from '@/theme'

export default function SessionScreen() {
  return <SafeAreaView style={styles.safe}><View style={styles.container}><Link href="/" style={styles.back}>← Aujourd’hui</Link><Text style={styles.kicker}>ÉTAPE 01 / 03</Text><Text style={styles.title}>Repartir avec Jésus</Text><Text style={styles.verse}>« Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos. »</Text><View style={styles.rule} /><Text style={styles.body}>Lis doucement. Rien à réussir, seulement un moment pour être présent.</Text><Text style={styles.footer}>Ton journal reste privé.</Text></View></SafeAreaView>
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.paper }, container: { flex: 1, padding: 24 }, back: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, marginBottom: 74 }, kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, marginTop: 16 }, verse: { color: colors.ink, fontFamily: typography.display, fontSize: 22, lineHeight: 31, marginTop: 32 }, rule: { width: 64, borderTopWidth: 2, borderTopColor: colors.copper, marginTop: 34 }, body: { color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 24, maxWidth: 300 }, footer: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, marginTop: 'auto' } })
