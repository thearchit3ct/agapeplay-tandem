# Spécification fonctionnelle

## Rôles

| Rôle | Capacités principales |
|---|---|
| Visiteur | Lire la présentation, consulter les parcours publics, demander une invitation |
| Participant | Suivre un parcours, réaliser des défis, écrire un journal, partager avec son binôme |
| Binôme | Voir les éléments partagés, répondre, encourager, signaler un besoin |
| Mentor | Voir les signaux de suivi autorisés, envoyer des relances, gérer un groupe |
| Responsable | Gérer la communauté, les parcours, les rôles et les exports agrégés |
| Modérateur | Traiter signalements, blocages et incidents selon un protocole auditable |
| Administrateur plateforme | Configuration technique et accès exceptionnel journalisé |

## Épics du produit

### EPIC A — Compte et consentement

- connexion par email, lien magique, Google, Apple et Microsoft ;
- choix de langue et fuseau horaire ;
- âge minimum de 16 ans clairement affiché ;
- vérification manuelle de l'âge et du rôle de mentor, sans conservation de
  copie de pièce d'identité ;
- consentement séparé pour les notifications et les communications ;
- export et suppression du compte ;
- session multi-appareils avec révocation.

### EPIC B — Parcours

- catalogue de parcours ;
- fiche parcours : objectif, durée, public, tradition ou courant, auteur, validation ;
- séances composées de contenu, question et action ;
- progression par semaine et par séance ;
- reprise après absence ;
- version hors ligne des séances déjà téléchargées ;
- contenu en français et structure prête pour plusieurs langues.

### EPIC C — Binôme

- invitation par lien ou email ;
- expiration et révocation de l'invitation ;
- consentement réciproque ;
- proposition du mentor par l'église pour les 16–17 ans ;
- acceptation explicite du jeune avant activation ;
- sortie du tandem à tout moment ;
- choix de ce qui est partagé ;
- changement de binôme sans perte du parcours ;
- mise en pause de la relation ;
- blocage et signalement.

### EPIC D — Check-in et journal

- réponse rapide de statut ;
- note ou texte privé ;
- partage explicite d'une réponse ;
- historique visible par le participant ;
- suppression individuelle ;
- avertissement avant d'écrire des informations sensibles ;
- aucune indexation publicitaire du contenu.

### EPIC E — Communication sûre

- conversation privée participant-binôme ;
- conversation privée limitée aux personnes du tandem ;
- redirection volontaire vers WhatsApp, hors périmètre de modération ;
- aucun chat de groupe, audio ou vidéo dans le MVP ;
- notifications paramétrables ;
- signalement d'un message ;
- blocage ;
- conservation limitée des messages selon la politique produit ;
- journal d'audit des actions de modération, pas du contenu spirituel consulté par défaut.

### EPIC F — Espace mentor

- liste des participants affectés ;
- signaux : actif, à relancer, demande d'aide ;
- notes de suivi séparées du journal utilisateur ;
- réponses suggérées mais jamais envoyées automatiquement ;
- parcours de formation du mentor ;
- formation suivie dans AgapePlay ou justificatif externe ;
- validation permanente et révocable ;
- permissions par groupe.

### EPIC G — Espace église

- création d'une communauté ;
- invitation par QR code ou lien ;
- groupes et cohortes ;
- affectation des mentors ;
- sélection de parcours ;
- statut administratif des tandems ;
- statistiques exclusivement globales et anonymisées ;
- export des participants selon permission ;
- fermeture d'une cohorte et politique de rétention.

### EPIC H — Contenu et administration

- éditeur de séances ;
- workflow brouillon → revue théologique → traduction → publication ;
- versions et historique ;
- tags par public, durée, langue et contexte ;
- prévisualisation mobile et web ;
- archivage sans supprimer l'historique des utilisateurs.

## Critères de lancement MVP

- un utilisateur peut commencer un parcours sans assistance ;
- un binôme peut être invité, accepter et comprendre ses droits ;
- le journal privé n'est jamais visible au mentor par défaut ;
- un participant peut terminer une séance hors ligne et la synchroniser ;
- un participant peut supprimer son compte et ses contenus ;
- un mentor peut suivre un groupe sans accès excessif ;
- pour un mineur, l'église voit le statut administratif sans voir les messages
  ni le journal ;
- un signalement arrive à un modérateur avec un statut traçable ;
- les notifications peuvent être désactivées ;
- aucun paiement, prix ou appel à l'achat n'apparaît dans les apps mobiles ;
- les scénarios critiques sont testés sur web, iOS et Android.
