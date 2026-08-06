# AgapePlay Tandem

AgapePlay Tandem est une application de discipulat chrétien fondée sur l'accompagnement humain.

> Grandir dans la foi en 10 minutes par jour, accompagné par une personne de confiance.

Le projet vise à aider les chrétiens à construire une vie spirituelle régulière grâce à des parcours courts, des défis concrets et un binôme de croissance.

## Vision

La plupart des applications chrétiennes proposent surtout du contenu. AgapePlay Tandem ajoute la dimension qui manque souvent : une relation d'accompagnement, des échanges réguliers et des passages à l'action dans la vie quotidienne.

## MVP

La première version se concentrera sur un parcours de six semaines : **Repartir avec Jésus**.

- création d'un profil spirituel simple ;
- invitation d'un binôme ou attribution par une église ;
- défi quotidien de moins de dix minutes ;
- lecture biblique, prière, réflexion et mise en pratique ;
- journal personnel ;
- check-in hebdomadaire ;
- discussion privée entre binôme ;
- signaux minimaux pour le mentor et statistiques anonymisées pour le responsable d'église ;
- notifications douces, sans pression ni classement public.

## Parcours initial

1. Où est-ce que j'en suis ?
2. Comprendre l'Évangile
3. Développer une vie de prière
4. Lire et mémoriser la Bible
5. Grandir avec les autres
6. Trouver sa place et servir

## Principes

- **Relation avant performance** : la progression ne se résume pas à une série de jours consécutifs.
- **Action avant accumulation** : chaque contenu doit conduire à une pratique concrète.
- **Sécurité et confiance** : les échanges privés restent protégés et les outils d'église respectent les rôles.
- **Foi et responsabilité** : l'application accompagne la vie spirituelle sans se substituer à une église, un pasteur ou un professionnel de santé.
- **Simplicité** : une expérience courte, claire et accessible sur mobile.

## Statut

Le projet dispose d'une application web React/Vite connectable à Supabase et
d'un socle mobile Expo/React Native. Le participant peut consulter un parcours,
terminer une séance, tenir un journal privé, inviter un tandem et échanger dans
une conversation protégée. Le mobile ajoute l'authentification par lien
magique, la progression hors ligne, les rappels locaux et les deep links
d'invitation.

Les tableaux de bord mentor/église, le contenu complet du parcours, les
notifications push distantes, les builds stores, Stripe, la conformité et la
modération opérationnelle restent à finaliser.

## Développement local

Prérequis : Node.js 20+ et npm.

```bash
npm install
npm run dev
npm run build
npm run mobile:typecheck
npm run mobile:export
```

L'application est ensuite disponible sur [http://localhost:5173](http://localhost:5173). Le bandeau « Mode démonstration » rappelle que les données sont conservées uniquement dans le `localStorage` du navigateur.

Voir [`docs/15-MODE-DEVELOPPEMENT-SANS-SERVICES.md`](docs/15-MODE-DEVELOPPEMENT-SANS-SERVICES.md) pour la frontière entre ce prototype et les intégrations à venir.

Voir [`docs/PRODUCT-VISION.md`](docs/PRODUCT-VISION.md) pour le périmètre détaillé.

Voir [`docs/21-ETAT-DU-PROJET-2026-08-06.md`](docs/21-ETAT-DU-PROJET-2026-08-06.md) pour l'état réel du projet, ce qui reste à faire, et les pièges déjà mesurés.

## Documentation

- [Stratégie produit](docs/00-STRATEGIE.md)
- [État de l'art](docs/01-ETAT-DE-L-ART.md)
- [Positionnement et différenciation](docs/02-POSITIONNEMENT.md)
- [Personas et parcours](docs/03-PERSONAS-PARCOURS.md)
- [Spécification fonctionnelle](docs/04-SPECIFICATION-FONCTIONNELLE.md)
- [Architecture web et mobile](docs/05-ARCHITECTURE-WEB-MOBILE.md)
- [Données, sécurité et confiance](docs/06-DONNEES-SECURITE-CONFIANCE.md)
- [Contenu et gouvernance éditoriale](docs/07-CONTENU-EDITORIAL.md)
- [Métriques et expérimentation](docs/08-METRIQUES-EXPERIMENTS.md)
- [Roadmap](docs/09-ROADMAP.md)
- [Plan de recherche](docs/10-PLAN-DE-RECHERCHE.md)
- [Carte du backlog GitHub](docs/11-ISSUE-MAP.md)
- [Décisions d'architecture](docs/12-DECISIONS-ARCHITECTURE.md)
- [Intégration du parcours Alpha](docs/13-INTEGRATION-ALPHA.md)
- [Décisions produit du cadrage](docs/14-DECISIONS-PRODUIT-2026-08-04.md)
- [État complet du projet](docs/19-ETAT-COMPLET-DU-PROJET-2026-08-05.md)

## Contribuer

Les retours sur les parcours, l'expérience utilisateur, la sécurité et les usages en église sont les bienvenus. Consultez [`CONTRIBUTING.md`](CONTRIBUTING.md) avant d'ouvrir une issue ou une pull request.

Pour les signalements sensibles, consultez [`SECURITY.md`](SECURITY.md). Les échanges communautaires suivent [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Licence

La licence du code sera définie avant la première version exploitable. Les contenus bibliques et pédagogiques pourront suivre des conditions distinctes.
