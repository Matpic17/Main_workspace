/**
 * =============================================================================
 *  Get_data.gs — Chargement des extracts TOM les plus récents
 * =============================================================================
 */

/**
 * Charge les extracts les plus récents du dossier CONFIG.IDS.DOSSIER_EXTRACTS.
 *
 * @param {string} val  "normal" (4 extracts) ou "log" (sans cases_history, pour Logistics)
 * @returns {{cases_partnumber_data: Array[], cases_solution_data: Array[],
 *            cases_history_data: (Array[]|undefined), pn_lbo_data: Array[]}|undefined}
 *          undefined si un extract manque et que le message a été affiché à l'utilisateur.
 */
function get_data(val) {
  const mode = val === "log" ? "log" : "normal";
  const requis = mode === "log"
    ? ["cases_partnumber", "cases_solution", "pn_LBO"]
    : ["cases_partnumber", "cases_solution", "cases_history", "pn_LBO"];

  const latestFileIds = findLatestFiles(CONFIG.IDS.DOSSIER_EXTRACTS);
  const manquants = requis.filter(cle => !latestFileIds || !latestFileIds.get(cle));
  if (manquants.length > 0) {
    signalerExtractsManquants_(manquants);
    return undefined;
  }

  const lire = cle => {
    const valeurs = SpreadsheetApp.openById(latestFileIds.get(cle)).getSheets()[0].getDataRange().getValues();
    log_(`${cle} chargé (${valeurs.length - 1} lignes)`);
    return valeurs;
  };

  return {
    cases_partnumber_data: lire("cases_partnumber"),
    cases_solution_data: lire("cases_solution"),
    cases_history_data: mode === "normal" ? lire("cases_history") : undefined,
    pn_lbo_data: lire("pn_LBO")
  };
}

/**
 * Prévient qu'un extract manque : fenêtre si lancement manuel, sinon erreur
 * explicite (l'exécution par déclencheur apparaît alors en échec).
 */
function signalerExtractsManquants_(manquants) {
  const lienDossier = `https://drive.google.com/drive/folders/${CONFIG.IDS.DOSSIER_EXTRACTS}?usp=drive_link`;
  const lienDoc = `https://docs.google.com/document/d/${CONFIG.IDS.DOC_DOCUMENTATION}/edit`;
  const message = `Extract(s) manquant(s) dans le dossier : ${manquants.join(", ")}`;
  log_(`❌ ${message}`);

  const html = HtmlService.createHtmlOutput(`
      <p><strong>Il manque un ou plusieurs extracts dans le dossier :</strong> ${manquants.join(", ")}.
      <br><br>Merci de vérifier que tous les extracts sont dans ce <a href="${lienDossier}" target="_blank">dossier</a>.</p>
      <hr><p>Pour vous aider, voici le lien de la <a href="${lienDoc}" target="_blank">documentation</a>.</p>`)
    .setWidth(500)
    .setHeight(170);

  try {
    SpreadsheetApp.getUi().showModalDialog(html, "Fichier manquant");
  } catch (e) {
    // Pas d'interface (déclencheur) : on fait échouer l'exécution avec un message clair
    throw new Error(`${message}. Dossier : ${lienDossier}`);
  }
}
