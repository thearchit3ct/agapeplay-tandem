/**
 * L'espace église : fonder, rejoindre, organiser — issue #17.
 *
 * La scène, écrite avant l'écran comme le demande le doc 16 :
 *
 *   Personne : un responsable de jeunesse dans une église réelle, souvent
 *              bénévole, qui n'a jamais administré de logiciel.
 *   Moment   : un dimanche soir. Il vient de proposer un parcours à sept
 *              jeunes et veut leur envoyer quelque chose ce soir, pas demain.
 *   Appareil : un téléphone, dans une salle paroissiale — 375 px, et la moitié
 *              des gestes se font debout.
 *   Besoin   : ouvrir une cohorte avec ses dates, obtenir un lien à faire
 *              circuler, et voir qui est entré.
 *   Risque   : croire qu'un lien fonctionne alors que la communauté n'est pas
 *              activée ; envoyer un lien qui fait entrer n'importe qui comme
 *              mentor ; clôturer une cohorte et ne pas savoir si ça a pris.
 *   Preuve   : `supabase/migrations/20260825230000_communaute_et_cohortes.sql`
 *              et `tests/rls/communaute.test.ts`.
 *
 * Trois partis pris, chacun en réponse à un de ces risques :
 *
 * - **les gestes absents sont expliqués, pas cachés.** Une communauté en
 *   attente garde ses boutons d'organisation et perd ceux d'invitation, avec
 *   une phrase qui dit pourquoi. Un bouton grisé sans explication ferait
 *   croire à une panne ;
 * - **un lien dit ce qu'il confère.** « Un lien fait entrer comme
 *   participant » est écrit à côté du bouton qui l'émet, parce que c'est la
 *   borne la plus importante du chantier et qu'elle est invisible autrement ;
 * - **rien n'est annoncé qui n'ait été relu.** Chaque action attend la ligne
 *   revenue de la base avant de changer l'écran (voir `../communaute`), et un
 *   refus silencieux devient un message, pas un succès.
 *
 * Ce que cet écran ne montre pas, et ne montrera pas ici : quoi que ce soit du
 * contenu spirituel de qui que ce soit. Le doc 06 borne le responsable à la
 * « statistique agrégée » et le mentor aux « signaux minimaux si affecté » ;
 * l'espace mentor est l'issue #16. La liste des membres s'arrête au nom, au
 * rôle et à la date d'entrée.
 */
import { useState } from 'react'
import {
  cohorteRecevable, etatCohorte, etatLien, lienDInvitation, placesRestantes, pouvoirsEglise,
} from '@agapeplay/domain'
import type {
  ChurchSnapshot, Cohorte, EtatCohorte, EtatLien, LienInvitation, RefusDAdhesion, RoleEglise,
} from '@agapeplay/domain'
import type { Copy } from '@agapeplay/content/copy/web'
import type { EspaceResponsable, MembreCommunaute } from '../communaute'

const dateCourte = (valeur: string | null) => (valeur === null ? '' : new Date(valeur).toLocaleDateString())

const LIBELLE_COHORTE: Record<EtatCohorte, keyof Copy> = {
  'en-cours': 'cohortOngoing',
  'a-venir': 'cohortUpcoming',
  terminee: 'cohortEnded',
  close: 'cohortClosed',
}

const LIBELLE_ROLE: Record<RoleEglise, keyof Copy> = {
  member: 'memberRole',
  mentor: 'mentorRole',
  leader: 'leaderRole',
  admin: 'adminRole',
}

const LIBELLE_LIEN: Record<EtatLien, keyof Copy> = {
  vivant: 'linkAlive',
  perime: 'linkExpired',
  epuise: 'linkExhausted',
  revoque: 'linkRevoked',
}

/**
 * Les refus de la RPC, dits avec des mots.
 *
 * Le `Record` typé fait échouer `tsc -b` le jour où la migration ajoute un
 * code sans qu'on ait écrit sa phrase — un refus muet laisserait la personne
 * devant un écran qui n'a pas bougé et ne dit rien.
 */
export type RefusAffichable = RefusDAdhesion | 'nom_invalide'

