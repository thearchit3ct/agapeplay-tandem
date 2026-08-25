/**
 * Tout ce que cette application écrit sur le téléphone, en un seul endroit.
 *
 * La raison est la suppression de compte. Elle doit vider l'appareil autant que
 * la base — un journal en cache et une file de synchronisation laissés derrière
 * seraient lisibles par le prochain qui ouvre ce téléphone —, et le mode
 * d'échec est silencieux : une clé ajoutée un jour dans un module, oubliée dans
 * la liste de purge, survit à la suppression sans que rien ne le signale.
 *
 * D'où l'inversion : les modules ne déclarent plus leur clé chez eux, ils la
 * lisent ici. `TOUTES_LES_CLEFS` est donc exhaustive par construction, et non
 * par vigilance.
 *
 * Ce que la purge ne peut pas atteindre, et qui est traité ailleurs : les
 * notifications déjà planifiées (elles vivent dans le système — voir
 * `oublierLesRappels`) et la session Supabase, fermée par `signOut`.
 */
export const CLEFS = {
  /** La file des séances terminées en attente d'envoi (`offlineQueue.ts`). */
  fileProgression: 'agapeplay:tandem:sync-queue',
  /** L'identifiant de mesure tiré sur l'appareil (`mesure.ts`). */
  mesureIdentifiant: 'agapeplay:tandem:mesure-id',
  /** Le consentement à la mesure, côté appareil (`mesure.ts`). */
  mesureConsentement: 'agapeplay:tandem:mesure-consentement',
  /** Les identifiants des rappels posés dans le système (`notifications.ts`). */
  rappelsPoses: 'agapeplay:tandem:rappels-poses',
  /** Le jeton d'invitation reçu par lien, en attente de connexion (`invitations.ts`). */
  jetonEnAttente: 'agapeplay:tandem:jeton-en-attente',
  /** Le parcours publié, gardé pour être lisible hors ligne (`parcours.ts`). */
  parcours: 'agapeplay:tandem:parcours',
  /**
   * La langue choisie pour toute l'application (`langue.ts`).
   *
   * Elle est purgée avec le reste à la suppression du compte, bien qu'elle ne
   * dise rien de personne : `TOUTES_LES_CLEFS` vaut par son exhaustivité, et une
   * exception « celle-ci ne compte pas » est exactement le raisonnement qui
   * laisse un jour une vraie donnée derrière.
   */
  langue: 'agapeplay:tandem:langue',
} as const

export const TOUTES_LES_CLEFS: readonly string[] = Object.values(CLEFS)
