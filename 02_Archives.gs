/**
 * =============================================================================
 *  02_Archive.gs — Archivage en BDD et lecture de la semaine précédente
 * =============================================================================
 *  • Les lignes sont collées EN BAS de l'onglet (après la dernière ligne datée
 *    et après tout contenu présent dans les colonnes écrites) : rien n'est écrasé.
 *  • La colonne A reçoit une vraie date (format CONFIG.ARCHIVE.FORMAT_DATE).
 *  • Colonne CONFIG.ARCHIVE.ENTETE_NOUVEAU : "Nouveau" si la ligne n'était pas
 *    dans l'archive à la date précédente de l'onglet, sinon "Existant".
 *  • La "date précédente" = dernière date STRICTEMENT antérieure à aujourd'hui
 *    dans l'onglet (même définition pour les mails).
 *
 *  Clés d'identification d'une ligne (champ `cle` de getFiltresImport_) :
 *    "cas"          → n° de cas
 *    "cas+anomalie" → n° de cas + libellé "Anomaly: …"
 *    "scenario"     → ID du scénario (COLONNES.SOLUTION.SCENARIO_ID_MAIL)
 *    "cas+pn"       → n° de cas + part number
 *    "cas+groupe"   → n° de cas + groupe (COLONNES.SOLUTION.GROUP_ID)
 * =============================================================================
 */

/**
 * Ajoute des lignes en bas d'un onglet de base, une seule fois par jour.
 *
 * @param {string} idClasseur
 * @param {string} libelle      pour le journal ("la BDD archive"…)
 * @param {string} onglet
 * @param {Array<Array<*>>} donnee  lignes AVEC la date en colonne A
 * @param {{retirerFiltre: boolean, typeCle: (string|undefined), enteteDerniereColonne: (string|undefined)}} options
 *        typeCle renseigné → ajout de la colonne "Nouveau / Existant"
 *        enteteDerniereColonne → nom écrit en ligne 1 au-dessus de la dernière colonne de données (si vide)
 */