const LIBELLE_REFUS: Record<RefusAffichable, keyof Copy> = {
  invitation_introuvable: 'joinRefusedNotFound',
  invitation_epuisee: 'joinRefusedExhausted',
  communaute_inactive: 'joinRefusedInactive',
  cohorte_close: 'joinRefusedClosed',
  cohorte_terminee: 'joinRefusedEnded',
  adhesion_revoquee: 'joinRefusedRevoked',
  deja_dans_une_communaute: 'joinRefusedAlready',
  // `identite_absente` et `nom_invalide` ne devraient pas remonter jusqu'ici —
  // l'écran n'appelle pas sans session, et le bouton reste inerte sur un nom
  // trop court. Ils ont quand même leur phrase : un refus prévu par la base et
  // muet à l'écran est le pire des deux mondes.
  identite_absente: 'joinRefusedUnknown',
  nom_invalide: 'joinRefusedUnknown',
  inconnu: 'joinRefusedUnknown',
}

export type ActionsCommunaute = {
  onFonder: (nom: string) => void
  onRejoindre: (jetonOuLien: string) => void
  onCreerCohorte: (cohorte: { nom: string; debutLe: string | null; finLe: string | null }) => void
  onCloturerCohorte: (cohorteId: string) => void
  onEmettreLien: (cohorteId: string | null) => void
  onRevoquerLien: (jeton: string) => void
  onNommerMentor: (membreId: string) => void
  onRetirerMembre: (membreId: string) => void
}

export function ChurchView({
  snapshot, espace, origine, maintenant, refus, t, actions,
}: {
  snapshot: ChurchSnapshot
  espace: EspaceResponsable
  /** L'origine du site, pour fabriquer les liens. Injectée : `window` n'a pas sa place dans un composant testable. */
  origine: string
  /** L'instant qui juge les fenêtres et les péremptions, figé par l'appelant le temps d'un rendu. */
  maintenant: Date
  refus: RefusAffichable | null
  t: Copy
  actions: ActionsCommunaute
}) {
  return <section className="content-section workspace-section">
    <div className="section-header">
      <div>
        <span className="section-kicker">{t.churchWorkspace}</span>
        <h2>{snapshot ? snapshot.nom : t.churchWorkspace}</h2>
        <p>{t.aggregateStatsDescription}</p>
      </div>
      <span className="workspace-glyph" aria-hidden="true">⌂</span>
    </div>

    {refus && <p className="invitation-state" role="alert">{t[LIBELLE_REFUS[refus]]}</p>}

    {!snapshot ? <SansCommunaute t={t} actions={actions} /> : <>
      <BandeauStatut snapshot={snapshot} t={t} />
      <div className="workspace-grid">
        <article className="workspace-card">
          <span className="section-kicker">{t.roleLabel}</span>
          <strong>{t[LIBELLE_ROLE[snapshot.role]]}</strong>
          <p>{snapshot.nom}</p>
        </article>
        <article className="workspace-card">
          <span className="section-kicker">{t.churchGroups}</span>
          <strong>{snapshot.groupCount}</strong>
          <p>{t.groupsLabel}</p>
        </article>
      </div>

      {pouvoirsEglise(snapshot.role, snapshot.statut).organiser && <EspaceDuResponsable
        snapshot={snapshot} espace={espace} origine={origine} maintenant={maintenant} t={t} actions={actions}
      />}
    </>}
  </section>
}

/**
 * Les deux portes d'entrée, côte à côte.
 *
 * Elles ne sont pas symétriques et l'écran ne prétend pas qu'elles le soient :
 * rejoindre est le geste de presque tout le monde, fonder est celui de trois
 * personnes par église. Rejoindre passe donc en premier.
 */
