# Mesure et vie privée

*Écrit le 25 août 2026 pour l'issue #20. Ce document dit ce que le produit
mesure, comment, et ce qu'il refuse de savoir. Il complète le doc 08, qui
définit **quoi** mesurer, et le doc 06, qui pose la politique de données. En cas
de contradiction, c'est le doc 06 qui l'emporte : la mesure est au service du
produit, jamais l'inverse.*

---

## Le problème, tel qu'il se pose

Le produit met en relation des adolescents de 16-17 ans et des mentors adultes
autour de journaux intimes et de conversations privées. Il promet la discrétion,
et il tient cette promesse jusqu'ici : le journal est fermé par la RLS, la
conversation n'est lisible que de ses deux participants, la modération ne voit
qu'un message précis attaché à un signalement précis.

Il faut malgré tout savoir si l'application aide. Le doc 08 le dit en une
phrase : « les métriques servent à comprendre si l'application aide les
personnes à avancer, pas à maximiser le temps d'écran ». Sans mesure, on ne
saura pas que huit personnes sur dix abandonnent avant d'inviter leur binôme, et
on continuera de sortir des fonctionnalités au jugé.

Toute la difficulté tient dans un seul mot du critère de l'issue #20 :
**respectueuses**. La solution facile — un identifiant de compte dans chaque
événement — donnerait une mesure parfaite et un fichier d'activité nominatif
sur des mineurs. Ce document décrit le chemin retenu et ce qu'il coûte.

---

## Les cinq décisions

### 1. `anonymous_id` : d'où il vient, et ce qu'il ne permet pas

L'identifiant naît **sur l'appareil**, d'un tirage aléatoire
(`crypto.randomUUID()` sur le web, un équivalent sur mobile quand Hermes ne la
fournit pas). Il vit dans le stockage local, à côté de l'état de l'application.

Ce qu'il **n'est pas**, et la règle est dure : il n'est jamais l'`auth.uid()` du
compte, ni une valeur qui en dérive. Aucun hachage d'adresse e-mail, aucune
graine tirée de l'identifiant de session. Cette règle n'est pas seulement écrite
ici : un trigger la refuse en base (`mesure_identifiant_non_relie`) dans son cas
littéral, et le domaine partagé la refuse plus tôt, sur la forme.

Ce que cet identifiant permet : recoudre les gestes d'un même appareil pour
lire un entonnoir. Ce qu'il ne permet **pas** : retrouver une personne, relier
deux appareils, savoir si un événement vient d'un participant ou d'un mentor,
recouper avec quoi que ce soit d'autre — aucune table ne le contient hors
`analytics_events`.

**Ce que ça coûte, et qu'on assume.** Le funnel compte des *appareils*, jamais
des personnes. Quelqu'un qui ouvre l'application sur son téléphone puis sur
l'ordinateur familial compte deux fois ; quelqu'un qui nettoie son navigateur
repart à zéro. Les taux de passage entre étapes en sont légèrement pessimistes.
Rendre ces chiffres exacts demanderait exactement la jointure qu'on refuse.

**Rotation : treize mois.** Passé ce délai, l'identifiant est retiré et un autre
est tiré. Le plafond ne coûte rien à la mesure — l'horizon le plus long du
doc 08 est la rétention à 42 jours, et la « quatrième semaine accompagnée » du
funnel en demande une trentaine — et il empêche la mesure de devenir un suivi
durable. Une rotation plus courte, à trente jours par exemple, couperait les
cohortes en deux et ferait disparaître précisément ce que l'issue demande de
voir : ce qui se passe après la quatrième semaine.

### 2. Le consentement

**Le modèle retenu : information claire et interrupteur, sans bannière.**

Il n'y a pas de bannière de cookies parce qu'il n'y a rien à faire accepter à un
tiers : le site n'appelle aucun service extérieur, aucune régie, aucun SDK
d'analyse. Une bannière ici ne protégerait personne ; elle apprendrait
seulement à cliquer « J'accepte » sans lire, ce qui est le contraire du service
qu'on doit rendre à quelqu'un de seize ans.

Le dispositif est conçu pour tenir les conditions d'une mesure d'audience
strictement interne, et ces conditions sont vérifiables une par une :

