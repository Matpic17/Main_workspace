/**
 * =============================================================================
 *  01_Utils.gs — FONCTIONS UTILITAIRES PARTAGÉES
 * =============================================================================
 *  Journalisation, gestion d'erreurs, mode test, accès aux classeurs, mails.
 *  Les fonctions se terminant par "_" sont privées (invisibles dans le menu
 *  "Exécuter" d'Apps Script).
 * =============================================================================
 */

// Cache des classeurs ouverts pendant UNE exécution (évite de rouvrir 15 fois la BDD)
const CACHE_CLASSEURS_ = {};
// Profondeur d'appel des traitements encadrés (pour ne notifier qu'une fois en cas d'erreur)
const ETAT_EXECUTION_ = { profondeur: 0 };


// =============================================================================
// JOURNAL & ERREURS
// =============================================================================

function log_(message) {
  Logger.log(message);
}

/**
 * Exécute un traitement en journalisant début / fin / durée.
 * En cas d'erreur : journalise le détail, envoie un mail d'alerte (si
 * CONFIG.EMAILS.ALERTE_ERREUR est rempli) puis RELANCE l'erreur pour que
 * l'exécution apparaisse bien en échec dans Apps Script.
 *
 * @param {string} nomTraitement
 * @param {Function} fn
 * @returns {*} le résultat de fn
 */
