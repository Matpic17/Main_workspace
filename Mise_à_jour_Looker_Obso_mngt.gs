/**
 * Nombre de lignes par appel IMPORTRANGE.
 * @const {number}
 */
const BATCH_SIZE_IMPORTRANGE = 3000;

/**
 * Ligne à partir de laquelle commencer l'importation dans la SOURCE
 * (1 = en-tête, 2 = données).
 * @const {number}
 */
const SOURCE_START_ROW = 2;

/**
 * Ligne à laquelle coller la formule dans la DESTINATION
 * (1 = écraser l'en-tête, 2 = coller sous l'en-tête).
 * @const {number}
 */
const DEST_START_ROW = 2;


// --- CONFIGURATION ---
const DISPATCH_CONFIG = {
  "contract": {
    fileId: "1z2HVZWCCRnWiR-q9Uc8cNyw5BOz7vGroJYoTSwkbQk4",
    tabs: [
      "OBSO ALERTS", "OBSO NOTIFICATIONS", "OBSO HISTORY",
      "TREATMENT ALERTS", "TREATMENT NOTIFICATIONS", "TREATMENT HISTORY"
    ]
  },
  "cases_partnumber": {
    fileId: "1EBoAkR_71U5SHEO6wUdgyPN4y7rc5lfqaHrfWqHCFaI",
    useFirstTab: true,
    sourceTabName: "CASE > PN"
  },
  "cases_solution": {
    fileId: "1F223VXpIsBNRlWpJoFMSYL1g5VtofwPP-BQwZrwCO84",
    useFirstTab: true,
    sourceTabName: "CASE > SOLUTION"
  },
  "cases_history": {
    fileId: "1p50sBzrZ3Ni3e2w5UUwp2MjCPZe1xPY9GUCo0PSWk5E",
    useFirstTab: true,
    sourceTabName: "CASE > HISTORY"
  },
  "pn_LBO": {
    fileId: "1Ob3_J_RQvl41kONdXqdLQbBH0MJXxJENFWo_hqdBJek",
    useFirstTab: true,
    sourceTabName: "PN_Scenario_tree_node"
  },
  "action_solution_pn": {
    fileId: "1ylGxsGkG5Yata2ft-oRjNCX4Swn9_RNgGEa8xvh_MaA",
    useFirstTab: true,
    sourceTabName: "Sheet1"
  },
  "case_program_variant": {
    fileId: "1SBIPB9v2-2EOmWdWcVeqqunhumiK8pGGNSuIegJgm5A",
    useFirstTab: true,
    sourceTabName: "CASE > PROGRAM & VARIANTS"
  },
  "pn_to_sol" : {
    fileId: "1FpLJDdqp1MQP_oKvGsME_JwoUfn7y623xh-Uwitbp6U",
    useFirstTab: true,
    sourceTabName: "Feuille 1"
  }
};

const FOLDER_ID = "0ACEvsK712Yj6Uk9PVA";

const FILE_DEFINITIONS = {
  cases_partnumber: ["cases", "partnumber"],
  cases_solution: ["cases", "solution"],
  cases_history: ["cases", "history"],
  pn_LBO: ["partnumber", "lbo"],
  contract: ["contract"],
  action_solution_pn: ["actions", "solutions", "partnumber"],
  case_program_variant: ["cases", "program", "variants"],
  pn_to_sol: ["pn", "to", "sol"]
};

/**
 * Fonction principale pour METTRE À JOUR LES LIENS IMPORTRANGE.
 * Construit des formules par lots et ajuste la taille des feuilles.
 */
