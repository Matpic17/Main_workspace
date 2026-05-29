function case_cause_code(datas) {

  // Récupérer une copie de l'extract case history
  var data = new DataFilter(datas.cases_history_data.map(row => row.slice()))

  data = data
  .AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "OnHOLD" && status != "SOLVED")
  .AddCriteria(34, cause => cause == "")
  .ApplyFilters()
  .RemoveDuplicates(1)
  .GetFilteredData();

  return data
  
}

function supplier_notif(datas) {

  // Récupérer une copie de l'extract Case history
  var data = new DataFilter(datas.cases_history_data.map(row => row.slice()))

  data = data
  .AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "OnHOLD" && status != "SOLVED")
  .AddCriteria(11, notif => notif == "")
  .ApplyFilters()
  .RemoveDuplicates(1)
  .GetFilteredData();

  return data
  
}

function case_summary(datas){

  // Récupérer une copie de l'extract Case_History
  var case_summary_data = new DataFilter(datas.cases_history_data.map(row => row.slice()));

  case_summary_data.AddCriteria(20, summary => !(summary.includes("Summary") && summary.includes("Procurable") && summary.includes("Repairable") && summary.includes("Missing part") && summary.includes("Resolution strategy") && summary.includes("Resolution status"))) // Filtrage sur les summary ne contenant pas tous ces mots
  .AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "SOLVED" && status != "Case_status_code")
  .AddCriteria(1, cas => parseInt(String(cas).substring(0, 2)) >= 22); // Filtrage sur les cas de 2022 ou plus

  var case_summary_filtered = case_summary_data.ApplyFilters().RemoveDuplicates(1).GetFilteredData(); // Applique les filtres, retire les doublons et obtiens les données dans la variable

  return case_summary_filtered

}

function case_notif_date_futur(datas) {

  // Récupérer une copie de l'extract case history
  var data = new DataFilter(datas.cases_history_data.map(row => row.slice()))

  data = data.AddCriteria(41, status => status != "CANCEL" && status != "CLOSED" && status != "OnHOLD" && status != "SOLVED")
  .AddCriteria(11, notif => notif > new Date())
  .ApplyFilters()
  .RemoveDuplicates(1)
  .GetFilteredData();

  return data

}
