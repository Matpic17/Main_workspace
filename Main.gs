function import_extract() {
  /*---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Le but du code est de récupérer les extracts dans le dossier "Extract" et de les filtrer selon les différentes data anormales dans TOM pour traitement dans un Looker et une base de donnée.
  
  Le code est constitué d'une classe qui permet de faire des filtres facilement et retirer les doublons.
  
  la fonction dans le main fait appel à tous les filtres dans P1 ou P2 ou P3 pour desengorger le code principal.
  
  Un fois les filtres faits, tout est envoyé dans la BDD avec la date en première colonne puis le Looker est connecté à chaque onglet pour afficher les données.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
  
  //updateLookerStudioSources();

  var ss = SpreadsheetApp.getActiveSpreadsheet(); // Récupération du tableur actif
  var database = SpreadsheetApp.openById("1W0_NpL4E8Lmd_PED9U4tygL0bfsNVzurvTcNzijcgkU"); // Ouverture de la base de données

  // Appelle une fonction pour récupérer les données en les rendant plus lisibles
  var datas = get_data("normal");

  if(datas == undefined){
    return; // Arrête le processus si aucune donnée n'est trouvée
  }

  Logger.log("Data chargées");

  // Filtrage des noms et prénoms, puis manipulation des données
    var nom_prenom = new DataFilter(datas.cases_history_data.map(row => row.slice())).AddCriteria(50, prenom => prenom !== "").AddCriteria(51, nom => nom !== "").ApplyFilters().GetFilteredData();

    // Reformatage des noms et prénoms
    nom_prenom.map(row => {
      let concat = row[50] + " " + row[51];
      row[52] = row[51];
      row[51] = row[50];
      row[50] = concat;
    });

    // Extraction des colonnes pertinentes
    var tab_name = [];
    for(let i = 2; i < nom_prenom.length; i++){
      tab_name.push(nom_prenom[i].slice(50, 53));
    }

    var nom_prenom_data = new DataFilter(tab_name).RemoveDuplicates(0).GetFilteredData();

    // Mise à jour des données dans l'onglet "Infos"
    database.getSheetByName("Infos").getRange("A2:C").clearContent();
    if(nom_prenom_data.length != 0){
      database.getSheetByName("Infos").getRange(2, 1, nom_prenom_data.length, nom_prenom_data[0].length).setValues(nom_prenom_data);
    }

  // Mise à jour du WIP dans la BDD

    update_WIP_Routine(datas);



  //Filtrage des données

    let total = []; // Initialisation des données agrégées pour les cas filtrés

    //Zone de test avant les autres filtres


    var pnSsSd = pnWoutSD(datas);




    // Appels à des fonctions de filtrage et mise à jour dans différents onglets
    //PN sans Shortage Date
      var pnSsSd = pnWoutSD(datas);

      pastInMain("PnWoutSD", "A2:DH", pnSsSd);

      pushInTotal(pnSsSd, total, 50, 51, 1, "PnWoutSD", 41);


    //case without PN
      var case_without_PN_filtered = case_wout_PN(datas);

      pastInMain("Cases without PN", "A2:DH", case_without_PN_filtered);

      pushInTotal(case_without_PN_filtered, total, 50, 51, 1, "Cases without PN", 41);


    //PN in two categories
      /*var pnIn2Cat = pn_in_two_cat(datas);

      pastInMain("PN in two categories (Mat & IG ou Equip)", "A2:DH", pnIn2Cat);

      pushInTotal(pnIn2Cat, total, 49, 50, 1, "PN in two categories");*/
      

    //case without programs CANCELLED
      /*var case_without_programs_data = new DataFilter(datas.cases_variant_data);
      case_without_programs_data.AddCriteria(51, program => program == "").AddCriteria(36, value => value == "IMPL" || value == "INVEST" || value == "QUALIF" || value == "ASSESS" || value == "STOCK");

      var case_without_programs_filtered = case_without_programs_data.ApplyFilters().GetFilteredData();

      ss.getSheetByName("Cases without programs").getRange("A2:BA" + ss.getSheetByName("Cases without programs").getRange("B1").getNextDataCell(SpreadsheetApp.Direction.DOWN).getA1Notation().slice(1)).clearContent();

      if(case_without_programs_filtered.length != 0){
        ss.getSheetByName("Cases without programs").getRange(2, 1, case_without_programs_filtered.length, case_without_programs_filtered[0].length).setValues(case_without_programs_filtered);
      }*/


    //OG4-OG5 check
      
      var total_case_eol = lbotest(datas);

      pastInMain("OG4-OG5 status check", "A2:CW", total_case_eol);

      pushInTotal(total_case_eol, total, 50, 51, 1, "OG4-OG5 status check", 41);


    //OG4-OG5 cases without scenario (empty)

      var no_solution = case_wout_solution(datas);

    //OG4-OG5 cases without scenario (not applied) merge OG4-OG5 cases without scenario (empty)
      
      var scenario_not_applied_filtered = og4_og5_wout_scenario_applied(datas);

      var merge_scenario_empty = [];
      
      merge_scenario_empty.push(...scenario_not_applied_filtered, ...no_solution);

      pastInMain("OG4-OG5 cases without scenario (not applied)", "A2:CW", merge_scenario_empty);

      pushInTotal(merge_scenario_empty, total, 50, 51, 1, "OG4-OG5 cases without scenario (not applied)", 41);


    //LBO cases without a LBO type

      /*var case_without_LBO_type_data = lbo_wout_type(datas);

      pastInMain("LBO cases without a LBO type (T1,T2,T3)", "A2:AI", case_without_LBO_type_data);

      pushInTotal(case_without_LBO_type_data, total, 101, 102, 53, "LBO cases without a LBO type");*/


    //Case_category_code

      var case_category_code_filtered = case_wout_category_code(datas);

      pastInMain("Case_category code (empty)", "A2:CW", case_category_code_filtered);

      pushInTotal(case_category_code_filtered, total, 50, 51, 1, "Cases without category code", 41);

    //PN not in SAP
    
      var pn_not_SAP = pn_not_in_SAP(datas);

      pastInMain("PN not in SAP", "A2:DH", pn_not_SAP);

      pushInTotal(pn_not_SAP, total, 50, 51, 1, "PN not in SAP", 41);


    //Date in obsolete component

      var date_obsolete_component = obsolete_component(datas);

      pastInMain("Wrong info in Obsolete_component", "A2:DH", date_obsolete_component);

      pushInTotal(date_obsolete_component, total, 50, 51, 1, "Obsolete_component not standardized", 41);


    //Case_summary not standardised

      var case_summary_data = case_summary(datas);

      pastInMain("Case_summary empty", "A2:CA", case_summary_data);

      pushInTotal(case_summary_data, total, 50, 51, 1, "Case_summary not standardised", 41);


    //LBO NOGO REPAIR scenario applied in OG5 not in Closed or Stock

      /*var lbo_nogo_repair_data = lbo_nogo_repair_OG5(datas); // Done into LBO check

      pastInMain("LBO NOGO Repair OG5 in SOLVED", "A2:CW", lbo_nogo_repair_data);

      pushInTotal(lbo_nogo_repair_data, total, 49, 50, 1, "LBO NOGO REPAIR with case in solved status");*/

    //Case_cause_code empty

      var case_cause_code_data = case_cause_code(datas);

      pastInMain("Case_cause_code (empty)", "A2:CA", case_cause_code_data);

      pushInTotal(case_cause_code_data, total, 50, 51, 1, "Case_cause_code (empty)", 41);

    //Notif_date_futur

      /*var notif_date_futur_data = case_notif_date_futur(datas);

      pastInMain("Case_notif_date_futur", "A2:CA", notif_date_futur_data);

      pushInTotal(notif_date_futur_data, total, 49, 50, 1, "Case_notif_date_futur", 40);*/

    //LBO deadline empty

      /*var lbo_deadline_data = lbo_deadline(datas);

      pastInMain("LBO_deadline", "A2:CW", lbo_deadline_data);

      pushInTotal(lbo_deadline_data, total, 49, 50, 1, "LBO_deadline");*/

    //Solution state empty

      /*var solution_state_data = solution_state(datas);

      pastInMain("Solution_state", "A2:CW", solution_state_data);

      pushInTotal(solution_state_data, total, 49, 50, 1, "Solution_state");*/

    // Case last modification date empty
    
      /*var case_last_modif_date_data = case_last_modif_date(datas);

      pastInMain("Case_last_modif_date", "A2:CA", case_last_modif_date_data);

      pushInTotal(case_last_modif_date_data, total, 49, 50, 1, "Case_last_modif_date");*/


    // Supplier notif date empty
      
      var supplier_notif_data = supplier_notif(datas);

      pastInMain("supplier_notif", "A2:CA", supplier_notif_data);

      pushInTotal(supplier_notif_data, total, 50, 51, 1, "supplier_notif_empty", 41);

    // Scenarios not updated

      var not_updated = statusToBeUpdated(datas);

      pastInMain("Not updated", "A2:CW", not_updated);

      pushInTotal(not_updated, total, 50, 51, 1, "Scenario not updated", 41);

    // LBO T1/T2 without redesign

      var lbo_bb = lbo_bb_t1(datas);

      pastInMain("LBO_BB", "A2:CW", lbo_bb);


    // Mise à jour des données agrégées dans "Case leader summary"
      ss.getSheetByName("Case leader summary").getRange("A2:C").clearContent(); 
      ss.getSheetByName("Case leader summary").getRange(2, 1, total.length, total[0].length).setValues(total);

    // Get datas of OCL summary for archives
      var ocl_summary = ss.getSheetByName("OCL summary recap").getDataRange().getValues();
      ocl_summary.splice(0, 1);


  Logger.log("Data collées, chargement de la BDD");
  


  // Préparation et mise en forme des données pour la BDD
  var datas_filtered = 
    {wout_PN: case_without_PN_filtered,
    //pn_2_cat: pnIn2Cat,
    //wout_programs: case_without_programs_filtered,
    only_eol: total_case_eol,
    scenario_n_applied: merge_scenario_empty,
    //no_scenario: no_solution,
    //wout_lbo_type: case_without_LBO_type_data,
    wout_category_code: case_category_code_filtered,
    pn_SAP: pn_not_SAP,
    obso_compo: date_obsolete_component,
    case_summary: case_summary_data,
    //lbonogorepair: lbo_nogo_repair_data,
    case_cause: case_cause_code_data,
    //notif_date: notif_date_futur_data,
    //lbo_deadline: lbo_deadline_data,
    //solution_state: solution_state_data,
    //case_last_modif: case_last_modif_date_data,
    supplier_notif: supplier_notif_data,
    not_updated: not_updated,
    ocl_summary_recap: ocl_summary,
    pnSansSd: pnSsSd,
    lbo_bb: lbo_bb
    }
  ;

  // Ajout de la date du jour dans la première colonne
  var today = new Date();
  var formattedDate = today.toLocaleDateString("fr-FR", { //Mise en forme de la date
        day: "numeric",
        month: "numeric",
        year: "numeric"
        });

  // Boucle à travers chaque jeu de données dans datas_filtered
  for (const [key, dataSet] of Object.entries(datas_filtered)) {

      // Ajouter la date du jour au début de chaque ligne
      for (let i = 0; i < dataSet.length; i++) {
        // Insère la date au début de chaque ligne
        if(dataSet[i][0] != today){
          dataSet[i].unshift(formattedDate);
        }
      }
  }

  charge_Obso_management("LBO_BB", datas_filtered.lbo_bb)

  //Chargement des données dans la BDD
  charge_BDD("Not updated", datas_filtered.not_updated);
  
  charge_BDD("Cases without PN", datas_filtered.wout_PN);

  //charge_BDD("PN in two categories (Mat & IG ou Equip)", datas_filtered.pn_2_cat);

  //charge_BDD("Cases without programs", datas_filtered.wout_programs);

  charge_BDD("OG4-OG5 status check", datas_filtered.only_eol);

  charge_BDD("OG4-OG5 cases without scenario (not applied)", datas_filtered.scenario_n_applied);

  //charge_BDD("OG4-OG5 cases without scenario (empty)", datas_filtered.no_scenario);

  //charge_BDD("LBO cases without a LBO type (T1,T2,T3)", datas_filtered.wout_lbo_type);

  charge_BDD("Case_category code (empty)", datas_filtered.wout_category_code);

  charge_BDD("PN not in SAP", datas_filtered.pn_SAP);

  charge_BDD("Wrong info in Obsolete_component", datas_filtered.obso_compo);

  charge_BDD("Case_summary empty", datas_filtered.case_summary);

  //charge_BDD("LBO NOGO Repair OG5 in SOLVED", datas_filtered.lbonogorepair);

  charge_BDD("Case_cause_code (empty)", datas_filtered.case_cause);

  //charge_BDD("Case_notif_date_futur", datas_filtered.notif_date);

  //charge_BDD("LBO_deadline", datas_filtered.lbo_deadline);

  //charge_BDD("solution_state", datas_filtered.solution_state);

  //charge_BDD("Case_last_modif_date", datas_filtered.solution_state);

  charge_BDD("supplier_notif", datas_filtered.supplier_notif);

  charge_BDD("OCL summary recap", datas_filtered.ocl_summary_recap);

  charge_BDD("pnWoutSd", datas_filtered.pnSansSd);


  // Mise à jour de la date de dernière mise à jour
  var date = new Date()
  var options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  };

  ss.getSheetByName("Accueil").getRange("D1").setValue("Dernière mise à jour effectuée " + date.toLocaleDateString("fr-FR", options));

  envoyerRapportPersonnaliseParMail();

}

