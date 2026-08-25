import { describe, expect, it } from 'vitest'
import { jetonDuLien } from './liens'
import { lienDInvitation } from './communaute'

describe('jetonDuLien', () => {
  it('lit le lien de tandem émis par le web', () => {
    expect(jetonDuLien('https://tandem.agapeplay.store/?invite=abc123'))
      .toEqual({ forme: 'tandem', jeton: 'abc123' })
  })

  it('lit le lien de communauté émis par le web', () => {
    // Construit par la fonction qui l'émet, et non recopié à la main : c'est
    // ce qui fait que renommer le paramètre côté émission casserait ce test
    // plutôt que les liens des gens.
    expect(jetonDuLien(lienDInvitation('https://tandem.agapeplay.store', 'jeton-42')))
      .toEqual({ forme: 'communaute', jeton: 'jeton-42' })
  })

  it('lit la route mobile, en build comme dans Expo Go', () => {
    expect(jetonDuLien('agapeplay:///invite?token=abc123'))
      .toEqual({ forme: 'tandem', jeton: 'abc123' })
    // Le cas qui casse `new URL` selon les moteurs : un schéma personnalisé et
    // un chemin `/--/` inséré par Expo Go.
    expect(jetonDuLien('exp://192.168.1.10:8081/--/invite?token=abc123'))
      .toEqual({ forme: 'tandem', jeton: 'abc123' })
  })

  it('ne voit aucun jeton dans le retour du lien magique', () => {
    // Les jetons d'authentification voyagent dans le FRAGMENT, et sont
    // ramassés par `useAuthDeepLink`. Les lire ici enverrait quelqu'un sur un
    // écran d'invitation au moment où il vient de se connecter.
    expect(jetonDuLien('agapeplay:///#access_token=aaa&refresh_token=bbb')).toBeNull()
    expect(jetonDuLien('https://tandem.agapeplay.store/')).toBeNull()
  })

  it('ignore un paramètre vide plutôt que de rendre un jeton vide', () => {
    expect(jetonDuLien('https://tandem.agapeplay.store/?invite=')).toBeNull()
    expect(jetonDuLien('https://tandem.agapeplay.store/?invite=%20')).toBeNull()
  })

  it('donne la précédence au tandem quand les deux se croisent', () => {
    expect(jetonDuLien('https://tandem.agapeplay.store/?communaute=c1&invite=t1'))
      .toEqual({ forme: 'tandem', jeton: 't1' })
  })
})