- **aucun tiers** : la seule destination est la base du produit ;
- **aucun profilage** : les événements ne servent qu'à des comptages agrégés, et
  rien dans le produit ne lit un événement pour changer ce qu'une personne voit ;
- **aucune donnée reliable** : voir la décision 1 ;
- **aucun texte** : ni journal, ni message, ni mot libre de signalement — tenu
  par une contrainte, pas par une consigne ;
- **durée bornée** : treize mois, puis nouvel identifiant ;
- **un interrupteur**, atteignable et respecté partout.

L'interrupteur est dans les réglages sur le web, et sur la carte d'accueil sur
mobile — qui n'a pas d'écran de réglages, et où un choix qu'on ne trouve pas ne
serait pas un choix.

**Un refus est respecté partout.** Le réglage vit sur l'appareil (c'est là que
naît l'identifiant, et un refus doit valoir avant même qu'un compte existe)
**et** sur le compte, dans `public.mesure_preferences`. À l'ouverture de
session, chaque appareil lit la préférence du compte ; **le refus l'emporte
toujours** sur l'accord local, jamais l'inverse. Un accord posé sur le compte ne
réactive donc rien sur un appareil qui a dit non : le défaut ne peut pas écraser
un choix.

Un refus efface l'identifiant sur-le-champ, sur les deux plateformes. Il ne
reste rien à regarder — c'est ce qui rend le refus vérifiable.

**Dette nommée.** Ce document décrit les conditions que le dispositif vise à
remplir ; il ne remplace pas une relecture juridique, et le doc 06 pose déjà la
même limite pour ses propres références. Le public visé (16-17 ans) et la nature
des données du produit (convictions religieuses, difficultés personnelles) en
font une relecture nécessaire avant collecte à grande échelle, pas un formalisme.

### 3. Le funnel : une vue, sans back-office

Le funnel du doc 08 est répondable par une seule requête, versionnée dans la
migration `20260825190000` : la vue `public.mesure_funnel_binome`.

Elle rend sept lignes, une par étape mesurable, et **toujours sept** — même sur
une table vide. Un tableau qui disparaîtrait faute de données serait un tableau
qui se tait le jour où l'on a le plus besoin de savoir qu'on ne mesure rien.

**Qui peut la lire : personne, depuis l'application.** Elle n'a aucun `grant`,
comme `tandem_moderators` avant elle, et pour la même raison : l'absence de
droit est la protection. Elle se lit depuis l'éditeur SQL du tableau de bord
Supabase, qui travaille en `postgres`. Une vue ordinaire s'exécutant avec les
droits de son propriétaire, lui accorder un `select` un jour ouvrirait la table
entière à travers elle — raison de plus de n'en accorder aucun.

Ce que ce choix coûte : il n'y a pas de tableau de bord, et lire le funnel
demande d'ouvrir l'éditeur SQL. C'est cohérent avec un produit qui n'a aucun
composant serveur, et c'est ce qui évite d'ajouter une surface d'accès à des
données qu'on vient de fermer.

```sql
-- Le funnel, tel quel.
select * from public.mesure_funnel_binome;

-- Les 28 derniers jours (la vue n'a pas de fenêtre : une vue ne prend pas de
-- paramètre, et en figer une obligerait à une migration pour la changer).
with recent as (
  select * from public.analytics_events
  where occurred_at >= now() - interval '28 days'
)
select event_name, count(distinct anonymous_id) as appareils
from recent group by event_name order by 2 desc;

-- Le taux d'acceptation d'invitation (doc 08, « mesures de santé »).
select
  count(distinct anonymous_id) filter (where event_name = 'partner_invited')  as invites,
  count(distinct anonymous_id) filter (where event_name = 'partner_accepted') as acceptes
from public.analytics_events;

-- Ce qui est signalé, et depuis où. Le garde-fou du doc 08 — « arrêt
-- automatique si un indicateur de signalement augmente » — se lit ici.
select metadata->>'category' as categorie, date_trunc('week', occurred_at) as semaine, count(*)
from public.analytics_events
where event_name = 'report_created'
group by 1, 2 order by 2 desc, 3 desc;
```

