/**
 * =============================================================================
 *  OCL.gs — Filtres sur l'extract cases_solution (+ PN sans shortage date)
 * =============================================================================
 *  Chaque fonction reçoit `datas` (résultat de get_data) et renvoie un tableau
 *  de lignes. Les données sources ne sont jamais modifiées (copie systématique).
 * =============================================================================
 */

/**
 * Scénarios Applied/Proposed dont le statut de solution est "To be updated".
 * Onglet : "Not updated".
 */
function statusToBeUpdated(datas) {
  const C = COLONNES.SOLUTION;
  return new DataFilter(copierLignes_(datas.cases_solution_data))
    .AddCriteria(C.SOLUTION_STATE, state => state === "Applied" || state === "Proposed")
    .AddCriteria(C.SOLUTION_STATUS, status => status === "To be updated")
    .ApplyFilters()
    .RemoveDuplicates(C.CLE_UNIQUE_NOT_UPDATED)
    .GetFilteredData();
}

/**
 * Cas OG4 à OG6 ouverts dont AUCUN scénario n'est "Applied" et dont TOUS les
 * scénarios sont renseignés. Une ligne par cas.
 * Onglet : "OG4-OG5 cases without scenario (not applied)" (avec case_wout_solution).
 */
function og4_og5_wout_scenario_applied(datas) {
  const C = COLONNES.SOLUTION;
  const candidats = new DataFilter(copierLignes_(datas.cases_solution_data))
    .AddCriteria(C.STATUT, statut => CONFIG.STATUTS.OUVERTS.includes(statut))
    .AddCriteria(C.OG, og => CONFIG.OG.OG4_A_OG6.includes(og))
    .ApplyFilters()
    .GetFilteredData();

  const casValides = garderGroupesValides_(candidats, C.CASE_NUMBER,
    row => !estVide_(row[C.SCENARIO_TYPE]) && row[C.SOLUTION_STATE] !== "Applied");

  return new DataFilter(casValides).RemoveDuplicates(C.CASE_NUMBER).GetFilteredData();
}

/**
 * Cas OG4 à OG6 (depuis 2021, hors REACH et CANCEL) dont AUCUN scénario n'est
 * renseigné. Une ligne par cas.
 */
function case_wout_solution(datas) {
  const C = COLONNES.SOLUTION;
  const candidats = new DataFilter(copierLignes_(datas.cases_solution_data))
    .AddCriteria(C.CAUSE_CATEGORY, cause => cause !== "reach")
    .AddCriteria(C.STATUT, statut => statut !== "CANCEL")
    .AddCriteria(C.OG, og => CONFIG.OG.OG4_A_OG6.includes(og))
    .AddCriteria(C.CASE_NUMBER, cas => anneeDuCas_(cas) > 20 && formatCasValide_(cas))
    .ApplyFilters()
    .GetFilteredData();

  const casSansScenario = garderGroupesValides_(candidats, C.CASE_NUMBER, row => row[C.SCENARIO_TYPE] === "");

  return new DataFilter(casSansScenario).RemoveDuplicates(C.CASE_NUMBER).GetFilteredData();
}

/**
 * Cas ouverts sans Case_category_code. Onglet : "Case_category code (empty)".
 */
function case_wout_category_code(datas) {
  const C = COLONNES.SOLUTION;
  return new DataFilter(copierLignes_(datas.cases_solution_data))
    .AddCriteria(C.CATEGORY_CODE, categorie => estVide_(categorie))
    .AddCriteria(C.STATUT, statut => CONFIG.STATUTS.OUVERTS.includes(statut))
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}

/**
 * PN sans shortage date (ni nouvelle ni initiale) sur des cas ouverts hors OG0/OG1.
 * Ajoute en dernière colonne la liste des scénarios "Applied" du groupe du PN,
 * et exclut les PN dont un scénario appliqué est NOGO. Une ligne par cas.
 * Onglet : "PnWoutSD".
 *
 * Correction : l'ancienne version sautait la 1re ligne de données des deux
 * extracts (elle la prenait pour l'en-tête, déjà retiré par les filtres).
 */
