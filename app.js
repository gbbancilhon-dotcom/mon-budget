"use strict";

/* ---------- Constantes ---------- */

const CLE_STOCKAGE = "mon-budget:transactions";

const CATEGORIES = {
  alimentation: { libelle: "Alimentation", couleur: "#f59e0b" },
  logement: { libelle: "Logement", couleur: "#6366f1" },
  transport: { libelle: "Transport", couleur: "#0ea5e9" },
  loisirs: { libelle: "Loisirs", couleur: "#ec4899" },
  sante: { libelle: "Santé", couleur: "#10b981" },
  autres: { libelle: "Autres", couleur: "#94a3b8" },
};

const formatEuro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/* ---------- Stockage ---------- */

function chargerTransactions() {
  try {
    const donnees = JSON.parse(localStorage.getItem(CLE_STOCKAGE));
    if (!Array.isArray(donnees)) return [];
    return donnees.filter(
      (t) =>
        t && typeof t.id === "string" &&
        (t.type === "depense" || t.type === "revenu") &&
        Number.isFinite(t.montant) && t.montant > 0 &&
        t.categorie in CATEGORIES &&
        typeof t.date === "string" && typeof t.description === "string"
    );
  } catch {
    return [];
  }
}

function sauvegarderTransactions() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(transactions));
  } catch {
    afficherErreur("Impossible d'enregistrer les données (stockage indisponible).");
  }
}

/* ---------- État ---------- */

let transactions = chargerTransactions();
let idEnEdition = null;

/* ---------- Calculs ---------- */

const total = (liste, type) =>
  liste.filter((t) => t.type === type).reduce((somme, t) => somme + t.montant, 0);

function repartitionDepenses() {
  const parCategorie = {};
  for (const t of transactions) {
    if (t.type === "depense") parCategorie[t.categorie] = (parCategorie[t.categorie] || 0) + t.montant;
  }
  return Object.entries(parCategorie).sort((a, b) => b[1] - a[1]);
}

