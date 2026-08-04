import { Link, useFocusEffect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { copy, Locale } from '@/content'
import { colors, typography } from '@/theme'
import { flushProgressQueue } from '@/offlineQueue'
import { supabase } from '@/supabase'

export default function HomeScreen() {
  const [locale, setLocale] = useState<Locale>('fr')
  const [offline, setOffline] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const t = useMemo(() => copy[locale], [locale])

  useFocusEffect(useCallback(() => {
    let active = true
    void supabase?.auth.getSession().then(({ data }) => { if (active) setSession(data.session) })
    void flushProgressQueue()
    return () => { active = false }
  }, []))

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topline}><Text style={styles.eyebrow}>{t.eyebrow}</Text><View style={styles.topActions}><Pressable accessibilityRole="button" accessibilityLabel={t.language} onPress={() => setLocale(locale === 'fr' ? 'en' : 'fr')}><Text style={styles.locale}>{locale.toUpperCase()}</Text></Pressable><Link href="/auth" asChild><Pressable><Text style={styles.authLink}>{session ? t.signedIn : t.signIn}</Text></Pressable></Link></View></View>
      {offline && <Pressable style={styles.offline} onPress={() => setOffline(false)}><Text style={styles.offlineText}>{t.offline}</Text></Pressable>}
      <Text style={styles.greeting}>{t.greeting}</Text>
      <Text style={styles.subtitle}>{t.subtitle}</Text>

      <View style={styles.heroCard}>
        <View style={styles.cardHeader}><Text style={styles.kicker}>{t.dailySession}</Text><Text style={styles.duration}>06 MIN</Text></View>
        <View style={styles.number}><Text style={styles.numberText}>01</Text></View>
        <Text style={styles.theme}>{t.theme}</Text>
        <Text style={styles.title}>{t.sessionTitle}</Text>
        <Text style={styles.verse}>{t.verse}</Text>
        <Text style={styles.prompt}>{t.prompt}</Text>
        <Link href="/session" asChild><Pressable style={styles.primary}><Text style={styles.primaryText}>{t.start}  →</Text></Pressable></Link>
      </View>

      <View style={styles.navGrid}>
        <Link href="/journey" asChild><Pressable style={styles.navCard}><Text style={styles.navIndex}>01</Text><Text style={styles.navTitle}>{t.journey}</Text><Text style={styles.navArrow}>↗</Text></Pressable></Link>
        <Link href="/tandem" asChild><Pressable style={styles.navCard}><Text style={styles.navIndex}>02</Text><Text style={styles.navTitle}>{t.tandem}</Text><Text style={styles.navArrow}>↗</Text></Pressable></Link>
        <Pressable style={styles.navCard} onPress={() => setOffline(!offline)}><Text style={styles.navIndex}>03</Text><Text style={styles.navTitle}>{t.journal}</Text><Text style={styles.navArrow}>⌁</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 24, paddingBottom: 48 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 },
  eyebrow: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1.4 },
  locale: { color: colors.ink, fontFamily: typography.mono, fontSize: 11, borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  authLink: { color: colors.copper, fontFamily: typography.mono, fontSize: 10 },
  greeting: { color: colors.ink, fontFamily: typography.display, fontSize: 42, lineHeight: 46, maxWidth: 330 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 28, maxWidth: 310 },
  offline: { borderWidth: 1, borderColor: colors.copper, padding: 11, marginBottom: 20 },
  offlineText: { color: colors.copper, fontFamily: typography.mono, fontSize: 10 },
  heroCard: { backgroundColor: colors.ink, padding: 22, minHeight: 380 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { color: colors.copper, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  duration: { color: colors.soft, fontFamily: typography.mono, fontSize: 10 },
  number: { marginTop: 28, borderWidth: 1, borderColor: '#454540', width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: colors.white, fontFamily: typography.mono, fontSize: 20 },
  theme: { color: colors.soft, fontFamily: typography.mono, fontSize: 11, marginTop: 22 },
  title: { color: colors.white, fontFamily: typography.display, fontSize: 32, lineHeight: 36, marginTop: 8 },
  verse: { color: colors.soft, fontFamily: typography.display, fontSize: 17, lineHeight: 24, marginTop: 18 },
  prompt: { color: '#aeadA5', fontSize: 13, lineHeight: 20, marginTop: 20 },
  primary: { alignSelf: 'flex-start', backgroundColor: colors.copper, paddingVertical: 14, paddingHorizontal: 18, marginTop: 25 },
  primaryText: { color: colors.white, fontFamily: typography.mono, fontSize: 11, letterSpacing: .5 },
  navGrid: { gap: 10, marginTop: 12 },
  navCard: { borderWidth: 1, borderColor: colors.line, padding: 17, minHeight: 76, flexDirection: 'row', alignItems: 'center' },
  navIndex: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, width: 32 },
  navTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20, flex: 1 },
  navArrow: { color: colors.ink, fontSize: 20 },
})
