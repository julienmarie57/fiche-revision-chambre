# Fiche Révision Chambre — App de maintenance

PWA mobile-first pour une équipe de techniciens : inspections trimestrielles
des chambres, checklists détaillées, remarques avec photos, rapports PDF,
récap trimestriel et analyses.

## Fonctionnement

- **Accueil** : chambres **à réaliser** (302, 304, 311, 404, 414), inspections
  **en cours** et **réalisées** du trimestre courant.
- **Techniciens** : Julien et Julien 2 (liste déroulante, mémorisée).
- **Checklist** : 7 catégories, 33 équipements. Toucher un équipement ouvre
  le détail des actions (cochables une par une) ou « Tout valider ».
- **Pop-up remarque** à la validation d'un équipement : texte et/ou photo,
  ou « Valider sans remarque ».
- **Clôture** : « Terminer l'inspection » → pop-up « Éditer le rapport ? » →
  PDF nommé `AAAAMMJJ_RAP_INSPCH<chambre>_<Personne>.pdf` + e-mail prérempli
  vers technique@csfds.be. La chambre passe alors en « réalisées » et
  disparaît de « à réaliser ».
- **Trimestres** (01/01, 01/04, 01/07, 01/10) : au changement, les chambres
  repassent automatiquement « à réaliser » et une bannière propose le récap
  du trimestre précédent : chambres non inspectées + remarques par chambre,
  éditable en PDF.
- **Historique & analyses** : filtres (trimestre, personne, chambre),
  remarques triables par date / chambre / équipement / personne, et
  fréquence des problèmes par équipement.
- **Export / Import JSON** pour transférer les données entre appareils tant
  que la synchronisation n'est pas activée.

## Synchronisation multi-appareils (Firebase)

Sans configuration, l'app est en **mode local** : les données restent sur
chaque appareil. Pour partager les inspections entre les 4 téléphones et
l'ordinateur :

1. Créer un compte sur [console.firebase.google.com](https://console.firebase.google.com)
2. « Ajouter un projet » (ex. `fiche-revision`), désactiver Google Analytics
3. Dans le projet : **Build → Realtime Database → Créer une base** (mode test,
   zone europe-west1)
4. **Paramètres du projet → Vos applications → Web (`</>`)** : enregistrer une
   app et copier l'objet `firebaseConfig`
5. Coller les valeurs dans `js/firebase.js` à la place des `A_REMPLACER`
6. Redéployer (push sur main) — la mention « ☁️ Synchronisation Firebase
   active » apparaît en bas de l'accueil

Les photos restent stockées localement (poids) ; textes et résultats sont
synchronisés. Règles de sécurité à resserrer ensuite (mode test expire).

## Déploiement

Site 100 % statique sur GitHub Pages :
https://julienmarie57.github.io/fiche-revision-chambre/

Installation smartphone : ouvrir l'URL → « Ajouter à l'écran d'accueil ».

## Structure

```
index.html            Interface (6 écrans + pop-ups)
css/styles.css        Styles mobile-first
js/data.js            Checklist, chambres, techniciens
js/firebase.js        Config + couche de synchronisation (optionnelle)
js/app.js             Logique : inspections, trimestres, PDF, analyses
sw.js                 Service worker (cache hors-ligne, réseau prioritaire)
```
