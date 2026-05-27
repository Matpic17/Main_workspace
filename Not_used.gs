function pn_in_two_cat(datas){

  var pn_in_2_cat = new DataFilter(datas.cases_partnumber_data.map(row => row.slice()));

  var pn_in_2_cat_data = pn_in_2_cat
    .AddCriteria(41, value => value != "CANCEL")
    .AddCriteria(69, pn => pn != "")
    .AddCriteria(31, category => category !== "")
    .ApplyFilters()
    .GetFilteredData()
  ;

  for(let row of pn_in_2_cat_data){
    if(row[31].startsWith("Equipment") || row[31].startsWith("Tools") || row[31].startsWith("Airframe")){
      row[31] = "Equipement";
    } else if(row[31].startsWith("Materials") || row[31].startsWith("Industrial")){
      row[31] = "Materials";
    }
  }

  var categoryMap = new Map();

  for (let row of pn_in_2_cat_data) {
    let subject = row[69];     // Numéro de sujet (PN)
    let category = row[31];   // Catégorie associée
    
    // Si le sujet n'existe pas dans le Map, on l'ajoute
    if (!categoryMap.has(subject)) {
      categoryMap.set(subject, {categories: new Set([category]), rows: [row], test: false});
    } else {
      let subjectStatus = categoryMap.get(subject);
      subjectStatus.categories.add(category);
      subjectStatus.rows.push(row);

      // Si on trouve plus d'une catégorie pour le même sujet, c'est une incohérence
      if (subjectStatus.categories.size > 1) {
        subjectStatus.test = true;  // Ajouter la ligne à l'ensemble des résultats
      }
    }
  }

  var result_data = [];

  // Vérifier chaque sujet dans la map
  categoryMap.forEach((status, subject) => {
    // Ajouter seulement les sujets qui sont toujours marqués comme valides
    if (status.test) {
      result_data.push(...status.rows);
    }
  });

  return result_data;

}


function lbo_wout_type(datas){

  var pn_lbo = datas.pn_lbo_data.map(row => row.slice());
  var history = datas.cases_history_data.map(row => row.slice());

  pn_lbo[0].push("Status_code", "Obsolescence_gate", "Case_Leader_prenom", "Case_Leader_nom")

  //Pour ajouter le status_code, l'OG et le nom du case leader
  let historyMap = new Map();

  for (let j = 1; j < history.length; j++) {
    const key = history[j][1];  // Clé basée sur la colonne 1 de history
    const value = [history[j][41], history[j][44], history[j][50], history[j][51]];  // Valeurs à récupérer
    historyMap.set(key, value);
  }

  // Parcourir pn_lbo et récupérer les valeurs depuis la map
  for (let i = 1; i < pn_lbo.length; i++) {
    const caseID = pn_lbo[i][54];  // ID basé sur la colonne 53 de pn_lbo
    if (historyMap.has(caseID)) {
      pn_lbo[i].push(...historyMap.get(caseID));  // Ajouter les valeurs correspondantes
    } else {
      pn_lbo[i].push("", "", "");  // Ajouter des valeurs vides si aucune correspondance
    }
  }

  var case_without_LBO_type = new DataFilter(pn_lbo);

  var case_without_LBO_type_data = case_without_LBO_type
  .AddCriteria(78, type => type == "")
  .AddCriteria(91, rejection => rejection == "NO")
  .AddCriteria(100, value => value == "IMPL" || value == "INVEST" || value == "QUALIF" || value == "ASSESS" || value == "STOCK")
  .ApplyFilters()
  .RemoveDuplicates(54)
  .GetFilteredData();

  var types = ["t1", "t2", "t3"];

  for(let i = case_without_LBO_type_data.length - 1; i >= 0; i--){
    if(types.some(keyword => case_without_LBO_type_data[i][68].toLowerCase().includes(keyword))){
      case_without_LBO_type_data.splice(i, 1);
      Logger.log("Ligne " + i + " Supprimée");
    }
  }

  return case_without_LBO_type_data;

}