function updateLookerStudioSources() {
  
  let rapport = "Rapport de mise à jour des sources :\n\n";

  // --- Préparer les paramètres d'autorisation ---
  const token = ScriptApp.getOAuthToken();
  const params = {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + token,
    },
    muteHttpExceptions: true
  };

  try {
    // --- Phase 1 : Trouver les derniers fichiers ---
    const latestFileIds = findLatestFiles(FOLDER_ID);
    
    if (!latestFileIds) {
      throw new Error("Impossible de trouver la date la plus récente ou les fichiers correspondants.");
    }

    // --- Phase 2 : Mettre à jour les formules IMPORTRANGE ---
    for (const key in DISPATCH_CONFIG) {
      const destInfo = DISPATCH_CONFIG[key];
      const destFileId = destInfo.fileId;
      const sourceFileId = latestFileIds.get(key);

      if (!sourceFileId) {
        rapport += `❌ ${key} : Fichier source introuvable pour la dernière date.\n`;
        continue;
      }
      
      try {
        // Autoriser programmatiquement l'accès
        Logger.log(`Autorisation de l'accès pour ${key}...`);
        const authUrl = `https://docs.google.com/spreadsheets/d/${destFileId}/externaldata/addimportrangepermissions?donorDocId=${sourceFileId}`;
        UrlFetchApp.fetch(authUrl, params);
        
        // Ouverture des fichiers
        const sourceSS = SpreadsheetApp.openById(sourceFileId);
        const destSS = SpreadsheetApp.openById(destFileId);

        if (key === 'contract') {
          for (const tabName of destInfo.tabs) {
            const sourceSheet = sourceSS.getSheetByName(tabName);
            if (!sourceSheet) throw new Error(`Onglet source '${tabName}' introuvable.`);
            
            const totalRows = sourceSheet.getMaxRows();
            const lastColA1 = colIndexToA1(sourceSheet.getLastColumn());

            updateSheetFormula(destSS, tabName, sourceFileId, tabName, totalRows, lastColA1);
          }
          rapport += `✔ ${key} : 6 onglets mis à jour.\n`;
        } else {
          const sourceTabName = destInfo.sourceTabName || "Feuil1";
          const sourceSheet = sourceSS.getSheetByName(sourceTabName);
          if (!sourceSheet) throw new Error(`Onglet source '${sourceTabName}' introuvable.`);

          const totalRows = sourceSheet.getMaxRows();
          const lastColA1 = colIndexToA1(sourceSheet.getLastColumn());

          const destSheetName = destSS.getSheets()[0].getName();
          
          updateSheetFormula(destSS, destSheetName, sourceFileId, sourceTabName, totalRows, lastColA1);
          rapport += `✔ ${key} : 1 onglet mis à jour.\n`;
        }
      } catch (e) {
        Logger.log(e);
        rapport += `❌ ERREUR pour ${key} : ${e.message}\n`;
      }
    }
  
  } catch (e) {
    Logger.log(e);
    rapport = `ERREUR CRITIQUE : ${e.message}`;
  }
  
  Logger.log(rapport);
  // Si lancé manuellement, on peut vouloir afficher le rapport
  // SpreadsheetApp.getUi().alert(rapport); 

  SpreadsheetApp.flush();
}

/**
 * Construit et écrit une formule IMPORTRANGE par lots dans un onglet cible.
 * AJOUT : Redimensionne la feuille si nécessaire.
 */