**La ligne « semaine accompagnée » rendra zéro**, et ce n'est pas un défaut de la
vue : `weekly_checkin_completed` n'a aucun geste dans le produit — le bilan
hebdomadaire est l'issue #18. La North Star du doc 08 (« semaines actives
accompagnées ») est donc **muette par construction** tant que ce chantier n'est
pas fait. L'API d'émission est posée pour qu'il n'ait qu'à s'y brancher : une
ligne `emettre('weekly_checkin_completed', { locale, journeyId, proprietes: {
week } })` au moment du geste, et la mesure existe. Il en va de même pour
`journey_paused`, dont aucun écran ne propose aujourd'hui l'équivalent, et pour
`help_requested`.

### 4. Supprimer

**La procédure de suppression des données analytics tient en une phrase : il n'y
a rien à supprimer qui pointe vers quelqu'un.**

Ce n'est pas une pirouette, et c'est vérifiable. `analytics_events` ne porte
aucune colonne qui désigne un compte : ni `user_id`, ni adresse, ni identifiant
de session. La seule colonne d'identité est `anonymous_id`, qui naît d'un tirage
sur l'appareil. Il n'existe donc **aucun prédicat** capable de sélectionner « les
événements de cette personne » — ni pour les exporter, ni pour les supprimer, ni
pour quiconque les chercherait, y compris sous réquisition.

Ce qui se supprime réellement, et qui est fait :

| Ce qui existe | Où | Ce qui l'efface |
|---|---|---|
| l'identifiant d'appareil | stockage local | refus de la mesure, remise à zéro de la démo, suppression de compte |
| les jalons de funnel (web) | stockage local | les mêmes gestes |
| le consentement, par compte | `mesure_preferences` | `supprimer_mon_compte()` |
| les événements | `analytics_events` | rien, et c'est le résultat recherché |

Effacer l'identifiant coupe le seul fil qui reliait entre eux les événements d'un
même appareil. Une fois coupé, il ne se renoue pas : le prochain identifiant est
un tirage neuf, et rien ne permet de le rapprocher du précédent.

**Ce que la suppression de compte change, exactement.** `supprimer_mon_compte()`
efface la ligne de `mesure_preferences` — c'est une donnée de la personne — et
ne touche à aucun événement, faute de pouvoir les désigner. Le web efface en
plus l'identifiant et les jalons de ce navigateur. Sur mobile, il n'existe
aujourd'hui **aucun geste de suppression de compte** : c'est un écart réel du
mobile, antérieur à ce chantier, et le refus de la mesure y efface bien
l'identifiant.

**L'export ne contient pas les événements**, pour la même raison, et le fichier
le dit lui-même (`a_propos_de_la_mesure`). Quelqu'un qui télécharge ses données
une seule fois, au moment de partir, doit pouvoir constater sur pièce que
l'absence est un choix et non un trou. Son consentement, lui, y figure.

### 5. L'écriture est réservée aux comptes connectés

La politique d'origine (`…_000007`) ouvrait l'insertion à `anon` avec
`with check (true)`. Le site est statique et la clé publiable est dans le
paquet : c'était un point d'écriture anonyme, sans limitation de débit, sur la
seule mesure que le produit possède. Un après-midi de `curl` suffit à rendre le
funnel inexploitable, et comme personne ne lit la table depuis l'application,
rien ne l'aurait signalé.

L'insertion est donc réservée à `authenticated`. **Ce que ça coûte** : les
gestes faits hors session ne sont plus mesurés — le web fonctionne en mode
démonstration sans compte, et une séance terminée dans ce mode ne laisse aucune
trace. C'est cohérent avec le funnel du doc 08, dont la première étape mesurée
est la création de compte ; ce qui précède relève de l'audience du site vitrine.

---

## Comment l'émission est faite

**Le catalogue vit dans `packages/domain/src/mesure.ts`**, partagé par le web et
le mobile, avec ses tests. Il connaît les dix événements du doc 08 et, pour
chacun, les seules propriétés qu'il a le droit de porter. Une propriété hors
catalogue ou une valeur trop longue fait échouer l'événement **entier**, jamais
en silence une clé de trop : c'est le même verdict que celui de la base, rendu
plus tôt.

