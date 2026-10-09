/**
 * =============================================================================
 *  Main.gs — Traitement principal : import_extract()
 * =============================================================================
 *  1. Met à jour les sources Looker (IMPORTRANGE)
 *  2. Charge les extracts TOM les plus récents du dossier "Extract"
 *  3. Met à jour la liste des Case Leaders (BDD « Infos ») et le WIP mensuel
 *  4. Calcule TOUS les filtres (si l'un plante, rien n'est écrit)
 *  5. Écrit chaque onglet du classeur + le résumé par Case Leader
 *  6. Archive les résultats EN BAS des onglets de la BDD : date du jour en
 *     colonne A + colonne "Nouveau / Existant" (comparaison à l'archive précédente)
 *  7. Met à jour la date sur l'Accueil et envoie les mails
 *
 *  Pour ajouter / retirer un filtre : modifier uniquement getFiltresImport_().
 * =============================================================================
 */
function import_extract() {
  return executerAvecAlerte_("import_extract", () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const C = COLONNES.CAS;

    // 1. Sources Looker
    updateLookerStudioSources();

    // 2. Extracts
    const datas = get_data("normal");
    if (!datas) return; // extract manquant : message déjà affiché
    log_("Data chargées");

    // 3. Case Leaders + WIP
    majOngletInfos_(datas);
    update_WIP_Routine(datas);

    // 4. Calcul de tous les filtres AVANT toute écriture
    const filtres = getFiltresImport_();
    const resultats = {};
    filtres.forEach(filtre => {
      try {
        resultats[filtre.onglet] = filtre.calcul(datas);
      } catch (e) {
        throw new Error(`Filtre « ${filtre.onglet} » : ${e.message}`);
      }
      log_(`  • ${filtre.onglet} : ${resultats[filtre.onglet].length} ligne(s)`);
    });

    // 5. Onglets du classeur + résumé par Case Leader
    const total = [];
    filtres.forEach(filtre => {
      const lignes = resultats[filtre.onglet];
      pastInMain(filtre.onglet, filtre.plage, lignes);
      if (filtre.sujetResume) {
        pushInTotal(lignes, total, C.CL_PRENOM, C.CL_NOM, C.CASE_NUMBER, filtre.sujetResume, C.STATUT);
      }
    });
    ecrireResumeCaseLeader_(ss, total);

    // "OCL summary recap" est calculé par le classeur à partir des onglets ci-dessus
    SpreadsheetApp.flush();
    const oclSummary = getOngletObligatoire_(ss, CONFIG.ONGLETS.OCL_SUMMARY_RECAP).getDataRange().getValues().slice(1);
    log_("Data collées, chargement de la BDD");

    // 6. Archivage en bas des onglets (vraie date en colonne A + colonne "Nouveau / Existant")
    const dateDuJour = dateDuJourMinuit_();
    const avecDate = lignes => lignes.map(row => [dateDuJour, ...row]);

    filtres.forEach(filtre => {
      if (filtre.ongletObsoManagement) charge_Obso_management(filtre.ongletObsoManagement, avecDate(resultats[filtre.onglet]));
      if (filtre.ongletBDD) charge_BDD(filtre.ongletBDD, avecDate(resultats[filtre.onglet]), filtre.cle);
    });
    charge_BDD(CONFIG.ONGLETS.OCL_SUMMARY_RECAP, avecDate(oclSummary));

    // 7. Date de mise à jour + mails
    const optionsDate = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    getOngletObligatoire_(ss, CONFIG.ONGLETS.ACCUEIL).getRange("D1")
      .setValue("Dernière mise à jour effectuée " + new Date().toLocaleDateString("fr-FR", optionsDate) +
                (modeTest_() ? " — 🧪 MODE TEST (ni mails ni archivage)" : ""));

    envoyerRapportPersonnaliseParMail();
  });
}


/**
 * LISTE DES FILTRES DU TRAITEMENT PRINCIPAL (dans l'ordre du résumé Case Leader)
 *
 *  onglet               : onglet du classeur actif (colonne A, à partir de la ligne 2)
 *  plage                : zone effacée avant écriture (élargie si les données sont plus larges)
 *  calcul               : fonction de filtrage (reçoit datas)
 *  sujetResume          : libellé dans "Case leader summary" (null = pas dans le résumé)
 *  ongletBDD            : onglet d'archive dans CONFIG.IDS.BDD_ARCHIVE (null = pas d'archive)
 *  cle                  : ce qui identifie une ligne d'une semaine à l'autre (colonne
 *                         "Nouveau / Existant" de l'archive ET décompte new/old des mails) :
 *                         "cas" | "cas+anomalie" | "scenario" | "cas+pn" (voir 02_Archive.gs)
 *  ongletObsoManagement : onglet dans CONFIG.IDS.BDD_OBSO_MANAGEMENT (optionnel)
 *
 *  Filtres désactivés (fonctions toujours disponibles, dans Not_used.gs / OG0.gs) :
 *  pn_in_two_cat, lbo_wout_type, lbo_nogo_repair_OG5, case_notif_date_futur,
 *  lbo_deadline, solution_state, case_last_modif_date.
 */
