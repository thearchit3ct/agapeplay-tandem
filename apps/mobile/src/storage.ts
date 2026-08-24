import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * AsyncStorage, avec un repli mémoire quand le module natif manque.
 *
 * Mesuré sur appareil (Expo Go 57, 24/08/2026) : le module natif peut être
 * nul — « AsyncStorageError: Native module is null » — et chaque lecture
 * levait alors une promesse non rattrapée : le rafraîchissement de session
 * Supabase en boucle, puis la file hors-ligne au premier focus de l'accueil.
 *
 * Le repli garde les fonctionnalités vivantes le temps de la session ; seule
 * la persistance entre deux lancements se perd, et uniquement dans
 * l'environnement où le natif manque déjà. Tous les consommateurs passent par
 * ici : un quatrième usage direct d'AsyncStorage referait le bug au premier
 * appareil venu.
 */
const memoire = new Map<string, string>()

export const stockage = {
  getItem: async (cle: string): Promise<string | null> => {
    try { return await AsyncStorage.getItem(cle) } catch { return memoire.get(cle) ?? null }
  },
  setItem: async (cle: string, valeur: string): Promise<void> => {
    try { await AsyncStorage.setItem(cle, valeur) } catch { memoire.set(cle, valeur) }
  },
  removeItem: async (cle: string): Promise<void> => {
    try { await AsyncStorage.removeItem(cle) } catch { memoire.delete(cle) }
  },
}