function executerAvecAlerte_(nomTraitement, fn) {
  const debut = Date.now();
  ETAT_EXECUTION_.profondeur++;
  log_(`▶️ ${nomTraitement} — début`);
  try {
    const resultat = fn();
    log_(`✅ ${nomTraitement} — terminé en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
    return resultat;
  } catch (e) {
    log_(`❌ ${nomTraitement} — ÉCHEC après ${((Date.now() - debut) / 1000).toFixed(1)} s : ${e.message}`);
    if (e.stack) log_(e.stack);
    if (ETAT_EXECUTION_.profondeur === 1) notifierErreur_(nomTraitement, e);
    throw e;
  } finally {
    ETAT_EXECUTION_.profondeur--;
  }
}

function notifierErreur_(nomTraitement, erreur) {
  const destinataire = CONFIG.EMAILS.ALERTE_ERREUR;
  if (!destinataire) return;
  try {
    const corps = `
      <div>
        Le traitement <b>${nomTraitement}</b> a échoué le ${new Date().toLocaleString("fr-FR")}.<br><br>
        <b>Erreur :</b> ${echapperHtml_(erreur.message)}<br><br>
        <pre style="font-size: 9pt;">${echapperHtml_(erreur.stack || "")}</pre>
        Détail complet : Apps Script → Exécutions.
      </div>`;
    GmailApp.sendEmail(destinataire, `⚠️ TOM — échec de ${nomTraitement}`, "", { htmlBody: corps });
  } catch (e) {
    log_(`⚠️ Impossible d'envoyer le mail d'alerte : ${e.message}`);
  }
}

function echapperHtml_(texte) {
  return String(texte)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Affiche une alerte si le script est lancé à la main (interface disponible),
 * sinon (déclencheur) se contente du journal.
 */
function alerteUtilisateur_(message) {
  log_(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    // Lancement par déclencheur : pas d'interface disponible
  }
}


// =============================================================================
// MODE TEST
// =============================================================================

function modeTest_() {
  return CONFIG.MODE_TEST.ACTIF === true;
}

/**
 * Indique si l'on a le droit d'écrire dans un fichier EXTERNE au classeur actif.
 * En mode test (sans ECRITURES_EXTERNES), journalise ce qui aurait été fait.
 *
 * @param {string} description  ce qui serait écrit (pour le journal)
 * @returns {boolean}
 */
function ecritureExterneAutorisee_(description) {
  if (!modeTest_() || CONFIG.MODE_TEST.ECRITURES_EXTERNES === true) return true;
  log_(`🧪 [MODE TEST] Écriture externe NON effectuée : ${description}`);
  return false;
}


// =============================================================================
// MAILS
// =============================================================================

function emailValide_(adresse) {
  return typeof adresse === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse.trim());
}

/**
 * Point de passage UNIQUE pour tous les mails du projet (respecte le mode test).
 *
 * @param {string} destinataire
 * @param {string} sujet
 * @param {string} corpsHtml
 * @param {Object=} imagesInline  ex. { logoRapport: blob }
 * @returns {boolean} true si le mail est parti (ou simulé en mode test)
 */
function envoyerMail_(destinataire, sujet, corpsHtml, imagesInline) {
  if (!emailValide_(destinataire)) {
    log_(`⚠️ Mail NON envoyé ("${sujet}") : adresse invalide « ${destinataire} ».`);
    return false;
  }
  let dest = destinataire;
  let objet = sujet;
  if (modeTest_()) {
    const redirection = CONFIG.MODE_TEST.EMAIL_REDIRECTION;
    if (!redirection) {
      log_(`🧪 [MODE TEST] Mail simulé → ${destinataire} | ${sujet}`);
      return true;
    }
    dest = redirection;
    objet = `[TEST → ${destinataire}] ${sujet}`;
  }
  const options = { htmlBody: corpsHtml };
  if (imagesInline) options.inlineImages = imagesInline;
  GmailApp.sendEmail(dest, objet, "", options);
  return true;
}


// =============================================================================
// CLASSEURS & ONGLETS
// =============================================================================

/** Ouvre un classeur par ID (une seule fois par exécution) avec un message d'erreur clair. */
function ouvrirClasseur_(id, libelle) {
  if (CACHE_CLASSEURS_[id]) return CACHE_CLASSEURS_[id];
  try {
    CACHE_CLASSEURS_[id] = SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error(`Impossible d'ouvrir ${libelle || "le classeur"} (ID ${id}) : ${e.message}`);
  }
  return CACHE_CLASSEURS_[id];
}

/** Renvoie l'onglet demandé ou lève une erreur explicite s'il n'existe pas. */
function getOngletObligatoire_(classeur, nomOnglet) {
  const onglet = classeur.getSheetByName(nomOnglet);
  if (!onglet) throw new Error(`Onglet « ${nomOnglet} » introuvable dans « ${classeur.getName()} ».`);
  return onglet;
}

/** Ajoute des lignes en fin d'onglet si besoin pour pouvoir écrire jusqu'à `derniereLigne`. */
function assurerNombreLignes_(onglet, derniereLigne) {
  const max = onglet.getMaxRows();
  if (derniereLigne > max) onglet.insertRowsAfter(max, derniereLigne - max);
}

/** Convertit une lettre de colonne ("DH") en numéro base 1 (112). */
function a1VersNumeroColonne_(lettres) {
  let n = 0;
  for (const c of String(lettres).toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}

/** Lettre de colonne à partir d'un index BASE 0 (0 → "A", 52 → "BA"). */
function lettreColonne_(index0) {
  return colIndexToA1(index0 + 1);
}


// =============================================================================
// DONNÉES
// =============================================================================

/** Copie profonde (1 niveau) d'un tableau 2D : les filtres ne modifient jamais les données sources. */
function copierLignes_(data) {
  return data.map(row => row.slice());
}

/**
 * Test "cellule vide" IDENTIQUE à l'ancien code (comparaison souple `== ""`).
 * ⚠️ Volontairement souple : conserve exactement le comportement historique.
 */
function estVide_(valeur) {
  return valeur == ""; // eslint-disable-line eqeqeq
}

/** Année (2 chiffres) d'un numéro de cas "AA-NNNNNN" (NaN si non numérique). */
function anneeDuCas_(numeroCas) {
  return parseInt(String(numeroCas).substring(0, 2));
}

/** Vrai si le numéro de cas a 6 caractères après le séparateur ("AA-NNNNNN"). */
function formatCasValide_(numeroCas) {
  return String(numeroCas).substring(3).length === 6;
}

/**
 * Regroupe les lignes par valeur d'une colonne et ne conserve que les groupes
 * dont TOUTES les lignes vérifient `conditionLigne`.
 * Ordre conservé : ordre de première apparition du groupe, puis ordre des lignes.
 */
function garderGroupesValides_(lignes, colonneGroupe, conditionLigne) {
  const groupes = new Map();
  lignes.forEach(row => {
    const cle = row[colonneGroupe];
    if (!groupes.has(cle)) groupes.set(cle, { valide: true, lignes: [] });
    const groupe = groupes.get(cle);
    if (!conditionLigne(row)) groupe.valide = false;
    groupe.lignes.push(row);
  });
  const resultat = [];
  groupes.forEach(groupe => {
    if (groupe.valide) groupe.lignes.forEach(row => resultat.push(row));
  });
  return resultat;
}

/** Date au format "jj/mm/aaaa" (même rendu que l'ancien code). */
function dateCourteFr_(date) {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "numeric", year: "numeric" });
}