function getFiltresImport_() {
  return [
    { onglet: "PnWoutSD", plage: "A2:DH", calcul: pnWoutSD,
      sujetResume: "PnWoutSD", ongletBDD: "pnWoutSd", cle: "cas" },

    { onglet: "Cases without PN", plage: "A2:DH", calcul: case_wout_PN,
      sujetResume: "Cases without PN", ongletBDD: "Cases without PN", cle: "cas" },

    { onglet: "OG4-OG5 status check", plage: "A2:CW", calcul: lbotest,
      sujetResume: "OG4-OG5 status check", ongletBDD: "OG4-OG5 status check", cle: "cas+anomalie" },

    { onglet: "OG4-OG5 cases without scenario (not applied)", plage: "A2:CW",
      calcul: datas => og4_og5_wout_scenario_applied(datas).concat(case_wout_solution(datas)),
      sujetResume: "OG4-OG5 cases without scenario (not applied)", ongletBDD: "OG4-OG5 cases without scenario (not applied)", cle: "cas" },

    { onglet: "Case_category code (empty)", plage: "A2:CW", calcul: case_wout_category_code,
      sujetResume: "Cases without category code", ongletBDD: "Case_category code (empty)", cle: "cas" },

    { onglet: "PN not in SAP", plage: "A2:DH", calcul: pn_not_in_SAP,
      sujetResume: "PN not in SAP", ongletBDD: "PN not in SAP", cle: "cas+pn" },

    { onglet: "Wrong info in Obsolete_component", plage: "A2:DH", calcul: obsolete_component,
      sujetResume: "Obsolete_component not standardized", ongletBDD: "Wrong info in Obsolete_component", cle: "cas" },

    { onglet: "Case_summary empty", plage: "A2:CA", calcul: case_summary,
      sujetResume: "Case_summary not standardised", ongletBDD: "Case_summary empty", cle: "cas" },

    { onglet: "Case_cause_code (empty)", plage: "A2:CA", calcul: case_cause_code,
      sujetResume: "Case_cause_code (empty)", ongletBDD: "Case_cause_code (empty)", cle: "cas" },

    { onglet: "supplier_notif", plage: "A2:CA", calcul: supplier_notif,
      sujetResume: "supplier_notif_empty", ongletBDD: "supplier_notif", cle: "cas" },

    { onglet: "Not updated", plage: "A2:CW", calcul: statusToBeUpdated,
      sujetResume: "Scenario not updated", ongletBDD: "Not updated", cle: "scenario" },

    { onglet: "LBO_BB", plage: "A2:CW", calcul: lbo_bb_t1,
      sujetResume: null, ongletBDD: null, ongletObsoManagement: "LBO_BB" }
  ];
}


/**
 * Remplace le contenu d'un onglet du classeur actif (à partir de la ligne 2).
 * Efface d'abord l'ancienne zone (colonnes de `range`, élargies à la largeur
 * des données) puis écrit les nouvelles lignes. L'en-tête (ligne 1) n'est
 * jamais touché.
 *
 * @param {string} onglet
 * @param {string} range  ex. "A2:DH"
 * @param {Array<Array<*>>} data
 */
function pastInMain(onglet, range, data) {
  const sheet = getOngletObligatoire_(SpreadsheetApp.getActiveSpreadsheet(), onglet);

  const correspondance = String(range).match(/^[A-Z]+\d+:([A-Z]+)$/i);
  const colonneFinPlage = correspondance ? a1VersNumeroColonne_(correspondance[1]) : sheet.getLastColumn();
  const largeurDonnees = data.length > 0 ? data[0].length : 0;
  const largeurAEffacer = Math.max(colonneFinPlage, largeurDonnees);

  const derniereLigne = sheet.getLastRow();
  if (derniereLigne >= 2 && largeurAEffacer > 0) {
    sheet.getRange(2, 1, derniereLigne - 1, largeurAEffacer).clearContent();
  }
  if (data.length > 0) {
    assurerNombreLignes_(sheet, data.length + 1);
    sheet.getRange(2, 1, data.length, largeurDonnees).setValues(data);
  }
}


