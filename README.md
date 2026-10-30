# Mes outils (PWA)

Inventaire de mes outils et accessoires de bricolage (catégories libres, photos, descriptif, prix, date et lieu d'achat, lien)
et liste de course des articles à acheter.

## Mise en ligne sur GitHub Pages
1. Créez un dépôt GitHub distinct de l'autre application (ex. `mes-outils`).
2. Envoyez-y tous les fichiers de ce dossier à la racine.
3. Settings > Pages > « Deploy from a branch », branche `main`, dossier `/ (root)`.
4. Adresse : `https://VOTRE-PSEUDO.github.io/mes-outils/`, puis installez-la depuis le menu du navigateur.

## Important
- Les données restent dans le navigateur de l'appareil : Réglages > « Sauvegarder » pour exporter un fichier complet (photos incluses).
- Les deux applications (logement et outils) ont chacune leur propre stockage et leur propre sauvegarde.
- Pour publier une mise à jour du code, changez `VERSION` dans `sw.js`.

## Remplissage automatique depuis un lien (nouveau)
- Le fichier `worker.js` (fourni à part) se colle dans un Worker Cloudflare gratuit : c'est le « relais » qui lit les pages des magasins.
- Réglages > « Remplissage automatique » : coller l'adresse du relais (`https://….workers.dev`), puis « Enregistrer et tester ».
- Dans un formulaire : coller un lien dans « Lien vers l'article » remplit nom, prix, photo, descriptif, magasin et catégorie.
- Android : une fois l'application installée, « Partager » depuis le navigateur ou l'application d'un magasin > « Mes outils ».
- Après mise à jour du code, `VERSION` dans `sw.js` est passée à `outils-v5`.
- Liste de course : photo (appareil ou galerie) possible ; elle suit l'article quand il passe à l'inventaire. Une photo prise à la main a priorité sur celle du site.
