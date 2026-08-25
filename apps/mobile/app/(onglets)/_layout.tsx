/**
 * La barre d'onglets — celle du système, pas une barre dessinée en JavaScript.
 *
 * `docs/21` avait refusé cette barre et nommé ses deux prérequis : une source
 * unique pour la langue, et de vraies icônes. Les deux sont là — `src/langue.ts`
 * pour la première, les jeux d'icônes de chaque plateforme pour les secondes —
 * et c'est ce qui rend ce fichier possible.
 *
 * **Ce que « native » veut dire ici, concrètement.** `NativeTabs` monte un
 * `UITabBarController` sur iOS et une `BottomNavigationView` sur Android. On
 * hérite donc de comportements qu'une barre en JavaScript n'aurait pas : le
 * Liquid Glass d'iOS 26, la remontée au sommet quand on retouche l'onglet déjà
 * ouvert, la réduction de la barre au défilement, les ondes de matériau
 * d'Android. Rien de tout cela n'est écrit ici — c'est exactement le propos.
 *
 * **Les icônes, et pourquoi celles-là.** Chaque plateforme reçoit son propre
 * jeu, ce que l'API permet en une ligne (`sf` pour iOS, `md` pour Android) :
 *
 * | Onglet      | iOS (SF Symbols)        | Android (Material Symbols) |
 * |-------------|-------------------------|----------------------------|
 * | Aujourd'hui | `sun.horizon`           | `wb_twilight`              |
 * | Parcours    | `map`                   | `map`                      |
 * | Journal     | `book.closed`           | `book`                     |
 * | Tandem      | `person.2`              | `people`                   |
 *
 * Le premier est le seul qui demande une explication : ce produit propose un
 * pas par jour, pas un agenda. Un soleil bas sur l'horizon dit le rituel
 * quotidien là où une icône de calendrier promettrait des dates et des cases à
 * cocher. Le journal est un livre **fermé** : c'est un espace privé.
 *
 * Aucune icône n'est dessinée à la main ni générée : les deux jeux sont ceux
 * des systèmes eux-mêmes — SF Symbols est fourni par iOS, et les Material
 * Symbols d'Android sont rendus depuis la fonte que `expo-symbols` embarque
 * déjà (dépendance d'`expo-router`, aucune installation, aucun réseau). Ils
 * suivent donc la teinte, l'épaisseur et le poids de sélection du système,
 * ce qu'aucun tracé fourni par nous ne saurait faire aussi bien. Le repli, si
 * le rendu Android venait à manquer : `src={require(…)}` avec un tracé maison —
 * mais le constat se fait sur appareil, pas ici (voir la recette de la PR).
 *
 * La variante pleine à la sélection (`{ default, selected }`) est le geste que
 * les deux plateformes attendent : le contour dit « ailleurs », le plein dit
 * « ici ».
 *
 * **Ce qui n'est pas dans les onglets, et pourquoi.** Séance, compte,
 * invitation et connexion restent dans la pile racine : ce sont des
 * destinations qu'on ouvre et qu'on referme, pas des lieux où l'on habite.
 * Quatre onglets, c'est aussi la limite de lisibilité — et Android en refuse
 * plus de cinq.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { copy } from '@agapeplay/content/copy/mobile-onglets'
import { colors } from '@/theme'
import { useLangue } from '@/langue'

export default function OngletsLayout() {
  const { langue } = useLangue()
  const t = copy[langue]

  return <NativeTabs
    // Le cuivre de la marque pour l'onglet actif. C'est la seule couleur posée
    // ici : tout le reste — fond, flou, épaisseur — appartient à la plateforme,
    // et sur iOS 26 le Liquid Glass ignore de toute façon les fonds qu'on lui
    // proposerait.
    tintColor={colors.copper}
    // La barre se réduit quand on descend dans un écran, et revient quand on
    // remonte : le geste d'iOS 26, qui rend l'écran à la lecture. Sans effet
    // ailleurs.
    minimizeBehavior="onScrollDown"
    // Android : la barre monte au-dessus du clavier au lieu d'être recouverte.
    // Ce n'est pas cosmétique — c'est ce qui garde le composeur de la
    // conversation atteignable, la barre servant de plancher au contenu.
    tabBarRespectsIMEInsets
  >
    <NativeTabs.Trigger name="index">
      <NativeTabs.Trigger.Icon sf={{ default: 'sun.horizon', selected: 'sun.horizon.fill' }} md={{ default: 'wb_twilight', selected: 'wb_twilight' }} />
      <NativeTabs.Trigger.Label>{t.today}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="journey">
      <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md={{ default: 'map', selected: 'map' }} />
      <NativeTabs.Trigger.Label>{t.journey}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="journal">
      <NativeTabs.Trigger.Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} md={{ default: 'book', selected: 'book' }} />
      <NativeTabs.Trigger.Label>{t.journal}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="tandem">
      <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md={{ default: 'people', selected: 'people' }} />
      <NativeTabs.Trigger.Label>{t.tandem}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  </NativeTabs>
}
