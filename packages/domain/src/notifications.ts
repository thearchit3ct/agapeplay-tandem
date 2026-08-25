/**
 * Ce qui doit être planifié sur l'appareil, et quand — issue #13.
 *
 * Les rappels du mobile sont des notifications **locales** : elles sont posées
 * par l'application sur le téléphone, et rien ne les envoie depuis un serveur.
 * Ce n'est pas un provisoire mais l'état du produit — il n'y a aucun composant
 * serveur qui pourrait décider d'écrire à quelqu'un, et `docs/29` le dit dans
 * les mêmes termes.
 *
 * D'où ce fichier : la seule chose qui se décide vraiment — **faut-il poser un
 * rappel, et lequel** — se déduit des préférences du compte, sans téléphone,
 * sans permission système et sans horloge. Le reste (demander l'autorisation,
 * annuler l'ancien, écrire l'identifiant rendu) est de la plomberie de
 * plateforme, et vit dans `apps/mobile/src/notifications.ts`.
 *
 * ---------------------------------------------------------------------------
 * Ce que ce fichier refuse de savoir
 * ---------------------------------------------------------------------------
 *
 * Il ne calcule **aucune série** et ne compte aucun jour manqué. Un rappel est
 * une proposition à heure fixe, pas la relance d'une dette : c'est la même
 * règle que `bilan.ts`, et elle tient pour la même raison — ce qui n'est pas
 * calculé ne peut pas être affiché ni écrit dans une notification.
 */

/**
 * Les préférences telles que la table les porte.
 *
 * Les clés sont **les noms de colonnes** de `notification_preferences`, comme
 * dans `AppState.notificationPrefs` : ce sont ces deux colonnes-là qui
 * décident, et les renommer ici ferait deux vocabulaires pour un seul réglage.
 *
 * Les trois autres colonnes (`messages`, `church`, `absence`) ne figurent pas :
 * aucune ne correspond à un rappel que l'appareil sait poser tout seul. Un
 * message reçu et une nouvelle de communauté demanderaient qu'un serveur
 * pousse la notification — il n'y en a pas ; l'absence, elle, est déjà dite
 * par `invitationDouce` à l'ouverture de l'écran, et la répéter dans une
 * notification reviendrait à commenter le silence de quelqu'un.
 */
export type PreferencesDeRappel = {
  sessions: boolean
  weekly_checkin: boolean
}

/** Le rappel de la séance du jour : tous les jours, à heure fixe. */
export const HEURE_RAPPEL_SEANCE = 8

/**
 * Le bilan de fin de semaine : le samedi, en fin de matinée.
 *
 * Samedi parce que c'est le jour où la fenêtre s'ouvre — `semaineDuBilan` fait
 * basculer la semaine couverte à partir du samedi (jour ISO 6). Un rappel posé
 * un autre jour proposerait soit une question qui n'est pas encore ouverte,
 * soit une semaine déjà entamée depuis plusieurs jours. Le test de ce fichier
 * relie les deux définitions plutôt que de les laisser dériver côte à côte.
 *
 * Onze heures, et pas huit : le rappel de séance occupe déjà le matin tôt, et
 * deux notifications à la même minute un samedi sont une seule notification
 * vue, plus une ignorée.
 */
export const JOUR_RAPPEL_BILAN = 6
export const HEURE_RAPPEL_BILAN = 11

export type RappelPlanifie =
  | { clef: 'seance'; cadence: 'quotidienne'; heure: number; minute: number }
  | { clef: 'bilan'; cadence: 'hebdomadaire'; jourIso: number; heure: number; minute: number }

/**
 * Les rappels à poser, d'après les préférences du compte.
 *
 * Rend la liste **complète** de ce qui doit exister sur l'appareil, jamais un
 * delta : l'appelant annule tout et repose cette liste. Un delta supposerait
 * qu'on sait ce qui est déjà planifié, et l'appareil est le seul à le savoir
 * vraiment — une notification survit à une désinstallation de l'application
 * dans certains cas, et à un changement de préférence fait depuis le
 * navigateur dans tous les cas.
 *
 * Un réglage coupé ne rend donc rien, ce qui vaut annulation : c'est le sens
 * littéral de « un réglage coupé annule la planification ».
 */
export const rappelsAPlanifier = (preferences: PreferencesDeRappel): RappelPlanifie[] => {
  const rappels: RappelPlanifie[] = []
  if (preferences.sessions) {
    rappels.push({ clef: 'seance', cadence: 'quotidienne', heure: HEURE_RAPPEL_SEANCE, minute: 0 })
  }
  if (preferences.weekly_checkin) {
    rappels.push({ clef: 'bilan', cadence: 'hebdomadaire', jourIso: JOUR_RAPPEL_BILAN, heure: HEURE_RAPPEL_BILAN, minute: 0 })
  }
  return rappels
}
