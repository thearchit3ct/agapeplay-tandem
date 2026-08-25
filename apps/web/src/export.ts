/**
 * L'export des données personnelles, côté navigateur.
 *
 * Tout ce qui décide **ce que l'export contient** — les sections, le refus de
 * rendre un fichier amputé, le nom du fichier — a déménagé le 26/08/2026 dans
 * `packages/domain/src/export.ts` avec ses tests : le mobile assemble
 * exactement le même fichier (issue #13), et deux listes de sections
 * divergeraient à la première table ajoutée. Le raisonnement, section par
 * section, se lit là-bas.
 *
 * Ce qui reste ici est le seul morceau réellement propre au web : la remise du
 * fichier. Un `Blob`, une URL d'objet et une balise `<a download>` n'existent
 * pas sur un téléphone, où le fichier passe par la feuille de partage native.
 *
 * Le module continue de réexporter le reste pour que les appelants web n'aient
 * qu'un seul chemin d'import à connaître.
 */
export {
  A_PROPOS_DE_LA_MESURE, SECTIONS, nomDuFichierExport, rassemblerExport,
} from '@agapeplay/domain'
export type {
  CibleExport, ExportPersonnel, Lecteur, Ligne, Reponse, SectionExport,
} from '@agapeplay/domain'

/**
 * Propose le fichier au téléchargement. Rien de plus : la construction du
 * contenu est ailleurs, et testée.
 */
export const telechargerJson = (nomFichier: string, contenu: unknown) => {
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  // Sans révocation, le blob reste en mémoire jusqu'au rechargement de la page.
  URL.revokeObjectURL(url)
}
