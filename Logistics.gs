// Cette fonction permet de lancer tous les scripts logistics d'un seul coup
function main() {
  var pnToSol = generate_kpi_extract();
  obso_flag_cleaning(pnToSol);
}

function generate_kpi_extract() {
  var datas = get_data("log");
  // --- 1. CONFIGURATION ---
  const IDX_PN_JOIN_KEY = 53;  // Col BA
  const IDX_SOL_JOIN_KEY = 64; // Col BL
  const IDX_SOL_STATE = 72;    // Col AB
  
  // Colonnes sources pour Scenario ID (nécessaire pour le pré-calcul)
  const SCENARIO_ID_HEADER_NAME = "Scenario_ID";

  const LBO_HEADER_ID = "scenario.id";
  const LBO_HEADER_TYPE = "lbo_scenario_data.lbo_type";
  const LBO_HEADER_SUBTYPE = "lbo_scenario_data.lbo_subtype";

  // ORDRE MODIFIÉ : LBO insérés avant "Sizing_element"
  const FINAL_HEADERS_ORDERED = [
    "Part_number", "Part_sap_designation", "Obso_flag", "Case_number",
    "Case_creation_date", "Case_description", "Case_review_date",
    "Obsolete_component", "Impact_on_repair_capability", "Case_category_code",
    "Case_status_code", "Obsolescence_gate_code", "Supplier_name",
    "Case_leader_last_name", "Scenario_type_code", "Scenario_title",
    "Scenario_description",
    "SCENARIO_LBO_type",     // <--- DÉPLACÉ ICI
    "SCENARIO_LBO_subtype",  // <--- DÉPLACÉ ICI
    "Sizing_element", "Prev_lbo_cost",
    "Group_initial_shortage_date", "Group_new_shortage_date", "PN_initial_shortage_date", "PN_new_shortage_date",
    "Group_name", "Program", "Variant", "Solution_decision_date", "Solution_decision_maker",
    "Solution_decision_comment", "Solution_state", "Solution_status",
    "Implementation_type_code", "Implementation_first_field_value",
    "Implementation_status", "PN_Group_ID", "SOL_Group_ID",
    "Scenario_ID", "LBO_deadline", "Cause_category_code"
  ];

  // --- 2. PRÉPARATION DES DONNÉES ---

  // A. Indexation Solution
  let solMap = new Map();
  let solData = datas.cases_solution_data;
  let solHeaders = solData[0];

  for(let i = 1; i < solData.length; i++) {
    let row = solData[i];
    let key = String(row[IDX_SOL_JOIN_KEY]).trim();
    if(key) {
      if (!solMap.has(key)) solMap.set(key, []);
      solMap.get(key).push(row);
    }
  }

  // B. Indexation LBO
  let lboMap = new Map();
  let lboData = datas.pn_lbo_data;
  let lboHeaders = lboData[0];

  let idxLboId = lboHeaders.indexOf(LBO_HEADER_ID);
  let idxLboType = lboHeaders.indexOf(LBO_HEADER_TYPE);
  let idxLboSubtype = lboHeaders.indexOf(LBO_HEADER_SUBTYPE);

  if(idxLboId > -1) {
    for(let i = 1; i < lboData.length; i++) {
      let row = lboData[i];
      let id = String(row[idxLboId]).trim();
      lboMap.set(id, {
        type: (idxLboType > -1) ? row[idxLboType] : "",
        subtype: (idxLboSubtype > -1) ? row[idxLboSubtype] : ""
      });
    }
  }

  // C. Mapping des colonnes (CORRECTION GROUP ID ICI)
  let pnHeaders = datas.cases_partnumber_data[0];
  let colMapping = [];

  // On cherche l'index de Scenario_ID dans les sources pour le pré-calcul
  let sourceIdxScenID_PN = pnHeaders.indexOf(SCENARIO_ID_HEADER_NAME);
  let sourceIdxScenID_SOL = solHeaders.indexOf(SCENARIO_ID_HEADER_NAME);

  FINAL_HEADERS_ORDERED.forEach(headerName => {
    let idxPN = -1;
    let idxSOL = -1;
    let idxFlag = -1;

    // -- CORRECTION 1 : Gestion manuelle des colonnes renommées --
    if (headerName === "PN_Group_ID") {
      idxPN = IDX_PN_JOIN_KEY; // On force l'index 52
    }
    else if (headerName === "SOL_Group_ID") {
      idxSOL = IDX_SOL_JOIN_KEY; // On force l'index 63
    }
    else if (headerName === "SCENARIO_LBO_type" || headerName === "SCENARIO_LBO_subtype") {
      // Index restent à -1
    }
    else {
      idxPN = pnHeaders.indexOf(headerName);
      idxSOL = solHeaders.indexOf(headerName);
    }

    colMapping.push({ name: headerName, idxPN: idxPN, idxSOL: idxSOL });
  });

  // --- 3. BOUCLE PRINCIPALE ---
  let resultats = [];
  resultats.push(FINAL_HEADERS_ORDERED); // En-têtes dans le bon ordre

  let pnData = datas.cases_partnumber_data;

  for(let i = 1; i < pnData.length; i++) {
    let pnRow = pnData[i];
    if(pnRow[68] == "") continue;

    let joinKey = String(pnRow[IDX_PN_JOIN_KEY]).trim();
    let solutionsList = solMap.get(joinKey) || [];
    
    if (solutionsList.length === 0) {
      solutionsList = [null];
    }

    for (let s = 0; s < solutionsList.length; s++) {
      let solRow = solutionsList[s];

      if (solRow) {
        let status = String(solRow[IDX_SOL_STATE]).trim();
        if (status.toLowerCase() === "rejected") continue;
      }

      // -- CORRECTION 2 : PRÉ-CALCUL DU SCENARIO ID --
      let currentScenarioId = "";
      
      if (sourceIdxScenID_PN > -1) {
        currentScenarioId = String(pnRow[sourceIdxScenID_PN]).trim();
      }
      if ((!currentScenarioId || currentScenarioId === "") && solRow && sourceIdxScenID_SOL > -1) {
        currentScenarioId = String(solRow[sourceIdxScenID_SOL]).trim();
      }
      
      let lboInfo = lboMap.get(currentScenarioId) || {type: "", subtype: ""};

      // -- CONSTRUCTION DE LA LIGNE --
      let newRow = [];

      colMapping.forEach(map => {
        if (map.name === "SCENARIO_LBO_type") {
          newRow.push(lboInfo.type);
        }
        else if (map.name === "SCENARIO_LBO_subtype") {
          newRow.push(lboInfo.subtype);
        }
        else {
          let val = "";
          if (map.idxPN > -1) {
            val = pnRow[map.idxPN];
          }
          else if (map.idxSOL > -1 && solRow) {
            val = solRow[map.idxSOL];
          }
          newRow.push(val);
        }
      });

      resultats.push(newRow);
    }
  }

  // --- 4. CRÉATION FICHIER ---
  let now = new Date();
  let day = String(now.getDate()).padStart(2, '0');
  let month = String(now.getMonth() + 1).padStart(2, '0');
  let year = now.getFullYear();
  let fileName = `pn_to_sol_${year}${month}${day}`;
  
  try {
    Logger.log("Création du fichier en cours...")
    let newSS = SpreadsheetApp.create(fileName);
    let id = newSS.getId();
    let file = DriveApp.getFileById(id);
    let folder = DriveApp.getFolderById(FOLDER_ID);
    file.moveTo(folder);
    
    let sheet = newSS.getSheets()[0];
    if (resultats.length > 0) {
      sheet.getRange("D:D").setNumberFormat("@");
      sheet.getRange(1, 1, resultats.length, resultats[0].length).setValues(resultats);
    }
    Logger.log("Fichier créé : " + fileName);
    return resultats; // IMPORTANT pour le script suivant
    
  } catch(e) {
    Logger.log("Erreur : " + e.message);
    SpreadsheetApp.getUi().alert("Erreur : " + e.message);
  }
}

