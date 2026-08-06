/**
 * Ce que ces tests protègent : qu'aucun écran n'affiche `undefined`.
 *
 * Les textes sont lus par accès direct (`t.inviteAccepted`) — il n'existe
 * aucun mécanisme de repli vers le français, et il n'en faut pas un : ce serait
 * ajouter du code pour pouvoir le tester. La garde utile est en amont, sur la
 * parité des jeux de clés.
 *
 * Portée honnête de cette garde : côté web, `tsc -b` en couvre déjà une partie,
 * parce que `Copy = copy.fr | copy.en` fait échouer l'accès à une clé absente
 * d'une des deux branches. Ces tests ne remplacent pas le typage — ils
 * l'attrapent plus tôt, ils couvrent `mobile-home.ts` qui n'exporte aucun type
 * équivalent, et ils voient ce que le typage ne voit pas : une clé anglaise
 * restée en français.
 */
import { describe, expect, it } from 'vitest'
import { copy as webCopy } from './web'
import { copy as mobileCopy } from './mobile-home'
import { copy as mobileTandemCopy } from './mobile-tandem'
import { sharedLabels } from './shared'

/**
 * Les libellés qui s'écrivent réellement pareil dans les deux langues.
 *
 * Exemptés fichier par fichier, jamais globalement : `journal` est un vrai
 * homographe côté web (« Journal »), mais côté mobile il vaut « Journal privé »
 * et « Private journal ». Une exemption globale rendrait le mobile aveugle.
 */
const homographes: Record<string, ReadonlySet<string>> = {
  'web.ts': new Set(['tandem', 'journal', 'notifications', 'participant', 'mentor', 'mentorRole']),
  'mobile-home.ts': new Set(['tandem', 'eyebrow']),
  'mobile-tandem.ts': new Set(['tandem']),
  'shared.ts': new Set(['tandem']),
}

const catalogues = {
  'web.ts': webCopy,
  'mobile-home.ts': mobileCopy,
  'mobile-tandem.ts': mobileTandemCopy,
  'shared.ts': sharedLabels,
} as const

describe.each(Object.entries(catalogues))('%s', (name, catalogue) => {
  const french = catalogue.fr as Record<string, string>
  const english = catalogue.en as Record<string, string>

  it('dit la même chose dans les deux langues, clé pour clé', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(french).sort())
  })

  it('n’a aucun texte vide', () => {
    const empty = Object.entries({ ...french, ...english }).filter(([, value]) => !value.trim())
    expect(empty).toEqual([])
  })

  it('n’a aucune clé anglaise restée identique au français', () => {
    // Un copier-coller de la branche `fr` vers la branche `en` laisse un texte
    // français dans l'interface anglaise, et rien ne le signale — ni le typage,
    // ni la relecture. Seuls les homographes recensés ci-dessus sont exemptés.
    const suspects = Object.keys(french).filter(
      (key) => french[key] === english[key] && !homographes[name].has(key),
    )
    expect(suspects).toEqual([])
  })
})

describe('textes réellement partagés', () => {
  it('sont repris tels quels par le web et par le mobile', () => {
    // `shared.ts` n'a de raison d'être que si les deux applications le
    // diffusent sans le réécrire. Si l'une des deux redéfinit une de ces clés
    // avec un autre texte, la mise en commun est rompue en silence.
    for (const locale of ['fr', 'en'] as const) {
      for (const [key, value] of Object.entries(sharedLabels[locale])) {
        expect({ [key]: (webCopy[locale] as Record<string, string>)[key] }).toEqual({ [key]: value })
        expect({ [key]: (mobileCopy[locale] as Record<string, string>)[key] }).toEqual({ [key]: value })
      }
    }
  })
})
