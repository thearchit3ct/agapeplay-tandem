/**
 * Le comportement clavier des dialogues — issue #14, 25/08/2026.
 *
 * Les sept dialogues du produit portaient déjà `role="dialog"`,
 * `aria-modal="true"` et un `aria-labelledby` — ce qu'un lecteur d'écran
 * annonce était juste. Ce qui manquait est ce qu'un clavier *fait* : Échap ne
 * refermait rien, la tabulation sortait du dialogue pour parcourir la page
 * masquée derrière lui, et à la fermeture le focus repartait au tout début du
 * document — c'est-à-dire à sept onglets du bouton qu'on venait d'utiliser.
 *
 * Un seul crochet, et pas sept copies. Trois décisions dedans :
 *
 * - **l'écoute est posée sur le dialogue, jamais sur `document`.** Les réglages
 *   et la suppression de compte sont ouverts *en même temps* — `App` les rend
 *   côte à côte et ouvrir le second ne referme pas le premier. Sur `document`,
 *   une touche Échap aurait fermé les deux, et les deux pièges se seraient
 *   disputé le focus. Sur le nœud, seul le dialogue qui contient le focus
 *   répond, et l'imbrication se résout d'elle-même ;
 * - **Échap est facultatif.** `TrustDialog` n'a pas de fermeture : c'est la
 *   porte des consentements, elle n'a ni croix ni clic sur le fond. Lui donner
 *   Échap ferait d'une règle produit un contournement au clavier. Le crochet
 *   appelé sans `onClose` piège le focus et ne referme rien ;
 * - **le focus va au premier élément, pas au cadre.** Focaliser la `<section>`
 *   demanderait un `tabindex="-1"` et poserait un anneau autour de tout le
 *   dialogue ; le premier bouton dit déjà où l'on est, et pour la fenêtre des
 *   consentements c'est la première case à cocher — donc le premier geste.
 *
 * La restitution du focus se fait au démontage, ce qui la rend indifférente à
 * la raison de la fermeture : croix, Échap, clic sur le fond, ou action
 * aboutie. Un `onClose` qui l'aurait portée aurait oublié les trois autres.
 */
import { useEffect, useRef } from 'react'

/**
 * Ce qui se focalise. `:not([disabled])` compte : le bouton d'envoi d'un
 * signalement sans catégorie est désarmé, et un piège qui s'y arrêterait
 * enfermerait quelqu'un sur un bouton qui ne répond pas.
 */
const FOCUSABLES = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useDialogue<T extends HTMLElement>(onClose?: () => void) {
  const cadre = useRef<T>(null)
  // `onClose` change d'identité à chaque rendu du parent (ce sont des flèches
  // écrites dans le JSX). Le garder dans une référence permet à l'effet de ne
  // se jouer qu'au montage — sinon le focus repartirait au premier élément à
  // chaque frappe dans un champ.
  const fermeture = useRef(onClose)
  fermeture.current = onClose

  useEffect(() => {
    const noeud = cadre.current
    if (!noeud) return
    const declencheur = document.activeElement as HTMLElement | null

    // `getClientRects()` plutôt que `offsetParent` : le dialogue vit dans un
    // conteneur `position: fixed`, où `offsetParent` ment.
    const joignables = () => [...noeud.querySelectorAll<HTMLElement>(FOCUSABLES)]
      .filter((element) => element.getClientRects().length > 0)

    joignables()[0]?.focus()

    const auClavier = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') {
        if (!fermeture.current) return
        // Le dialogue de suppression s'ouvre par-dessus celui des réglages :
        // sans cet arrêt, Échap refermerait les deux d'un coup.
        evenement.stopPropagation()
        fermeture.current()
        return
      }
      if (evenement.key !== 'Tab') return
      const liste = joignables()
      if (liste.length === 0) return
      const premier = liste[0]
      const dernier = liste[liste.length - 1]
      const actif = document.activeElement
      if (evenement.shiftKey ? actif === premier : actif === dernier) {
        evenement.preventDefault()
        ;(evenement.shiftKey ? dernier : premier).focus()
      }
    }

    noeud.addEventListener('keydown', auClavier)
    return () => {
      noeud.removeEventListener('keydown', auClavier)
      // Le déclencheur peut avoir disparu avec le dialogue — la suppression de
      // compte vide l'écran. `isConnected` évite alors de rendre le focus à un
      // nœud détaché, ce qui l'enverrait nulle part sans rien dire.
      if (declencheur?.isConnected) declencheur.focus()
    }
  }, [])

  return cadre
}

/**
 * Les flèches dans un groupe de boutons radio — les six catégories de
 * signalement, les cinq catégories de demande d'aide.
 *
 * Ce que `role="radiogroup"` promet et que le code ne tenait pas : dans un
 * groupe radio, la tabulation entre **une fois** et les flèches parcourent les
 * choix. Six arrêts de tabulation pour un choix unique, c'est six fois le
 * travail pour la même décision — et sur l'écran de signalement, celui qu'on
 * ouvre en pleurant, ça compte.
 *
 * Le `tabIndex` roulant vit dans les vues (`0` sur le choix courant, `-1` sur
 * les autres) ; cette fonction ne fait que déplacer.
 */
export function naviguerDansLeGroupe(
  evenement: { key: string; preventDefault: () => void; currentTarget: HTMLElement },
  rang: number,
  total: number,
  choisir: (rang: number) => void,
) {
  const cible = evenement.key === 'ArrowDown' || evenement.key === 'ArrowRight' ? (rang + 1) % total
    : evenement.key === 'ArrowUp' || evenement.key === 'ArrowLeft' ? (rang - 1 + total) % total
      : evenement.key === 'Home' ? 0
        : evenement.key === 'End' ? total - 1
          : null
  if (cible === null) return
  evenement.preventDefault()
  choisir(cible)
  // Le focus suit le choix : c'est ce qui distingue un groupe radio d'une liste
  // de boutons, et sans lui les flèches déplaceraient une sélection invisible.
  const groupe = evenement.currentTarget.parentElement
  const boutons = groupe?.querySelectorAll<HTMLElement>('[role="radio"]')
  boutons?.[cible]?.focus()
}
