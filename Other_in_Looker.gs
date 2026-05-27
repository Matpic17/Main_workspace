function pn_not_in_SAP(datas) {

  // Récupérer une copie de l'extract Case_Partnumber
  var pn_not_SAP = new DataFilter(datas.cases_partnumber_data.map(row => row.slice()));

  pn_not_SAP
  .AddCriteria(69, pn => pn != "")
  .AddCriteria(70, category => category == "") // Vérifie si la catégorie est vide
  .AddCriteria(41, statut => statut != "CANCEL"); // Exclut les statuts "CANCEL"

  pn_not_SAP = pn_not_SAP.ApplyFilters().GetFilteredData(); // Applique les filtres, retire les doublons et obtiens les données dans la variable

  // Traitement supplémentaire (désactivé ici)
  /*pn_not_SAP.forEach(row => {
    if(row[45] != ""){
      row.push("PN with associated case");
    } else {
      row.push("PN without associated case");
    }
  })*/
  
  return pn_not_SAP; // Renvoie les données filtrées
  
}

function obsolete_component(datas){

  // Récupérer une copie de l'extract Case_Partnumber
  var date_obsolete_compo = new DataFilter(datas.cases_partnumber_data.map(row => row.slice()));

  date_obsolete_compo.AddCriteria(13, obso_compo => {
    return typeof obso_compo === 'string' && (/^\d{2}[\/.\-]\d{2}[\/.\-].*/.test(obso_compo)); 
    }) // Vérifie le format de date
  .AddCriteria(41, status => status != "CANCEL") // Exclut les statuts "CANCEL"
  .AddCriteria(13, case_id => case_id != "30-01-C647-1221" && case_id != "56-77-10G" && case_id != "51-03-4660-0000" && case_id != "16-24-131-04-1" && case_id != "16-35-531-12-1" && case_id != "2105-01-22"); // Exclus certains résultats en trop

  date_obsolete_compo = date_obsolete_compo.ApplyFilters().RemoveDuplicates(1).GetFilteredData(); // Applique les filtres, retire les doublons et obtiens les données dans la variable

  return date_obsolete_compo
}

function case_wout_PN(datas) {

  var case_without_PN_data = new DataFilter(datas.cases_partnumber_data.map(row => row.slice())).AddCriteria(41, value => value == "IMPL" || value == "INVEST" || value == "QUALIF" || value == "ASSESS" || value == "STOCK").ApplyFilters().GetFilteredData();

  var subjectPnMap = new Map();

  case_without_PN_data.forEach(row => {
    const subject = row[1]; // Numéro de sujet (colonne index 1)
    const partnumberValue = row[69]; // Partnumber (colonne index 53)

    // Si le sujet n'est pas encore dans la map, l'ajouter avec un objet pour garder le statut de validité
    if (!subjectPnMap.has(subject)) {
      subjectPnMap.set(subject, { valid: true, rows: [] });
    }

    // Ajouter la valeur de la colonne 30 à la liste des valeurs pour ce sujet
    let subjectStatus = subjectPnMap.get(subject);

    // Vérification des conditions pour chaque ligne
    if (partnumberValue !== "") {
      // Si une ligne ne respecte pas la condition, on marque le sujet comme non valide
      subjectStatus.valid = false;
    }

    // Ajouter la ligne à l'ensemble des lignes de ce sujet
    subjectStatus.rows.push(row);

    // Mettre à jour le statut du sujet dans la map
    subjectPnMap.set(subject, subjectStatus);
  });

  var case_without_PN_filtered = [];

  // Vérifier chaque sujet dans la map
  subjectPnMap.forEach((status, subject) => {
    // Ajouter seulement les sujets qui sont toujours marqués comme valides
    if (status.valid) {
      case_without_PN_filtered.push(...status.rows);
    }
  });

  var scenario_not_applied_filtered = new DataFilter(case_without_PN_filtered).RemoveDuplicates(1).GetFilteredData();

  return scenario_not_applied_filtered;
}
