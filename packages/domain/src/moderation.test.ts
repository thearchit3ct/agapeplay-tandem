/**
 * Ce que ces tests protègent : qu'un dossier de modération dise ce que la base
 * autorise, ni plus ni moins, et que l'ordre de la pile ne noie pas ce qui
 * attend une décision.
 *
 * Deux gardes comptent plus que les autres, et elles sont ici parce qu'une
 * relecture ne les attrape pas :
 *
 * - **aucun identifiant de personne ne sort d'`assemblerDossiers`**. La
 *   comparaison `senderId === reporterId` entre, une origine sort. Le jour où
 *   quelqu'un ajoutera `senderId` au dossier « pour afficher qui a écrit », le
 *   test le dira — c'est exactement le mode d'échec que la vue
 *   `tandem_contexte_signale` prévient en excluant `blocked_by`.
 * - **une absence reste une absence**. Un signalement sans message précis, un
 *   tandem que la vue ne rend pas : l'écran doit pouvoir le dire, donc le
 *   dossier doit porter `null` plutôt qu'un objet vide.
 */
import { describe, expect, it } from 'vitest'
import { assemblerDossiers, transitionsPossibles } from './moderation'
import type { ContexteSignale, MessageSignale, Signalement } from './moderation'

const signalante = '11111111-1111-4111-8111-111111111111'
const autre = '22222222-2222-4222-8222-222222222222'

const signalement = (surcharge: Partial<Signalement> = {}): Signalement => ({
  id: 'r-1',
  tandemId: 't-1',
  messageId: 'm-1',
  reporterId: signalante,
  reason: 'Des messages qui insistent après un refus.',
  status: 'open',
  createdAt: '2026-08-20T10:00:00.000Z',
  resolvedAt: null,
  ...surcharge,
})

const contexte = (surcharge: Partial<ContexteSignale> = {}): ContexteSignale => ({
  tandemId: 't-1',
  status: 'active',
  createdAt: '2026-08-01T09:00:00.000Z',
  blockedAt: null,
  endedAt: null,
  ...surcharge,
})

const message = (surcharge: Partial<MessageSignale> = {}): MessageSignale => ({
  id: 'm-1',
  senderId: autre,
  body: 'le message signalé',
  createdAt: '2026-08-20T09:58:00.000Z',
  ...surcharge,
})

describe('transitionsPossibles', () => {
  it('propose la prise en charge et la clôture sur un signalement neuf', () => {
    expect(transitionsPossibles('open')).toEqual(['reviewing', 'resolved'])
  })

  it('ne repropose jamais le statut courant', () => {
    // Le trigger d'audit compare avec `is distinct from` : un changement vers
    // le même statut n'écrit aucune ligne. Un bouton qui l'offrirait mentirait
    // sur son effet et sur la trace qu'il prétend laisser.
    for (const statut of ['open', 'reviewing', 'resolved'] as const) {
      expect(transitionsPossibles(statut)).not.toContain(statut)
    }
  })

  it('laisse rouvrir un dossier clos', () => {
    // Le trigger efface `resolved_at` quand on quitte `resolved` : la marche
    // arrière est prévue par le schéma, l'écran n'a pas à la retenir.
    expect(transitionsPossibles('resolved')).toEqual(['reviewing'])
  })
})

describe('assemblerDossiers', () => {
  it('rattache à chaque signalement son contexte et son message', () => {
    const [dossier] = assemblerDossiers([signalement()], [contexte()], [message()])
    expect(dossier.contexte?.status).toBe('active')
    expect(dossier.message?.body).toBe('le message signalé')
  })

  it('dit d’où vient le message sans livrer d’identifiant', () => {
    const [ecritParLAutre] = assemblerDossiers([signalement()], [], [message()])
    expect(ecritParLAutre.message?.origine).toBe('autre')

    const [ecritParElle] = assemblerDossiers([signalement()], [], [message({ senderId: signalante })])
    expect(ecritParElle.message?.origine).toBe('signalant')

    // La garde qui compte : l'objet rendu ne contient aucun uuid de personne.
    expect(Object.keys(ecritParElle.message ?? {}).sort()).toEqual(['body', 'createdAt', 'origine'])
  })

  it('rend null plutôt que d’inventer quand le message manque', () => {
    // `tandem_reports.message_id` est nullable — un signalement peut viser la
    // relation et non un message — et vaut aussi NULL après effacement du
    // message (`on delete set null`). Aucun repli par `tandem_id` n'est
    // possible : aucune politique n'ouvre les autres messages du tandem.
    const [sansMessage] = assemblerDossiers([signalement({ messageId: null })], [contexte()], [])
    expect(sansMessage.message).toBeNull()

    const [messageAbsent] = assemblerDossiers([signalement()], [contexte()], [])
    expect(messageAbsent.message).toBeNull()
  })

  it('rend null quand la vue de contexte ne connaît pas le tandem', () => {
    const [dossier] = assemblerDossiers([signalement()], [], [message()])
    expect(dossier.contexte).toBeNull()
  })

  it('met devant ce qui attend une décision, et le plus récent d’abord', () => {
    const dossiers = assemblerDossiers(
      [
        signalement({ id: 'clos', status: 'resolved', createdAt: '2026-08-23T10:00:00.000Z' }),
        signalement({ id: 'ancien-ouvert', status: 'open', createdAt: '2026-08-18T10:00:00.000Z' }),
        signalement({ id: 'en-cours', status: 'reviewing', createdAt: '2026-08-22T10:00:00.000Z' }),
        signalement({ id: 'recent-ouvert', status: 'open', createdAt: '2026-08-21T10:00:00.000Z' }),
      ],
      [],
      [],
    )
    expect(dossiers.map((dossier) => dossier.signalement.id))
      .toEqual(['recent-ouvert', 'ancien-ouvert', 'en-cours', 'clos'])
  })

  it('ne réordonne pas la liste qu’on lui passe', () => {
    // L'écran garde la réponse de Supabase dans un état React : la trier sur
    // place ferait muter une valeur que React croit inchangée.
    const entree = [signalement({ id: 'a', status: 'resolved' }), signalement({ id: 'b', status: 'open' })]
    assemblerDossiers(entree, [], [])
    expect(entree.map((ligne) => ligne.id)).toEqual(['a', 'b'])
  })
})
