/**
 * Analyse plusieurs onglets, compare avec les données de la semaine précédente,
 * puis envoie un e-mail récapitulatif avec delta à chaque personne et un tableau global à Florent.
 */
function envoyerRapportPersonnaliseParMail() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- CONFIGURATION ---
  const NOMS_DES_ONGLETS = [
    "Not updated",
    "OG4-OG5 status check",
    "OG4-OG5 cases without scenario (not applied)",
    "Case_category code (empty)",
    "PnWoutSD",
    "LMP_prio_empty"
  ];
  const ID_IMAGE_DRIVE = "1utRWcNyf6tHHvDQzuVs1q00vOg97vSIm";
  const ID_IMAGE_FELICITATION = "1SBv0mYMkXZjUlAYUD0CMZPwZdkCzvhAx";
  const ID_FICHIER_ARCHIVE = "1W0_NpL4E8Lmd_PED9U4tygL0bfsNVzurvTcNzijcgkU";
  const EMAIL_RECAP_GLOBAL = "florent.le-cardiec@airbus.com";

  const imageBlob = DriveApp.getFileById(ID_IMAGE_DRIVE).getBlob();
  const imageFelicitation = DriveApp.getFileById(ID_IMAGE_FELICITATION).getBlob();
  const dateMaster = new Date();
  const year = dateMaster.getFullYear();
  const weekNumber = getWeekNumber();
  const ocl_list = getNames();

  // --- ÉTAPE 1 : Agrégation des données actuelles ---
  Logger.log("Étape 1 : Début de l'agrégation des données actuelles...");
  const rapportParPersonne = {};

  NOMS_DES_ONGLETS.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`Attention : Onglet non trouvé : "${sheetName}". Il est ignoré.`);
      return;
    }

    const values = sheet.getDataRange().getValues();
    Logger.log(`Analyse de l'onglet "${sheetName}" (${values.length - 1} lignes de données)...`);

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row.length <= 51) continue;
      if (row[41] == "CLOSED" || row[41] == "SOLVED" || row[41] == "CANCEL" || row[41] == "OnHOLD") continue;

      let caseValue;
      if (sheetName.toLowerCase() == "lbo nogo repair og5 in solved" || sheetName.toLowerCase() == "not updated" || sheetName.toLowerCase() == "lbo eol scenario in og4 stock") {
        caseValue = row[53]; // Colonne BA (Scenario ID)
      } else {
        caseValue = row[0]; // Colonne A (Case ID)
      }

      const personne = `${row[50]} ${row[51]}`.trim();
      if (!caseValue || !personne) continue;

      if (!rapportParPersonne[personne]) {
        rapportParPersonne[personne] = {};
      }
      if (!rapportParPersonne[personne][sheetName]) {
        rapportParPersonne[personne][sheetName] = new Set();
      }
      rapportParPersonne[personne][sheetName].add(caseValue);
    }
  });
  Logger.log("Étape 1 : Agrégation des données actuelles terminée.");

  // --- ÉTAPE 1.5 : Agrégation des données de la semaine précédente ---
  Logger.log("Étape 1.5 : Récupération des données de la semaine précédente...");
  const rapportSemainePrecedente = recupererRapportSemainePrecedente(NOMS_DES_ONGLETS, ID_FICHIER_ARCHIVE);

  // --- ÉTAPE 2 : Création du mail de récompense ---
  Logger.log("Début de l'étude du mail de récompense...")
  for(const name in rapportSemainePrecedente) {
    let recompense = true;

    for(const personne in rapportParPersonne) {
      if(personne == name) {
        recompense = false;
      };
    };

    if(recompense == true){
      const destinataire = GET_EMAIL(name);

      const sujet = `Data management report ${year}-W${weekNumber}, CONGRATULATION !`;
      const corpsDuMail = `
      <div>
        Hello ${name}, it's TOM !<br><br>
        I have some great news for you: your scope is now 100% clean !   All your issues have been resolved !!<br>
        <div>
          <img src="cid:logoRapport" style="width: 600px; margin-top: 15px;">
        </div>

        <br>Congratulations on the great work !
        <br><br>Best regards,<br>Automatic system for data management<br>

      </div>`;

      const options = {
        htmlBody: corpsDuMail,
        inlineImages: { logoRapport: imageFelicitation }
      };
      GmailApp.createDraft(destinataire, sujet, "", options);
      Logger.log(`Mail de félicitation envoyé avec succès pour ${name} (${destinataire}).`);

    };
  };
  Logger.log("Étape 2 : Fin de la génération des e-mails de récompense.");


  // --- ÉTAPE 3 : Génération et envoi des e-mails individuels ---
  Logger.log("Étape 3 : Début de la génération des e-mails individuels...");
  for (const personne in rapportParPersonne) {
    Logger.log("Personne traitée : " + personne)
    const destinataire = GET_EMAIL(personne); 

    const detailsParFeuille = rapportParPersonne[personne];
    let totalCases = 0;
    const lignesDeResume = [];

    for (const sheetName in detailsParFeuille) {
      const nombreDeCasActuel = detailsParFeuille[sheetName].size;
      totalCases += nombreDeCasActuel;

      const nombreDeCasPrecedent = rapportSemainePrecedente[personne]?.[sheetName]?.size || 0;
      let deltaTexte = "";

      if (nombreDeCasPrecedent === 0 && nombreDeCasActuel > 0) {
        deltaTexte = " <span style='color: blue;'>(new)</span>";
      } else {
        const delta = nombreDeCasActuel - nombreDeCasPrecedent;
        if (delta > 0) {
          deltaTexte = ` <span style='color: red;'>(évolution : +${delta})</span>`;
        } else if (delta < 0) {
          deltaTexte = ` <span style='color: green;'>(évolution : ${delta})</span>`;
        } else {
          deltaTexte = ` <span style='color: black;'>(évolution : +${delta})</span>`;
        }
      }

      const typeElement = (sheetName.toLowerCase() === "not updated" || sheetName.toLowerCase() === "og4-og5 status check") ? "scenario(s)" : "case(s)";
      lignesDeResume.push(`- ${nombreDeCasActuel} ${typeElement} in the category "${sheetName}"${deltaTexte}`);
    }

    if (totalCases > 0 && ocl_list.includes(personne.toLowerCase())) {
      try {
        const sujet = `Data management report ${year}-W${weekNumber} : ${totalCases} errors`;
        const corpsDuMail = `
        <div>
          Hello ${personne}, it's TOM !<br><br>
          Make me happy, solve the issues below :<br>
          ${lignesDeResume.join('<br>')}<br><br>
          In case you want to show all the cases, you can find the list in this Looker, section "Email categories" :<br>
          https://lookerstudio.google.com/s/l_iKhFrSnBY<br><br>
          Best regards,<br>Automatic system for data management<br>
          <div>
            <img src="cid:logoRapport" style="width: 250px; margin-top: 15px;">
          </div>
        </div>`;
        const options = {
          htmlBody: corpsDuMail,
          inlineImages: { logoRapport: imageBlob }
        };
        GmailApp.createDraft(destinataire, sujet, "", options);
        Logger.log(`Mail envoyé avec succès pour ${personne} (${destinataire}).`);
      } catch (e) {
        Logger.log(`ERREUR lors de la création du brouillon pour ${personne} : ${e.message}`);
      }
    }
  }
  Logger.log("Étape 3 : Fin de la génération des e-mails individuels.");

  // --- ÉTAPE 4 : Génération et envoi du récapitulatif à Florent ---
  Logger.log("Étape 4 : Début de la génération du récapitulatif global...");
  let total_issues = 0;
  for (const personne in rapportParPersonne) {
    for (const sheetName in rapportParPersonne[personne]) {
      total_issues += rapportParPersonne[personne][sheetName].size;
    }
  }

  const tableauRecapHTML = creerTableauRecapHTML(rapportParPersonne, rapportSemainePrecedente, NOMS_DES_ONGLETS);

  try {
    const sujet = `Data management recap for ${year}-W${weekNumber} : ${total_issues} errors`;
    const corpsDuMail = `
    <div>
      Hello Florent, it's TOM !<br><br>
      This is the global recap of the issues for this week. Total: <b>${total_issues}</b> errors.<br><br>
      ${tableauRecapHTML}
      <br>
      Best regards,<br>
      Automatic system for data management<br>
      <div>
        <img src="cid:logoRapport" style="width: 250px; margin-top: 15px;">
      </div>
    </div>`;
    const options = {
      htmlBody: corpsDuMail,
      inlineImages: { logoRapport: imageBlob }
    };
    GmailApp.createDraft(EMAIL_RECAP_GLOBAL, sujet, "", options);
    Logger.log(`Mail envoyé avec succès à Florent.`);
  } catch (e) {
    Logger.log(`ERREUR lors de l'envoi de l'e-mail à Florent : ${e.message}`);
  }
  Logger.log("Étape 4 : Fin du script.");
}


