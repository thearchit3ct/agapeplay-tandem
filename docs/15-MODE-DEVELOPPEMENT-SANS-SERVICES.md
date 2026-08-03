# Développement sans services externes

## Objectif

Avancer sur l'expérience utilisateur avant de disposer des comptes Supabase, Stripe, OAuth, Apple Developer, Google Play Console et App Store Connect.

Le prototype actuel est volontairement autonome. Il permet de valider les écrans, les parcours et les règles métier sans créer de vrais comptes ni manipuler de données personnelles réelles.

## Ce qui fonctionne aujourd'hui

- accueil quotidien avec une session courte ;
- progression locale sur le parcours « Repartir avec Jésus » ;
- journal personnel enregistré dans le navigateur ;
- conversation privée de démonstration avec le tandem ;
- signalement et blocage représentés par des actions locales ;
- bascule complète français/anglais sur les contenus du prototype ;
- réinitialisation de la démonstration ;
- construction de production vérifiée par `npm run build`.

## Ce qui est simulé

| Besoin | Mode actuel | Branchement futur |
| --- | --- | --- |
| Identité | Profil fictif Claire | Supabase Auth + email magique + OAuth |
| Données | `localStorage` du navigateur | Supabase Postgres + RLS |
| Journal | Stockage local privé | Table chiffrée/logiquement isolée, règles d'accès strictes |
| Tandem | Une relation et un message local | Relations vérifiées, invitations, blocage et modération serveur |
| Mentors | Profil fictif | Vérification église/AgapePlay + formation obligatoire |
| Paiements | Aucun prix ni paiement | Stripe exclusivement sur le web |
| Notifications | Préférences présentes dans le modèle | Push web/iOS/Android et emails transactionnels |
| Publication mobile | Non branchée | Shell natif partageant le domaine et les contrats |

## Règles de sécurité du prototype

- ne pas saisir de données sensibles ou de vrais échanges de mineurs ;
- ne pas présenter le mode démonstration comme une messagerie réelle ;
- ne pas ajouter de prix ou de parcours de paiement dans l'application ;
- ne pas intégrer d'IA dans le MVP ;
- ne pas déduire de statistiques d'usage à partir des données locales.

## Stratégie de remplacement

Les composants React utilisent aujourd'hui des données mockées et un stockage local. La prochaine étape technique consiste à introduire des interfaces de dépôt partagées, puis deux implémentations :

1. `Mock...Repository` pour continuer à développer hors ligne ;
2. `Supabase...Repository` pour l'environnement connecté.

Les écrans ne devront dépendre d'aucun détail Supabase ou Stripe. Cette séparation permettra de livrer l'interface web, puis le shell mobile, avant de fournir les secrets et comptes de production.

## Informations nécessaires plus tard

- projet Supabase, schéma validé et politiques RLS ;
- domaine web et configuration email ;
- identifiants OAuth Google, Apple et Microsoft ;
- compte Stripe, produits, prix, taxes et webhooks ;
- règles de validation des églises et des mentors ;
- contenus complets FR/EN et droits de traduction ;
- comptes développeur Apple et Google ;
- textes juridiques, politique de confidentialité et procédure de signalement.
