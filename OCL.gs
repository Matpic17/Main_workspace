function statusToBeUpdated(datas){

  var tmp = new DataFilter(datas.cases_solution_data.map(row => row.slice()));

  var data = tmp.AddCriteria(72, state => state == "Applied" || state == "Proposed")
  .AddCriteria(73, status => status == "To be updated")
  //.AddCriteria(40, status => status != "CANCEL" && status != "CLOSED" && status != "STOCK")
  .ApplyFilters()
  .RemoveDuplicates(71)
  .GetFilteredData(); // Filtrage sur les scenarios appliqués

  return data;
}

function og4_og5_wout_scenario_applied(datas){

  var scenario_not_applied = new DataFilter(datas.cases_solution_data.map(row => row.slice()));

  var scenario_not_applied_data = scenario_not_applied
    .AddCriteria(41, value => value == "IMPL" || value == "INVEST" || value == "QUALIF" || value == "ASSESS" || value == "STOCK")
    .AddCriteria(44, og => og == "OG4" || og == "OG5" || og == "OG5a" || og == "OG5b" || og == "OG6")
    .ApplyFilters()
    .GetFilteredData()
  ;

  var subjectMap = new Map();

  scenario_not_applied_data.forEach(row => {
    const subject = row[1]; // Numéro de sujet (colonne index 1 B)
    const solutionStateValue = row[72]; // Solution state (colonne index 73 BT)
    const scenarioValue = row[55]; // scenario (colonne index 54 BC)

    // Si le sujet n'est pas encore dans la map, l'ajouter avec un objet pour garder le statut de validité
    if (!subjectMap.has(subject)) {
      subjectMap.set(subject, { solution: true, applied: true, rows: [] });
    }

    // Ajouter la valeur de la colonne 30 à la liste des valeurs pour ce sujet
    let subjectStatus = subjectMap.get(subject);

    // Vérification des conditions pour chaque ligne :
    if (scenarioValue == "") {
      // Si une ligne ne respecte pas la condition, on marque le sujet comme non valide
      subjectStatus.solution = false;
    }

    if (solutionStateValue == "Applied"){
      subjectStatus.applied = false;
    }

    // Ajouter la ligne à l'ensemble des lignes de ce sujet
    subjectStatus.rows.push(row);

  });

  let validSubjects = [];

  // Vérifier chaque sujet dans la map
  subjectMap.forEach((status, subject) => {
    // Ajouter seulement les sujets qui sont toujours marqués comme valides
    if (status.solution && status.applied) {
      validSubjects.push(...status.rows);
    }
  });

  var scenario_not_applied_filtered = new DataFilter(validSubjects).RemoveDuplicates(1).GetFilteredData();
  
  return scenario_not_applied_filtered;

}

function case_wout_solution(datas) {

  var case_without_solution = new DataFilter(datas.cases_solution_data.map(row => row.slice())).AddCriteria(37, cause => cause !== "reach").AddCriteria(41, value => value !== "CANCEL").AddCriteria(44, og => og == "OG4" || og == "OG5" || og == "OG5a" || og == "OG5b" || og == "OG6").AddCriteria(1, cas => parseInt(cas.substring(0, 2)) > 20 && cas.substring(3).length == 6).ApplyFilters().GetFilteredData();

  var subjectsolutionMap = new Map();

  case_without_solution.forEach(row => {
    const subject = row[1]; // Numéro de sujet (column index 1)
    const solutionValue = row[55]; // Solution (column index 54)

    // Si le sujet n'est pas encore dans la map, l'ajouter avec un objet pour garder le statut de validité
    if (!subjectsolutionMap.has(subject)) {
      subjectsolutionMap.set(subject, { valid: true, rows: [] });
    }

    // Ajouter la valeur de la colonne 30 à la liste des valeurs pour ce sujet
    let subjectStatus = subjectsolutionMap.get(subject);

    // Vérification des conditions pour chaque ligne
    if (solutionValue !== "") {
      // Si une ligne ne respecte pas la condition, on marque le sujet comme non valide
      subjectStatus.valid = false;
    }

    // Ajouter la ligne à l'ensemble des lignes de ce sujet
    subjectStatus.rows.push(row);

    // Mettre à jour le statut du sujet dans la map
    subjectsolutionMap.set(subject, subjectStatus);
  });

  var case_without_Solution_filtered = [];

  // Vérifier chaque sujet dans la map
  subjectsolutionMap.forEach((status, subject) => {
    // Ajouter seulement les sujets qui sont toujours marqués comme valides
    if (status.valid) {
      case_without_Solution_filtered.push(...status.rows);
    }
  });

  var case_without_scenario = new DataFilter(case_without_Solution_filtered).RemoveDuplicates(1).GetFilteredData();

  return case_without_scenario;
}

