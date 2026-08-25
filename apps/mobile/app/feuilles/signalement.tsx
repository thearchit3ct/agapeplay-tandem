/**
 * Signaler : le formulaire, devenu une feuille du système.
 *
 * C'est la seule des quatre feuilles qui recueille quelque chose. Rien de ce
 * qu'elle demande n'a changé — les six catégories de `CATEGORIES_PROPOSEES`,
 * l'avertissement des lignes d'urgence sur les deux seules catégories
 * d'urgence immédiate, le mot libre facultatif et dit tel — et rien de ce
 * qu'elle écrit ne vit ici : c'est `(onglets)/tandem.tsx` qui insère, avec son
 * code de catégorie (jamais le libellé traduit), sa lecture de la ligne rendue,
 * sa vibration lourde et son événement de mesure.
 *
 * Deux différences avec les feuilles de blocage, et elles sont voulues :
 *
 * - **elle reste ouverte pendant l'envoi**, bouton désarmé et libellé changé.
 *   C'est exactement ce que faisait le panneau, et `reporting` n'existe que
 *   pour ce moment-là ;
 * - **elle ne se referme que si l'envoi a abouti.** Un insert refusé laissait
 *   le panneau en place, avec la catégorie et la phrase déjà saisies ; les
 *   perdre au moment où l'on raconte quelque chose de difficile serait le pire
 *   moment pour demander de recommencer.
 */
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Appui } from '@/appui'
import { copy } from '@agapeplay/content/copy/mobile-tandem'
import { CATEGORIES_PROPOSEES, urgenceDe } from '@agapeplay/domain'
import type { CategorieSignalement } from '@agapeplay/domain'
import { colors, ondeClaire, ondeEncre, toucheMinimale } from '@/theme'
import { CoquilleDeFeuille, traitsDeFeuille as traits } from '@/coquille'
import { declencherFeuille } from '@/feuilles'
import { useLangue } from '@/langue'

/**
 * Le libellé d'une catégorie proposée — repris tel quel du panneau qu'il
 * remplace, y compris son type d'entrée volontairement plus étroit que
 * `CategorieSignalement` : `non_precise` ne nomme pas une situation mais les
 * signalements antérieurs aux catégories, et n'est affiché que dans l'espace
 * modérateur, côté web. Une catégorie ajoutée sans son libellé fera échouer
 * `tsc`, pas l'écran.
 */
type CategorieProposee = Exclude<CategorieSignalement, 'non_precise'>

const libelleCategorie = (categorie: CategorieProposee, t: typeof copy.fr | typeof copy.en) => {
  if (categorie === 'malaise') return t.categoryMalaise
  if (categorie === 'insistance') return t.categoryInsistance
  if (categorie === 'secret') return t.categorySecret
  if (categorie === 'sexuel') return t.categorySexuel
  if (categorie === 'danger') return t.categoryDanger
  return t.categoryAutre
}

export default function FeuilleDeSignalement() {
  const { langue } = useLangue()
  const [categorie, setCategorie] = useState<CategorieSignalement | null>(null)
  const [motLibre, setMotLibre] = useState('')
  const [enVol, setEnVol] = useState(false)
  const t = copy[langue]

  const confirmer = async () => {
    if (!categorie || enVol) return
    setEnVol(true)
    const abouti = await declencherFeuille('signalement', { categorie, motLibre })
    setEnVol(false)
    if (abouti) router.back()
  }

  return <CoquilleDeFeuille nom="signalement" titre={t.report.toUpperCase()}>
    <Text style={traits.titre}>{t.reportTitle}</Text>
    <Text style={traits.texte}>{t.reportDescription}</Text>

    <View style={traits.choixListe}>
      {CATEGORIES_PROPOSEES.map((valeur) => (
        <Appui
          key={valeur}
          accessibilityRole="radio"
          accessibilityState={{ selected: categorie === valeur }}
          android_ripple={ondeEncre}
          style={({ pressed }) => [traits.choix, categorie === valeur && traits.choixRetenu, pressed && traits.presse]}
          onPress={() => setCategorie(valeur)}
        >
          <Text style={[traits.choixTexte, categorie === valeur && traits.choixTexteRetenu]}>{libelleCategorie(valeur, t)}</Text>
        </Appui>
      ))}
    </View>

    {/* Dit sur les deux seules catégories d'urgence immédiate, et nulle part
        ailleurs : sous chacune il deviendrait invisible, absent il laisserait
        croire qu'envoyer ce formulaire est un secours. */}
    {categorie && urgenceDe(categorie) === 'immediate' && <>
      <Text style={traits.alerte}>{t.reportHelplineNote}</Text>
      <Text style={traits.texte}>{t.reportUrgentNote}</Text>
    </>}

    <Text style={traits.etiquette}>{t.reportNoteLabel}</Text>
    <TextInput
      style={traits.champ}
      value={motLibre}
      onChangeText={setMotLibre}
      maxLength={1000}
      multiline
      placeholder={t.reportNotePlaceholder}
      placeholderTextColor={colors.muted}
    />

    {/* Sans catégorie il n'y a rien à envoyer : `category` est `not null` et
        sans défaut, la base refuserait l'insert. */}
    <Appui
      accessibilityRole="button"
      disabled={!categorie || enVol}
      android_ripple={ondeClaire}
      style={({ pressed }) => [traits.action, (!categorie || enVol) && traits.actionOff, pressed && traits.presse]}
      onPress={() => void confirmer()}
    ><Text style={traits.actionTexte}>{enVol ? t.reporting : t.reportConfirm}  →</Text></Appui>
    <Pressable accessibilityRole="button" style={toucheMinimale} disabled={enVol} onPress={() => router.back()}>
      {({ pressed }) => <Text style={[traits.annuler, pressed && traits.presse]}>{t.reportCancel}</Text>}
    </Pressable>
  </CoquilleDeFeuille>
}