function SansCommunaute({ t, actions }: { t: Copy; actions: ActionsCommunaute }) {
  const [jeton, setJeton] = useState('')
  const [nom, setNom] = useState('')

  return <div className="workspace-grid">
    <article className="workspace-card">
      <span className="section-kicker">{t.churchJoin}</span>
      <p>{t.churchJoinDescription}</p>
      <label htmlFor="communaute-jeton">{t.churchJoin}</label>
      <input id="communaute-jeton" value={jeton} onChange={(event) => setJeton(event.target.value)} autoComplete="off" />
      <button
        className="primary-button compact"
        disabled={jeton.trim() === ''}
        onClick={() => actions.onRejoindre(jeton.trim())}
      >{t.churchJoinAction}<span aria-hidden="true">→</span></button>
    </article>

    <article className="workspace-card">
      <span className="section-kicker">{t.churchFound}</span>
      <p>{t.churchFoundDescription}</p>
      <label htmlFor="communaute-nom">{t.churchName}</label>
      <input id="communaute-nom" value={nom} onChange={(event) => setNom(event.target.value)} autoComplete="organization" />
      {/* Le bouton reste inerte tant que le nom est trop court : la base
          refuse en dessous de deux caractères, et découvrir ce refus après le
          clic n'apprendrait rien à personne. */}
      <button
        className="primary-button compact"
        disabled={nom.trim().length < 2}
        onClick={() => actions.onFonder(nom.trim())}
      >{t.churchFoundAction}<span aria-hidden="true">→</span></button>
    </article>
  </div>
}

/** Ce que le statut de la communauté change, dit une fois, en haut. */
function BandeauStatut({ snapshot, t }: { snapshot: NonNullable<ChurchSnapshot>; t: Copy }) {
  if (snapshot.statut === 'active') return null
  return <p className="invitation-state" role="status">
    {snapshot.statut === 'pending' ? t.churchPendingBanner : t.churchSuspendedBanner}
  </p>
}

function EspaceDuResponsable({
  snapshot, espace, origine, maintenant, t, actions,
}: {
  snapshot: NonNullable<ChurchSnapshot>
  espace: EspaceResponsable
  origine: string
  maintenant: Date
  t: Copy
  actions: ActionsCommunaute
}) {
  const pouvoirs = pouvoirsEglise(snapshot.role, snapshot.statut)
  const [nom, setNom] = useState('')
  const [debut, setDebut] = useState('')
  const [fin, setFin] = useState('')
  const [copie, setCopie] = useState('')

  const copier = (jeton: string) => {
    void navigator.clipboard.writeText(lienDInvitation(origine, jeton))
    setCopie(jeton)
  }

  return <>
    <section className="invitations-section">
      <span className="section-kicker">{t.cohorts}</span>
      <div className="invitation-list">
        <div className="invitation-card">
          <label htmlFor="cohorte-nom">{t.cohortName}</label>
          <input id="cohorte-nom" value={nom} onChange={(event) => setNom(event.target.value)} />
          <label htmlFor="cohorte-debut">{t.cohortStart}</label>
          <input id="cohorte-debut" type="date" value={debut} onChange={(event) => setDebut(event.target.value)} />
          <label htmlFor="cohorte-fin">{t.cohortEnd}</label>
          <input id="cohorte-fin" type="date" value={fin} onChange={(event) => setFin(event.target.value)} />
          <button
            className="primary-button compact"
            disabled={nom.trim() === ''}
            onClick={() => {
              // Un champ de date vide vaut « pas de date », pas « le 1er
              // janvier 1970 » : la colonne est nullable des deux côtés, et un
              // groupe permanent est un cas normal, pas un oubli.
              actions.onCreerCohorte({ nom: nom.trim(), debutLe: debut || null, finLe: fin || null })
              setNom(''); setDebut(''); setFin('')
            }}
          >{t.cohortCreate}<span aria-hidden="true">→</span></button>
        </div>

        {espace.cohortes.length === 0
          ? <p className="invitation-absent">{t.cohortsEmpty}</p>
          : espace.cohortes.map((cohorte) => (
            <CarteCohorte
              key={cohorte.id} cohorte={cohorte} maintenant={maintenant}
              peutInviter={pouvoirs.inviter} t={t} actions={actions}
            />
          ))}
      </div>
    </section>

    <section className="invitations-section">
      <span className="section-kicker">{t.churchLinks}</span>
      <p className="invitation-lead">{t.linkOnlyMember}</p>
      {pouvoirs.inviter && <button className="small-button" onClick={() => actions.onEmettreLien(null)}>{t.newLink}</button>}
      <div className="invitation-list">
        {espace.liens.map((lien) => (
          <CarteLien
            key={lien.jeton} lien={lien} maintenant={maintenant} copie={copie === lien.jeton}
            t={t} onCopier={() => copier(lien.jeton)} onRevoquer={() => actions.onRevoquerLien(lien.jeton)}
          />
        ))}
      </div>
      <p className="invitation-note">{t.noQrYet}</p>
    </section>

    <section className="invitations-section">
      <span className="section-kicker">{t.churchMembers}</span>
      <div className="invitation-list">
        {espace.membres.map((membre) => (
          <CarteMembre key={membre.id} membre={membre} t={t} actions={actions} />
        ))}
      </div>
    </section>
  </>
}

