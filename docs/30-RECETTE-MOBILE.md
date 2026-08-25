# Recette mobile au doigt

*Créé le 25 août 2026 (issue #15). Consolide les checklists écrites dans les
PR [#58](https://github.com/thearchit3ct/agapeplay-tandem/pull/58) et
[#61](https://github.com/thearchit3ct/agapeplay-tandem/pull/61), dédoublonnées.
Ce document est **vivant** : chaque PR mobile qui ajoute un geste que rien dans
le dépôt ne peut vérifier ajoute sa ligne ici plutôt que de la laisser mourir
dans un corps de PR.*

---

## Pourquoi elle existe

L'intégration continue (`.github/workflows/ci.yml`) tourne sur chaque PR et
couvre ce qui est vérifiable sans appareil : les tests métier, le lint, le
typage des deux applications, la suite RLS et l'export Metro. **Ce que rien de
tout cela ne peut dire**, c'est si le clavier cache la case qu'on remplit, si
une icône d'onglet est absente sur Android, ou si une vibration part deux fois.

Ces choses-là ne se prouvent que le téléphone en main, après une build EAS
(voir [`29-BUILD-MOBILE.md`](./29-BUILD-MOBILE.md)). D'où cette liste.

**Un point échoue en silence, et c'est le premier à regarder** : les icônes
d'onglets Android passent par `renderToImageAsync`, qui rend `null` avec un
simple avertissement s'il manque quelque chose. L'onglet perdrait son icône sans
que rien, nulle part, ne rougisse.

**Piège de développeur, à connaître avant de conclure à un défaut** :
`apps/mobile/.expo/types/router.d.ts` est ignoré par git et **n'est pas
régénéré par `expo export`**. Un fichier périmé fait échouer `mobile:typecheck`
sur des routes pourtant valides ; le régénérer, c'est démarrer le serveur de
développement une fois. En CI le fichier est simplement absent, et le typage
passe — plus permissif qu'en local, donc, sur ce seul point.

---

## Avant de commencer

- Une build EAS installée sur un appareil **Android** et, si possible, un
  **iOS** — plusieurs points ne concernent qu'une plateforme et sont marqués.
- Un compte de test avec un binôme actif : sans tandem, la moitié des gestes
  n'est pas atteignable.
- De quoi couper le réseau (mode avion) : deux points en dépendent.

---

## 1. Le clavier — d'abord, parce que c'est le défaut qui a été rapporté

En bord-à-bord obligatoire depuis le SDK 54, la fenêtre ne se redimensionne
plus toute seule à l'ouverture du clavier : tout ce qui suit est du calcul
explicite, et le calcul n'a jamais été éprouvé ailleurs que sur cet appareil.

1. `auth` — toucher la case e-mail. La case **et** le bouton « Recevoir mon
   lien » restent visibles au-dessus du clavier.
2. `journal` — toucher la case d'entrée. Même chose avec « Enregistrer ».
3. `tandem` — toucher le composeur. Le fil **se rétrécit** au lieu de glisser, le
   composeur reste collé au clavier, et « Envoyer » est atteignable.
4. `tandem` → « Signaler » → toucher le mot libre. La case remonte, le bouton de
   confirmation reste atteignable.
5. Sur les quatre : **pas de bande blanche** d'une cinquantaine de points sous le
   champ — ce serait `insets.bottom` compté deux fois. Fermer le clavier rend
   bien la place.
6. **iOS** — onglet Tandem, clavier ouvert : le composeur reste au ras des
   touches, y compris pendant le défilement du fil (la barre se réduit).
7. **Android** — onglet Tandem, clavier ouvert : la barre d'onglets monte
   au-dessus du clavier et le composeur reste atteignable.

## 2. Les onglets

8. Les quatre onglets s'affichent, dans l'ordre Aujourd'hui / Parcours / Journal
   / Tandem.
9. **Android — les quatre icônes s'affichent.** C'est le point qui échoue en
   silence. Le repli documenté, s'il manque : `src={require(…)}` depuis un tracé
   maison.
10. **iOS** — la barre est en Liquid Glass (iOS 26), se réduit quand on descend
    dans un écran, et l'icône passe au plein sur l'onglet sélectionné.
11. Retoucher l'onglet déjà ouvert : l'écran remonte au sommet.
12. Bascule FR/EN depuis n'importe quel écran : **les libellés d'onglets
    suivent**, et les autres écrans aussi.
13. Fermer et rouvrir l'application : la langue est celle qu'on avait laissée.

## 3. La navigation et la main

14. Les écrans **glissent** latéralement au lieu de se fondre.
15. Bouton retour matériel d'Android : depuis un onglet, depuis un écran poussé,
    depuis une feuille — il revient bien en arrière à chaque fois, sans demander
    autant d'appuis qu'on a fait d'allers.
16. Chaque carte, rangée et bouton s'assombrit ou porte une onde sous le doigt.
17. Les petits liens — bascule FR/EN, « Partager », « Supprimer », les
    annulations — se touchent du premier coup.
18. Tirer vers le bas sur l'accueil, le journal et la conversation : le contenu
    se relit, et l'indicateur s'arrête **une fois**.

## 4. Les vibrations

19. Envoyer un message, terminer une séance, répondre au bilan, partager une
    entrée : une vibration, **une seule**, au moment où la chose aboutit.
    ⚠️ `expo-haptics` échoue en silence si la permission `VIBRATE` n'a pas été
    fusionnée au manifeste — **l'absence totale de vibration** est le signe à
    remonter, pas un détail de réglage.
20. Bloquer ou signaler : la vibration est nettement plus lourde.
21. Naviguer, changer de langue, ouvrir un panneau, annuler : **aucune**
    vibration.

## 5. Les feuilles de bas d'écran

22. Les quatre (blocage, déblocage, signalement, suppression de compte)
    s'ouvrent en feuille : poignée visible, glissement vers le bas pour
    refermer, fond assombri.
23. Signalement : une catégorie d'urgence immédiate affiche l'avertissement des
    lignes d'écoute. **Réseau coupé** et confirmation : la feuille reste
    **ouverte**, catégorie et texte intacts — on ne fait pas ressaisir une
    phrase difficile à écrire.
24. Bloquer : la feuille se referme, la vibration est lourde, la conversation se
    ferme, le fil reste lisible.
25. Supprimer son compte : la feuille se referme, puis l'application revient à
    Aujourd'hui — vérifier qu'aucun écran de compte ne reste derrière. **Et une
    seconde fois après avoir ouvert l'application à froid sur un lien.**

## 6. Les chemins d'entrée

26. `agapeplay:///` à froid → Aujourd'hui.
27. Lien d'invitation à froid (`/invite?token=…`) → l'écran d'invitation, jeton
    joué une seule fois.
28. Retour du lien magique : la session s'ouvre sans quitter l'écran.

## 7. Le lancement et les attentes

29. L'icône sur l'écran d'accueil : le « A•P » est net, pas rogné par le masque
    du fabricant.
30. L'écran de démarrage : sceau centré sur crème, sans texte. Sur Android 12+
    le système masque l'image en cercle et la redimensionne lui-même — le rendu
    peut différer de l'aperçu.
31. La barre de statut est sombre sur le crème, sur tous les écrans.
32. Première ouverture, réseau lent : la carte du jour, les rangées de Parcours,
    les entrées du Journal et le fil du Tandem montrent leur **forme**, pas le
    mot « chargement ».
33. Réglages système → réduire les animations : les formes restent, le battement
    s'arrête.

---

## Rendre compte

Un point qui échoue se remonte avec l'appareil, la version d'OS et la version
de l'application (`app.json`). Les trois numéros comptent : le clavier, les
marges basses et le rendu des icônes se comportent différemment d'une version
de plateforme à l'autre, et c'est précisément pour cela que cette liste ne peut
pas devenir un test.