function pastInMain(onglet, range, data){

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  //Cleaning des données
  ss.getSheetByName(onglet).getRange(range + ss.getSheetByName(onglet).getLastRow()).clearContent();

  //Vérif si il y a des données dans la variable, si oui, on colle dans le fichier
  if(data.length != 0){
    ss.getSheetByName(onglet).getRange(2, 1, data.length, data[0].length).setValues(data);
  }

}

function pushInTotal(data, total, colClprenom, colClNom, colCase, sujet, colStatus){

  if(data.length > 0){
    data.map(row => {
      if(row[colStatus] != "CANCEL" && row[colStatus] != "CLOSED" && row[colStatus] != "SOLVED" && row[colStatus] != "OnHOLD"){
        let tab = [row[colClprenom], row[colClNom], sujet, row[colCase]];
        total.push(tab);
      };
    });
  };

  return total

}


function charge_BDD(onglet, donnee){
 
  // Sortie rapide si pas de données (évite d'indenter tout le code)
  if(!donnee || donnee.length === 0) return; 

  var database = SpreadsheetApp.openById("1W0_NpL4E8Lmd_PED9U4tygL0bfsNVzurvTcNzijcgkU");
  var sheet = database.getSheetByName(onglet);
  
  // Sécurité : au cas où l'onglet n'existe pas
  if(!sheet) return; 

  // Formatage propre des dates côté Google Apps Script
  var timezone = Session.getScriptTimeZone();
  var dateDuJour = Utilities.formatDate(new Date(), timezone, "dd/MM/yyyy");

  var lastRow = sheet.getLastRow();
  // Sécurité si la feuille est totalement vide
  var derdateVal = lastRow > 0 ? sheet.getRange(lastRow, 1).getValue() : ""; 

  var fautIlEcrire = false;

  // Logique de vérification
  if(derdateVal instanceof Date){
    var derdateStr = Utilities.formatDate(derdateVal, timezone, "dd/MM/yyyy");
    if(derdateStr !== dateDuJour){
      fautIlEcrire = true;
    }
  } else {
    // Si ce n'est pas une date (vide ou texte), on écrit
    fautIlEcrire = true; 
  }

  // Écriture des données (écrite UNE SEULE fois dans le code)
  if(fautIlEcrire){

    sheet.getFilter()?.remove() // On retire les filtres (s'ils existent) pour éviter tout erreur


    // Calcul de la ligne de départ beaucoup plus propre !
    var startRow = sheet.getRange("C1").getNextDataCell(SpreadsheetApp.Direction.DOWN).getRow() + 1;
    
    // Si C1 est la seule cellule remplie, getNextDataCell part à la fin. 
    // Petite sécurité au cas où :
    if (startRow > sheet.getMaxRows()) startRow = 2; 

    sheet.getRange(startRow, 1, donnee.length, donnee[0].length).setValues(donnee);
  }
}