function case_wout_category_code(datas){

  var case_category_code_data = new DataFilter(datas.cases_solution_data.map(row => row.slice()));

  case_category_code_data
  .AddCriteria(32, category => category == "")
  .AddCriteria(41, value => value == "IMPL" || value == "INVEST" || value == "QUALIF" || value == "ASSESS" || value == "STOCK");

  var case_category_code_filtered = case_category_code_data.ApplyFilters().RemoveDuplicates(1).GetFilteredData();

  return case_category_code_filtered;
  
}

function pnWoutSD(datas){

  var pn = new DataFilter(datas.cases_partnumber_data.map(row => row.slice()));
  var solution = new DataFilter(datas.cases_solution_data.map(row => row.slice()));

  var dataPN = pn.AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "SOLVED" && status != "OnHOLD")
  .AddCriteria(44, og => og != "OG0" && og != "OG1")
  .AddCriteria(66, nsd => nsd == "")
  .AddCriteria(67, isd => isd == "")
  .AddCriteria(69, pn => pn != "")
  .ApplyFilters()
  .GetFilteredData();

  var dataSoluce = solution.AddCriteria(72, applied => applied == "Applied")
  .AddCriteria(64, group => group != "")
  .ApplyFilters()
  .GetFilteredData();

  const indexCleTableauPN = 53;
  const indexCleTableauSoluce = 64;

  const indiceColonneALierSoluce = 55;

  const indexDonnees = new Map();
  
  // On parcourt tableau2 (en sautant l'en-tête à l'index 0)
  for (let i = 1; i < dataSoluce.length; i++) {
    const ligne = dataSoluce[i];
    const cle = ligne[indexCleTableauSoluce];
    const valeurALier = ligne[indiceColonneALierSoluce];
    
    // On s'assure que la clé et la valeur existent
    if (cle && valeurALier) {
      if (!indexDonnees.has(cle)) {
        // 1. Clé vue pour la 1ère fois : on crée un nouveau tableau
        indexDonnees.set(cle, [valeurALier]);
      } else {
        // 2. Clé déjà vue : on ajoute la valeur au tableau existant
        indexDonnees.get(cle).push(valeurALier);
      }
    }
  }

  const tableauFinal = dataPN.map((ligne, index) => {
    
    // Cas spécial pour la ligne d'en-tête (index 0)
    if (index === 0) {
      const nouvelEnTete = dataSoluce[0][indiceColonneALierSoluce]; // ex: "Projet"
      return ligne.concat(nouvelEnTete);
    }
    
    // Pour toutes les autres lignes de données
    const cle = ligne[indexCleTableauPN];
    const donneesTrouvees = indexDonnees.get(cle); // ex: ["Projet A", "Projet C"]

    if (donneesTrouvees) {
      // Correspondance trouvée ! On joint le tableau avec une virgule et un espace.
      const chaineConcaennee = donneesTrouvees.join(", ");
      return ligne.concat(chaineConcaennee);
    } else {
      // Aucune correspondance. On ajoute une cellule vide.
      return ligne.concat("");
    }
  });

  var lastTableau_tmp = new DataFilter(tableauFinal.map(row => row.slice()));

  var lastTableau = lastTableau_tmp.AddCriteria(112, sc => !sc.includes("NOGO"))
  .ApplyFilters()
  .RemoveDuplicates(0)
  .GetFilteredData()

  return lastTableau

}

