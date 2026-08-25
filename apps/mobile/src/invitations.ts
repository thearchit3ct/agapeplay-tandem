/**
 * Les liens d'invitation, de bout en bout — issue #13, quatrième front.
 *
 * Jusqu'ici le mobile savait accepter une invitation **si** un jeton lui était
 * passé en paramètre de route, ce qui ne pouvait arriver qu'en tapant l'URL à
 * la main : le lien réellement envoyé aux gens est celui du web,
 * `https://tandem.agapeplay.store/?invite=…`, et rien ne le reliait à
 * l'application. Ce module ferme le chemin.
 *
 * Trois décisions y sont prises, et une seule est du code :
 *
 * - **la lecture du lien vit dans le domaine** (`jetonDuLien`), parce que les
 *   quatre formes d'URL — web, schéma `agapeplay://`, Expo Go — disent la même
 *   chose et qu'aucune n'est un cas particulier ;
 * - **le jeton est retenu jusqu'à la connexion.** Un lien s'ouvre presque
 *   toujours avant d'avoir un compte : « connecte-toi pour accepter » suivi
 *   d'un jeton perdu est la façon la plus sûre de casser un appariement. Le
 *   web fait déjà exactement cela (`retenirJetonCommunaute`) ;
 * - **il est consommé avant de connaître le résultat.** Les deux issues sont
 *   terminales : une tentative qui échoue ne doit pas se rejouer à chaque
 *   rendu, ni ressurgir au prochain démarrage. Le refus, lui, s'affiche.
 *
 * Ce que ce module ne fait PAS, et c'est voulu : il ne touche pas au retour du
 * lien magique. Les jetons d'authentification voyagent dans le **fragment** de
 * l'URL et sont ramassés par `authDeepLink.ts` ; `jetonDuLien` ne lit que la
 * requête, et son test le vérifie.
 */
import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { jetonDuLien, refusDAdhesion } from '@agapeplay/domain'
import type { JetonRecu, RefusDAdhesion } from '@agapeplay/domain'
import { CLEFS } from './clefs'
import { stockage } from './storage'
import { supabase } from './supabase'

export const retenirJeton = async (recu: JetonRecu): Promise<void> => {
  await stockage.setItem(CLEFS.jetonEnAttente, JSON.stringify(recu))
}

export const jetonRetenu = async (): Promise<JetonRecu | null> => {
  const brut = await stockage.getItem(CLEFS.jetonEnAttente)
  if (!brut) return null
  try {
    const lu = JSON.parse(brut) as JetonRecu
    return lu?.jeton && (lu.forme === 'tandem' || lu.forme === 'communaute') ? lu : null
  } catch {
    return null
  }
}

export const oublierJeton = async (): Promise<void> => {
  await stockage.removeItem(CLEFS.jetonEnAttente)
}

/**
 * Écoute les liens entrants et emmène sur l'écran d'invitation.
 *
 * Monté à la racine des routes, à côté de `useAuthDeepLink` : c'est le seul
 * endroit qui existe déjà quand l'application s'ouvre à froid sur un lien.
 * Le jeton est écrit **avant** la navigation — si l'écran se montait plus vite
 * que l'écriture, il ne trouverait rien à jouer.
 */
export function useLiensDInvitation() {
  useEffect(() => {
    let actif = true
    const traiter = async (url: string | null) => {
      if (!url || !actif) return
      const recu = jetonDuLien(url)
      if (!recu) return
      await retenirJeton(recu)
      if (!actif) return
      router.push('/invite')
    }
    void Linking.getInitialURL().then(traiter)
    const abonnement = Linking.addEventListener('url', (evenement) => { void traiter(evenement.url) })
    return () => { actif = false; abonnement.remove() }
  }, [])
}

/**
 * Accepte une invitation de tandem. Rend `true` si le tandem est actif.
 *
 * `accept_tandem_invitation` est `security invoker` : c'est la session qui
 * décide, et une invitation périmée, révoquée ou adressée à quelqu'un d'autre
 * lève. On lit donc l'erreur plutôt que de supposer.
 */
export const accepterInvitationTandem = async (jeton: string): Promise<boolean> => {
  const client = supabase
  if (!client) return false
  const { error } = await client.rpc('accept_tandem_invitation', { p_token: jeton })
  return !error
}

/**
 * Rejoint une communauté — issue #17, côté mobile.
 *
 * La RPC lève des **codes** courts (`cohorte_terminee`,
 * `deja_dans_une_communaute`…) et non des phrases : `refusDAdhesion` les
 * reconnaît, l'écran choisit ses mots. C'est le seul endroit du dépôt où l'on
 * lit une chaîne d'erreur SQL, et il est isolé pour cette raison — la même
 * forme qu'`apps/web/src/communaute.ts`.
 *
 * Le mobile n'a pas d'espace de communauté : rejoindre y aboutit, et la suite
 * (cohortes, mentors, liens) se vit sur le web. L'écran le dit plutôt que de
 * laisser croire à une page qui n'existe pas.
 */
export const rejoindreLaCommunaute = async (
  jeton: string,
): Promise<{ rejointe: true } | { refus: RefusDAdhesion }> => {
  const client = supabase
  if (!client) return { refus: 'inconnu' }
  const { data, error } = await client.rpc('rejoindre_une_communaute', { p_token: jeton })
  if (error) return { refus: refusDAdhesion(error.message) }
  return typeof data === 'string' ? { rejointe: true } : { refus: 'inconnu' }
}