/**
 * Ajoute au résumé [prénom, nom, sujet, n° de cas] chaque ligne dont le statut
 * n'est pas dans CONFIG.STATUTS.EXCLUS_RESUME.
 */
function pushInTotal(data, total, colClprenom, colClNom, colCase, sujet, colStatus) {
  data.forEach(row => {
    if (!CONFIG.STATUTS.EXCLUS_RESUME.includes(row[colStatus])) {
      total.push([row[colClprenom], row[colClNom], sujet, row[colCase]]);
    }
  });
  return total;
}


/** Réécrit l'onglet "Case leader summary" (colonnes A à D). */
function ecrireResumeCaseLeader_(ss, total) {
  const sheet = getOngletObligatoire_(ss, CONFIG.ONGLETS.RESUME_CASE_LEADER);
  const derniereLigne = sheet.getLastRow();
  if (derniereLigne >= 2) sheet.getRange(2, 1, derniereLigne - 1, 4).clearContent();
  if (total.length > 0) {
    assurerNombreLignes_(sheet, total.length + 1);
    sheet.getRange(2, 1, total.length, 4).setValues(total);
  }
  log_(`Case leader summary : ${total.length} ligne(s)`);
}


/**
 * Liste des Case Leaders [nom complet, prénom, nom] → BDD, onglet "Infos".
 * (Correction : l'ancienne version sautait la 1re ligne de données.)
 */
function majOngletInfos_(datas) {
  const C = COLONNES.CAS;
  const vus = new Set();
  const lignes = [];
  datas.cases_history_data.slice(1).forEach(row => {
    const prenom = row[C.CL_PRENOM];
    const nom = row[C.CL_NOM];
    if (prenom === "" || nom === "") return;
    const nomComplet = prenom + " " + nom;
    if (vus.has(nomComplet)) return;
    vus.add(nomComplet);
    lignes.push([nomComplet, prenom, nom]);
  });

  if (!ecritureExterneAutorisee_(`BDD « ${CONFIG.ONGLETS.BDD_INFOS} » : ${lignes.length} Case Leader(s)`)) return;

  const sheet = getOngletObligatoire_(ouvrirClasseur_(CONFIG.IDS.BDD_ARCHIVE, "la BDD archive"), CONFIG.ONGLETS.BDD_INFOS);
  sheet.getRange("A2:C").clearContent();
  if (lignes.length > 0) {
    assurerNombreLignes_(sheet, lignes.length + 1);
    sheet.getRange(2, 1, lignes.length, 3).setValues(lignes);
  }
}


/**
 * Archive des lignes EN BAS de l'onglet `onglet` de la BDD (CONFIG.IDS.BDD_ARCHIVE).
 * Ne fait rien si l'onglet a déjà été alimenté aujourd'hui.
 * @param {string} onglet
 * @param {Array<Array<*>>} donnee  lignes AVEC la date en colonne A
 * @param {string=} typeCle         si renseigné, ajoute la colonne "Nouveau / Existant" (voir 02_Archive.gs)
 */
function charge_BDD(onglet, donnee, typeCle) {
  ajouterEnBDD_(CONFIG.IDS.BDD_ARCHIVE, "la BDD archive", onglet, donnee, { retirerFiltre: true, typeCle: typeCle });
}

/** Archive des lignes en bas de l'onglet `onglet` de la BDD du Looker Obso management. */
function charge_Obso_management(onglet, donnee) {
  ajouterEnBDD_(CONFIG.IDS.BDD_OBSO_MANAGEMENT, "la BDD Obso management", onglet, donnee, { retirerFiltre: false });
}


/**
 * WIP mensuel : au premier import du mois, archive dans l'onglet "WIP" de la
 * BDD le nombre de cas uniques par OG et par équipe pour le mois précédent.
 * Colonnes : Mois | OG | Global | <équipes…> | UNKNOWN | global_ratios
 */
