/**
 * Les trois gestes de compte du mobile — issue #13, troisième front.
 *
 * Emporter ses données, se déconnecter partout, supprimer son compte. Ils
 * existaient côté web depuis la PR #44 ; le mobile n'en avait aucun, c'est-à-
 * dire qu'on pouvait y vivre sans jamais pouvoir partir.
 *
 * **Rien n'est réinventé côté contenu.** L'export assemble le fichier avec
 * `rassemblerExport`, qui parcourt la liste `SECTIONS` du domaine — la même que
 * le navigateur, à la ligne près. C'est la raison du déménagement de ce module
 * dans `packages/domain` : deux listes auraient divergé à la première table
 * ajoutée, et le fichier téléchargé depuis un téléphone serait devenu plus
 * court que celui du navigateur, sans que rien ne le dise. Même refus du
 * fichier amputé, donc : `rassemblerExport` lève à la première anomalie, et
 * l'écran annonce l'échec plutôt que de remettre un fichier plus court de
 * quelques lignes.
 *
 * Ce qui diffère vraiment du web, et c'est tout : le fichier ne se
 * « télécharge » pas. Il s'écrit dans le cache de l'application, puis passe par
 * la feuille de partage du système, qui laisse la personne choisir où il va.
 * Les deux bibliothèques sont chargées **au moment d'agir** et jamais à
 * l'import : c'est la leçon d'`expo-notifications` (voir `notifications.ts`),
 * et `mobile:export` est la seule garde qui l'attraperait.
 */
import { nomDuFichierExport, rassemblerExport } from '@agapeplay/domain'
import type { Ligne, Reponse, SectionExport } from '@agapeplay/domain'
import { TOUTES_LES_CLEFS } from './clefs'
import { oublierLesRappels } from './notifications'
import { stockage } from './storage'
import { supabase } from './supabase'

/**
 * Ce que l'écran a besoin de distinguer, et rien de plus.
 *
 * `sans-partage` n'est pas un échec de l'export : le fichier a bien été
 * assemblé, c'est l'appareil qui n'offre aucun moyen de le remettre. Les
 * confondre ferait dire « on n'a pas pu rassembler tes données » à quelqu'un
 * dont les données sont là.
 */
export type ResultatExport = 'remis' | 'echec-assemblage' | 'sans-partage'

export const emporterMesDonnees = async (
  compte: { id: string; email: string | null },
): Promise<ResultatExport> => {
  const client = supabase
  if (!client) return 'echec-assemblage'

  const lire = async (section: SectionExport): Promise<Reponse> => {
    const requete = client.from(section.table).select(section.colonnes)
    const { data, error } = await (section.cible === 'adresse'
      ? requete.ilike(section.colonne, compte.email ?? '')
      : requete.eq(section.colonne, compte.id))
    return { data: data as Ligne[] | null, error }
  }

  let contenu: unknown
  try {
    contenu = await rassemblerExport(lire, compte)
  } catch {
    return 'echec-assemblage'
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require('expo-sharing') as typeof import('expo-sharing')

    // Le cache, et non le dossier des documents : le fichier n'a pas à
    // survivre au geste. Une fois rangé là où la personne l'a choisi, la copie
    // laissée dans l'application n'est plus qu'une seconde copie de tout son
    // journal sur le même téléphone.
    const fichier = new File(Paths.cache, nomDuFichierExport())
    fichier.create({ overwrite: true })
    fichier.write(JSON.stringify(contenu, null, 2))

    // Demandé APRÈS l'écriture, et lu : un téléphone sans feuille de partage
    // n'est pas un export raté — le fichier existe. Les deux cas ont leur
    // phrase, parce que « on n'a pas pu rassembler tes données » serait faux
    // ici, et c'est le genre de faux qui fait croire à une perte.
    if (!(await Sharing.isAvailableAsync())) return 'sans-partage'
    await Sharing.shareAsync(fichier.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
    })
    return 'remis'
  } catch {
    // L'écriture du fichier ou l'ouverture de la feuille a échoué. Le contenu
    // était pourtant complet : on ne dit donc pas « rassemblement impossible ».
    return 'sans-partage'
  }
}

/**
 * Ferme la session sur tous les appareils. Rend `false` si rien n'a bougé.
 *
 * La réponse est lue, comme partout : annoncer « tu es déconnecté·e partout »
 * sur un appel en échec ferait croire fermée une session qui reste ouverte
 * ailleurs — et c'est précisément le geste qu'on pose quand on craint le
 * contraire.
 */
export const deconnexionPartout = async (): Promise<boolean> => {
  const client = supabase
  if (!client) return false
  const { error } = await client.auth.signOut({ scope: 'global' })
  return !error
}

/**
 * Vide ce téléphone de tout ce que l'application y a écrit.
 *
 * Appelé après une suppression réussie. La liste vient de `clefs.ts` et est
 * exhaustive par construction : c'est tout l'intérêt de ce fichier-là. Les
 * rappels déjà planifiés, eux, vivent dans le système et non dans le stockage —
 * `oublierLesRappels` s'en charge, sans quoi le téléphone continuerait de
 * proposer une séance à un compte qui n'existe plus.
 */
export const purgerLAppareil = async (): Promise<void> => {
  for (const clef of TOUTES_LES_CLEFS) await stockage.removeItem(clef)
  await oublierLesRappels()
}

/**
 * La suppression réelle. `supprimer_mon_compte()` fait tout d'un tenant côté
 * base — données personnelles effacées, tandems terminés sauf les bloqués,
 * `auth.users` neutralisée, sessions révoquées — ou rien du tout.
 *
 * Deux choses restent à faire ici, et elles comptent autant :
 *
 *   - lire la réponse. Une erreur non lue afficherait « ton compte est
 *     supprimé » sur un compte intact ;
 *   - vider ce téléphone. Le journal en cache, la file de synchronisation et
 *     l'identifiant de mesure sont locaux : une purge qui s'arrêterait à la
 *     base les laisserait au prochain qui ouvre cet appareil.
 *
 * La déconnexion finale est le pendant visible de la révocation, pas la
 * garantie : les lignes `auth.sessions` sont déjà parties avec la fonction.
 */
export const supprimerMonCompte = async (): Promise<boolean> => {
  const client = supabase
  if (!client) return false
  const { error } = await client.rpc('supprimer_mon_compte')
  if (error) return false
  await purgerLAppareil()
  await client.auth.signOut({ scope: 'global' })
  return true
}
