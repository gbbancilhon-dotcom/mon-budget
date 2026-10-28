# Mon budget

Application web de gestion de budget personnel, en français, sans backend.

## Technologies

- HTML, CSS et JavaScript pur — **aucun framework, aucune dépendance, aucun outil de build**.
- Stockage local avec `localStorage` (clé `mon-budget:transactions`, JSON).
- Graphique en anneau dessiné en SVG (`createElementNS`), sans bibliothèque.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure : carte solde, formulaire, graphique, historique avec filtres. `app.js` chargé avec `defer`. |
| `style.css` | Design : variables CSS dans `:root`, grille responsive (1 colonne mobile, 2 colonnes dès 800 px), mode sombre via `prefers-color-scheme`. |
| `app.js` | Toute la logique (voir architecture). |
| `.claude/launch.json` | Config de prévisualisation : `python -m http.server 5173` sur 127.0.0.1 (le port 8765 est refusé par Windows). Optionnel. |

## Architecture de `app.js`

Sections dans l'ordre du fichier :

1. **Constantes** : `CLE_STOCKAGE`, `CATEGORIES` (clé → `{ libelle, couleur }`), `formatEuro` (`Intl.NumberFormat` fr-FR, EUR).
2. **Stockage** : `chargerTransactions()` (JSON invalide ou entrées mal formées ignorées → pas de plantage), `sauvegarderTransactions()`.
3. **État** : `transactions` (tableau en mémoire, source de vérité) et `idEnEdition` (`null` hors modification).
4. **Calculs** : `total`, `repartitionDepenses`, `transactionsFiltrees` (lit les contrôles de filtre, tri par date décroissante).
5. **Utilitaires DOM** : `$` (getElementById), `el` (création d'élément avec `textContent`), `formatDate`, `aujourdhui`, `afficherErreur`.
6. **Rendu** : `renderSolde`, `renderHistorique`, `renderGraphique`, puis `render()` qui appelle les trois.
7. **Actions** : `lireFormulaire` (validation), `soumettreFormulaire` (ajout ou modification), `demarrerEdition`, `supprimerTransaction`, `reinitialiserFormulaire`, `reinitialiserFiltres`.
8. **Initialisation** : `init()` remplit les listes de catégories, branche les événements, appelle `render()` (sur `DOMContentLoaded`).

Flux : événement → modification de `transactions` → `sauvegarderTransactions()` → `render()`. Les filtres ne touchent que `renderHistorique()`.

## Modèle de données

```js
{ id: string /* crypto.randomUUID() */, type: "depense" | "revenu", montant: number /* > 0, 2 décimales */,
  categorie: "alimentation" | "logement" | "transport" | "loisirs" | "sante" | "autres",
  date: "AAAA-MM-JJ", description: string }
```

Le montant est toujours positif ; le signe est déduit de `type`.

## Fonctionnalités implémentées

- Ajout d'une dépense ou d'un revenu (montant, catégorie, date, description), validation avec messages d'erreur en français.
- Modification et suppression (avec confirmation) d'une transaction depuis l'historique.
- Tableau de bord : solde (vert/rouge selon le signe), total des revenus, total des dépenses.
- Graphique en anneau de la répartition des **dépenses** par catégorie, légende avec montants et pourcentages, infobulle au survol, `aria-label` descriptif, cas d'une seule catégorie géré (cercle plein).
- Historique trié par date décroissante, filtrable par type, catégorie, période (du / au) et texte ; résumé des totaux filtrés ; bouton « Réinitialiser ».
- Persistance dans `localStorage`, mode sombre automatique.

Pas encore fait : export/import JSON, filtre par mois sur le graphique, tests automatisés. Les filtres, la modification, la suppression et le cas d'un `localStorage` corrompu n'ont pas été testés à la main.

## Conventions

- **Interface entièrement en français** : libellés, messages, dates `jj/mm/aaaa`, montants au format `1 234,56 €`.
- Identifiants du code en français (`transactions`, `categorie`, `montant`, `renderSolde`, `afficherErreur`…), noms de fonctions de rendu préfixés `render`. Rester cohérent avec ce style.
- Le texte saisi par l'utilisateur est inséré uniquement via `textContent` (helper `el`), jamais via `innerHTML`.
- Les dates sont stockées en `AAAA-MM-JJ` et comparées comme des chaînes ; `formatDate` ne sert qu'à l'affichage.
- La clé de catégorie « santé » est `sante` (sans accent) ; le libellé affiché est « Santé ».
- Couleurs et rayons via variables CSS (`--principal`, `--positif`, `--negatif`…) ; couleurs de catégories définies dans `CATEGORIES`.
- Design moderne et épuré, mobile d'abord, focus visibles, labels de formulaire.

## Lancer l'application

Ouvrir `index.html` directement dans un navigateur, ou servir le dossier : `python -m http.server 5173 --bind 127.0.0.1`.
