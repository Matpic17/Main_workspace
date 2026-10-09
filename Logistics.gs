/**
 * =============================================================================
 *  Logistics.gs — Extract pn_to_sol + règles de flag/unflag (R00 à R14)
 * =============================================================================
 *  main()                 : lance generate_kpi_extract() puis obso_flag_cleaning()
 *  generate_kpi_extract() : crée le fichier pn_to_sol_AAAAMMJJ dans le dossier des extracts
 *  obso_flag_cleaning()   : applique les règles et ajoute les PN à (dé)flaguer
 *                           dans l'onglet "Obso flag cleaning" du fichier Logistics
 * =============================================================================
 */

/** Lance tous les traitements logistics d'un coup. */
function main() {
  return executerAvecAlerte_("Logistics main", () => {
    const pnToSol = generate_kpi_extract();
    if (pnToSol === null) return; // extract manquant : message déjà affiché
    obso_flag_cleaning(pnToSol);   // undefined → obso_flag_cleaning relit le dernier pn_to_sol du dossier
  });
}


/**
 * Construit l'extract pn_to_sol : une ligne par (PN, solution non rejetée),
 * colonnes = CONFIG.LOGISTICS.ENTETES_PN_TO_SOL, + type/sous-type LBO.
 * @returns {Array<Array<*>>|undefined|null} les lignes (en-tête compris) ;
 *          null si un extract manque ; undefined si la création du fichier a échoué
 */