/**
 * Récupère le rapport d'anomalies pour la deuxième date la plus récente depuis le fichier d'archive.
 * @param {string[]} nomsDesOnglets - La liste des onglets à analyser.
 * @param {string} idFichierArchive - L'ID du Google Sheet servant d'archive.
 * @returns {object} Un objet structuré comme rapportParPersonne pour les données anciennes.
 */
function recupererRapportSemainePrecedente(nomsDesOnglets, idFichierArchive) {
  Logger.log("  -> Début de la récupération des données de la semaine précédente...");
  const rapportAncien = {};
  try {
    const ssArchive = SpreadsheetApp.openById(idFichierArchive);
    const sheetRefDates = ssArchive.getSheetByName(nomsDesOnglets[1]);
    Logger.log(`Onglet en cours de traitement : "${nomsDesOnglets[1]}"`);

    if (!sheetRefDates) {
      Logger.log(`  -> Onglet de référence "${nomsDesOnglets[1]}" non trouvé dans l'archive. Abandon.`);
      return {};
    }

    const datesColumn = sheetRefDates.getRange("A2:A").getValues();
    const datesUniques = new Set();
    datesColumn.forEach(row => {
      if (row[0] instanceof Date && row[0].getTime() > 0) {
        datesUniques.add(new Date(row[0].setHours(0, 0, 0, 0)).getTime());
      }
    });

    if (datesUniques.size < 2) {
      Logger.log("  -> Moins de deux dates d'historique trouvées. Pas de données précédentes à comparer.");
      return {};
    }

    const datesTriees = Array.from(datesUniques).sort((a, b) => b - a);
    const timestampPrecedent = datesTriees[1];
    const datePrecedente = new Date(timestampPrecedent);
    Logger.log(`  -> Date de la semaine précédente identifiée : ${datePrecedente.toLocaleDateString("en-GB")}`);

    nomsDesOnglets.forEach(sheetName => {
      const sheet = ssArchive.getSheetByName(sheetName);
      if (!sheet) return;

      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[0] instanceof Date && new Date(row[0].setHours(0, 0, 0, 0)).getTime() === timestampPrecedent) {
          if (row.length <= 51) continue;
          if (row[42] == "CLOSED" || row[42] == "SOLVED" || row[42] == "CANCEL" || row[42] == "OnHOLD") continue;

          if (sheetName.toLowerCase() == "lbo nogo repair og5 in solved" || sheetName.toLowerCase() == "not updated" || sheetName.toLowerCase() == "lbo eol scenario in og4 stock") {
            caseValue = row[54]; 
          } else {
            caseValue = row[1];
          }

          const personne = `${row[51]} ${row[52]}`.trim();
          if (!caseValue || !personne) continue;

          if (!rapportAncien[personne]) rapportAncien[personne] = {};
          if (!rapportAncien[personne][sheetName]) rapportAncien[personne][sheetName] = new Set();
          rapportAncien[personne][sheetName].add(caseValue);
        }
      }
    });
    Logger.log("  -> Récupération des données de la semaine précédente terminée.");
    return rapportAncien;
  } catch (e) {
    Logger.log(`  -> ERREUR lors de la lecture du fichier d'archive : ${e.message}`);
    return {};
  }
}


