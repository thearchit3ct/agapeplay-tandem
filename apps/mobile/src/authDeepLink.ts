import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { supabase } from './supabase'

/**
 * Le retour du lien magique — le maillon qui n'a jamais existé.
 *
 * Mesuré sur appareil le 24/08/2026, première séance réelle du mobile :
 * l'écran de connexion demandait `emailRedirectTo: 'agapeplay:///'`, mais
 * RIEN n'écoutait l'URL au retour. Même dans un build de production, le lien
 * aurait rouvert l'app et la session serait restée à terre — les jetons
 * voyagent dans le fragment de l'URL, et personne ne les ramassait. La
 * connexion mobile n'a donc jamais pu aboutir, dans aucun environnement.
 *
 * Sur React Native, `detectSessionInUrl` ne peut rien faire (pas de
 * window.location) : le ramassage est manuel — URL initiale au lancement à
 * froid, évènement `url` si l'app était déjà ouverte — puis `setSession`.
 */
const extraireJetons = (url: string) => {
  const fragment = url.split('#')[1]
  if (!fragment) return null
  const params = new URLSearchParams(fragment)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  return accessToken && refreshToken ? { accessToken, refreshToken } : null
}

export function useAuthDeepLink() {
  useEffect(() => {
    const client = supabase
    if (!client) return
    let actif = true
    const traiter = async (url: string | null) => {
      if (!url || !actif) return
      const jetons = extraireJetons(url)
      if (!jetons) return
      await client.auth.setSession({ access_token: jetons.accessToken, refresh_token: jetons.refreshToken })
    }
    void Linking.getInitialURL().then(traiter)
    const abonnement = Linking.addEventListener('url', (evenement) => { void traiter(evenement.url) })
    return () => { actif = false; abonnement.remove() }
  }, [])
}