function transactionsFiltrees() {
  const type = $("filtre-type").value;
  const categorie = $("filtre-categorie").value;
  const debut = $("filtre-debut").value;
  const fin = $("filtre-fin").value;
  const texte = $("filtre-texte").value.trim().toLowerCase();
  return transactions
    .filter((t) =>
      (!type || t.type === type) &&
      (!categorie || t.categorie === categorie) &&
      (!debut || t.date >= debut) &&
      (!fin || t.date <= fin) &&
      (!texte || t.description.toLowerCase().includes(texte))
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- Utilitaires DOM ---------- */

function $(id) {
  return document.getElementById(id);
}

function el(tag, classe, texte) {
  const noeud = document.createElement(tag);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function formatDate(iso) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

function aujourdhui() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function afficherErreur(message) {
  const zone = $("erreur");
  zone.textContent = message;
  zone.hidden = !message;
}

/* ---------- Rendu ---------- */

function renderSolde() {
  const revenus = total(transactions, "revenu");
  const depenses = total(transactions, "depense");
  const solde = revenus - depenses;
  $("solde").textContent = formatEuro.format(solde);
  $("solde").className = "solde " + (solde < 0 ? "negatif" : "positif");
  $("total-revenus").textContent = formatEuro.format(revenus);
  $("total-depenses").textContent = formatEuro.format(depenses);
}

function renderHistorique() {
  const liste = $("liste");
  const lignes = transactionsFiltrees();
  liste.replaceChildren();

  if (lignes.length === 0) {
    const vide = el("li", "vide", transactions.length ? "Aucun résultat pour ces filtres." : "Aucune transaction pour le moment.");
    liste.append(vide);
  }

  for (const t of lignes) {
    const cat = CATEGORIES[t.categorie];
    const ligne = el("li", "ligne");
    const badge = el("span", "badge", cat.libelle);
    badge.style.background = cat.couleur;
    const montant = el(
      "span",
      "montant " + (t.type === "revenu" ? "positif" : "negatif"),
      (t.type === "revenu" ? "+" : "−") + formatEuro.format(t.montant)
    );
    const modifier = el("button", "icone", "✎");
    modifier.type = "button";
    modifier.title = modifier.ariaLabel = "Modifier";
    modifier.addEventListener("click", () => demarrerEdition(t.id));
    const supprimer = el("button", "icone", "🗑");
    supprimer.type = "button";
    supprimer.title = supprimer.ariaLabel = "Supprimer";
    supprimer.addEventListener("click", () => supprimerTransaction(t.id));

    ligne.append(
      el("span", "date", formatDate(t.date)),
      el("span", "desc", t.description || "—"),
      badge, montant, modifier, supprimer
    );
    liste.append(ligne);
  }

  const revenus = total(lignes, "revenu");
  const depenses = total(lignes, "depense");
  $("resume-filtre").textContent = lignes.length
    ? `${lignes.length} transaction(s) · Revenus ${formatEuro.format(revenus)} · Dépenses ${formatEuro.format(depenses)}`
    : "";
}

const SVG_NS = "http://www.w3.org/2000/svg";

function pointSurCercle(angle, rayon) {
  return [100 + rayon * Math.cos(angle), 100 + rayon * Math.sin(angle)];
}

function renderGraphique() {
  const donut = $("donut");
  const legende = $("legende");
  donut.replaceChildren();
  legende.replaceChildren();

  const donnees = repartitionDepenses();
  const totalDepenses = donnees.reduce((s, [, v]) => s + v, 0);

  if (totalDepenses === 0) {
    donut.append(el("p", "vide", "Aucune dépense à afficher."));
    return;
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Répartition des dépenses : " +
      donnees.map(([c, v]) => `${CATEGORIES[c].libelle} ${Math.round((v / totalDepenses) * 100)} %`).join(", ")
  );

  const rExt = 90;
  const rInt = 55;
  let angle = -Math.PI / 2;

  for (const [cle, valeur] of donnees) {
    const cat = CATEGORIES[cle];
    const part = valeur / totalDepenses;
    let forme;

    if (donnees.length === 1) {
      // Un seul arc de 360° est dégénéré : on dessine un anneau.
      forme = document.createElementNS(SVG_NS, "circle");
      forme.setAttribute("cx", 100);
      forme.setAttribute("cy", 100);
      forme.setAttribute("r", (rExt + rInt) / 2);
      forme.setAttribute("fill", "none");
      forme.setAttribute("stroke", cat.couleur);
      forme.setAttribute("stroke-width", rExt - rInt);
    } else {
      const fin = angle + part * 2 * Math.PI;
      const grand = part > 0.5 ? 1 : 0;
      const [x1, y1] = pointSurCercle(angle, rExt);
      const [x2, y2] = pointSurCercle(fin, rExt);
      const [x3, y3] = pointSurCercle(fin, rInt);
      const [x4, y4] = pointSurCercle(angle, rInt);
      forme = document.createElementNS(SVG_NS, "path");
      forme.setAttribute(
        "d",
        `M${x1} ${y1} A${rExt} ${rExt} 0 ${grand} 1 ${x2} ${y2} L${x3} ${y3} A${rInt} ${rInt} 0 ${grand} 0 ${x4} ${y4} Z`
      );
      forme.setAttribute("fill", cat.couleur);
      angle = fin;
    }

    const titre = document.createElementNS(SVG_NS, "title");
    titre.textContent = `${cat.libelle} : ${formatEuro.format(valeur)} (${Math.round(part * 100)} %)`;
    forme.append(titre);
    svg.append(forme);

    const item = el("li");
    const pastille = el("span", "pastille");
    pastille.style.background = cat.couleur;
    item.append(
      pastille,
      el("span", "", cat.libelle),
      el("span", "valeur", `${formatEuro.format(valeur)} · ${Math.round(part * 100)} %`)
    );
    legende.append(item);
  }

  donut.append(svg);
}

function render() {
  renderSolde();
  renderGraphique();
  renderHistorique();
}

/* ---------- Actions ---------- */

function lireFormulaire() {
  const type = document.querySelector('input[name="type"]:checked').value;
  const montant = Number($("montant").value);
  const categorie = $("categorie").value;
  const date = $("date").value;
  const description = $("description").value.trim();

  if (!Number.isFinite(montant) || montant <= 0) return { erreur: "Le montant doit être supérieur à 0." };
  if (!(categorie in CATEGORIES)) return { erreur: "Choisissez une catégorie." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { erreur: "Indiquez une date valide." };

  return { valeur: { type, montant: Math.round(montant * 100) / 100, categorie, date, description } };
}

function reinitialiserFormulaire() {
  idEnEdition = null;
  $("formulaire").reset();
  $("date").value = aujourdhui();
  $("titre-form").textContent = "Nouvelle transaction";
  $("btn-valider").textContent = "Ajouter";
  $("btn-annuler").hidden = true;
  afficherErreur("");
}

function demarrerEdition(id) {
  const t = transactions.find((x) => x.id === id);
  if (!t) return;
  idEnEdition = id;
  document.querySelector(`input[name="type"][value="${t.type}"]`).checked = true;
  $("montant").value = t.montant;
  $("categorie").value = t.categorie;
  $("date").value = t.date;
  $("description").value = t.description;
  $("titre-form").textContent = "Modifier la transaction";
  $("btn-valider").textContent = "Enregistrer";
  $("btn-annuler").hidden = false;
  afficherErreur("");
  $("formulaire").scrollIntoView({ behavior: "smooth", block: "center" });
  $("montant").focus();
}

function supprimerTransaction(id) {
  if (!confirm("Supprimer cette transaction ?")) return;
  transactions = transactions.filter((t) => t.id !== id);
  if (idEnEdition === id) reinitialiserFormulaire();
  sauvegarderTransactions();
  render();
}

function soumettreFormulaire(evenement) {
  evenement.preventDefault();
  const { valeur, erreur } = lireFormulaire();
  if (erreur) return afficherErreur(erreur);

  if (idEnEdition) {
    transactions = transactions.map((t) => (t.id === idEnEdition ? { ...t, ...valeur } : t));
  } else {
    transactions.push({ id: crypto.randomUUID(), ...valeur });
  }
  sauvegarderTransactions();
  reinitialiserFormulaire();
  render();
}

function reinitialiserFiltres() {
  for (const id of ["filtre-type", "filtre-categorie", "filtre-debut", "filtre-fin", "filtre-texte"]) $(id).value = "";
  renderHistorique();
}

/* ---------- Initialisation ---------- */

function init() {
  for (const [cle, cat] of Object.entries(CATEGORIES)) {
    $("categorie").add(new Option(cat.libelle, cle));
  }
  $("filtre-categorie").add(new Option("Toutes les catégories", ""));
  for (const [cle, cat] of Object.entries(CATEGORIES)) {
    $("filtre-categorie").add(new Option(cat.libelle, cle));
  }

  $("date").value = aujourdhui();
  $("formulaire").addEventListener("submit", soumettreFormulaire);
  $("btn-annuler").addEventListener("click", reinitialiserFormulaire);
  $("btn-reinitialiser").addEventListener("click", reinitialiserFiltres);
  for (const id of ["filtre-type", "filtre-categorie", "filtre-debut", "filtre-fin", "filtre-texte"]) {
    $(id).addEventListener("input", renderHistorique);
  }

  render();
}

document.addEventListener("DOMContentLoaded", init);