**La base tient la même règle** (`analytics_events_metadata_sobre`) : clés du
doc 08, valeurs scalaires, 40 caractères. La redondance est voulue — le domaine
protège d'une erreur de programmation, la contrainte protège d'une application
compromise.

**L'émission ne casse jamais un geste produit.** C'est l'exception assumée à la
règle « toute écriture lit sa réponse » qui gouverne le reste du dépôt : ici, on
lit la réponse **pour la jeter**. Personne ne clique pour émettre un
`session_completed` ; un envoi qui échoue ne doit rien changer à ce que la
personne voit, rien retarder, rien afficher. On lit quand même, plutôt que de
laisser filer la promesse, parce qu'un rejet sans `catch` remonte en « unhandled
rejection » — lire pour jeter est le seul moyen de se taire vraiment.

**Hors ligne : la perte est assumée.** Aucune file. `offlineQueue` rejoue les
gestes produits — une séance, une entrée de journal, un message — parce qu'ils
appartiennent à quelqu'un. Un événement de mesure n'appartient à personne. Le
mettre en file coûterait du stockage, un rejeu à retardement qui fausse les
horodatages du funnel, et une file de plus à vider à la suppression de compte ;
ce qu'on y gagnerait — quelques pourcents de complétude sur un pilote — ne vaut
pas ce prix.

### Ce qui est émis aujourd'hui

| Événement | Web | Mobile | Où |
|---|---|---|---|
| `account_created` | oui | non | à la validation de l'écran de confiance (âge + consentements) |
| `journey_started` | oui | non | à la première séance ouverte sur cet appareil |
| `session_completed` | oui | oui | à la fin d'une séance, avec `day` et une tranche de durée |
| `partner_invited` | oui | non | à la création d'une invitation |
| `partner_accepted` | oui | oui | à l'acceptation réussie d'une invitation |
| `share_created` | oui | non | au partage d'une entrée de journal |
| `report_created` | oui | oui | à l'envoi d'un signalement (`category`, `channel_type`) |
| `weekly_checkin_completed` | — | — | aucun geste : issue #18 |
| `journey_paused` | — | — | aucun geste dans le produit |
| `help_requested` | — | — | aucun geste dans le produit |

**Pourquoi `account_created` n'est pas émis sur mobile.** Le geste qui crée un
compte au sens de ce produit — âge confirmé, consentements posés — n'existe que
sur le web. L'écran mobile de connexion envoie un lien magique, rien de plus.
Émettre l'événement à la première session mobile compterait un compte de plus
par appareil, et le funnel dirait qu'il se crée plus de comptes qu'il n'y a de
personnes. Les autres absences côté mobile suivent la même règle : le geste n'y
existe pas encore (pas d'invitation, pas de partage, pas de choix de parcours).

**`duration_bucket`, jamais la durée.** Une durée à la seconde près est un
signal de comportement : elle dit combien de temps quelqu'un est resté sur une
page de journal intime, et deux durées exactes suffisent souvent à reconnaître
un appareil. Cinq tranches — moins de 2 min, 2-5, 5-10, 10-20, plus de 20 —
répondent à la question qu'on se pose réellement : la séance a-t-elle été
traversée ou vécue.

---

## Ce qui reste ouvert

- **Relecture juridique** avant collecte à grande échelle (voir décision 2).
- **`weekly_checkin_completed`** : la North Star reste muette jusqu'à l'issue
  #18. L'API est prête ; c'est une ligne à ajouter au geste.
- **Conservation des événements** : aucune durée n'est fixée, aucune purge n'est
  posée. Elle demanderait un cron et une décision de durée — la même dette que
  celle nommée dans `20260825090000` pour les messages des tandems terminés. Ce
  n'est pas urgent au sens du risque (rien ne désigne personne) mais une table
  qui ne se purge jamais finit par peser.
- **Suppression de compte sur mobile** : elle n'existe pas, et c'est un écart
  antérieur à ce chantier.
- **Le mode démonstration n'est plus mesuré** depuis la fermeture de `anon`. Si
  l'on veut un jour compter les visites avant compte, c'est du côté du site
  vitrine qu'il faudra le faire, pas ici.
