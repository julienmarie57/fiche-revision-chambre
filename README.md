# Fiche Révision Chambre — App de maintenance

PWA mobile-first pour les techniciens : checklist de révision des chambres,
-photo du numéro de chambre avec détection automatique (OCR), horodatage,
validation par équipement avec remarques texte + photo.

## Fonctionnalités

- **Nouvelle fiche** : photo du numéro de porte → OCR → numéro de chambre
  pré-rempli (modifiable), semaine et date automatiques, personne
  pré-remplie avec le nom de l'appareil (modifiable, mémorisé).
- **Checklist** : 7 catégories, 33 équipements. Toucher un équipement ouvre
  le détail des actions à réaliser (cochables une par une) ou « Tout valider ».
- **Pop-up remarque** à la validation d'un équipement : champ texte et/ou
  photo, ou « Valider sans remarque ».
- **Clôture et rapport** : au clic sur « Terminer la fiche », pop-up
  « Éditer le rapport ? ». Si oui : génération d'un PDF (résultats,
  remarques et photos) nommé
  `AAAAMMJJ_RAP_INSPCH<n°chambre>_<Personne>.pdf`, téléchargé
  automatiquement, puis ouverture d'un e-mail pré-adressé à
  technique@csfds.be avec l'objet prédéfini
  `AAAAMMJJ_RAP_INSPCH<n°chambre>_<Personne>`. Le PDF est joint depuis les
  téléchargements du téléphone (2 taps) : les apps web n'ont pas le droit
  d'attacher un fichier à un e-mail sans intervention.
- **Hors-ligne** : service worker + stockage local (localStorage). Les fiches
  restent sur le téléphone.
- **Historique** : fiches en cours / terminées, consultation détaillée,
  régénération du rapport PDF, export JSON.

## Installation sur smartphone

1. Ouvrir l'URL de l'app dans Chrome (Android) ou Safari (iOS).
2. Android : menu ⋮ → « Ajouter à l'écran d'accueil ».
   iOS : Partager → « Sur l'écran d'accueil ».
3. L'app s'ouvre en plein écran comme une application native.

> La détection OCR du numéro de chambre et la génération PDF nécessitent une
> connexion la première fois (Tesseract.js et jsPDF chargés depuis un CDN,
> mis en cache ensuite). En cas d'échec, le numéro se saisit manuellement.

## Déploiement

Site 100 % statique, aucune compilation. Exemple avec GitHub Pages :

```bash
git init && git add . && git commit -m "App fiche révision chambre"
git remote add origin <url-du-repo>
git push -u origin main
```

Puis activer GitHub Pages (branche `main`, racine) dans les paramètres du
dépôt. L'app sera disponible à l'adresse du site.

## Structure

```
index.html            Interface (4 écrans + modale remarque)
css/styles.css        Styles mobile-first
js/data.js            Checklist (catégories, équipements, actions)
js/app.js             Logique : OCR, checklist, remarques, stockage, export
sw.js                 Service worker (cache hors-ligne)
manifest.webmanifest  Manifeste PWA
icons/                Icônes 192/512
```

## Données

Les fiches sont stockées localement sur l'appareil (clé `mtn_fiches` dans
localStorage). Le bouton « Exporter les données » télécharge un JSON avec
toutes les fiches (à faire depuis le téléphone du technicien ou d'un poste
où les données sont présentes).
