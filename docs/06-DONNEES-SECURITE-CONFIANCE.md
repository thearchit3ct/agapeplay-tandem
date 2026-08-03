# Données, sécurité et confiance

## Niveau de sensibilité

Les échanges de prière, les journaux et certaines réponses de parcours peuvent révéler des convictions religieuses, des informations de santé, des difficultés personnelles ou des informations concernant la vie privée. Ces informations doivent être traitées comme hautement sensibles dans la conception, même lorsque l'utilisateur ne les a pas étiquetées comme telles.

La CNIL classe notamment les convictions religieuses ou philosophiques parmi les données sensibles. Une analyse d'impact devra être réalisée avant un traitement à risque élevé.

## Politique produit MVP

- âge minimum : 16 ans ;
- pas de matching public ou aléatoire ;
- relation uniquement par invitation ou rattachement supervisé à une communauté ;
- pour les 16–17 ans, mentor proposé par l'église et accepté par le jeune ;
- validation manuelle par pièce contrôlée ou attestation d'église, sans copie conservée ;
- journaux privés par défaut ;
- partage actionné par l'utilisateur, écran par écran ;
- pas de publicité ciblée à partir du contenu spirituel ;
- pas d'entraînement d'un modèle d'IA sur les journaux ou conversations ;
- suppression du compte et export des données accessibles dans l'application ;
- conservation limitée et documentée des messages signalés ;
- accès administrateur exceptionnel, justifié et journalisé.

## Matrice d'accès minimale

| Donnée | Participant | Binôme | Mentor | Responsable |
|---|---:|---:|---:|---:|
| Profil public minimal | Oui | Oui si partagé | Oui si groupe | Oui si groupe |
| Progression de séance | Oui | Optionnel | Signaux minimaux si affecté | Non, statistique agrégée uniquement |
| Journal privé | Oui | Non par défaut | Non | Non |
| Réponse partagée | Oui | Oui | Selon règle du groupe | Selon permission |
| Demande d'aide | Oui | Selon choix | Oui | Oui si escalade |
| Message signalé | Parties concernées | Parties concernées | Modération | Modération |

## Sécurité technique

- RLS obligatoire sur toute table accessible depuis un client.
- Les permissions ne doivent pas reposer sur des métadonnées modifiables par l'utilisateur.
- Les canaux Realtime privés doivent avoir une autorisation serveur testée.
- Les liens d'invitation sont signés, expirables et révocables.
- Les actions sensibles exigent une confirmation et sont idempotentes.
- Les logs ne doivent pas contenir le texte des journaux ou messages.
- Les exports sont temporaires, protégés et expirent automatiquement.
- Les secrets sont séparés par environnement.
- Les dépendances et SDK sont inventoriés avant publication mobile.

## Sécurité relationnelle

- guide de comportement accepté par les participants ;
- bouton de blocage toujours accessible ;
- bouton de signalement depuis chaque message ;
- possibilité de quitter une relation sans justification publique ;
- protocole de réponse aux signalements ;
- séparation entre accompagnement spirituel et urgence médicale ou psychologique ;
- répertoire d'orientation vers les responsables humains et services locaux ;
- une conversation privée entre un mineur et son mentor est autorisée uniquement
  dans le tandem proposé par l'église et accepté par le jeune ; elle reste
  signalable, bloquable et supprimable à tout moment.
- tout signalement grave impliquant un mineur est escaladé automatiquement à
  AgapePlay, en plus du traitement par l'église.

## IA

L'IA peut être utilisée ultérieurement pour :

- résumer un parcours déjà public ;
- suggérer une question de discussion ;
- aider un responsable à préparer une séance ;
- détecter un ton potentiellement préoccupant pour orienter vers une revue humaine.

L'IA ne doit pas :

- se présenter comme Dieu, pasteur, thérapeute ou mentor ;
- interpréter une révélation personnelle comme une vérité ;
- répondre seule à une crise ;
- analyser les journaux privés sans consentement explicite ;
- générer du contenu doctrinal non relu.

## Références de conformité

- [CNIL — donnée sensible](https://www.cnil.fr/fr/definition/donnee-sensible)
- [EDPB — Data Protection Impact Assessment](https://www.edpb.europa.eu/topics/accountability-and-compliance-tools/data-protection-impact-assessment_en)
- [CNIL — recommandation applications mobiles](https://cnil.fr/sites/default/files/2024-09/recommandation-applications-mobiles.pdf)
- [Apple — App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Google Play — Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)

Ces références ne remplacent pas une validation juridique. Une revue spécialisée est nécessaire avant la collecte de données réelles.