/**
 * Fonction d'analyse des règles de la logistic (R01 à R14).
 * Prend les données brutes, applique les règles et écrit dans l'onglet "Obso flag cleaning".
 */
function obso_flag_cleaning(data) {
  // On récupère les derniers fichiers du Drive
  const latestFileIds = findLatestFiles(FOLDER_ID);

  // Chargement de pn_to_sol (s'il n'est pas passé par main())
  if(!data) {
    let pnToSolId = null;
    for (let key of latestFileIds.keys()) {
      if (key.includes("pn_to_sol")) {
        pnToSolId = latestFileIds.get(key);
        break;
      }
    }
    if (pnToSolId) {
      data = SpreadsheetApp.openById(pnToSolId).getSheetByName("Feuille 1").getDataRange().getValues();
    } else {
      Logger.log("❌ ERREUR : Fichier pn_to_sol introuvable.");
      return;
    }
  }
  Logger.log("Extract pn_to_sol chargé");

  // --- NOUVEAUTÉ : Chargement de cases_history DIRECTEMENT DEPUIS LE DOSSIER DRIVE ---
  Logger.log("Recherche de cases_history directement dans le dossier Drive...");
  
  let historyId = null;
  let closestDiff = Infinity;
  let today = new Date().getTime();

  // On contourne latestFileIds et on fouille tout le dossier complet
  let folderMain = DriveApp.getFolderById(FOLDER_ID);
  let filesIter = folderMain.getFiles();

  while (filesIter.hasNext()) {
    let file = filesIter.next();
    let fileName = file.getName();
    
    // Si on trouve un fichier avec "cases_history" dans son nom
    if (fileName.includes("cases_history")) {
      let match = fileName.match(/\d{8}/);
      
      if (match) {
        let dateStr = match[0];
        let year = parseInt(dateStr.substring(0, 4), 10);
        let month = parseInt(dateStr.substring(4, 6), 10) - 1;
        let day = parseInt(dateStr.substring(6, 8), 10);
        
        let fileDate = new Date(year, month, day).getTime();
        let diff = Math.abs(today - fileDate);
        
        // On garde celui qui a la date la plus proche d'aujourd'hui
        if (diff < closestDiff) {
          closestDiff = diff;
          historyId = file.getId(); // On récupère le VRAI ID depuis Drive
        }
      } else if (!historyId) {
        // Sécurité si aucune date n'est trouvée dans le nom
        historyId = file.getId();
      }
    }
  }

  let validCasesForCleaning = new Set();
  let pivotDate = new Date(2021, 11, 31, 23, 59, 59).getTime();

  if (!historyId) {
    Logger.log("❌ ERREUR CRITIQUE : Aucun fichier 'cases_history' trouvé dans latestFileIds.");
  } else {
    let historySheet = SpreadsheetApp.openById(historyId).getSheets()[0];
    
    // 1. On ne charge QUE la ligne 1 pour trouver les colonnes
    let lastCol = historySheet.getLastColumn();
    let lastRow = historySheet.getLastRow();
    let headersHistory = historySheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    let idxCaseId = headersHistory.indexOf("Case_number"); 
    let idxDate = headersHistory.indexOf("Case_history_date"); 
    let idxOG = headersHistory.indexOf("New_obsolescence_gate_code"); 
    
    Logger.log("Recherche des colonnes : Case=" + idxCaseId + " | Date=" + idxDate + " | OG=" + idxOG);

    let caseMaxDates = new Map(); // Stockera la date OG1 la plus récente par Case
    let countOG1 = 0;

    if (idxCaseId > -1 && idxDate > -1 && idxOG > -1 && lastRow > 1) {
      
      let caseIdData = historySheet.getRange(2, idxCaseId + 1, lastRow - 1, 1).getValues();
      let dateData = historySheet.getRange(2, idxDate + 1, lastRow - 1, 1).getValues();
      let ogData = historySheet.getRange(2, idxOG + 1, lastRow - 1, 1).getValues();

      // Extraction et conservation de la MAX date
      for(let i = 0; i < (lastRow - 1); i++) {
        let caseId = String(caseIdData[i][0]).trim();
        let ogCode = String(ogData[i][0]).trim().toUpperCase();

        if (ogCode === "OG1" && caseId !== "") {
          countOG1++;
          let dateVal = dateData[i][0];
          let d = NaN;
          
          if (dateVal instanceof Date) {
            d = dateVal.getTime();
          } else if (typeof dateVal === "string" && dateVal.includes("/")) {
            let datePart = dateVal.split(" ")[0]; 
            let parts = datePart.split("/");
            if(parts.length >= 3) {
              let year = parseInt(parts[2], 10);
              if (year < 100) year += 2000;
              d = new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
            }
          } else {
            d = new Date(dateVal).getTime();
          }

          if (!isNaN(d)) {
            let currentMax = caseMaxDates.get(caseId) || 0;
            if (d > currentMax) {
              caseMaxDates.set(caseId, d);
            }
          }
        }
      }

      // Validation stricte : la dernière date doit être > 2021
      caseMaxDates.forEach((maxDate, caseId) => {
        if (maxDate > pivotDate) {
          validCasesForCleaning.add(caseId);
        }
      });
      Logger.log("✅ " + validCasesForCleaning.size + " Cases ID validés (Dernière OG1 > 2021) sur " + caseMaxDates.size + " uniques avec OG1.");
    } else {
      Logger.log("ERREUR CRITIQUE : Colonnes introuvables ou fichier cases_history vide !");
    }
  }

  // --- 1. CONFIGURATION ---
  const SS_ID = "1avjOXCrwPr58AmI9mSTtPzaqvXNkl1lou3pSmMYkJeo";
  const TARGET_SHEET_NAME = "Obso flag cleaning";
  const DUPLICATE_LINES = false;

  const COL_PN = "Part_number";
  const COL_CAT = "Case_category_code";
  const COL_STATUS = "Case_status_code";
  const COL_SCENARIO = "Scenario_type_code";
  const COL_DATE_INIT = "Group_initial_shortage_date";
  const COL_DATE_NEW = "Group_new_shortage_date";
  const COL_GROUP_ID = "PN_Group_ID";
  const COL_FLAG = "Obso_flag";
  const COL_SOLUTION_STATE = "Solution_state";
  const COL_CAUSE_CAT = "Cause_category_code";

  const STATUS_CLOSED_LIST = ["SOLVED", "CANCEL", "CLOSED"];
  const STATUS_R01_LIST = ["ALERT", "CANCEL"];
  const EXCEPTIONS_R02_R03_R05_LIST = ["CANCEL", "CLOSED", "ALERT"];
  const CAT_EQUIPMENT_STARTS = ["EQUIPEMENT", "EQUIPMENT", "AIRFRAME ITEM", "TOOLS"];

  // --- 2. PRÉPARATION ---
  var ss = SpreadsheetApp.openById(SS_ID);
  var cleaning_sheet = ss.getSheetByName(TARGET_SHEET_NAME);

  if (!cleaning_sheet) {
    SpreadsheetApp.getUi().alert("Erreur : Onglet '" + TARGET_SHEET_NAME + "' introuvable.");
    return;
  }

  var headers = data[0];
  var idx = {
    pn: headers.indexOf(COL_PN),
    cat: headers.indexOf(COL_CAT),
    status: headers.indexOf(COL_STATUS),
    scenario: headers.indexOf(COL_SCENARIO),
    dateInit: headers.indexOf(COL_DATE_INIT),
    dateNew: headers.indexOf(COL_DATE_NEW),
    groupId: headers.indexOf(COL_GROUP_ID),
    flag: headers.indexOf(COL_FLAG),
    state: headers.indexOf(COL_SOLUTION_STATE),
    cause: headers.indexOf(COL_CAUSE_CAT)
  };

  var col = new Map();
  for(let i = 1; i < data.length; i++){
    let row = data[i];
    let key = String(row[idx.pn]).trim();
    if(key && key !== "") {
      if (!col.has(key)) col.set(key, []);
      col.get(key).push(row);
    }
  }

  var pnToChange = [];
  var dateDuJour = new Date();

  // --- 2.5 LOGIQUE R00 (SAP vs TOM) ---
  const FOLDER_SAP_ID = "1JAD3mWlL8Q19wzbFhU6CFCifoFBNvzTv"; 
  const folderSAP = DriveApp.getFolderById(FOLDER_SAP_ID);
  const filesSAP = folderSAP.getFiles();

  if (filesSAP.hasNext()) {
    let fileSAP = filesSAP.next(); 
    let sapSpreadsheet = SpreadsheetApp.openById(fileSAP.getId());
    let sapSheet = sapSpreadsheet.getSheets()[0]; 
    let lastRowSAP = sapSheet.getLastRow();
    
    if (lastRowSAP > 1) {
      let sapData = sapSheet.getRange("A2:A" + lastRowSAP).getValues(); 
      let addedFromSAP = new Set(); 
      
      sapData.forEach(row => {
        let sapPn = String(row[0]).trim().toUpperCase(); 
        if (sapPn && sapPn !== "" && !col.has(sapPn) && !addedFromSAP.has(sapPn)) {
          let newRow = new Array(headers.length).fill(""); 
          newRow[idx.pn] = sapPn; 
          let outputRow = [dateDuJour, ...newRow, "R00", "UNFLAG", "NA SAP"];
          pnToChange.push(outputRow);
          addedFromSAP.add(sapPn); 
        }
      });
    } else {
      Logger.log("Avertissement : Le fichier SAP est vide.");
    }
  } else {
    Logger.log("Avertissement : Aucun fichier SAP trouvé.");
  }

  // --- 3. ANALYSE DES RÈGLES (Boucle sur chaque PN) ---
  col.forEach((rows, keyPN) => {
    
    let isEqp = false;
    let hasOpenCase = false;
    let allStatusR01 = true;
    let allSD9999 = true;
    let sd9999withExceptions = true;
    let flag;
    let hasReach = false;
    let allReach = true;
    let hasAny9999 = false;
    let scenariosPresent = new Set();
    let groupsAnalysis = new Map();

    rows.forEach(row => {
      let cat = String(row[idx.cat] || "").trim().toUpperCase();
      let status = String(row[idx.status] || "").trim().toUpperCase();
      let scen = String(row[idx.scenario] || "").trim().toUpperCase();
      let groupId = String(row[idx.groupId] || "UNKNOWN_GROUP").trim();
      let causeCat = String(row[idx.cause] || "").trim().toUpperCase();
      flag = String(row[idx.flag] || "NO").trim();

      let d1 = row[idx.dateInit];
      let d2 = row[idx.dateNew];
      let lineDate9999 = isDate9999(d1) || isDate9999(d2);
      if (lineDate9999) hasAny9999 = true;

      if (CAT_EQUIPMENT_STARTS.some(start => cat.startsWith(start))) isEqp = true;
      if (!STATUS_CLOSED_LIST.includes(status)) hasOpenCase = true;
      if (!STATUS_R01_LIST.includes(status)) allStatusR01 = false;
      
      if (causeCat === "REACH") {
        hasReach = true;
      } else {
        allReach = false;
      }

      if (!lineDate9999) {
        allSD9999 = false;
        if (!EXCEPTIONS_R02_R03_R05_LIST.includes(status)) {
          sd9999withExceptions = false;
        }
      }

      if (scen) scenariosPresent.add(scen);

      if (!groupsAnalysis.has(groupId)) {
        groupsAnalysis.set(groupId, { has3F: false, hasLBO: false, has3F_9999: false });
      }
      let gData = groupsAnalysis.get(groupId);
      if (scen === "3F") gData.has3F = true;
      if (scen === "LBO") gData.hasLBO = true;
      if (scen === "3F" && lineDate9999) gData.has3F_9999 = true;
    });

    let scenarios = Array.from(scenariosPresent);
    const hasScenario = (s) => scenarios.includes(s);
    const noScenario = (s) => !scenarios.includes(s);

    let isR02Valid = false;
    if (groupsAnalysis.size > 0) {
      isR02Valid = true;
      for (let gData of groupsAnalysis.values()) {
        if (! (gData.has3F && gData.hasLBO) ) {
          isR02Valid = false;
          break;
        }
      }
    }

    let isR03Valid = false;
    if (groupsAnalysis.size > 0) {
        isR03Valid = true; 
        for (let gData of groupsAnalysis.values()) {
            if (!gData.has3F_9999) {
                isR03Valid = false;
                break;
            }
        }
    }

    let ruleApplied = "";
    let action = "";

    // --- RÈGLES ---
    if (allStatusR01) { ruleApplied = "R01"; action = "UNFLAG"; }
    else if (isEqp && isR02Valid && sd9999withExceptions) { ruleApplied = "R02"; action = "UNFLAG"; }
    else if (isEqp && isR03Valid && sd9999withExceptions) { ruleApplied = "R03"; action = "UNFLAG"; }
    else if (!isEqp && !hasOpenCase && hasScenario("QUALIFICATION") && noScenario("3F") && noScenario("REDESIGN")) { ruleApplied = "R04"; action = "UNFLAG"; }
    else if (!isEqp && sd9999withExceptions && hasAny9999) { ruleApplied = "R05"; action = "UNFLAG"; }
    else if (allReach) { ruleApplied = "R06"; action = "UNFLAG"; }
    else if (hasOpenCase) { ruleApplied = "R11"; action = "FLAG"; }
    else if (isEqp && !hasOpenCase) {
      let hasCaseWithout3F = rows.some(r => String(r[idx.scenario]).trim().toUpperCase() !== "3F");
      if (hasCaseWithout3F) { ruleApplied = "R12"; action = "FLAG"; }
    }
    else if (!isEqp && !hasOpenCase) {
       let hasCaseWithoutQualif = rows.some(r => String(r[idx.scenario]).trim().toUpperCase() !== "QUALIFICATION");
       if (hasCaseWithoutQualif) { ruleApplied = "R13"; action = "FLAG"; }
    }
    else if (!hasOpenCase && hasScenario("LBO") && noScenario("3F") && noScenario("QUALIFICATION")) {
      ruleApplied = "R14"; action = "FLAG";
    }

    if((flag == "YES" && action == "FLAG") || (flag == "NO" && action == "UNFLAG")){
      ruleApplied = ""
    }

    // -- C. ENREGISTREMENT ET STATUT CLEANING (CORRIGÉ POUR LE PN ENTIER ET IGNORANT CANCEL/ALERT) --
    if (ruleApplied !== "") {
      let linesToPush = DUPLICATE_LINES ? rows : [rows[0]];
      let idxCase = headers.indexOf("Case_number");
      
      let isPnCleaningOk = true; 
      let hasAtLeastOneCase = false;
      
      if (idxCase > -1) {
        for (let r of rows) { 
          let caseNumber = String(r[idxCase]).trim();
          let currentStatus = String(r[idx.status] || "").trim().toUpperCase();
          
          if (caseNumber !== "") {
            hasAtLeastOneCase = true;
            
            // NOUVEAU : On ignore l'évaluation pour les statuts CANCEL et ALERT
            if (currentStatus !== "CANCEL" && currentStatus !== "ALERT") {
              if (!validCasesForCleaning.has(caseNumber)) {
                isPnCleaningOk = false;
                break; // Un cas invalide suffit pour recaler tout le PN
              }
            }
          }
        }
      }
      
      // Sécurité : si aucun Case Number n'est trouvé, le PN est NOK
      if (!hasAtLeastOneCase) {
        isPnCleaningOk = false;
      }

      // Application aux lignes
      linesToPush.forEach(row => {
        let cleaningStatus = isPnCleaningOk ? "Cleaning OK" : "Cleaning NOK"; 
        let outputRow = [dateDuJour, ...row, ruleApplied, action, cleaningStatus];
        pnToChange.push(outputRow);
      });
    }
  });

  Logger.log("Chargement des données dans le fichier...")
  // --- 4. ÉCRITURE ---
  if (pnToChange.length > 0) {
    let lastRow = cleaning_sheet.getLastRow();
    cleaning_sheet.getRange(lastRow + 1, 1, pnToChange.length, pnToChange[0].length).setValues(pnToChange);
    Logger.log(pnToChange.length + " lignes ajoutées.");
  } else {
    Logger.log("Aucun résultat à enregistrer.");
  }
}