function pnWoutSD(datas) {
  const P = COLONNES.PARTNUMBER;
  const S = COLONNES.SOLUTION;

  // 1. PN concernés (en-tête exclu explicitement)
  const lignesPN = new DataFilter(copierLignes_(datas.cases_partnumber_data.slice(1)))
    .AddCriteria(P.STATUT, statut => !CONFIG.STATUTS.EXCLUS_RESUME.includes(statut))
    .AddCriteria(P.OG, og => !CONFIG.OG.EXCLUS_PN_SANS_SD.includes(og))
    .AddCriteria(P.PN_NEW_SD, sd => estVide_(sd))
    .AddCriteria(P.PN_INITIAL_SD, sd => estVide_(sd))
    .AddCriteria(P.PART_NUMBER, pn => !estVide_(pn))
    .ApplyFilters()
    .GetFilteredData();

  // 2. Scénarios appliqués par groupe
  const solutionsAppliquees = new DataFilter(copierLignes_(datas.cases_solution_data.slice(1)))
    .AddCriteria(S.SOLUTION_STATE, state => state === "Applied")
    .AddCriteria(S.GROUP_ID, groupe => !estVide_(groupe))
    .ApplyFilters()
    .GetFilteredData();

  const scenariosParGroupe = new Map();
  solutionsAppliquees.forEach(row => {
    const groupe = row[S.GROUP_ID];
    const scenario = row[S.SCENARIO_TYPE];
    if (groupe && scenario) {
      if (!scenariosParGroupe.has(groupe)) scenariosParGroupe.set(groupe, []);
      scenariosParGroupe.get(groupe).push(scenario);
    }
  });

  // 3. Ajout de la colonne "scénarios du groupe", exclusion des NOGO, une ligne par cas
  const resultat = [];
  lignesPN.forEach(row => {
    const scenarios = scenariosParGroupe.get(row[P.PN_GROUP_ID]);
    const listeScenarios = scenarios ? scenarios.join(", ") : "";
    if (!listeScenarios.includes("NOGO")) resultat.push(row.concat(listeScenarios));
  });

  return new DataFilter(resultat).RemoveDuplicates(P.CASE_ID).GetFilteredData();
}

/**
 * Contrôle de cohérence statut / OG / scénarios des cas OG4-OG5 (depuis 2019).
 * Renvoie une ligne par (cas, anomalie) avec le libellé de l'anomalie en
 * dernière colonne. Onglet : "OG4-OG5 status check".
 * NB : le titre du scénario est passé en minuscules dans la sortie (comme avant).
 */