function ajouterEnBDD_(idClasseur, libelle, onglet, donnee, options) {
  const opts = options || {};
  if (!donnee || donnee.length === 0) return;

  const sheet = ouvrirClasseur_(idClasseur, libelle).getSheetByName(onglet);
  if (!sheet) {
    log_(`⚠️ Onglet « ${onglet} » introuvable dans ${libelle} : données NON archivées.`);
    return;
  }

  // --- Dernière ligne datée (colonne A) ---
  const derniereLigne = sheet.getLastRow();
  const colonneA = derniereLigne > 0 ? sheet.getRange(1, 1, derniereLigne, 1).getValues() : [];
  let derniereLigneDatee = 0;
  for (let i = colonneA.length - 1; i >= 1; i--) {
    if (colonneA[i][0] !== "" && colonneA[i][0] !== null) { derniereLigneDatee = i + 1; break; }
  }
  if (derniereLigneDatee > 0 && jourDe_(colonneA[derniereLigneDatee - 1][0]) === jourAujourdhui_()) {
    log_(`  • ${libelle} « ${onglet} » : déjà alimenté aujourd'hui, ignoré.`);
    return;
  }

  // --- Nouveau / Existant ---
  let drapeaux = null;
  let detail = "";
  if (opts.typeCle) {
    const precedent = lireArchivePrecedente_(sheet);
    const clesPrecedentes = new Set();
    precedent.lignes.forEach(r => {
      const cle = cleLigne_(opts.typeCle, r.slice(1));
      if (cle) clesPrecedentes.add(cle);
    });
    drapeaux = donnee.map(r => (clesPrecedentes.has(cleLigne_(opts.typeCle, r.slice(1)))
      ? CONFIG.ARCHIVE.VALEUR_EXISTANT : CONFIG.ARCHIVE.VALEUR_NOUVEAU));
    const nbNouveaux = drapeaux.filter(d => d === CONFIG.ARCHIVE.VALEUR_NOUVEAU).length;
    detail = ` (${nbNouveaux} nouvelle(s), ${donnee.length - nbNouveaux} existante(s) par rapport au ${jourLisible_(precedent.jour)})`;
  }

  if (!ecritureExterneAutorisee_(`${libelle}, onglet « ${onglet} » : ${donnee.length} ligne(s)${detail}`)) return;

  if (opts.retirerFiltre) {
    const filtre = sheet.getFilter();
    if (filtre) filtre.remove();
  }

  // --- Colonne "Nouveau / Existant" (repérée par son en-tête, créée si besoin) ---
  const largeur = donnee[0].length;
  let colonneDrapeau = 0;
  if (drapeaux) {
    const derniereColonne = sheet.getLastColumn();
    const entetes = derniereColonne > 0 ? sheet.getRange(1, 1, 1, derniereColonne).getValues()[0] : [];
    const index = entetes.lastIndexOf(CONFIG.ARCHIVE.ENTETE_NOUVEAU);
    if (index >= 0 && index + 1 > largeur) {
      colonneDrapeau = index + 1;
    } else if (index >= 0) {
      // Les données sont devenues plus larges que l'emplacement de la colonne : on insère des
      // colonnes AVANT elle, ce qui la décale vers la droite AVEC tout son historique.
      const aInserer = largeur - index;
      sheet.insertColumnsBefore(index + 1, aInserer);
      colonneDrapeau = index + 1 + aInserer;
      log_(`ℹ️ « ${onglet} » : ${aInserer} colonne(s) insérée(s) ; la colonne « ${CONFIG.ARCHIVE.ENTETE_NOUVEAU} » ` +
           `passe de ${lettreColonne_(index)} à ${lettreColonne_(colonneDrapeau - 1)} (historique conservé).`);
    } else {
      let dernierEntete = 0;
      entetes.forEach((e, i) => { if (e !== "" && e !== null) dernierEntete = i + 1; });
      colonneDrapeau = Math.max(largeur, dernierEntete) + 1;
      assurerNombreColonnes_(sheet, colonneDrapeau);
      sheet.getRange(1, colonneDrapeau).setValue(CONFIG.ARCHIVE.ENTETE_NOUVEAU);
    }
  }

  // --- Ligne de départ : sous la dernière ligne datée ET sous tout contenu des colonnes écrites ---
  let ligneDepart = derniereLigneDatee + 1;
  if (derniereLigne > derniereLigneDatee) {
    const largeurLue = Math.max(largeur, colonneDrapeau);
    const dessous = sheet.getRange(derniereLigneDatee + 1, 1, derniereLigne - derniereLigneDatee, largeurLue).getValues();
    for (let k = dessous.length - 1; k >= 0; k--) {
      const occupee = dessous[k].some((v, j) => v !== "" && v !== null && (j < largeur || j === colonneDrapeau - 1));
      if (occupee) { ligneDepart = derniereLigneDatee + k + 2; break; }
    }
  }
  ligneDepart = Math.max(ligneDepart, 2);

  // --- Écriture ---
  assurerNombreColonnes_(sheet, largeur);
  assurerNombreLignes_(sheet, ligneDepart + donnee.length - 1);
  sheet.getRange(ligneDepart, 1, donnee.length, largeur).setValues(donnee);
  sheet.getRange(ligneDepart, 1, donnee.length, 1).setNumberFormat(CONFIG.ARCHIVE.FORMAT_DATE);
  if (drapeaux) sheet.getRange(ligneDepart, colonneDrapeau, donnee.length, 1).setValues(drapeaux.map(d => [d]));
  if (opts.enteteDerniereColonne) nommerColonneSiVide_(sheet, largeur, opts.enteteDerniereColonne);

  log_(`  • ${libelle} « ${onglet} » : ${donnee.length} ligne(s) ajoutée(s) à partir de la ligne ${ligneDepart}${detail}.`);
}


/**
 * Lignes d'un onglet d'archive à la dernière date STRICTEMENT antérieure à
 * aujourd'hui (lignes complètes, date en colonne A).
 * @returns {{jour: (string|null), lignes: Array<Array<*>>}}  jour au format "aaaammjj"
 */