function charge_Obso_management(onglet, donnee){

  if(donnee.length > 0){

    var database = SpreadsheetApp.openById("1aDK1Ykub7spwTtrIe0d9WGxj3iO4Q-mR7q6jBOUE6NM");

    var date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "numeric", year: "numeric" })

    var derdate = database.getSheetByName(onglet).getRange(database.getSheetByName(onglet).getLastRow(), 1).getValue();

    if(derdate instanceof Date){

      derdate = derdate.toLocaleDateString("fr-FR", { day: "numeric", month: "numeric", year: "numeric" });

      if(derdate != date){

        database.getSheetByName(onglet).getRange(database.getSheetByName(onglet).getRange("C1").getNextDataCell(SpreadsheetApp.Direction.DOWN).getA1Notation().slice(1), 1, donnee.length, donnee[0].length).setValues(donnee);

      }
    } else {

      database.getSheetByName(onglet).getRange(database.getSheetByName(onglet).getRange("C1").getNextDataCell(SpreadsheetApp.Direction.DOWN).getA1Notation().slice(1), 1, donnee.length, donnee[0].length).setValues(donnee);

    }
  }
}

function update_WIP_Routine(datas) {
  
  // --- 1. CONFIGURATION ---
  const FOLDER_ID = "0ACEvsK712Yj6Uk9PVA";
  const SPREADSHEET_ID = "1W0_NpL4E8Lmd_PED9U4tygL0bfsNVzurvTcNzijcgkU";
  const TARGET_SHEET_NAME = "WIP";
  
  // Index des colonnes (A=0, B=1, Z=25, AA=26, etc.)
  const IDX_CASE_ID = 1; // Colonne B
  const IDX_STATUS = 41; // Colonne AO
  const IDX_OG = 44;     // Colonne AR
  const IDX_LEADER = 51; // Colonne AY
  
  // NOUVEAUTÉ : Deux listes d'exclusion différentes
  const STATUS_EXCLUS_STANDARD = ["ALERT", "CLOSED", "CANCEL", "SOLVED"]; // Pour les colonnes normales
  const STATUS_EXCLUS_RATIOS = ["CLOSED", "CANCEL", "SOLVED"];            // Pour la colonne global_ratios (garde "ALERT")

  // Intégration de l'OG0
  const OG_CIBLES = ["OG0", "OG1", "OG2", "OG3", "OG4", "OG5", "OG5a"]; 
  const moisFrancais = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  // Dictionnaire des équipes
  const TEAMS_MAP = {
    "BOOS": "TIGER", "ESCHBACH": "TIGER", "SINGH": "TIGER", "Schreiber": "TIGER", "REITER": "TIGER", "PICAUD": "TIGER",
    "NAMSI": "EQUIPMENT", "BACH": "EQUIPMENT", "ALEXANDRE": "EQUIPMENT", "Maire": "EQUIPMENT", "HAEUSSLER": "EQUIPMENT", "BLANCHET": "EQUIPMENT", "LORENZINI": "EQUIPMENT", "TRAMIER": "EQUIPMENT", "SOUIDI": "EQUIPMENT", "RIHANI": "EQUIPMENT", "Parot": "EQUIPMENT", "SELMI": "EQUIPMENT", "GODINEAU": "EQUIPMENT", "MEUNIER": "EQUIPMENT", "FOUQUET": "EQUIPMENT", "BARBIER": "EQUIPMENT", "MULLER": "EQUIPMENT", "SAINTOT": "EQUIPMENT",
    "CROSNIER": "NH90", "SIMON": "NH90", "CHARLES": "NH90", "GARZETTI": "NH90", "COVES": "NH90", "VONGSAY": "NH90", "Namsi": "NH90", "HERAUD": "NH90", "PAYAN": "NH90", "NAYL": "NH90", "CHEVALIER": "NH90", "GRANDREMY": "NH90", "AUBRIS": "NH90", "CHEVALIER-JAGOT": "NH90", "SARINENA": "NH90",
    "EVANGELOU": "MATERIAL", "BLIN": "MATERIAL", "LEGENTIL": "MATERIAL", "MARET": "MATERIAL", "DAVIN": "MATERIAL", "GAGNEAU": "MATERIAL", "FRAISSE": "MATERIAL", "BLANC": "MATERIAL", "LAURENT": "MATERIAL", "DURAND": "MATERIAL"
  };

  // --- 2. DETERMINATION DES DATES ---
  let today = new Date();
  let currentYear = today.getFullYear();
  let currentMonth = today.getMonth() + 1; // 1 à 12
  
  // Calcul du mois de référence (le mois précédent à archiver)
  let refDate = new Date(currentYear, today.getMonth() - 1, 1);
  let refYear = refDate.getFullYear();
  let refMonthIndex = refDate.getMonth(); // 0 à 11
  
  let refMonthString = moisFrancais[refMonthIndex] + " " + refYear; 

  // --- 3. VERIFICATION DANS L'ONGLET "WIP" (LE VIGILE) ---
  let ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);
  
  if (!targetSheet) {
    Logger.log("L'onglet WIP n'existe pas. Veuillez lancer le script d'initialisation d'abord.");
    return;
  }
  
  let lastRow = targetSheet.getLastRow();
  if (lastRow > 1) {
    let existingMonths = targetSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < existingMonths.length; i++) {
      if (existingMonths[i][0] === refMonthString) {
        Logger.log("Le mois de '" + refMonthString + "' est déjà présent dans la base. Mission accomplie pour ce mois-ci, arrêt du script.");
        return; 
      }
    }
  }

  // --- 4. RECHERCHE DU PREMIER FICHIER DU MOIS COURANT ---
  Logger.log("Recherche du premier fichier d'extraction pour le mois courant (" + currentMonth + "/" + currentYear + ")...");
  let folder = DriveApp.getFolderById(FOLDER_ID);
  let files = folder.getFiles();
  
  let targetFileName = "";
  let countFileOfMonth = 0;

  while (files.hasNext()) {
    let file = files.next();
    let name = file.getName();
    
    let match = name.match(/cases_history_(\d{4})(\d{2})(\d{2})/);
    
    if (match) {
      let fileYear = parseInt(match[1]);
      let fileMonth = parseInt(match[2]);
      
      if (fileYear === currentYear && fileMonth === currentMonth) {
        countFileOfMonth += 1;
        targetFileName = name;
      }
    }
  }

  if (countFileOfMonth > 1) {
    Logger.log("Plusieurs fichiers trouvés pour le mois en cours, pas de WIP à renseigner pour cette semaine.");
    return; 
  }

  // --- 5. EXTRACTION DES DONNEES ---
  Logger.log("Fichier " + targetFileName + " trouvé, extraction en cours...");
  let donneesAInserer = [];
  
  try {
    // Application des filtres sur la data d'entrée
    let data = new DataFilter(datas.cases_history_data.map(row => row.slice())).ApplyFilters().GetFilteredData();
    
    let compteursUniques = {};
    OG_CIBLES.forEach(og => {
      compteursUniques[og] = {
        GLOBAL: new Set(),
        GLOBAL_RATIOS: new Set(), // Le Set spécifique pour les ratios
        NH90: new Set(),
        MATERIAL: new Set(),
        EQUIPMENT: new Set(),
        TIGER: new Set(),
        UNKNOWN: new Set()
      };
    });

    for (let r = 1; r < data.length; r++) {
      let caseId = String(data[r][IDX_CASE_ID]).trim();
      let status = String(data[r][IDX_STATUS]).trim().toUpperCase();
      let og = String(data[r][IDX_OG]).trim();
      let leaderName = String(data[r][IDX_LEADER]).trim(); 
      
      let isExcludedStandard = STATUS_EXCLUS_STANDARD.includes(status);
      let isExcludedRatios = STATUS_EXCLUS_RATIOS.includes(status);
      let isTargetOg = OG_CIBLES.includes(og);

      if (isTargetOg && caseId !== "") {
        // 1. Alimentation spécifique pour global_ratios (Accepte les "ALERT")
        if (!isExcludedRatios) {
          compteursUniques[og].GLOBAL_RATIOS.add(caseId);
        }
        
        // 2. Alimentation du WIP Standard et des équipes (Refuse les "ALERT")
        if (!isExcludedStandard) {
          compteursUniques[og].GLOBAL.add(caseId); 
          
          let team = TEAMS_MAP[leaderName] || "UNKNOWN";
          compteursUniques[og][team].add(caseId);
        }
      }
    }

    // Préparation des lignes à ajouter (9 colonnes)
    OG_CIBLES.forEach(og => {
      if (og === "OG0") {
        donneesAInserer.push([
          refMonthString, 
          og, 
          "", // WIP Global
          "", // WIP NH90
          "", // WIP MATERIAL
          "", // WIP EQUIPMENT
          "", // WIP TIGER
          "", // WIP UNKNOWN
          compteursUniques[og].GLOBAL_RATIOS.size // global_ratios
        ]);
      } else {
        donneesAInserer.push([
          refMonthString, 
          og, 
          compteursUniques[og].GLOBAL.size,
          compteursUniques[og].NH90.size,
          compteursUniques[og].MATERIAL.size,
          compteursUniques[og].EQUIPMENT.size,
          compteursUniques[og].TIGER.size,
          compteursUniques[og].UNKNOWN.size,
          compteursUniques[og].GLOBAL_RATIOS.size 
        ]);
      }
    });

  } catch (e) {
    Logger.log("Erreur lors du traitement des données source : " + e.message);
    return;
  }

  // --- 6. AJOUT DANS L'ONGLET "WIP" ---
  if (donneesAInserer.length > 0) {
    // Changement : on utilise 9 colonnes pour l'appendRow à la fin du fichier
    targetSheet.getRange(lastRow + 1, 1, donneesAInserer.length, 9).setValues(donneesAInserer);
    Logger.log("Succès ! Les " + donneesAInserer.length + " lignes de '" + refMonthString + "' ont été ajoutées à la base de données (incluant OG0 et global_ratios).");
  }
}
