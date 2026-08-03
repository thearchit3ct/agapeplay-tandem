# Métriques, instrumentation et expérimentation

## Principe

Les métriques servent à comprendre si l'application aide les personnes à avancer, pas à maximiser le temps d'écran.

## North Star

**Semaines actives accompagnées** : une semaine durant laquelle un participant réalise une action de parcours et a au moins un échange confirmé avec son binôme.

## Funnel MVP

1. Visite de la présentation.
2. Création de compte.
3. Choix d'un parcours.
4. Première séance terminée.
5. Binôme invité.
6. Binôme accepté.
7. Premier partage.
8. Première semaine accompagnée.
9. Quatrième semaine accompagnée.
10. Parcours terminé.

## Événements recommandés

Les événements ne doivent jamais contenir le texte d'un journal, le contenu d'un message ou une référence permettant de déduire une situation intime.

| Événement | Propriétés autorisées |
|---|---|
| `account_created` | locale, platform |
| `journey_started` | journey_id, source |
| `session_completed` | journey_id, week, day, duration_bucket |
| `partner_invited` | journey_id, invitation_type |
| `partner_accepted` | journey_id |
| `share_created` | journey_id, share_type |
| `weekly_checkin_completed` | journey_id, week |
| `help_requested` | source_role, category |
| `report_created` | category, channel_type |
| `journey_paused` | reason_category |

## Mesures de santé du produit

- taux de première séance terminée ;
- taux d'acceptation d'invitation ;
- semaines actives accompagnées par participant ;
- rétention à 7, 28 et 42 jours ;
- délai médian avant premier échange ;
- taux de reprise après absence ;
- demandes d'aide résolues dans le délai cible ;
- taux d'export et de suppression réussis ;
- incidents de sécurité par mille utilisateurs ;
- charge hebdomadaire moyenne d'un mentor.

## Expériences à privilégier

- invitation du binôme pendant l'onboarding ou après la première séance ;
- rappel quotidien fixe ou fenêtre choisie ;
- question de partage libre ou question à choix guidé ;
- parcours de quatre ou six semaines ;
- rappel de reprise neutre ou invitation à demander de l'aide.

## Garde-fous

- aucune expérimentation ne modifie la visibilité d'un journal sans consentement ;
- aucun test ne récompense une fréquence malsaine ;
- arrêt automatique si un indicateur d'aide demandée ou de signalement augmente ;
- revue humaine de toute expérience portant sur mineurs, crise ou données sensibles.
