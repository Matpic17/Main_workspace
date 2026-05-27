function get_data(val) {
  //Récupérer le dossier des extracts
  const latestFileIds = findLatestFiles(FOLDER_ID);

  var pn_to_solution, cases_partnumber, cases_solution, cases_history, pn_LBO;

  //Boucle permettant de récupérer les ID des extracts
  /*while(fichiers.hasNext()){

    let file = fichiers.next()
    let name = file.getName();
    name = name.toLowerCase();

    if(name.includes("pn") && name.includes("to") && name.includes("sol")){
      pn_to_solution = SpreadsheetApp.openById(file.getId());

    } else if(name.includes("cases") && name.includes("partnumber")){
      cases_partnumber = SpreadsheetApp.openById(file.getId());

    } else if(name.includes("cases") && name.includes("solution")){
      cases_solution = SpreadsheetApp.openById(file.getId());

    } else if(name.includes("cases") && name.includes("history")){
      cases_history = SpreadsheetApp.openById(file.getId());

    } else if(name.includes("partnumber") && name.includes("lbo")){
      pn_LBO = SpreadsheetApp.openById(file.getId());

    }
  }*/

  cases_solution = SpreadsheetApp.openById(latestFileIds.get("cases_solution"));

  cases_partnumber = SpreadsheetApp.openById(latestFileIds.get("cases_partnumber"));

  cases_history = SpreadsheetApp.openById(latestFileIds.get("cases_history"));

  pn_LBO = SpreadsheetApp.openById(latestFileIds.get("pn_LBO"));


  //Vérifier si tous les extracts sont présents dans le dossier
  if(/*!pn_to_solution || */!cases_partnumber || !cases_solution || !cases_history || !pn_LBO){

  var htmlOutput = HtmlService
    .createHtmlOutput(`
      <p><strong>Il manque un des 5 extracts dans le dossier.</strong>
      <br><br>Merci de vérifier que tous les extracts sont dans ce <a href="https://drive.google.com/drive/folders/` + lien_dossier + `?usp=drive_link" target="_blank">dossier</a>.</p>
      <hr><p>Pour vous aider, voici le lien de la <a href="https://docs.google.com/document/d/19Sm8tXjYujYoVdNkkh3WL9BW93o4D5iEeCXUf266ZxE/edit" target="_blank">documentation</a>.</p>`)
    .setWidth(500)
    .setHeight(150);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Fichier manquant");
    return;
  }

  //Charger les données des extracts dans les variables

  //var pn_to_solution_data = pn_to_solution.getSheets()[0].getDataRange().getValues();
  //Logger.log("pn_to_solution chargé")
  if(val == "normal"){
    var cases_partnumber_data = cases_partnumber.getSheets()[0].getDataRange().getValues();
    Logger.log("cases_partnumber chargé")
    var cases_solution_data = cases_solution.getSheets()[0].getDataRange().getValues();
    Logger.log("cases_solution chargé")
    var cases_history_data = cases_history.getSheets()[0].getDataRange().getValues();
    Logger.log("cases_history chargé")
    var pn_lbo_data = pn_LBO.getSheets()[0].getDataRange().getValues();
    Logger.log("pn to LBO chargé")
    
  } else if(val == "log") { // Si on est sur la log alors on charge moins de fichiers
    var cases_partnumber_data = cases_partnumber.getSheets()[0].getDataRange().getValues();
    Logger.log("cases_partnumber chargé")
    var cases_solution_data = cases_solution.getSheets()[0].getDataRange().getValues();
    Logger.log("cases_solution chargé")
    var pn_lbo_data = pn_LBO.getSheets()[0].getDataRange().getValues();
    Logger.log("pn to LBO chargé")
  }


  return {
    //pn_to_solution_data: pn_to_solution_data,
    cases_partnumber_data: cases_partnumber_data,
    cases_solution_data: cases_solution_data,
    cases_history_data: cases_history_data,
    pn_lbo_data: pn_lbo_data,
  };
}
