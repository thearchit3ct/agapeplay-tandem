# Design humain pour AgapePlay Tandem

## Pourquoi

La première direction visuelle était cohérente mais trop facilement reconnaissable comme une composition générée : palette attendue, cartes symétriques, slogans génériques et décoration décidée avant la situation d'usage.

Pour la suite, le projet adopte une méthode de design humain. Le but n'est pas d'ajouter des imperfections artificielles. Le but est de partir de personnes réelles, de leurs mots et de leurs moments d'usage.

## Ce que la recherche confirme

- IDEO décrit le human-centered design comme une pratique qui commence par l'observation des personnes dans leur contexte, puis passe par l'idéation, le prototypage et l'itération.
- Le GOV.UK Design System demande des preuves d'utilité et d'unicité avant de créer un composant ou un pattern, et relie la publication à la recherche utilisateur.
- Le même système rappelle qu'une image ne doit pas porter seule une information nécessaire à la tâche.
- Les heuristiques de Nielsen insistent sur le langage du monde réel, la visibilité des états, le contrôle laissé à l'utilisateur, la prévention des erreurs et la sobriété.

Sources :

- [IDEO — Human-centered design](https://www.ideo.com/?TB_iframe=true&height=300&width=400)
- [GOV.UK — Contribution criteria](https://design-system.service.gov.uk/community/contribution-criteria/)
- [GOV.UK — Get started](https://design-system.service.gov.uk/get-started/)
- [GOV.UK — Images](https://design-system.service.gov.uk/styles/images/)
- [Nielsen Norman Group — 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)

## Règles AgapePlay

Avant toute nouvelle refonte d'écran, écrire une scène :

```text
Personne : qui utilise l'écran ?
Moment : que se passe-t-il autour d'elle ?
Appareil : comment tient-elle son téléphone ?
Besoin : que doit-elle réussir maintenant ?
Risque : honte, pression, surveillance, confusion ou découragement ?
Preuve : observation, citation, mesure ou hypothèse ?
```

Chaque composant doit ensuite avoir un rôle explicite : orienter, rassurer, permettre une action, montrer un état ou protéger une relation. Un élément purement décoratif doit rester discret.

## Application au produit

Pour AgapePlay Tandem, les prochains écrans devront partir de scènes comme :

- une personne de 16–17 ans qui ouvre l'application dans un lieu partagé et veut garder son journal réellement privé ;
- un adulte qui dispose de trois minutes avant de partir et veut retrouver exactement où reprendre ;
- un mentor qui souhaite encourager sans transformer l'accompagnement en contrôle ;
- un responsable d'église qui doit comprendre un état administratif sans voir le contenu intime.

Ces scènes produisent des choix visuels plus crédibles que des effets “premium” ajoutés à une maquette vide : confidentialité visible, reprise immédiate, états calmes, langage non culpabilisant et hiérarchie adaptée au moment.

## Skill réutilisable

La skill locale `human-centered-product-design` (`/Users/nitch/.codex/skills/human-centered-product-design/SKILL.md`) applique cette méthode à chaque demande de design : brief humain, parcours minimal, direction visuelle située, prototype content-first, test de tâche et audit d'accessibilité.
