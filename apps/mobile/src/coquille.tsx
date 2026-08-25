/**
 * La coquille commune des quatre feuilles natives.
 *
 * Ce qu'elle porte, et qui serait recopié quatre fois sinon :
 *
 * - **la garde de feuille orpheline.** Une feuille ouverte sans geste armé —
 *   après un rechargement à chaud, ou par une URL forgée — se referme d'elle-
 *   même. Un bouton de confirmation qui ne confirmerait rien serait le pire des
 *   écrans de sécurité ;
 * - **la marge du bas.** Une feuille se pose au ras de l'écran : sans la marge
 *   de sécurité, son bouton tomberait sous la barre de gestes. Elle est lue ici
 *   et non devinée ;
 * - **le fond et le défilement.** Le papier de la marque, et un contenu qui
 *   défile — le signalement est long, et un formulaire qu'on ne peut pas faire
 *   remonter derrière un clavier est un formulaire abandonné.
 *
 * Ce qu'elle ne porte pas : aucune règle produit. Les textes, les gardes et les
 * écritures restent dans l'écran qui a armé le geste.
 */
import { useEffect } from 'react'
import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, typography } from './theme'
import { feuilleArmee, type NomDeFeuille } from './feuilles'

export function CoquilleDeFeuille({ nom, titre, children }: { nom: NomDeFeuille; titre: string; children: ReactNode }) {
  const marges = useSafeAreaInsets()
  const armee = feuilleArmee(nom)

  // Dans un effet et non pendant le rendu : naviguer depuis un rendu est une
  // écriture dans le routeur au milieu d'une lecture, et React le refuse.
  useEffect(() => {
    if (!armee) router.back()
  }, [armee])

  if (!armee) return <View style={styles.vide} />

  return <ScrollView
    style={styles.feuille}
    contentContainerStyle={[styles.contenu, { paddingBottom: 28 + marges.bottom }]}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
  >
    <Text style={styles.kicker}>{titre}</Text>
    {children}
  </ScrollView>
}

/**
 * Les traits communs aux quatre feuilles — repris **tels quels** des panneaux
 * qu'elles remplacent (`tandem.tsx`, `compte.tsx`), aux bordures près : une
 * feuille native a déjà son cadre, et redessiner un encadré dedans ferait deux
 * boîtes l'une dans l'autre. Les tailles, les familles et les couleurs, elles,
 * ne bougent pas : ce sont les mêmes phrases, au même endroit du regard.
 */
export const traitsDeFeuille = StyleSheet.create({
  titre: { color: colors.ink, fontFamily: typography.display, fontSize: 26, marginTop: 12 },
  texte: { color: colors.ink, fontSize: 15, lineHeight: 23, marginTop: 13 },
  note: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, lineHeight: 16, marginTop: 16 },
  // L'avertissement des lignes d'urgence : encadré, pas coloré en rouge — la
  // palette du produit n'en a pas, et en inventer un ferait de cette feuille
  // une alarme là où elle doit rester tenable à lire.
  alerte: { color: colors.ink, fontSize: 15, lineHeight: 23, marginTop: 18, borderLeftWidth: 2, borderLeftColor: colors.copper, paddingLeft: 12 },
  etiquette: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 0.5, marginTop: 22 },
  champ: { borderWidth: 1, borderColor: colors.line, padding: 13, minHeight: 78, marginTop: 9, color: colors.ink, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  choix: { borderWidth: 1, borderColor: colors.line, padding: 14 },
  choixRetenu: { borderColor: colors.ink, backgroundColor: colors.white },
  choixTexte: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  choixTexteRetenu: { color: colors.ink },
  choixListe: { marginTop: 18, gap: 8 },
  action: { alignSelf: 'flex-start', backgroundColor: colors.ink, paddingVertical: 14, paddingHorizontal: 18, marginTop: 22 },
  actionOff: { backgroundColor: colors.line },
  actionTexte: { color: colors.white, fontFamily: typography.mono, fontSize: 11, letterSpacing: 0.5 },
  annuler: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, marginTop: 18, textDecorationLine: 'underline' },
  presse: { opacity: 0.55 },
})

const styles = StyleSheet.create({
  vide: { flex: 1, backgroundColor: colors.paper },
  feuille: { flex: 1, backgroundColor: colors.paper },
  // La poignée du système occupe le haut de la feuille : la marge supérieure
  // lui laisse sa place, sinon le premier mot passerait dessous.
  contenu: { paddingTop: 26, paddingHorizontal: 24 },
  kicker: { color: colors.muted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },
})
