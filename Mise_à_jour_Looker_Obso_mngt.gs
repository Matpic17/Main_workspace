/**
 * =============================================================================
 *  Mise_à_jour_Looker_Obso_mngt.gs — Sources Looker (IMPORTRANGE) + recherche des extracts
 * =============================================================================
 *  Configuration : CONFIG.SOURCES_LOOKER, CONFIG.TYPES_FICHIERS_EXTRACTS et
 *  CONFIG.IMPORTRANGE (fichier 00_Config).
 * =============================================================================
 */

/**
 * Met à jour les formules IMPORTRANGE des fichiers sources du Looker pour
 * qu'elles pointent vers les extracts les plus récents.
 */
function updateLookerStudioSources() {
  if (!ecritureExterneAutorisee_("mise à jour des formules IMPORTRANGE des sources Looker")) return;

  let rapport = "Rapport de mise à jour des sources :\n\n";
  const params = {
    method: "post",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };

  try {
    const latestFileIds = findLatestFiles(CONFIG.IDS.DOSSIER_EXTRACTS);
    if (!latestFileIds) throw new Error("Impossible de trouver la date la plus récente ou les fichiers correspondants.");

    for (const key in CONFIG.SOURCES_LOOKER) {
      const destInfo = CONFIG.SOURCES_LOOKER[key];
      const destFileId = destInfo.fileId;
      const destFileName = SpreadsheetApp.openById(destFileId).getName();
      const sourceFileId = latestFileIds.get(key);

      if (!sourceFileId) {
        rapport += `❌ ${key} : fichier source introuvable pour la dernière date.\n`;
        continue;
      }

      try {
        // Autorise l'IMPORTRANGE entre les deux fichiers
        log_(`Autorisation de l'accès pour ${destFileName}...`);
        UrlFetchApp.fetch(`https://docs.google.com/spreadsheets/d/${destFileId}/externaldata/addimportrangepermissions?donorDocId=${sourceFileId}`, params);

        const sourceSS = SpreadsheetApp.openById(sourceFileId);
        const destSS = SpreadsheetApp.openById(destFileId);

        if (destInfo.tabs) {
          // Plusieurs onglets de même nom dans la source et la destination (ex. contract)
          for (const tabName of destInfo.tabs) {
            const sourceSheet = sourceSS.getSheetByName(tabName);
            if (!sourceSheet) throw new Error(`Onglet source '${tabName}' introuvable.`);
            updateSheetFormula(destSS, tabName, sourceFileId, tabName, sourceSheet.getMaxRows(), colIndexToA1(sourceSheet.getLastColumn()));
          }
          rapport += `✔ ${key} : ${destInfo.tabs.length} onglets mis à jour.\n`;
        } else {
          const sourceTabName = destInfo.sourceTabName || "Feuil1";
          const sourceSheet = sourceSS.getSheetByName(sourceTabName);
          if (!sourceSheet) throw new Error(`Onglet source '${sourceTabName}' introuvable.`);
          const destSheetName = destSS.getSheets()[0].getName();
          updateSheetFormula(destSS, destSheetName, sourceFileId, sourceTabName, sourceSheet.getMaxRows(), colIndexToA1(sourceSheet.getLastColumn()));
          rapport += `✔ ${key} : 1 onglet mis à jour.\n`;
        }
      } catch (e) {
        log_(String(e));
        rapport += `❌ ERREUR pour ${key} : ${e.message}\n`;
      }
    }
  } catch (e) {
    log_(String(e));
    rapport = `ERREUR CRITIQUE : ${e.message}`;
  }

  log_(rapport);
  SpreadsheetApp.flush();
}


/**
 * Écrit dans un onglet une formule IMPORTRANGE par lots de
 * CONFIG.IMPORTRANGE.TAILLE_LOT lignes (redimensionne l'onglet si besoin).
 */
