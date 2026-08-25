/**
 * La politique de confidentialité, servie sans compte — issue #23.
 *
 * Pourquoi une page à part, et non un dialogue de plus dans l'application :
 * Google Play exige une **URL publique** qu'un examinateur ouvre sans compte,
 * et un adolescent qui hésite à s'inscrire doit pouvoir lire ce qu'on garde de
 * lui avant de donner son adresse. Un dialogue derrière l'écran de connexion
 * répondrait à la lettre du critère et à rien de ce qu'il protège.
 *
 * ---------------------------------------------------------------------------
 * Pourquoi le branchement se fait dans `main.tsx` et non dans `App`
 * ---------------------------------------------------------------------------
 *
 * `App()` ouvre sur `useState(() => loadState())`, puis enchaîne le bootstrap
 * Supabase, la file hors-ligne et la lecture du consentement de mesure. Un
 * `return` anticipé **dans** `App` n'empêcherait rien de tout cela : au moment
 * où il s'exécute, `loadState()` a déjà écrit dans `localStorage`. Une page qui
 * annonce « rien n'est posé sur ton appareil » et pose un état de démonstration
 * en arrivant serait fausse dès sa première phrase. Le composant ci-dessous n'a
 * donc aucun effet, ne lit ni n'écrit le stockage, et ne construit aucun client
 * Supabase — la page ne fait, hors les polices, aucune requête réseau.
 *
 * ---------------------------------------------------------------------------
 * La langue
 * ---------------------------------------------------------------------------
 *
 * Sans compte, il n'y a pas de préférence à lire : la langue vient de celle du
 * navigateur, et un sélecteur la change pour la visite. Ce choix n'est pas
 * retenu, pour la raison ci-dessus — retenir un choix demanderait d'écrire, et
 * une seule URL doit rendre les deux versions à qui la reçoit.
 */
import { useState } from 'react'
import { copy } from '@agapeplay/content/copy/web'
import type { Locale } from '@agapeplay/domain'

/**
 * La route publique, en un seul endroit.
 *
 * Le chemin est français parce que le produit l'est, et il n'a pas d'alias :
 * une seule adresse se colle dans un formulaire de store, se met dans un pied
 * de page et se vérifie. La barre finale est tolérée — c'est la faute de frappe
 * la plus banale, et un 404 sur la politique de confidentialité est le pire
 * endroit où la punir.
 */
export const ROUTE_CONFIDENTIALITE = '/confidentialite'

export const estRouteConfidentialite = (pathname: string): boolean =>
  pathname === ROUTE_CONFIDENTIALITE || pathname === `${ROUTE_CONFIDENTIALITE}/`

const langueDuNavigateur = (): Locale =>
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr'

/**
 * Le titre de l'onglet, posé par `main.tsx` avant le montage.
 *
 * Il compte plus ici qu'ailleurs : cette adresse se met en favori, se colle
 * dans un formulaire de store et s'ouvre à côté de vingt autres onglets. Un
 * onglet nommé « AgapePlay Tandem » comme le reste du site ne dirait pas ce
 * qu'on est venu lire.
 */
export const titreDeLaPage = (): string =>
  `${copy[langueDuNavigateur()].privacyPageTitle} · AgapePlay Tandem`

/** Un repère à compléter par un humain, signalé comme tel plutôt que comblé. */
function RepereACompleter({ texte }: { texte: string }) {
  return <p className="legal-todo">{texte}</p>
}

