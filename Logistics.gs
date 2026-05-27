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
  // Je suppose que Scenario_ID est quelque part dans les headers. 
  // S'il n'est pas trouvé par nom, il faudra vérifier son nom exact dans le source.
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
      // On laisse idxSOL à -1 car on veut cette info depuis le fichier PN
    } 
    else if (headerName === "SOL_Group_ID") {
      idxSOL = IDX_SOL_JOIN_KEY; // On force l'index 63
      // On laisse idxPN à -1 car on veut cette info depuis le fichier SOL
    }
    // Pour les colonnes LBO, pas d'index source, c'est géré plus tard
    else if (headerName === "SCENARIO_LBO_type" || headerName === "SCENARIO_LBO_subtype") {
      // Index restent à -1
    } 
    else {
      // Cas standard
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
    if(pnRow[69] == "") continue; 

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
      // On doit trouver l'ID tout de suite pour pouvoir remplir les colonnes LBO 
      // qui arrivent au milieu de la boucle.
      let currentScenarioId = "";
      
      // On cherche d'abord dans PN
      if (sourceIdxScenID_PN > -1) {
        currentScenarioId = String(pnRow[sourceIdxScenID_PN]).trim();
      }
      // Sinon dans Solution (si vide dans PN et solution existe)
      if ((!currentScenarioId || currentScenarioId === "") && solRow && sourceIdxScenID_SOL > -1) {
        currentScenarioId = String(solRow[sourceIdxScenID_SOL]).trim();
      }
      
      // On récupère les infos LBO associées
      let lboInfo = lboMap.get(currentScenarioId) || {type: "", subtype: ""};


      // -- CONSTRUCTION DE LA LIGNE --
      let newRow = [];

      colMapping.forEach(map => {
        // Cas Spécial : Colonnes LBO (insérées au milieu)
        if (map.name === "SCENARIO_LBO_type") {
          newRow.push(lboInfo.type);
        }
        else if (map.name === "SCENARIO_LBO_subtype") {
          newRow.push(lboInfo.subtype);
        }
        // Cas Standard : Récupération depuis PN ou SOL
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

  if(!data) {
    const latestFileIds = findLatestFiles(FOLDER_ID);
    data = SpreadsheetApp.openById(latestFileIds.get("pn_to_sol")).getSheetByName("Feuille 1").getDataRange().getValues();
  }
  Logger.log("Extract chargé")

  // --- 1. CONFIGURATION ---
  const SS_ID = "1avjOXCrwPr58AmI9mSTtPzaqvXNkl1lou3pSmMYkJeo";
  const TARGET_SHEET_NAME = "Obso flag cleaning";
  
  const DUPLICATE_LINES = true; 

  // Noms des colonnes
  const COL_PN = "Part_number";
  const COL_CAT = "Case_category_code";
  const COL_STATUS = "Case_status_code";
  const COL_SCENARIO = "Scenario_type_code";
  const COL_DATE_INIT = "Group_initial_shortage_date";
  const COL_DATE_NEW = "Group_new_shortage_date";
  const COL_GROUP_ID = "PN_Group_ID";
  const COL_FLAG = "Obso_flag";
  const COL_SOLUTION_STATE = "Solution_state";

  // Listes de référence
  const STATUS_CLOSED_LIST = ["SOLVED", "CANCEL", "CLOSED"];
  const STATUS_R01_LIST = ["ALERT", "CANCEL"];
  const CAT_EQUIPMENT_STARTS = ["EQUIPEMENT", "EQUIPMENT", "AIRFRAME ITEM", "TOOLS"];

  // --- 2. PRÉPARATION ---
  var ss = SpreadsheetApp.openById(SS_ID);
  var cleaning_sheet = ss.getSheetByName(TARGET_SHEET_NAME);
  
  if (!cleaning_sheet) {
    SpreadsheetApp.getUi().alert("Erreur : Onglet '" + TARGET_SHEET_NAME + "' introuvable.");
    return;
  }

  // Mapping des index
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
    state: headers.indexOf(COL_SOLUTION_STATE)
  };

  // Regroupement par PN
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

  // --- 3. ANALYSE DES RÈGLES (Boucle sur chaque PN) ---
  
  col.forEach((rows, keyPN) => {
    
    // -- A. CALCUL DES INDICATEURS POUR CE PN --
    
    let isEqp = false;
    let hasOpenCase = false;
    let allStatusR01 = true;
    let allSD9999 = true; 
    let flag;
    
    let scenariosPresent = new Set();
    
    // Map pour l'analyse par groupe
    // Structure : Map<GroupID, { has3F: bool, hasLBO: bool, has3F_9999: bool }>
    let groupsAnalysis = new Map(); 

    rows.forEach(row => {
      let cat = String(row[idx.cat] || "").trim().toUpperCase();
      let status = String(row[idx.status] || "").trim().toUpperCase();
      let scen = String(row[idx.scenario] || "").trim().toUpperCase();
      let groupId = String(row[idx.groupId] || "UNKNOWN_GROUP").trim();
      let sol_state = String(row[idx.state] || "").trim();
      flag = String(row[idx.flag] || "NO").trim();

      // Check Dates pour cette ligne
      let d1 = row[idx.dateInit];
      let d2 = row[idx.dateNew];
      let lineDate9999 = isDate9999(d1) || isDate9999(d2);

      // 1. Indicators Globaux
      if (CAT_EQUIPMENT_STARTS.some(start => cat.startsWith(start))) isEqp = true;
      if (!STATUS_CLOSED_LIST.includes(status)) hasOpenCase = true;
      if (!STATUS_R01_LIST.includes(status)) allStatusR01 = false;
      if (!lineDate9999) allSD9999 = false;

      if (scen) scenariosPresent.add(scen);

      // 2. Remplissage des données par Groupe
      if (!groupsAnalysis.has(groupId)) {
        groupsAnalysis.set(groupId, { 
            has3F: false, 
            hasLBO: false, 
            has3F_9999: false // Indicateur spécifique pour R03
        });
      }
      let gData = groupsAnalysis.get(groupId);
      
      if (scen === "3F") gData.has3F = true;
      if (scen === "LBO") gData.hasLBO = true;
      
      // Pour R03 : On vérifie si c'est un 3F AVEC la date 9999 sur la ligne
      if (scen === "3F" && lineDate9999) {
          gData.has3F_9999 = true;
      }
    });

    let scenarios = Array.from(scenariosPresent);
    
    // Helpers boolean
    const hasScenario = (s) => scenarios.includes(s);
    const noScenario = (s) => !scenarios.includes(s);


    // -- LOGIQUE R02 (INTOUCHÉE selon demande) --
    // Vérifier que TOUS les groupes ont 3F et LBO
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

    // -- LOGIQUE R03 (MISE À JOUR) --
    // Vérifier que TOUS les groupes sont touchés par au moins un "3F avec SD 9999"
    let isR03Valid = false;
    if (groupsAnalysis.size > 0) {
        isR03Valid = true; // On part du principe que c'est bon
        for (let gData of groupsAnalysis.values()) {
            // Si un groupe n'a pas son "3F à 9999", la R03 échoue pour tout le PN
            if (!gData.has3F_9999) {
                isR03Valid = false;
                break;
            }
        }
    }


    // -- B. APPLICATION DES RÈGLES (ORDRE STRICT) --
    
    let ruleApplied = "";
    let action = "";

    // --- RÈGLES "UNSET" (UNFLAG) ---

    // R01
    if (allStatusR01) {
      ruleApplied = "R01"; action = "UNFLAG";
    }
    // R02 (Logic préservée : Groupes OK + allSD9999 global)
    else if (isEqp && isR02Valid && allSD9999) {
      ruleApplied = "R02"; action = "UNFLAG";
    }
    // R03 (Logic mise à jour : isEqp + Tous les groupes OK sur 3F_9999)
    else if (isEqp && isR03Valid) { 
      ruleApplied = "R03"; action = "UNFLAG";
    }
    // R04
    else if (!isEqp && !hasOpenCase && hasScenario("QUALIFICATION") && noScenario("3F") && noScenario("REDESIGN")) {
      ruleApplied = "R04"; action = "UNFLAG";
    }
    // R05
    else if (!isEqp && allSD9999) {
      ruleApplied = "R05"; action = "UNFLAG";
    }

    // --- RÈGLES "SET" (FLAG) ---

    // R11
    else if (hasOpenCase) {
      ruleApplied = "R11"; action = "FLAG";
    }
    // R12
    else if (isEqp && !hasOpenCase && noScenario("3F") === false) { 
      let hasCaseWithout3F = rows.some(r => String(r[idx.scenario]).trim().toUpperCase() !== "3F");
      if (hasCaseWithout3F) {
        ruleApplied = "R12"; action = "FLAG";
      }
    }
    // R13
    else if (!isEqp && !hasOpenCase) {
       let hasCaseWithoutQualif = rows.some(r => String(r[idx.scenario]).trim().toUpperCase() !== "QUALIFICATION");
       if (hasCaseWithoutQualif) {
         ruleApplied = "R13"; action = "FLAG";
       }
    }
    // R14
    else if (!hasOpenCase && hasScenario("LBO") && noScenario("3F") && noScenario("QUALIFICATION")) {
      ruleApplied = "R14"; action = "FLAG";
    }

    // Gestion de l'écrasement si déjà bon
    if((flag == "YES" && action == "FLAG") || (flag == "NO" && action == "UNFLAG")){
      ruleApplied = ""
    };

    // -- C. ENREGISTREMENT --
    if (ruleApplied !== "") {
      let linesToPush = DUPLICATE_LINES ? rows : [rows[0]];
      linesToPush.forEach(row => {
        let outputRow = [dateDuJour, ...row, ruleApplied, action];
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
    Logger.log("Aucun résultat.");
  }
}

/**
 * Helper pour vérifier si une date correspond à 31.12.9999
 */
function isDate9999(val) {
  if (!val || val == "") return false;
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return val.getFullYear() === 9999 && val.getDate() === 31 && val.getMonth() === 11;
  }
  let s = String(val);
  return s.includes("9999") && s.includes("12") && s.includes("31");
}


function inOutWip_PN_flagued(){

  var ss = SpreadsheetApp.openById("1avjOXCrwPr58AmI9mSTtPzaqvXNkl1lou3pSmMYkJeo");
  var sheet = ss.getSheetByName("IN OUT WIP PN");

  var lastRow = sheet.getLastRow();

  const latestFileIds = findLatestFiles(FOLDER_ID);
  var pn_solution = SpreadsheetApp.openById(latestFileIds.get("pn_to_sol"));
  Logger.log(pn_solution.getName())
  var pn_solution_last_month = getPreviousMonthFile();

  if(!pn_solution) throw Error("Pas de PN to solution dans le dossier fourni");

  var pn_solution_data = pn_solution.getSheets()[0].getDataRange().getValues();
  var pn_solution_last_month_data = SpreadsheetApp.open(pn_solution_last_month).getSheets()[0].getDataRange().getValues();

  var pn_last_month = new Map();

  pn_solution_last_month_data.forEach(row => {
    if(!pn_last_month.has(row[0])){
      pn_last_month.set(row[0].toString(), {flag: row[2]});
    };
  });

  var pn = new Map();

  pn_solution_data.forEach(row => {
    if(!pn.has(row[0])){
      pn.set(row[0].toString(), {flag: row[2]});
    };
  });

  var pn_flag = [];
  var flag_kpi = 0;
  var unflag_kpi = 0;
  var wip = pn.size - 1; // -1 Pour retirer l'entête dans le compte

  pn.forEach((currentData, keyPN) => {

    if(pn_last_month.has(keyPN)){
      let flag_data = pn_last_month.get(keyPN);

      if(flag_data.flag == "NO" && currentData.flag == "YES"){
        flag_kpi += 1;
      } else if(flag_data.flag == "YES" && currentData.flag == "NO"){
        unflag_kpi += 1
      } 
    } else if(currentData.flag == "YES"){
      flag_kpi += 1;
    }
  });

  var option = {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  };

  var date = new Date().toLocaleString("fr-FR", option)
  
  pn_flag.push([date, flag_kpi, unflag_kpi, wip])

  sheet.getRange(lastRow + 1, 1, 1, 4).setValues(pn_flag)

}

function getPreviousMonthFile() {
  
  // 1. Calculer le mois et l'année cibles (Mois précédent)
  const today = new Date();
  // On se place au 1er du mois pour éviter les bugs de fin de mois (ex: 30 mars - 1 mois)
  const targetDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  
  const targetMonth = targetDate.getMonth(); // 0 = Janvier, 11 = Décembre
  const targetYear = targetDate.getFullYear();
  
  // Pour l'affichage log (ex: "01/2026")
  const displayTarget = String(targetMonth + 1).padStart(2, '0') + "/" + targetYear;
  Logger.log(`Recherche du fichier le plus ancien pour la période : ${displayTarget}`);

  // 2. Récupération des fichiers dans le dossier
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFiles(); // On récupère tout et on filtre après
  
  let validFiles = [];

  // 3. Filtrage : On ne garde que ceux qui correspondent au mois précédent
  while (files.hasNext()) {
    let file = files.next();
    let name = file.getName();
    
    // Regex pour capturer la date : PN_to_SOL_(jour)/(mois)/(année)
    // Group 1 = Jour, Group 2 = Mois, Group 3 = Année
    let match = name.match(/pn_to_sol_(\d{4})(\d{2})(\d{2})/);
    
    if (match) {
      let fileDay = parseInt(match[3], 10);
      let fileMonth = parseInt(match[2], 10) - 1; // JS compte les mois de 0 à 11
      let fileYear = parseInt(match[1], 10);
      
      // Si le fichier correspond au mois et à l'année recherchés
      if (fileMonth === targetMonth && fileYear === targetYear) {
        validFiles.push({
          file: file,
          day: fileDay,
          fullDate: new Date(fileYear, fileMonth, fileDay) // Pour le tri
        });
      }
    }
  }

  // 4. Vérification et Tri
  if (validFiles.length === 0) {
    throw new Error(`Aucun fichier "PN_to_SOL" trouvé pour le mois de ${displayTarget} dans le dossier.`);
  }

  // On trie par date croissante (Le plus ancien en premier : 01 < 05 < 20)
  validFiles.sort((a, b) => a.fullDate - b.fullDate);
  
  // 5. Résultat
  let oldestFile = validFiles[0].file;
  Logger.log(`Fichier trouvé : ${oldestFile.getName()} (ID: ${oldestFile.getId()})`);
  
  // Retourne le fichier (objet DriveApp File)
  // Tu peux utiliser return oldestFile.getId() si tu veux juste l'ID
  return oldestFile;
}
