# Intégration du parcours Alpha

## Conclusion

Oui, AgapePlay Tandem peut intégrer Alpha, mais il faut distinguer trois niveaux :

1. **compagnon Alpha** : Tandem organise la relation et le suivi autour d'un Alpha lancé par une église ;
2. **intégration officielle** : Alpha autorise l'utilisation de ses contenus, liens, médias ou interfaces dans Tandem ;
3. **parcours post-Alpha** : Tandem accompagne les participants après la fin d'Alpha.

La recommandation est de commencer par le niveau 1 et le niveau 3, puis de demander un partenariat officiel avant toute intégration de vidéos, guides ou contenus protégés.

## Ce que montre l'état de l'art Alpha

Alpha est conçu par et pour l'Église et met l'accent sur les fondamentaux de la foi, la conversation et le contexte local. La série Alpha Film est présentée comme un parcours de 11 semaines et 16 sessions, avec des ressources d'équipe et de formation accessibles via les espaces Alpha officiels. Les formats, langues et ressources peuvent évoluer : il faut toujours vérifier avec Alpha France ou Alpha International avant d'implémenter un connecteur.

Références officielles :

- [À propos d'Alpha](https://alpha.org/about/)
- [Alpha Film Series](https://gulf.alpha.org/blog/preview/alpha-film-series/)
- [Prévisualisation des thèmes Alpha](https://portugal.alpha.org/previews/)
- [Parcours Alpha France](https://parcoursalpha.fr/)
- [Ressources et inscription via MyAlpha](https://app.alpha.org/fr/)

## Ce que Tandem peut apporter

### Avant Alpha

- inviter un ami ;
- prier pour les invités ;
- préparer une conversation ;
- rejoindre une cohorte Alpha via un lien ou QR code ;
- expliquer les règles de confidentialité et de discussion.

### Entre les sessions

- rappel de la prochaine rencontre ;
- question personnelle facultative ;
- binôme d'accueil ;
- prière partagée ;
- défi relationnel ou pratique non doctrinal ;
- suivi de présence sans exposition de journal intime.

### Après Alpha

- parcours de six semaines `Après Alpha` ;
- mémorisation de passages bibliques ;
- découverte des pratiques spirituelles ;
- intégration à un petit groupe ;
- identification d'une prochaine étape avec un responsable ;
- activité AgapePlay ou soirée de discussion pour maintenir le lien.

## Niveaux d'intégration

### Niveau A — Référencement sans licence de contenu

Tandem stocke uniquement :

- le nom du parcours ;
- le nombre de séances ;
- les dates de cohorte ;
- les liens vers les ressources officielles ;
- les check-ins et échanges propres à Tandem.

Avantage : rapide, faible risque juridique et compatible avec les pratiques officielles.

### Niveau B — Import de métadonnées autorisées

Après accord, Tandem pourrait importer les titres, descriptions, références de séances et liens de ressources via un flux ou un contrat fourni par Alpha.

Avantage : meilleure expérience sans héberger les médias protégés.

### Niveau C — Intégration officielle des médias

Après partenariat et validation technique, Tandem pourrait proposer des vidéos, guides ou formations Alpha dans une interface intégrée.

Conditions à clarifier : licence, territoires, langues, hébergement, téléchargement offline, analytics, attribution, SSO, API, support et retrait des contenus.

## Décision recommandée pour le MVP

- ne pas copier les vidéos, scripts, guides ou visuels Alpha ;
- ne pas utiliser la marque Alpha comme si Tandem était un produit officiel ;
- proposer une fonctionnalité `Lancer un accompagnement Alpha` ;
- laisser l'église enregistrer son Alpha officiel et ses liens ;
- construire le binôme, les check-ins, la prière et le suivi dans Tandem ;
- développer un parcours original `Après Alpha` ;
- contacter Alpha France pour demander le cadre de partenariat.

## Modèle de données à prévoir

```text
external_programs
  id
  provider_name
  provider_program_id
  title
  official_url
  license_status
  locale

cohorts
  id
  community_id
  external_program_id
  starts_at
  ends_at

cohort_sessions
  id
  cohort_id
  ordinal
  scheduled_at
  official_resource_url
  tandem_prompt_id
```

`license_status` doit bloquer l'affichage de médias ou contenus tant qu'un accord explicite n'est pas enregistré.

## Différenciation créée

Tandem ne devient pas un concurrent d'Alpha. Il devient une couche d'accompagnement qui aide une église à transformer un parcours de découverte en relation durable et en prochaine étape concrète.