function lbo_nogo_repair_OG5(datas){
  //Si LBO, NOGO ou REPAIR se trouve seul dans un groupe, il prend le lead du statut. Si par contre il se retrouve dans le même groupe qu'un 3F ou qualif sans distinction de programme ou sur le même programme alors le 3F ou qualif prend le lead. Si dans le même groupe et sur un programme différent alors LBO, NOGO et REPAIR prennent le lead.

  // Récupérer une copie de l'extract Case_Solution
  var tmp = new DataFilter(datas.cases_solution_data.map(row => row.slice()));

  var data = tmp.AddCriteria(44, og => og == "OG5") // Filtrage sur les OG5+
  .AddCriteria(72, state => state == "Applied")
  .AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "STOCK")
  .AddCriteria(1, cas => parseInt(String(cas).substring(0, 2)) >= 22) // Filtrage sur les cas de 2022 ou plus
  .ApplyFilters()
  .GetFilteredData() // Filtrage sur les scenarios appliqués

  for(let i = 0; i < data.length; i++){
    if(data[i][55] == "NOGO" && (data[i][65].toLowerCase().includes("no data") || data[i][65].toLowerCase().includes("not use") || data[i][65].toLowerCase().includes("no impact") || data[i][65].toLowerCase().includes("not relevant") || data[i][65].toLowerCase().includes("not used") || data[i][65].toLowerCase().includes("no data"))){
      data.splice(i, 1);
    };
  };

  // Regrouper les lignes par sujet (colonne 1)
  let subjectMap = new Map();
  
  data.forEach(row => {
    let subject = row[1];
    if (!subjectMap.has(subject)) {
      subjectMap.set(subject, []);
    }
    subjectMap.get(subject).push(row);
  });

  // Définition des scénarios
  const scenarioSet1 = new Set(["LBO", "NOGO", "REPAIR"]);
  const scenarioSet2 = new Set(["3F", "QUALIFICATION", "REDESIGN"]);

  var validSubjects = [];

  let subjectsToReport = new Map();

  subjectMap.forEach((rows, subject) => {
    let keySubjectGroupProgram = new Map();
    let keySubjectGroup = new Map();
    //let keySubject = new Map();

    let shouldNotReport = false;
    let scenario_found = false;

    for (let row of rows) {
      let group = row[64];
      let program = row[69];
      let scenario = row[55];

      // Clés pour différents niveaux de regroupement
      let keySGP = `${subject}-${group}-${program}`;
      let keySG = `${subject}-${group}`;
      let keyS = `${subject}`;

      // Logique 1 et 3: même clé sujet-group-program et même clé sujet-group
      if (!keySubjectGroupProgram.has(keySGP)) {
        keySubjectGroupProgram.set(keySGP, new Set());
      }
      keySubjectGroupProgram.get(keySGP).add(scenario);
      if (keySubjectGroupProgram.get(keySGP).hasAny(scenarioSet1) && keySubjectGroupProgram.get(keySGP).hasAny(scenarioSet2)) {
        shouldNotReport = true;
      }

      if (!keySubjectGroup.has(keySG)) {
        keySubjectGroup.set(keySG, new Set());
      }
      keySubjectGroup.get(keySG).add(scenario);
      if (keySubjectGroup.get(keySG).hasAny(scenarioSet1) && keySubjectGroup.get(keySG).hasAny(scenarioSet2)) {
        shouldNotReport = true;
      }

      // Il faut qu'il y ai au moins 1 scenario LBO, NOGO ou Repair
      if(scenarioSet1.has(scenario)){
        scenario_found = true;
      }

      // Logique 2 et 4: même clé sujet-group avec différents programmes et même clé sujet avec différents groupes
      /*if (!keySubject.has(keyS)) {
        keySubject.set(keyS, new Map());
      }
      if (!keySubject.get(keyS).has(group)) {
        keySubject.get(keyS).set(group, new Set());
      }
      keySubject.get(keyS).get(group).add(scenario);*/
    }
    

    // Vérification des logiques 2 et 4 si non bloqué par 1 ou 3
    if (!shouldNotReport && scenario_found) {
      validSubjects.push(...rows);
    }
  });


  var data_lbo_nogo_repair_OG5 = new DataFilter(validSubjects).RemoveDuplicates(1).GetFilteredData();

  return data_lbo_nogo_repair_OG5;
}

Set.prototype.hasAny = function(set) {
  for (let item of set) {
    if (this.has(item)) {
      return true;
    }
  }
  return false;
}

function lbo_deadline(datas) {

  // Récupérer une copie de l'extract case solution
  var data = new DataFilter(datas.cases_solution_data.map(row => row.slice()))

  data = data.AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "OnHOLD" && status != "SOLVED")
  .AddCriteria(6, lbo => lbo == "")
  .AddCriteria(44, og => og == "OG4" || og == "OG5" || og == "OG5a" || og == "OG5b" || og == "OG6")
  .AddCriteria(55, scenario => scenario == "LBO")
  .ApplyFilters()
  .RemoveDuplicates(1)
  .GetFilteredData();

  return data

}

function solution_state(datas) {

  // Récupérer une copie de l'extract case solution
  var data = new DataFilter(datas.cases_solution_data.map(row => row.slice()))

  data = data.AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "OnHOLD" && status != "SOLVED")
  .AddCriteria(72, state => state == "")
  .AddCriteria(55, scenario => scenario != "")
  .AddCriteria(44, og => og == "OG4" || og == "OG5" || og == "OG5a" || og == "OG5b" || og == "OG6")
  .ApplyFilters()
  .RemoveDuplicates(1)
  .GetFilteredData();

  return data

}

function case_last_modif_date(datas) {

  // Récupérer une copie de l'extract case history
  var data = new DataFilter(datas.cases_history_data.map(row => row.slice()))

  data = data
  .AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "OnHOLD" && status != "SOLVED")
  .AddCriteria(23, modif => modif == "")
  .ApplyFilters()
  .RemoveDuplicates(1)
  .GetFilteredData();

  return data
  
}