export function PolitiqueDeConfidentialite() {
  const [locale, setLocale] = useState<Locale>(langueDuNavigateur)
  const t = copy[locale]

  return <main className="legal-page" lang={locale}>
    <div className="legal-sheet">
      <header className="legal-head">
        {/* Le bloc de marque est refait ici plutôt qu'emprunté à
            `.brand-lockup` : celui de l'application appartient à la barre
            latérale, que deux points de rupture escamotent puis masquent —
            sous 375 px, la marque disparaissait de cette page. */}
        <div className="legal-brand">
          <span className="legal-mark" aria-hidden="true">A</span>
          <span><strong>AgapePlay</strong> Tandem</span>
        </div>
        <div className="locale-switcher" aria-label={t.language}>
          <button className={locale === 'fr' ? 'active' : ''} onClick={() => setLocale('fr')}>FR</button>
          <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
        </div>
      </header>

      <h1>{t.privacyPageTitle}</h1>
      <p className="legal-date">{t.privacyPageUpdated}</p>
      <p className="legal-lead">{t.privacyPageLead}</p>

      <section className="legal-summary" aria-labelledby="legal-summary-title">
        <h2 id="legal-summary-title">{t.privacySummaryTitle}</h2>
        <ul>
          <li>{t.privacySummary1}</li>
          <li>{t.privacySummary2}</li>
          <li>{t.privacySummary3}</li>
          <li>{t.privacySummary4}</li>
          <li>{t.privacySummary5}</li>
        </ul>
      </section>

      <section>
        <h2>{t.privacyWhoTitle}</h2>
        <p>{t.privacyWhoBody}</p>
        <RepereACompleter texte={t.privacyWhoTodo} />
      </section>

      <section>
        <h2>{t.privacyDataTitle}</h2>
        <p>{t.privacyDataIntro}</p>
        <ul>
          <li>{t.privacyDataAccount}</li>
          <li>{t.privacyDataJournal}</li>
          <li>{t.privacyDataMessages}</li>
          <li>{t.privacyDataProgress}</li>
          <li>{t.privacyDataWeekly}</li>
          <li>{t.privacyDataCommunity}</li>
          <li>{t.privacyDataMentor}</li>
          <li>{t.privacyDataReports}</li>
          <li>{t.privacyDataInvites}</li>
          <li>{t.privacyDataMeasure}</li>
          <li>{t.privacyDataDevice}</li>
        </ul>
      </section>

      <section>
        <h2>{t.privacySensitiveTitle}</h2>
        <p>{t.privacySensitiveBody}</p>
      </section>

      <section>
        <h2>{t.privacyWhoReadsTitle}</h2>
        <ul>
          <li>{t.privacyWhoReadsJournal}</li>
          <li>{t.privacyWhoReadsMessages}</li>
          <li>{t.privacyWhoReadsMentor}</li>
          <li>{t.privacyWhoReadsChurch}</li>
          <li>{t.privacyWhoReadsModeration}</li>
          <li>{t.privacyWhoReadsUs}</li>
        </ul>
      </section>

      <section>
        <h2>{t.privacyNeverTitle}</h2>
        <ul>
          <li>{t.privacyNever1}</li>
          <li>{t.privacyNever2}</li>
          <li>{t.privacyNever3}</li>
          <li>{t.privacyNever4}</li>
          <li>{t.privacyNever5}</li>
        </ul>
      </section>

      <section>
        <h2>{t.privacyMeasureTitle}</h2>
        <p>{t.privacyMeasureIntro}</p>
        <p>{t.privacyMeasureAnonymous}</p>
        <p>{t.privacyMeasureHonest}</p>
        <p>{t.privacyMeasureOptOut}</p>
      </section>

      <section>
        <h2>{t.privacyThirdTitle}</h2>
        <p>{t.privacyThirdHosting}</p>
        <p>{t.privacyThirdFonts}</p>
        <p>{t.privacyThirdOauth}</p>
        <RepereACompleter texte={t.privacyThirdTodo} />
      </section>

      <section>
        <h2>{t.privacyKeepTitle}</h2>
        <ul>
          <li>{t.privacyKeepAccount}</li>
          <li>{t.privacyKeepInvites}</li>
          <li>{t.privacyKeepMeasure}</li>
          <li>{t.privacyKeepReports}</li>
        </ul>
        <p>{t.privacyKeepDebt}</p>
      </section>

      <section>
        <h2>{t.privacyDeleteTitle}</h2>
        <p>{t.privacyDeleteExport}</p>
        <p>{t.privacyDeletePath}</p>
        <p>{t.privacyDeleteGoes}</p>
        <p>{t.privacyDeleteStays}</p>
        <p>{t.privacyDeleteReturn}</p>
        <p>{t.privacyDeleteNoAccess}</p>
        <p>{t.privacyDeleteMobile}</p>
      </section>

      <section>
        <h2>{t.privacyAgeTitle}</h2>
        <p>{t.privacyAgeBody}</p>
      </section>

      <section>
        <h2>{t.privacyRightsTitle}</h2>
        <p>{t.privacyRightsBody}</p>
        <p>{t.privacyRightsMinor}</p>
        <p>{t.privacyRightsCnil}</p>
      </section>

      {/* L'urgence est placée avant le contact, et non en note de bas de page :
          quelqu'un qui lit cette page en cherchant à qui parler doit tomber sur
          les numéros qui répondent vraiment avant sur l'adresse qui répond en
          un mois. Mêmes numéros que l'écran de signalement et le doc 22. */}
      <section className="legal-emergency">
        <h2>{t.privacyEmergencyTitle}</h2>
        <p>{t.privacyEmergencyBody}</p>
      </section>

      <section>
        <h2>{t.privacyChangesTitle}</h2>
        <p>{t.privacyChangesBody}</p>
      </section>

      <section>
        <h2>{t.privacyContactTitle}</h2>
        <p>{t.privacyContactBody}</p>
        <RepereACompleter texte={t.privacyContactTodo} />
      </section>

      <footer className="legal-foot">
        <a href="/">{t.privacyPageBack}</a>
      </footer>
    </div>
  </main>
}