function updateSheetFormula(destSS, destSheetName, sourceFileId, sourceSheetName, sourceTotalRows, sourceLastColA1) {
  const { TAILLE_LOT, LIGNE_DEBUT_SOURCE, LIGNE_DEBUT_DEST } = CONFIG.IMPORTRANGE;

  const destSheet = destSS.getSheetByName(destSheetName);
  if (!destSheet) throw new Error(`(updateSheetFormula) Onglet destination "${destSheetName}" introuvable.`);

  const dataRows = sourceTotalRows - (LIGNE_DEBUT_SOURCE - 1);
  if (dataRows <= 0) {
    log_(`Aucune donnée à importer pour ${sourceSheetName}.`);
    return;
  }

  // Redimensionnement de la destination
  const requiredLastRow = LIGNE_DEBUT_DEST + dataRows - 1;
  const currentMaxRows = destSheet.getMaxRows();
  if (currentMaxRows < requiredLastRow) {
    log_(`Ajout de ${requiredLastRow - currentMaxRows} lignes à "${destSheetName}".`);
    destSheet.insertRowsAfter(currentMaxRows, requiredLastRow - currentMaxRows);
  }

  // Nettoyage de l'ancien contenu
  const lastRow = destSheet.getMaxRows();
  if (lastRow >= LIGNE_DEBUT_DEST) {
    destSheet.getRange(LIGNE_DEBUT_DEST, 1, lastRow - LIGNE_DEBUT_DEST + 1, destSheet.getMaxColumns()).clearContent();
  }

  // Formule par lots
  const numBatches = Math.ceil(dataRows / TAILLE_LOT);
  const importFormulas = [];
  for (let i = 0; i < numBatches; i++) {
    const batchStartRow = LIGNE_DEBUT_SOURCE + i * TAILLE_LOT;
    const batchEndRow = batchStartRow + Math.min(TAILLE_LOT, dataRows - i * TAILLE_LOT) - 1;
    importFormulas.push(`IMPORTRANGE("${sourceFileId}"; "'${sourceSheetName}'!A${batchStartRow}:${sourceLastColA1}${batchEndRow}")`);
  }
  const finalFormula = dataRows > TAILLE_LOT ? `={${importFormulas.join(";")}}` : "=" + importFormulas[0];

  destSheet.getRange(LIGNE_DEBUT_DEST, 1).setFormula(finalFormula);
  log_(`Formule mise à jour dans ${destSheetName} (source : ${dataRows} lignes).`);
}


/**
 * Parcourt le dossier et renvoie, pour la date AAAAMMJJ la plus récente, l'ID
 * de chaque type d'extract (version "_cleaned" prioritaire).
 * @param {string} folderId
 * @returns {Map<string, string>|null}  { type → ID } ou null si aucun fichier daté
 */
function findLatestFiles(folderId) {
  const allFiles = DriveApp.getFolderById(folderId).getFiles();
  const filesByDate = new Map();
  let latestDateFound = "00000000";
  const DATE_REGEX = /_(\d{8})(?:_cleaned)?$/;

  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const nameLower = file.getName().toLowerCase();
    const match = nameLower.match(DATE_REGEX);
    if (!match) continue;

    const dateString = match[1];
    if (dateString > latestDateFound) latestDateFound = dateString;
    if (!filesByDate.has(dateString)) filesByDate.set(dateString, new Map());

    const isCleaned = nameLower.endsWith("_cleaned");
    const fileTypeKey = getFileTypeKey(nameLower.substring(0, match.index), CONFIG.TYPES_FICHIERS_EXTRACTS);
    if (fileTypeKey) {
      filesByDate.get(dateString).set(fileTypeKey + (isCleaned ? "_cleaned" : ""), file.getId());
    }
  }

  if (latestDateFound === "00000000") return null;

  const latestFilesMap = filesByDate.get(latestDateFound);
  const finalFileIds = new Map();
  for (const key of Object.keys(CONFIG.TYPES_FICHIERS_EXTRACTS)) {
    const bestId = latestFilesMap.get(key + "_cleaned") || latestFilesMap.get(key);
    if (bestId) finalFileIds.set(key, bestId);
  }
  return finalFileIds;
}


/**
 * Type d'extract d'après son nom : les mots-clés du type doivent apparaître
 * dans l'ordre parmi les morceaux du nom séparés par "_".
 */
function getFileTypeKey(baseName, definitions) {
  const parts = baseName.split("_");
  for (const key in definitions) {
    const keywords = definitions[key];
    let keywordIndex = 0;
    for (const part of parts) {
      if (part === keywords[keywordIndex]) keywordIndex++;
      if (keywordIndex === keywords.length) return key;
    }
  }
  return null;
}


/** Index de colonne BASE 1 → lettres A1 (1 → "A", 27 → "AA"). */
function colIndexToA1(colIndex) {
  let a1 = "";
  let num = colIndex;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    a1 = String.fromCharCode(65 + remainder) + a1;
    num = Math.floor((num - 1) / 26);
  }
  return a1;
}