function updateSheetFormula(destSS, destSheetName, sourceFileId, sourceSheetName, sourceTotalRows, sourceLastColA1) {
  
  // 1. Récupérer l'objet feuille de destination
  const destSheet = destSS.getSheetByName(destSheetName);
  if (!destSheet) {
    throw new Error(`(updateSheetFormula) Onglet destination "${destSheetName}" introuvable.`);
  }

  // 2. Calculer le nombre de données à importer
  const dataRows = sourceTotalRows - (SOURCE_START_ROW - 1);
  if (dataRows <= 0) {
    Logger.log(`Aucune donnée à importer pour ${sourceSheetName}.`);
    return;
  }

  // --- AJOUT : Logique de redimensionnement automatique ---
  // Calculer la ligne finale nécessaire dans la destination
  const requiredLastRow = DEST_START_ROW + dataRows - 1;
  const currentMaxRows = destSheet.getMaxRows();

  if (currentMaxRows < requiredLastRow) {
    const rowsToAdd = requiredLastRow - currentMaxRows;
    Logger.log(`Ajout de ${rowsToAdd} lignes à "${destSheetName}" pour contenir les données.`);
    destSheet.insertRowsAfter(currentMaxRows, rowsToAdd);
  }
  // --- FIN DE L'AJOUT ---

  // 3. Définir les plages pour l'écriture
  const clearStartRow = DEST_START_ROW;
  const formulaSetRow = DEST_START_ROW;
  const lastRow = destSheet.getMaxRows(); // On utilise maxRows pour tout nettoyer
  const lastCol = destSheet.getMaxColumns();

  // 4. Effacer l'ancien contenu
  if (lastRow >= clearStartRow) {
    destSheet.getRange(clearStartRow, 1, lastRow - clearStartRow + 1, lastCol).clearContent();
  }

  // 5. Construire la formule en lots
  const numBatches = Math.ceil(dataRows / BATCH_SIZE_IMPORTRANGE);
  const importFormulas = [];

  for (let i = 0; i < numBatches; i++) {
    const batchStartRow = SOURCE_START_ROW + (i * BATCH_SIZE_IMPORTRANGE);
    const rowsInThisBatch = Math.min(BATCH_SIZE_IMPORTRANGE, dataRows - (i * BATCH_SIZE_IMPORTRANGE));
    const batchEndRow = batchStartRow + rowsInThisBatch - 1;
    
    const rangeA1 = `'${sourceSheetName}'!A${batchStartRow}:${sourceLastColA1}${batchEndRow}`;
    importFormulas.push(`IMPORTRANGE("${sourceFileId}"; "${rangeA1}")`);
  }

  // 6. Assembler la formule finale
  let finalFormula;
  if (dataRows > BATCH_SIZE_IMPORTRANGE) {
    // Utilisation des accolades pour concaténer verticalement (;)
    finalFormula = `={${importFormulas.join(";")
}}`;
  } else {
    finalFormula = "=" + importFormulas[0];
  }

  // 7. Écrire la nouvelle formule
  destSheet.getRange(formulaSetRow, 1).setFormula(finalFormula);
  Logger.log(`Formule mise à jour dans ${destSheetName} (Source: ${dataRows} lignes).`);


}


/**
 * Scanne un dossier Drive pour trouver les ID des fichiers les plus récents.
 */
function findLatestFiles(folderId) {
  const dossier_extract = DriveApp.getFolderById(folderId);
  const allFiles = dossier_extract.getFiles();
  const filesByDate = new Map();
  let latestDateFound = "00000000";
  const DATE_REGEX = /_(\d{8})(?:_cleaned)?$/;

  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const name = file.getName();
    const nameLower = name.toLowerCase();
    const match = nameLower.match(DATE_REGEX);
    if (!match) continue;

    const dateString = match[1];
    if (dateString > latestDateFound) latestDateFound = dateString;
    if (!filesByDate.has(dateString)) filesByDate.set(dateString, new Map());

    const isCleaned = nameLower.endsWith("_cleaned");
    const baseName = nameLower.substring(0, match.index);
    const fileTypeKey = getFileTypeKey(baseName, FILE_DEFINITIONS);

    if (fileTypeKey) {
      const storageKey = fileTypeKey + (isCleaned ? "_cleaned" : "");
      filesByDate.get(dateString).set(storageKey, file.getId());
    }
  }
  
  if (latestDateFound === "00000000") return null;

  const latestFilesMap = filesByDate.get(latestDateFound);
  const finalFileIds = new Map();
  
  for (const key of Object.keys(FILE_DEFINITIONS)) {
    const bestId = latestFilesMap.get(key + "_cleaned") || latestFilesMap.get(key);
    if (bestId) {
      finalFileIds.set(key, bestId);
    }
  }
  
  return finalFileIds;
}

/**
 * Fonction d'aide pour trouver le type de fichier.
 */
function getFileTypeKey(baseName, definitions) {
  const parts = baseName.split('_');
  for (const key in definitions) {
    const keywords = definitions[key];
    let keywordIndex = 0;
    for (const part of parts) {
      if (part === keywords[keywordIndex]) {
        keywordIndex++;
      }
      if (keywordIndex === keywords.length) {
        return key;
      }
    }
  }
  return null;
}

/**
 * Convertit un index de colonne (base 1) en sa notation A1.
 */
function colIndexToA1(colIndex) {
  let a1 = '';
  let num = colIndex;
  while (num > 0) {
    let remainder = (num - 1) % 26;
    a1 = String.fromCharCode(65 + remainder) + a1;
    num = Math.floor((num - 1) / 26);
  }
  return a1;
}