function lbotest(datas) {
  const C = COLONNES.SOLUTION;
  const SCENARIOS_TECHNIQUES = ["3F", "REDESIGN", "QUALIFICATION"];
  const IMPL_TECHNIQUE_TERMINEE = ["6/6", "To be updated", "Migration Oct 24"];     // début du statut de solution
  const LBO_FINALISE = ["8/9", "9/9", "To be updated", "Migration Oct 24"];          // début du statut de solution
  const STATUTS_OG4_IMPL = ["IMPL", "QUALIF", "ASSESS"];
  const commencePar = (valeur, prefixes) => prefixes.some(p => String(valeur || "").startsWith(p));

  const lignes = new DataFilter(copierLignes_(datas.cases_solution_data))
    .AddCriteria(C.CASE_NUMBER, cas => anneeDuCas_(cas) > 18 && formatCasValide_(cas))
    .AddCriteria(C.OG, og => CONFIG.OG.OG4_OG5.includes(og))
    .AddCriteria(C.STATUT, statut => !CONFIG.STATUTS.FERMES.includes(statut))
    .ApplyFilters()
    .GetFilteredData();

  // Titre en minuscules (conservé dans la sortie, comme dans l'ancien code)
  lignes.forEach(row => { row[C.SCENARIO_TITLE] = String(row[C.SCENARIO_TITLE]).toLowerCase(); });

  // Regroupement par cas
  const scenariosParCas = new Map();
  lignes.forEach(row => {
    const caseId = row[C.CASE_ID];
    if (!scenariosParCas.has(caseId)) scenariosParCas.set(caseId, []);
    scenariosParCas.get(caseId).push(row);
  });

  const anomalies = new Map();

  scenariosParCas.forEach((scenarios, caseId) => {
    const raisons = [];
    const caseOG = String(scenarios[0][C.OG]);
    const caseStatus = scenarios[0][C.STATUT];
    const appliques = scenarios.filter(row => row[C.SOLUTION_STATE] === "Applied");

    const aLboEolApplique = appliques.some(row =>
      row[C.SCENARIO_TYPE] === "LBO" && (row[C.SCENARIO_TITLE].includes("eol") || row[C.SCENARIO_TITLE].includes("end of life")));
    // (Règle "LBO BB" désactivée suite à la mise à jour des BR)

    const aLboBBApplique = appliques.some(row =>
      row[C.SCENARIO_TYPE] === "LBO" && (row[C.SCENARIO_TITLE].includes("bb") || row[C.SCENARIO_TITLE].includes("bridge buy") || row[C.SCENARIO_TITLE].includes("bridge-buy")));

    if (caseOG.startsWith("OG4")) {
      const implTechniqueEnCours = appliques.some(row =>
        SCENARIOS_TECHNIQUES.includes(row[C.SCENARIO_TYPE]) &&
        !commencePar(row[C.SOLUTION_STATUS], IMPL_TECHNIQUE_TERMINEE));

      if (caseStatus == "STOCK" && aLboBBApplique && !implTechniqueEnCours) {
          raisons.push("Anomaly: OG4 with an technic implementation on going (3F/Redesign...) must have a IMPL or QUALIF status.");
        }

      if (implTechniqueEnCours) {
        // Règle prioritaire OG4 : implémentation technique en cours → statut IMPL/QUALIF/ASSESS
        if (!STATUTS_OG4_IMPL.includes(caseStatus)) {
          raisons.push("Anomaly: OG4 with an technic implementation on going (3F/Redesign...) must have a IMPL or QUALIF status.");
        }
      } else if (aLboEolApplique && caseStatus !== "STOCK") {
        // Règle secondaire OG4 : LBO sans implémentation technique en cours → STOCK
        raisons.push("Anomaly: OG4 with an LBO (and without technic implementation on going) must have a stock status.");
      }
    }

    if (caseOG.startsWith("OG5")) {
      // Règle 4 : un LBO en OG5 doit être finalisé (8/9 ou 9/9)
      const lboNonFinalise = appliques.some(row =>
        row[C.SCENARIO_TYPE] === "LBO" && !commencePar(row[C.SOLUTION_STATUS], LBO_FINALISE));
      if (lboNonFinalise) {
        raisons.push("Anomaly: OG5 validated with an LBO not finalized (statut <> 8/9 ou 9/9).");
      }
      // Règle 5 : un LBO EOL en OG5 doit avoir le statut STOCK
      if (aLboEolApplique && caseStatus !== "STOCK") {
        raisons.push("Anomaly: OG5 with LBO EOL must have STOCK status.");
      }
      // (Règle 6 "LBO BB seul" supprimée suite à la mise à jour des BR)
    }

    // Une ligne par anomalie, basée sur la 1re ligne du cas
    raisons.forEach(raison => {
      const cle = `${caseId} | ${raison}`;
      if (!anomalies.has(cle)) anomalies.set(cle, [...scenarios[0], raison]);
    });
  });

  return Array.from(anomalies.values());
}