function lbotest(datas){

  var tmp = datas.cases_solution_data.map(row => row.slice());

  var tempo = new DataFilter(tmp)
  .AddCriteria(1, cas => parseInt(String(cas).substring(0, 2)) > 18 && String(cas).substring(3).length == 6)
  .AddCriteria(44, og => ["OG4", "OG5", "OG5a", "OG5b"].includes(og))
  .AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "SOLVED")
  .ApplyFilters()
  .GetFilteredData();

  let eol = tempo.map(row => {    
    let lower = row[57].toLowerCase();
    row[57] = lower;
    return row;
  });

  const casesMap = new Map();
  eol.forEach(row => {
    const caseId = row[0];
    if (!casesMap.has(caseId)) {
      casesMap.set(caseId, []);
    }
    casesMap.get(caseId).push(row);
  });

  const anomalyMap = new Map();

  // 3. ANALYSE DE CHAQUE CAS (logique corrigée)
  casesMap.forEach((scenarios, caseId) => {
    const anomalies = []; // Pour stocker les erreurs trouvées pour ce cas
    
    // Informations générales du cas (extraites de la première ligne)
    const caseOG = scenarios[0][44];
    const caseStatus = scenarios[0][41];

    // On analyse tous les scénarios APPLIQUÉS du cas
    const appliedScenarios = scenarios.filter(row => row[72] === "Applied");
    
    const hasAppliedLBO_EOL = appliedScenarios.some(row => row[55] === "LBO" && row[57].toLowerCase().includes("eol"));
    const hasAppliedLBO_BB = appliedScenarios.some(row => row[55] === "LBO" && row[57].toLowerCase().includes("bb"));
    const hasOtherDefinitiveSolution = appliedScenarios.some(row => ["3F", "REDESIGN", "QUALIFICATION"].includes(row[55]));
    
    // ---- DÉBUT DES RÈGLES DE VÉRIFICATION ----

    if (caseOG.startsWith("OG4")) {
      // On vérifie d'abord s'il y a une implémentation technique (3F, Redesign...) EN COURS.
      const hasOngoingTechnicalImpl = appliedScenarios.some(row => ["3F", "REDESIGN", "QUALIFICATION"].includes(row[55]) && !(String(row[73] || "").startsWith("6/6") || String(row[73] || "").startsWith("To be updated") || String(row[73] || "").startsWith("Migration Oct 24")) // Statut de solution différent de "6/6 - Implementation ended" ou statut to be update
      );

      if (hasOngoingTechnicalImpl) {
        // Règle Prioritaire pour OG4 : Si une implémentation technique est en cours, le statut DOIT être IMPL ou QUALIF.
        if (!["IMPL", "QUALIF", "ASSESS"].includes(caseStatus)) {
          anomalies.push("Anomaly: OG4 with an technic implementation on going (3F/Redesign...) must have a IMPL or QUALIF status.");
        }
      } else {
        // Règle Secondaire pour OG4 : S'il n'y a PAS d'implémentation technique en cours, on vérifie les LBO.
        if ((hasAppliedLBO_EOL || hasAppliedLBO_BB) && caseStatus !== "STOCK") {
          anomalies.push("Anomaly: OG4 with an LBO (and without technic implementation on going) must have a stock status.");
        }
      }
    }

    if (caseOG.startsWith("OG5")) {
      // Règle 4: Un LBO en OG5 ne doit pas être en cours d'implémentation.
      // NOTE: J'ajoute la colonne 72 pour le statut de la solution (ex: "7/9..."). Adaptez l'index si besoin.
      const isLBO_notFinalized = appliedScenarios.some(row => {
          if (row[55] === "LBO") {
              const solutionStatus = row[73] || ""; // ex: "7/9 - Partial or pending reception"
              return !(solutionStatus.startsWith("8/9") || solutionStatus.startsWith("9/9") || solutionStatus.startsWith("To be updated") || solutionStatus.startsWith("Migration Oct 24"));
          }
          return false;
      });
      if (isLBO_notFinalized) {
        anomalies.push("Anomaly: OG5 validated with an LBO not finalized (statut <> 8/9 ou 9/9).");
      }

      // Règle 5: Un LBO EOL en OG5 doit avoir le statut STOCK.
      if (hasAppliedLBO_EOL && caseStatus !== "STOCK") {
        anomalies.push("Anomaly: OG5 with LBO EOL must have STOCK status.");
      }
      
      // Règle 6: Un cas en OG5 ne peut pas avoir un LBO BB comme seule solution.
      /*if (hasAppliedLBO_BB && !hasOtherDefinitiveSolution && !hasAppliedLBO_EOL) {
        anomalies.push("Anomaly: OG5 invalid because finalized with only an LBO BB (temporary solution).");
      } Supprimé suite à mise à jour des BR*/ 
    }

    // Si des anomalies ont été trouvées, on ajoute le cas et ses scénarios au résultat.
    if (anomalies.length > 0) {
      // On prend la première ligne du cas comme ligne représentative
      const representativeRow = scenarios[0]; 
      
      anomalies.forEach(reason => {
        // On crée la clé primaire "N° Cas | Règle non respectée"
        const anomalyKey = `${caseId} | ${reason}`;
        
        // Si cette anomalie précise n'a pas encore été ajoutée pour ce cas, on l'ajoute
        if (!anomalyMap.has(anomalyKey)) {
          let newRow = [...representativeRow]; // Copie de la ligne
          newRow.push(reason); // Ajout du commentaire d'anomalie
          anomalyMap.set(anomalyKey, newRow);
        }
      });
    }
  });

  // On convertit les valeurs du Map (les lignes uniques) en un tableau pour le retour
  return Array.from(anomalyMap.values());
}
