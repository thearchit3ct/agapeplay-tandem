import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PolitiqueDeConfidentialite, estRouteConfidentialite, titreDeLaPage } from './views/confidentialite'
import './styles.css'

/**
 * La politique de confidentialité est branchée ici, avant `App`, et pas à
 * l'intérieur — `App()` lit et écrit `localStorage` dès son premier `useState`,
 * si bien qu'un `return` anticipé arriverait trop tard.
 *
 * `App` est chargé **dynamiquement**, et ce n'est pas une optimisation de
 * poids : l'importer statiquement suffirait à trahir la page. Sa chaîne
 * d'imports passe par `lib/supabaseClient`, qui construit le client dès
 * l'évaluation du module — lequel relit la session stockée et peut rafraîchir
 * son jeton, c'est-à-dire lire le stockage et appeler le réseau sur une page
 * qui affirme ne faire ni l'un ni l'autre. Un `import()` dans la branche qui en
 * a besoin met cette chaîne dans un morceau que la page publique ne télécharge
 * jamais.
 *
 * Aucune bibliothèque de routage pour une seule adresse : le chemin est lu une
 * fois, au montage. La page ne quitte l'application que par un lien ordinaire,
 * donc rien n'a à réagir à une navigation qui n'a pas lieu.
 */
const racine = createRoot(document.getElementById('root')!)

if (estRouteConfidentialite(window.location.pathname)) {
  document.title = titreDeLaPage()
  racine.render(
    <StrictMode>
      <PolitiqueDeConfidentialite />
    </StrictMode>,
  )
} else {
  void import('./App').then(({ default: App }) => {
    racine.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