function lireArchivePrecedente_(sheet) {
  const derniereLigne = sheet.getLastRow();
  if (derniereLigne < 2) return { jour: null, lignes: [] };

  const aujourdhui = jourAujourdhui_();
  const jours = sheet.getRange(1, 1, derniereLigne, 1).getValues().map(r => jourDe_(r[0]));

  let jourPrecedent = null;
  for (let i = 1; i < jours.length; i++) {
    const j = jours[i];
    if (j && j < aujourdhui && (!jourPrecedent || j > jourPrecedent)) jourPrecedent = j;
  }
  if (!jourPrecedent) return { jour: null, lignes: [] };

  const premiere = jours.indexOf(jourPrecedent);
  const derniere = jours.lastIndexOf(jourPrecedent);
  const bloc = sheet.getRange(premiere + 1, 1, derniere - premiere + 1, sheet.getLastColumn()).getValues();
  return { jour: jourPrecedent, lignes: bloc.filter((r, k) => jours[premiere + k] === jourPrecedent) };
}


/**
 * Clé d'identification d'une ligne (SANS la date en tête).
 * @param {string} typeCle  "cas" | "cas+anomalie" | "scenario" | "cas+pn" | "cas+groupe"
 * @param {Array<*>} row
 * @returns {string} "" si la ligne n'a pas d'identifiant
 */
function cleLigne_(typeCle, row) {
  const numeroCas = texte_(row[COLONNES.CAS.CASE_NUMBER]);
  switch (typeCle) {
    case "cas+anomalie":
      return numeroCas ? numeroCas + " | " + trouverAnomalie_(row) : "";
    case "scenario":
      return texte_(row[COLONNES.SOLUTION.SCENARIO_ID_MAIL]);
    case "cas+pn":
      return numeroCas ? numeroCas + " | " + texte_(row[COLONNES.PARTNUMBER.PART_NUMBER]) : "";
    case "cas+groupe":
      return numeroCas ? numeroCas + " | " + texte_(row[COLONNES.SOLUTION.GROUP_ID]) : "";
    default:
      return numeroCas;
  }
}

/** Libellé "Anomaly: …" ajouté par lbotest (cherché depuis la fin de la ligne). */
function trouverAnomalie_(row) {
  for (let i = row.length - 1; i >= 0; i--) {
    if (typeof row[i] === "string" && row[i].startsWith("Anomaly:")) return row[i];
  }
  return "";
}

/** Texte nettoyé ("" pour vide / null / undefined). */
function texte_(valeur) {
  return valeur === undefined || valeur === null ? "" : String(valeur).trim();
}

/** Nom de personne comparable d'une semaine à l'autre (casse et espaces ignorés). */
function normaliserNom_(nom) {
  return String(nom).toLowerCase().replace(/\s+/g, " ").trim();
}


// =============================================================================
// DATES
// =============================================================================

/** Jour "aaaammjj" d'une cellule de colonne A (Date ou texte "jj/mm/aaaa"), null sinon. */
function jourDe_(valeur) {
  if (valeur instanceof Date) {
    return isNaN(valeur.getTime()) ? null : Utilities.formatDate(valeur, Session.getScriptTimeZone(), "yyyyMMdd");
  }
  const m = texte_(valeur).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? m[3] + m[2].padStart(2, "0") + m[1].padStart(2, "0") : null;
}

function jourAujourdhui_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
}

/** "aaaammjj" → "jj/mm/aaaa" (ou "aucune archive précédente"). */
function jourLisible_(jour) {
  return jour ? `${jour.substring(6, 8)}/${jour.substring(4, 6)}/${jour.substring(0, 4)}` : "aucune archive précédente";
}

/** Date du jour à minuit (colonne A de l'archive). */
function dateDuJourMinuit_() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Ajoute des colonnes en fin d'onglet si besoin pour pouvoir écrire jusqu'à `derniereColonne`. */
function assurerNombreColonnes_(onglet, derniereColonne) {
  const max = onglet.getMaxColumns();
  if (derniereColonne > max) onglet.insertColumnsAfter(max, derniereColonne - max);
}

/** Écrit `nom` en ligne 1 de la colonne `colonne` (base 1) si la cellule est vide. */
function nommerColonneSiVide_(onglet, colonne, nom) {
  const cellule = onglet.getRange(1, colonne);
  if (cellule.getValue() === "") cellule.setValue(nom);
}
