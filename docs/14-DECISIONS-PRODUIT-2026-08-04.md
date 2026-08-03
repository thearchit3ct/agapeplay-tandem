# Décisions produit — 4 août 2026

Ce document fige les choix issus du cadrage produit. Il sert de référence aux
spécifications, aux issues et aux décisions techniques. Toute évolution doit
être ajoutée ici ou dans un ADR lié.

## 1. Périmètre de lancement

- Les surfaces web, iOS et Android sont lancées simultanément.
- L'interface et les parcours officiels AgapePlay sont disponibles en français
  et en anglais dès le lancement.
- L'âge minimum est de 16 ans.
- Les utilisateurs peuvent appartenir à plusieurs églises ou communautés et
  avoir un rôle différent dans chacune.
- Les deux portes d'entrée sont disponibles : `Repartir avec Jésus` et le mode
  compagnon d'un parcours Alpha local.
- L'intégration officielle de contenus Alpha nécessite un partenariat distinct.

## 2. Accompagnement et sécurité des 16–17 ans

- Un tandem peut être personnel ou proposé par une église.
- Pour un 16–17 ans, le mentor est proposé par l'église.
- Le jeune doit accepter explicitement la proposition avant l'activation.
- Le jeune peut refuser ou quitter le tandem à tout moment, sans justification.
- La vérification du mentor est manuelle : contrôle d'une pièce d'identité ou
  attestation officielle d'une église.
- La formation du mentor peut être suivie dans AgapePlay ou justifiée par un
  document externe.
- La formation est permanente, mais peut être révoquée par AgapePlay ou
  l'église selon le protocole d'incident.
- Aucun consentement parental n'est demandé dans le parcours produit à ce
  stade ; une validation juridique par pays reste obligatoire avant lancement.
- L'église voit le statut administratif du tandem : proposé, accepté, terminé,
  bloqué ou signalé. Elle ne voit ni le journal ni les messages privés.
- Une relation avec un mineur reste strictement individuelle et traçable ; il
  n'existe pas de matching public ou aléatoire.

## 3. Conversations et modération

- Les conversations intégrées sont limitées au binôme ou au tandem mentor-
  participant concerné.
- Il n'y a pas de chat de groupe, d'audio ou de vidéo intégré dans le MVP.
- Une redirection volontaire vers WhatsApp peut être proposée, avec un rappel
  clair que cette conversation sort du périmètre de modération AgapePlay.
- Bloquer, signaler, demander de l'aide et supprimer immédiatement la relation
  sont disponibles depuis le tandem et chaque message.
- Les signalements sont traités par l'église et AgapePlay.
- Tout signalement grave impliquant un mineur est automatiquement escaladé à
  AgapePlay ; les procédures d'urgence orientent vers les services compétents
  et ne promettent pas une prise en charge immédiate par l'application.
- Le mentor voit uniquement les signaux minimaux nécessaires à son rôle. Le
  responsable d'église ne voit que des statistiques globales et anonymisées.

## 4. Vérification et données

- La plateforme conserve le statut de vérification, la date, le validateur et
  le type de preuve utilisé.
- Aucune copie de pièce d'identité n'est conservée par défaut.
- Les journaux sont privés par défaut et les partages sont explicites.
- Les messages signalés peuvent être conservés pendant une durée limitée et
  documentée ; les logs de sécurité ne contiennent pas leur texte par défaut.
- L'export complet, la suppression du compte et la gestion séparée des
  consentements sont disponibles.
- Les statistiques d'église et les analytics de produit sont anonymisés et ne
  permettent pas de déduire la situation spirituelle d'une personne.
- Aucune IA n'est utilisée dans le MVP et aucun journal ou message n'est
  utilisé pour entraîner un modèle.

## 5. Modèle économique et paiements

- Le socle gratuit comprend les parcours AgapePlay de base, le suivi quotidien,
  le journal privé et les conversations privées.
- L'abonnement église débloque les fonctions de communauté, cohortes, rôles,
  parcours privés, tableau de bord agrégé et accompagnement Alpha.
- Les parcours premium peuvent être vendus à l'unité ou par abonnement
  personnel.
- Tous les paiements et abonnements sont effectués exclusivement sur le web via
  Stripe.
- Les apps iOS et Android n'affichent aucun prix, bouton d'achat, écran de
  paiement ou lien invitant à acheter ou gérer un abonnement sur le web.
- Les apps mobiles permettent uniquement de se connecter et d'utiliser les
  droits déjà acquis sur le web. Les entitlements sont synchronisés par le
  backend.
- Une revue de conformité Apple/Google est obligatoire avant soumission ; si le
  modèle web-only n'est pas accepté pour une surface donnée, la publication de
  cette surface est bloquée jusqu'à résolution.

## 6. Contenus et droits

- Les contenus peuvent être créés par AgapePlay, une église ou un auteur
  partenaire validé.
- Un parcours public doit passer par la validation AgapePlay.
- Un parcours privé de communauté peut être publié par l'église sans
  validation centrale, sous réserve des règles de sécurité et de droits.
- Les parcours d'église ou de partenaires peuvent exister dans une seule
  langue ou plusieurs langues selon les droits disponibles.
- Les traductions bibliques sont proposées uniquement lorsque les droits sont
  vérifiés.

## 7. Offline, notifications et personnalisation

- Le mode hors ligne couvre les séances déjà téléchargées, la validation du
  défi quotidien, le journal privé et les conversations déjà chargées.
- Les actions hors ligne sont mises en file, idempotentes et synchronisées avec
  un état explicite en cas de conflit.
- Les notifications de séance, messages, réunions d'église et absence peuvent
  être configurées séparément.
- Les espaces d'église peuvent personnaliser leur logo, leurs couleurs, leur
  nom, leurs informations et leur page d'accueil dédiée.

## 8. Décisions par défaut pour la suite

- AgapePlay fournit la modération de plateforme, le support et la gouvernance
  des contenus publics.
- Chaque église désigne au moins un responsable et un remplaçant avant d'activer
  les tandems de mineurs.
- Les règles de comportement sont acceptées avant le premier échange.
- Les permissions sont vérifiées côté serveur par RLS et par des fonctions
  d'autorisation testées ; elles ne reposent jamais sur un rôle modifiable côté
  client.
- Les achats web utilisent Stripe Checkout et Stripe Billing ; les droits
  d'accès sont matérialisés dans une table d'entitlements indépendante du
  fournisseur de paiement.
- Les apps mobiles sont des compagnons authentifiés sans surface commerciale.
- La sortie du MVP nécessite une DPIA, une revue spécialisée des mineurs et une
  revue des règles des stores dans les pays ciblés.