function generate_kpi_extract() {
  const L = CONFIG.LOGISTICS;
  const P = COLONNES.PARTNUMBER;
  const S = COLONNES.SOLUTION;

  const datas = get_data("log");
  if (!datas) return null;

  // --- A. Solutions indexées par groupe ---
  const solData = datas.cases_solution_data;
  const solHeaders = solData[0];
  const solMap = new Map();
  for (let i = 1; i < solData.length; i++) {
    const key = String(solData[i][S.GROUP_ID]).trim();
    if (key) {
      if (!solMap.has(key)) solMap.set(key, []);
      solMap.get(key).push(solData[i]);
    }
  }

  // --- B. Type / sous-type LBO par ID de scénario ---
  const lboData = datas.pn_lbo_data;
  const lboHeaders = lboData[0];
  const idxLboId = lboHeaders.indexOf(L.ENTETES_PN_LBO.ID);
  const idxLboType = lboHeaders.indexOf(L.ENTETES_PN_LBO.TYPE);
  const idxLboSubtype = lboHeaders.indexOf(L.ENTETES_PN_LBO.SOUS_TYPE);
  const lboMap = new Map();
  if (idxLboId > -1) {
    for (let i = 1; i < lboData.length; i++) {
      const row = lboData[i];
      lboMap.set(String(row[idxLboId]).trim(), {
        type: idxLboType > -1 ? row[idxLboType] : "",
        subtype: idxLboSubtype > -1 ? row[idxLboSubtype] : ""
      });
    }
  } else {
    log_(`⚠️ Colonne "${L.ENTETES_PN_LBO.ID}" introuvable dans pn_LBO : types LBO laissés vides.`);
  }

  // --- C. Correspondance des colonnes de sortie (par nom d'en-tête) ---
  const pnHeaders = datas.cases_partnumber_data[0];
  const idxScenarioIdPN = pnHeaders.indexOf(L.ENTETE_SCENARIO_ID);
  const idxScenarioIdSOL = solHeaders.indexOf(L.ENTETE_SCENARIO_ID);

  const colMapping = L.ENTETES_PN_TO_SOL.map(headerName => {
    let idxPN = -1;
    let idxSOL = -1;
    if (headerName === L.ENTETE_PN_GROUP_ID) {
      idxPN = P.PN_GROUP_ID;
    } else if (headerName === L.ENTETE_SOL_GROUP_ID) {
      idxSOL = S.GROUP_ID;
    } else if (headerName !== L.ENTETE_LBO_TYPE && headerName !== L.ENTETE_LBO_SOUS_TYPE) {
      idxPN = pnHeaders.indexOf(headerName);
      idxSOL = solHeaders.indexOf(headerName);
    }
    return { name: headerName, idxPN: idxPN, idxSOL: idxSOL };
  });

  const introuvables = colMapping.filter(m => m.idxPN === -1 && m.idxSOL === -1 &&
    m.name !== L.ENTETE_LBO_TYPE && m.name !== L.ENTETE_LBO_SOUS_TYPE).map(m => m.name);
  if (introuvables.length > 0) log_(`⚠️ Colonnes introuvables dans les extracts (laissées vides) : ${introuvables.join(", ")}`);

  // --- D. Construction des lignes ---
  const resultats = [L.ENTETES_PN_TO_SOL.slice()];
  const pnData = datas.cases_partnumber_data;

  for (let i = 1; i < pnData.length; i++) {
    const pnRow = pnData[i];
    if (estVide_(pnRow[P.PN_LOGISTICS])) continue;

    const joinKey = String(pnRow[P.PN_GROUP_ID]).trim();
    let solutionsList = solMap.get(joinKey) || [];
    if (solutionsList.length === 0) solutionsList = [null];

    solutionsList.forEach(solRow => {
      if (solRow && String(solRow[S.SOLUTION_STATE]).trim().toLowerCase() === "rejected") return;

      // ID de scénario : celui du PN, sinon celui de la solution
      let scenarioId = idxScenarioIdPN > -1 ? String(pnRow[idxScenarioIdPN]).trim() : "";
      if (!scenarioId && solRow && idxScenarioIdSOL > -1) scenarioId = String(solRow[idxScenarioIdSOL]).trim();
      const lboInfo = lboMap.get(scenarioId) || { type: "", subtype: "" };

      resultats.push(colMapping.map(map => {
        if (map.name === L.ENTETE_LBO_TYPE) return lboInfo.type;
        if (map.name === L.ENTETE_LBO_SOUS_TYPE) return lboInfo.subtype;
        if (map.idxPN > -1) return pnRow[map.idxPN];
        if (map.idxSOL > -1 && solRow) return solRow[map.idxSOL];
        return "";
      }));
    });
  }
  log_(`pn_to_sol : ${resultats.length - 1} ligne(s) calculée(s).`);

  // --- E. Création du fichier ---
  const now = new Date();
  const fileName = `pn_to_sol_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  if (!ecritureExterneAutorisee_(`création du fichier ${fileName} (${resultats.length} lignes) dans le dossier des extracts`)) {
    return resultats;
  }

  try {
    log_("Création du fichier en cours...");
    const newSS = SpreadsheetApp.create(fileName);
    DriveApp.getFileById(newSS.getId()).moveTo(DriveApp.getFolderById(CONFIG.IDS.DOSSIER_EXTRACTS));
    const sheet = newSS.getSheets()[0];
    sheet.getRange("D:D").setNumberFormat("@"); // Case_number en texte
    sheet.getRange(1, 1, resultats.length, resultats[0].length).setValues(resultats);
    log_("Fichier créé : " + fileName);
    return resultats;
  } catch (e) {
    alerteUtilisateur_("Erreur lors de la création de " + fileName + " : " + e.message);
    return undefined; // obso_flag_cleaning rechargera le dernier pn_to_sol du dossier
  }
}


/**
 * Règles logistics R00 à R14 : liste des PN à flaguer / déflaguer.
 * Écrit dans l'onglet CONFIG.ONGLETS.LOGISTICS_CLEANING du fichier Logistics.
 * @param {Array<Array<*>>=} data  pn_to_sol (sinon relu depuis le dossier)
 */
function obso_flag_cleaning(data) {
  const L = CONFIG.LOGISTICS;

  // --- 0. pn_to_sol ---
  if (!data) {
    const latestFileIds = findLatestFiles(CONFIG.IDS.DOSSIER_EXTRACTS);
    let pnToSolId = null;
    if (latestFileIds) {
      for (const key of latestFileIds.keys()) {
        if (key.includes("pn_to_sol")) { pnToSolId = latestFileIds.get(key); break; }
      }
    }
    if (!pnToSolId) {
      log_("❌ ERREUR : fichier pn_to_sol introuvable.");
      return;
    }
    data = SpreadsheetApp.openById(pnToSolId).getSheetByName(CONFIG.ONGLETS.PN_TO_SOL).getDataRange().getValues();
  }
  log_("Extract pn_to_sol chargé");

  // --- 1. Cas dont la dernière OG1 est postérieure à la date pivot ---
  const validCasesForCleaning = casValidesPourCleaning_();

  // --- 2. Préparation ---
  const cleaningSheet = ouvrirClasseur_(CONFIG.IDS.FICHIER_LOGISTICS, "le fichier Logistics").getSheetByName(CONFIG.ONGLETS.LOGISTICS_CLEANING);
  if (!cleaningSheet) {
    alerteUtilisateur_("Erreur : onglet '" + CONFIG.ONGLETS.LOGISTICS_CLEANING + "' introuvable.");
    return;
  }

  const headers = data[0];
  const E = L.ENTETES_REGLES;
  const idx = {
    pn: headers.indexOf(E.PN), cat: headers.indexOf(E.CAT), status: headers.indexOf(E.STATUS),
    scenario: headers.indexOf(E.SCENARIO), dateInit: headers.indexOf(E.DATE_INIT), dateNew: headers.indexOf(E.DATE_NEW),
    groupId: headers.indexOf(E.GROUP_ID), flag: headers.indexOf(E.FLAG), state: headers.indexOf(E.STATE),
    cause: headers.indexOf(E.CAUSE), caseNumber: headers.indexOf(E.CASE)
  };

  // Lignes regroupées par PN
  const lignesParPN = new Map();
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][idx.pn]).trim();
    if (key) {
      if (!lignesParPN.has(key)) lignesParPN.set(key, []);
      lignesParPN.get(key).push(data[i]);
    }
  }

  const pnToChange = [];
  const dateDuJour = new Date();

  // --- 2.5 R00 : PN présents dans SAP mais absents de TOM → UNFLAG ---
  const filesSAP = DriveApp.getFolderById(CONFIG.IDS.DOSSIER_SAP).getFiles();
  if (filesSAP.hasNext()) {
    const sapSheet = SpreadsheetApp.openById(filesSAP.next().getId()).getSheets()[0];
    const lastRowSAP = sapSheet.getLastRow();
    if (lastRowSAP > 1) {
      const ajoutes = new Set();
      sapSheet.getRange("A2:A" + lastRowSAP).getValues().forEach(row => {
        const sapPn = String(row[0]).trim().toUpperCase();
        if (sapPn && !lignesParPN.has(sapPn) && !ajoutes.has(sapPn)) {
          const newRow = new Array(headers.length).fill("");
          newRow[idx.pn] = sapPn;
          pnToChange.push([dateDuJour, ...newRow, "R00", "UNFLAG", "NA SAP"]);
          ajoutes.add(sapPn);
        }
      });
    } else {
      log_("Avertissement : le fichier SAP est vide.");
    }
  } else {
    log_("Avertissement : aucun fichier SAP trouvé.");
  }

  // --- 3. Règles R01 à R14, PN par PN ---
  lignesParPN.forEach(rows => {
    let isEqp = false;
    let hasOpenCase = false;
    let allStatusR01 = true;
    let sd9999withExceptions = true;
    let flag;
    let allReach = true;
    let hasAny9999 = false;
    const scenariosPresent = new Set();
    const groupsAnalysis = new Map();

    rows.forEach(row => {
      const cat = String(row[idx.cat] || "").trim().toUpperCase();
      const status = String(row[idx.status] || "").trim().toUpperCase();
      const scen = String(row[idx.scenario] || "").trim().toUpperCase();
      const groupId = String(row[idx.groupId] || "UNKNOWN_GROUP").trim();
      const causeCat = String(row[idx.cause] || "").trim().toUpperCase();
      flag = String(row[idx.flag] || "NO").trim(); // valeur de la DERNIÈRE ligne du PN

      const lineDate9999 = isDate9999(row[idx.dateInit]) || isDate9999(row[idx.dateNew]);
      if (lineDate9999) hasAny9999 = true;

      if (L.CATEGORIES_EQUIPEMENT.some(debut => cat.startsWith(debut))) isEqp = true;
      if (!L.STATUTS_FERMES.includes(status)) hasOpenCase = true;
      if (!L.STATUTS_R01.includes(status)) allStatusR01 = false;
      if (causeCat !== "REACH") allReach = false;

      if (!lineDate9999 && !L.EXCEPTIONS_R02_R03_R05.includes(status)) sd9999withExceptions = false;

      if (scen) scenariosPresent.add(scen);

      if (!groupsAnalysis.has(groupId)) groupsAnalysis.set(groupId, { has3F: false, hasLBO: false, has3F_9999: false });
      const g = groupsAnalysis.get(groupId);
      if (scen === "3F") g.has3F = true;
      if (scen === "LBO") g.hasLBO = true;
      if (scen === "3F" && lineDate9999) g.has3F_9999 = true;
    });

    const hasScenario = s => scenariosPresent.has(s);
    const groupes = Array.from(groupsAnalysis.values());
    const isR02Valid = groupes.length > 0 && groupes.every(g => g.has3F && g.hasLBO);
    const isR03Valid = groupes.length > 0 && groupes.every(g => g.has3F_9999);

    let ruleApplied = "";
    let action = "";

    if (allStatusR01) { ruleApplied = "R01"; action = "UNFLAG"; }
    else if (isEqp && isR02Valid && sd9999withExceptions) { ruleApplied = "R02"; action = "UNFLAG"; }
    else if (isEqp && isR03Valid && sd9999withExceptions) { ruleApplied = "R03"; action = "UNFLAG"; }
    else if (!isEqp && !hasOpenCase && hasScenario("QUALIFICATION") && !hasScenario("3F") && !hasScenario("REDESIGN")) { ruleApplied = "R04"; action = "UNFLAG"; }
    else if (!isEqp && sd9999withExceptions && hasAny9999) { ruleApplied = "R05"; action = "UNFLAG"; }
    else if (allReach) { ruleApplied = "R06"; action = "UNFLAG"; }
    else if (hasOpenCase) { ruleApplied = "R11"; action = "FLAG"; }
    else if (isEqp && !hasOpenCase) {
      if (rows.some(r => String(r[idx.scenario]).trim().toUpperCase() !== "3F")) { ruleApplied = "R12"; action = "FLAG"; }
    }
    else if (!isEqp && !hasOpenCase) {
      if (rows.some(r => String(r[idx.scenario]).trim().toUpperCase() !== "QUALIFICATION")) { ruleApplied = "R13"; action = "FLAG"; }
    }
    // ⚠️ R14 n'est jamais atteinte : tous les cas "!hasOpenCase" sont déjà traités par R12/R13.
    else if (!hasOpenCase && hasScenario("LBO") && !hasScenario("3F") && !hasScenario("QUALIFICATION")) {
      ruleApplied = "R14"; action = "FLAG";
    }

    // Déjà dans l'état voulu : rien à faire
    if ((flag == "YES" && action == "FLAG") || (flag == "NO" && action == "UNFLAG")) ruleApplied = ""; // eslint-disable-line eqeqeq

    if (ruleApplied === "") return;

    // Cleaning OK si TOUS les cas du PN (hors CANCEL/ALERT) ont leur dernière OG1 > date pivot
    let isPnCleaningOk = true;
    let hasAtLeastOneCase = false;
    if (idx.caseNumber > -1) {
      for (const r of rows) {
        const caseNumber = String(r[idx.caseNumber]).trim();
        const currentStatus = String(r[idx.status] || "").trim().toUpperCase();
        if (caseNumber !== "") {
          hasAtLeastOneCase = true;
          if (!L.STATUTS_IGNORES_CLEANING.includes(currentStatus) && !validCasesForCleaning.has(caseNumber)) {
            isPnCleaningOk = false;
            break;
          }
        }
      }
    }
    if (!hasAtLeastOneCase) isPnCleaningOk = false;

    const cleaningStatus = isPnCleaningOk ? "Cleaning OK" : "Cleaning NOK";
    (L.DUPLIQUER_LIGNES ? rows : [rows[0]]).forEach(row => {
      pnToChange.push([dateDuJour, ...row, ruleApplied, action, cleaningStatus]);
    });
  });

  // --- 4. Écriture ---
  log_("Chargement des données dans le fichier...");
  if (pnToChange.length === 0) {
    log_("Aucun résultat à enregistrer.");
    return;
  }
  if (!ecritureExterneAutorisee_(`fichier Logistics « ${CONFIG.ONGLETS.LOGISTICS_CLEANING} » : ${pnToChange.length} ligne(s)`)) return;
  const lastRow = cleaningSheet.getLastRow();
  assurerNombreLignes_(cleaningSheet, lastRow + pnToChange.length);
  cleaningSheet.getRange(lastRow + 1, 1, pnToChange.length, pnToChange[0].length).setValues(pnToChange);
  log_(pnToChange.length + " lignes ajoutées.");
}


/**
 * Cas dont la date OG1 la plus récente (cases_history le plus proche
 * d'aujourd'hui dans le dossier des extracts) est postérieure à la date pivot.
 * Colonnes repérées par nom d'en-tête (CONFIG.LOGISTICS.ENTETES_HISTORY).
 * @returns {Set<string>}
 */
function casValidesPourCleaning_() {
  const L = CONFIG.LOGISTICS;
  const valides = new Set();
  const p = L.DATE_PIVOT_OG1;
  const pivotDate = new Date(p.annee, p.mois0, p.jour, 23, 59, 59).getTime();

  // Fichier cases_history dont la date (AAAAMMJJ dans le nom) est la plus proche d'aujourd'hui
  let historyId = null;
  let closestDiff = Infinity;
  const today = new Date().getTime();
  const filesIter = DriveApp.getFolderById(CONFIG.IDS.DOSSIER_EXTRACTS).getFiles();
  while (filesIter.hasNext()) {
    const file = filesIter.next();
    const fileName = file.getName();
    if (!fileName.includes("cases_history")) continue;
    const match = fileName.match(/\d{8}/);
    if (match) {
      const s = match[0];
      const fileDate = new Date(parseInt(s.substring(0, 4), 10), parseInt(s.substring(4, 6), 10) - 1, parseInt(s.substring(6, 8), 10)).getTime();
      const diff = Math.abs(today - fileDate);
      if (diff < closestDiff) { closestDiff = diff; historyId = file.getId(); }
    } else if (!historyId) {
      historyId = file.getId();
    }
  }

  if (!historyId) {
    log_("❌ ERREUR CRITIQUE : aucun fichier 'cases_history' trouvé dans le dossier des extracts.");
    return valides;
  }

  const historySheet = SpreadsheetApp.openById(historyId).getSheets()[0];
  const lastCol = historySheet.getLastColumn();
  const lastRow = historySheet.getLastRow();
  const headersHistory = historySheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idxCaseId = headersHistory.indexOf(L.ENTETES_HISTORY.CASE);
  const idxDate = headersHistory.indexOf(L.ENTETES_HISTORY.DATE);
  const idxOG = headersHistory.indexOf(L.ENTETES_HISTORY.OG);
  log_("Recherche des colonnes : Case=" + idxCaseId + " | Date=" + idxDate + " | OG=" + idxOG);

  if (idxCaseId < 0 || idxDate < 0 || idxOG < 0 || lastRow <= 1) {
    log_("ERREUR CRITIQUE : colonnes introuvables ou fichier cases_history vide !");
    return valides;
  }

  // Lecture des 3 colonnes utiles uniquement
  const caseIdData = historySheet.getRange(2, idxCaseId + 1, lastRow - 1, 1).getValues();
  const dateData = historySheet.getRange(2, idxDate + 1, lastRow - 1, 1).getValues();
  const ogData = historySheet.getRange(2, idxOG + 1, lastRow - 1, 1).getValues();

  const caseMaxDates = new Map();
  for (let i = 0; i < lastRow - 1; i++) {
    const caseId = String(caseIdData[i][0]).trim();
    const ogCode = String(ogData[i][0]).trim().toUpperCase();
    if (ogCode !== "OG1" || caseId === "") continue;

    const d = dateEnMillisecondes_(dateData[i][0]);
    if (!isNaN(d) && d > (caseMaxDates.get(caseId) || 0)) caseMaxDates.set(caseId, d);
  }

  caseMaxDates.forEach((maxDate, caseId) => { if (maxDate > pivotDate) valides.add(caseId); });
  log_("✅ " + valides.size + " Cases ID validés (dernière OG1 > pivot) sur " + caseMaxDates.size + " uniques avec OG1.");
  return valides;
}

/** Date (objet Date, "jj/mm/aa[aa] hh:mm" ou autre format lisible) → millisecondes (NaN si illisible). */
function dateEnMillisecondes_(valeur) {
  if (valeur instanceof Date) return valeur.getTime();
  if (typeof valeur === "string" && valeur.includes("/")) {
    const parts = valeur.split(" ")[0].split("/");
    if (parts.length >= 3) {
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      return new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
    }
    return NaN;
  }
  return new Date(valeur).getTime();
}


/** Vrai si la valeur correspond au 31/12/9999 (date "sans fin"). */
function isDate9999(val) {
  if (!val || val == "") return false; // eslint-disable-line eqeqeq
  if (Object.prototype.toString.call(val) === "[object Date]") {
    return val.getFullYear() === 9999 && val.getDate() === 31 && val.getMonth() === 11;
  }
  const s = String(val);
  return s.includes("9999") && s.includes("12") && s.includes("31");
}


/**
 * KPI mensuel IN / OUT / WIP des PN flagués : compare le pn_to_sol courant à
 * celui du début du mois précédent. Ajoute une ligne à l'onglet
 * CONFIG.ONGLETS.LOGISTICS_IN_OUT du fichier Logistics.
 * (Fonction présente dans l'avant-dernière version de Logistics.gs sur GitHub.)
 */
function inOutWip_PN_flagued() {
  const sheet = getOngletObligatoire_(ouvrirClasseur_(CONFIG.IDS.FICHIER_LOGISTICS, "le fichier Logistics"), CONFIG.ONGLETS.LOGISTICS_IN_OUT);
  const lastRow = sheet.getLastRow();

  const latestFileIds = findLatestFiles(CONFIG.IDS.DOSSIER_EXTRACTS);
  const pnToSolId = latestFileIds && latestFileIds.get("pn_to_sol");
  if (!pnToSolId) throw new Error("Pas de PN to solution dans le dossier fourni");
  const pn_solution = SpreadsheetApp.openById(pnToSolId);
  log_(pn_solution.getName());
  const pn_solution_last_month = getPreviousMonthFile();

  const flagsParPN = valeurs => {
    const map = new Map();
    valeurs.forEach(row => {
      const cle = String(row[0]);
      if (!map.has(cle)) map.set(cle, { flag: row[2] });
    });
    return map;
  };
  const pn = flagsParPN(pn_solution.getSheets()[0].getDataRange().getValues());
  const pn_last_month = flagsParPN(SpreadsheetApp.open(pn_solution_last_month).getSheets()[0].getDataRange().getValues());

  let flag_kpi = 0;
  let unflag_kpi = 0;
  const wip = pn.size - 1; // -1 pour l'en-tête

  pn.forEach((currentData, keyPN) => {
    if (pn_last_month.has(keyPN)) {
      const avant = pn_last_month.get(keyPN).flag;
      if (avant == "NO" && currentData.flag == "YES") flag_kpi += 1;        // eslint-disable-line eqeqeq
      else if (avant == "YES" && currentData.flag == "NO") unflag_kpi += 1; // eslint-disable-line eqeqeq
    } else if (currentData.flag == "YES") {                                 // eslint-disable-line eqeqeq
      flag_kpi += 1;
    }
  });

  const date = new Date().toLocaleString("fr-FR", { year: "numeric", month: "numeric", day: "numeric" });
  if (!ecritureExterneAutorisee_(`fichier Logistics « ${CONFIG.ONGLETS.LOGISTICS_IN_OUT} » : ${JSON.stringify([date, flag_kpi, unflag_kpi, wip])}`)) return;
  sheet.getRange(lastRow + 1, 1, 1, 4).setValues([[date, flag_kpi, unflag_kpi, wip]]);
}


/** Plus ancien fichier pn_to_sol_AAAAMMJJ du mois précédent (objet File Drive). */
function getPreviousMonthFile() {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();
  const displayTarget = String(targetMonth + 1).padStart(2, "0") + "/" + targetYear;
  log_(`Recherche du fichier le plus ancien pour la période : ${displayTarget}`);

  const validFiles = [];
  const files = DriveApp.getFolderById(CONFIG.IDS.DOSSIER_EXTRACTS).getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const match = file.getName().match(/pn_to_sol_(\d{4})(\d{2})(\d{2})/);
    if (!match) continue;
    const fileYear = parseInt(match[1], 10);
    const fileMonth = parseInt(match[2], 10) - 1;
    const fileDay = parseInt(match[3], 10);
    if (fileMonth === targetMonth && fileYear === targetYear) {
      validFiles.push({ file: file, fullDate: new Date(fileYear, fileMonth, fileDay) });
    }
  }

  if (validFiles.length === 0) {
    throw new Error(`Aucun fichier "PN_to_SOL" trouvé pour le mois de ${displayTarget} dans le dossier.`);
  }
  validFiles.sort((a, b) => a.fullDate - b.fullDate);
  const oldestFile = validFiles[0].file;
  log_(`Fichier trouvé : ${oldestFile.getName()} (ID: ${oldestFile.getId()})`);
  return oldestFile;
}