/**
 * Crée un tableau HTML de récapitulatif avec delta.
 * @param {object} rapportActuel - L'objet avec les données actuelles.
 * @param {object} rapportPrecedent - L'objet avec les données de la semaine précédente.
 * @param {string[]} nomsDesOnglets - La liste des noms d'onglets pour les colonnes.
 * @returns {string} Le code HTML du tableau.
 */
function creerTableauRecapHTML(rapportActuel, rapportPrecedent, nomsDesOnglets) {
  let html = `<p>Voici le détail par personne et par catégorie :</p>
              <table style="border: 1px solid black; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt;">
                <thead>
                  <tr style="background-color: #f2f2f2;">
                    <th style="border: 1px solid black; padding: 8px;">Personne</th>`;
  nomsDesOnglets.forEach(nomOnglet => {
    html += `<th style="border: 1px solid black; padding: 8px;">${nomOnglet}</th>`;
  });
  html += `     </tr>
              </thead>
              <tbody>`;

  const personnesTriees = Object.keys(rapportActuel).sort();

  for (const personne of personnesTriees) {
    if (Object.keys(rapportActuel[personne]).length >= 0) {
      html += `<tr>
                 <td style="border: 1px solid black; padding: 8px;">${personne}</td>`;
      nomsDesOnglets.forEach(nomOnglet => {
        const nombreDeCasActuel = rapportActuel[personne]?.[nomOnglet]?.size || 0;
        const nombreDeCasPrecedent = rapportPrecedent[personne]?.[nomOnglet]?.size || 0;
        let deltaTexte = "";

        if (nombreDeCasPrecedent === 0 && nombreDeCasActuel > 0) {
          deltaTexte = " <span style='color: blue;'>(new)</span>";
        } else {
          const delta = nombreDeCasActuel - nombreDeCasPrecedent;
          if (delta > 0) {
            deltaTexte = ` <span style='color: red;'>(+${delta})</span>`;
          } else if (delta < 0) {
            deltaTexte = ` <span style='color: green;'>(${delta})</span>`;
          } /*else {
            deltaTexte = ` <span style='color: black;'>(+${delta})</span>`;
          }*/
        }
        html += `<td style="border: 1px solid black; padding: 8px; text-align: center;">${nombreDeCasActuel}${deltaTexte}</td>`;
      });
      html += `</tr>`;
    }
  }
  html += `  </tbody>
           </table>`;
  return html;
}


/**
 * Calcule le numéro de la semaine ISO 8601.
 * @returns {number} Le numéro de la semaine.
 */
function getWeekNumber() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    // January 4 is always in week 1.
    const week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}


/**
 * Récupère les OCL actifs à partir d'une feuille de configuration.
 * @returns {string[]} Un tableau contenant les noms des OCL en minuscules.
 */
function getNames(){
  const SPREADSHEET_ID = "11VPET-9JI5_wMsujaVldKnCq6PGI8K84sMrD46lOrVQ";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("concat");
  if (!sheet) {
    Logger.log(`Attention : La feuille "concat" est introuvable.`);
    return [];
  }
  
  const values = sheet.getRange("A2:A").getValues();
  const donneesTotales = new Set();

  for (const row of values) {
    const val = row[0];
    if (val === null || val === "") {
      break; 
    }
    if (typeof val === 'string') {
      donneesTotales.add(val.toLowerCase().trim());
    }
  }
  return Array.from(donneesTotales);
}