function CarteCohorte({
  cohorte, maintenant, peutInviter, t, actions,
}: {
  cohorte: Cohorte
  maintenant: Date
  peutInviter: boolean
  t: Copy
  actions: ActionsCommunaute
}) {
  const etat = etatCohorte(cohorte, maintenant)
  const fenetre = cohorte.debutLe === null && cohorte.finLe === null
    ? t.cohortNoDates
    : `${dateCourte(cohorte.debutLe)} → ${dateCourte(cohorte.finLe)}`

  return <div className="invitation-card">
    <div className="invitation-card-top">
      <span className="status-chip">{t[LIBELLE_COHORTE[etat]]}</span>
      <span className="invitation-dates">{fenetre}</span>
    </div>
    <strong className="invitation-address">{cohorte.nom}</strong>
    {/* Le lien n'est proposé que là où la base l'accepterait : une cohorte
        close ou terminée refuse aussi bien l'émission du lien que l'entrée. */}
    {peutInviter && cohorteRecevable(etat) && <button
      className="outline-button" onClick={() => actions.onEmettreLien(cohorte.id)}
    >{t.newLink}</button>}
    {cohorte.statut === 'active' && <button
      className="outline-button" onClick={() => actions.onCloturerCohorte(cohorte.id)}
    >{t.cohortClose}</button>}
  </div>
}

function CarteLien({
  lien, maintenant, copie, t, onCopier, onRevoquer,
}: {
  lien: LienInvitation
  maintenant: Date
  copie: boolean
  t: Copy
  onCopier: () => void
  onRevoquer: () => void
}) {
  const etat = etatLien(lien, maintenant)
  return <div className="invitation-card">
    <div className="invitation-card-top">
      <span className="status-chip">{t[LIBELLE_LIEN[etat]]}</span>
      <span className="invitation-dates">{placesRestantes(lien)} {t.placesLeft}</span>
    </div>
    {/* Le jeton n'est montré que tant qu'il sert. Un lien mort affiché en clair
        n'est plus une information, c'est une chose à recopier par erreur. */}
    {etat === 'vivant' && <>
      <button className="outline-button" onClick={onCopier}>{copie ? t.linkCopied : t.copyLink}</button>
      <button className="outline-button" onClick={onRevoquer}>{t.revokeLink}</button>
      <p className="invitation-dates">{t.invitationsExpiresOn} {dateCourte(lien.expireLe)}</p>
    </>}
  </div>
}

function CarteMembre({ membre, t, actions }: { membre: MembreCommunaute; t: Copy; actions: ActionsCommunaute }) {
  const roles = { member: t.memberRole, mentor: t.mentorRole, leader: t.leaderRole, admin: t.adminRole } as const
  return <div className="invitation-card">
    <div className="invitation-card-top">
      <span className="status-chip">{roles[membre.role]}</span>
      <span className="invitation-dates">{dateCourte(membre.entreLe)}</span>
    </div>
    {/* Le nom peut être vide : `profiles.display_name` a « » pour défaut, et un
        compte qui n'a jamais réglé son nom en garde un. On affiche alors le
        rôle seul plutôt qu'une ligne muette. */}
    <strong className="invitation-address">{membre.nom || roles[membre.role]}</strong>
    {membre.statut === 'active' && membre.role === 'member' && <button
      className="outline-button" onClick={() => actions.onNommerMentor(membre.id)}
    >{t.makeMentor}</button>}
    {membre.statut === 'active' && membre.role !== 'leader' && <button
      className="outline-button" onClick={() => actions.onRetirerMembre(membre.id)}
    >{t.revokeMember}</button>}
  </div>
}