function update_WIP_Routine(datas) {
  const C = COLONNES.CAS;
  const equipes = Object.keys(CONFIG.EQUIPES);
  const inconnue = CONFIG.EQUIPE_INCONNUE;
  const equipeParNom = construireEquipeParNom_();

  // --- Mois de référence (= mois précédent) ---
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1 à 12
  const refDate = new Date(currentYear, today.getMonth() - 1, 1);
  const refMonthString = CONFIG.MOIS_FR[refDate.getMonth()] + " " + refDate.getFullYear();

  // --- Mois déjà archivé ? ---
  const targetSheet = ouvrirClasseur_(CONFIG.IDS.BDD_ARCHIVE, "la BDD archive").getSheetByName(CONFIG.ONGLETS.BDD_WIP);
  if (!targetSheet) {
    log_(`L'onglet ${CONFIG.ONGLETS.BDD_WIP} n'existe pas. Veuillez lancer le script d'initialisation d'abord.`);
    return;
  }
  const lastRow = targetSheet.getLastRow();
  if (lastRow > 1) {
    const moisExistants = targetSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    if (moisExistants.some(r => r[0] === refMonthString)) {
      log_(`WIP : "${refMonthString}" déjà présent dans la base, rien à faire.`);
      return;
    }
  }

  // --- Premier import du mois ? (un seul extract cases_history du mois courant) ---
  let targetFileName = "";
  let countFileOfMonth = 0;
  const files = DriveApp.getFolderById(CONFIG.IDS.DOSSIER_EXTRACTS).getFiles();
  while (files.hasNext()) {
    const name = files.next().getName();
    const match = name.match(/cases_history_(\d{4})(\d{2})(\d{2})/);
    if (match && parseInt(match[1]) === currentYear && parseInt(match[2]) === currentMonth) {
      countFileOfMonth += 1;
      targetFileName = name;
    }
  }
  if (countFileOfMonth > 1) {
    log_("WIP : plusieurs fichiers trouvés pour le mois en cours, pas de WIP à renseigner cette semaine.");
    return;
  }
  if (countFileOfMonth === 0) {
    log_(`⚠️ WIP : aucun fichier cases_history du mois en cours trouvé ; calcul sur les données chargées.`);
  } else {
    log_(`WIP : fichier ${targetFileName} trouvé, calcul en cours...`);
  }

  // --- Comptage des cas uniques ---
  const compteurs = {};
  CONFIG.OG.WIP.forEach(og => {
    compteurs[og] = { GLOBAL: new Set(), GLOBAL_RATIOS: new Set() };
    equipes.concat(inconnue).forEach(eq => { compteurs[og][eq] = new Set(); });
  });

  const data = datas.cases_history_data;
  for (let r = 1; r < data.length; r++) {
    const caseId = String(data[r][C.CASE_NUMBER]).trim();
    const status = String(data[r][C.STATUT]).trim().toUpperCase();
    const og = String(data[r][C.OG]).trim();
    const leaderName = String(data[r][C.CL_NOM]).trim();

    if (!CONFIG.OG.WIP.includes(og) || caseId === "") continue;

    if (!CONFIG.STATUTS.WIP_EXCLUS_RATIOS.includes(status)) {
      compteurs[og].GLOBAL_RATIOS.add(caseId);
    }
    if (!CONFIG.STATUTS.WIP_EXCLUS_STANDARD.includes(status)) {
      compteurs[og].GLOBAL.add(caseId);
      compteurs[og][equipeParNom[leaderName.toUpperCase()] || inconnue].add(caseId);
    }
  }

  const lignes = CONFIG.OG.WIP.map(og => {
    const c = compteurs[og];
    if (og === "OG0") {
      // OG0 : seule la colonne global_ratios est renseignée
      return [refMonthString, og, "", ...equipes.map(() => ""), "", c.GLOBAL_RATIOS.size];
    }
    return [refMonthString, og, c.GLOBAL.size, ...equipes.map(eq => c[eq].size), c[inconnue].size, c.GLOBAL_RATIOS.size];
  });

  // --- Écriture ---
  if (!ecritureExterneAutorisee_(`BDD « ${CONFIG.ONGLETS.BDD_WIP} » : ${JSON.stringify(lignes)}`)) return;
  targetSheet.getRange(lastRow + 1, 1, lignes.length, lignes[0].length).setValues(lignes);
  log_(`WIP : ${lignes.length} lignes de "${refMonthString}" ajoutées.`);
}

/** { "NOM EN MAJUSCULES": "EQUIPE" } à partir de CONFIG.EQUIPES. */
function construireEquipeParNom_() {
  const map = {};
  Object.keys(CONFIG.EQUIPES).forEach(equipe => {
    CONFIG.EQUIPES[equipe].forEach(nom => {
      const cle = String(nom).trim().toUpperCase();
      if (map[cle] && map[cle] !== equipe) log_(`⚠️ ${cle} est déclaré dans ${map[cle]} et ${equipe} : ${equipe} retenu.`);
      map[cle] = equipe;
    });
  });
  return map;
}
