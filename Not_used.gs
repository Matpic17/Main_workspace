/**
 * =============================================================================
 *  Not_used.gs — Filtres DÉSACTIVÉS (non appelés par import_extract)
 * =============================================================================
 *  Conservés pour pouvoir les réactiver : ajouter une entrée dans
 *  getFiltresImport_() (Main.gs). Index repris à l'identique de l'ancien code.
 * =============================================================================
 */

/** PN associés à deux familles de catégories (Équipement vs Materials). */
function pn_in_two_cat(datas) {
  const C = COLONNES.PARTNUMBER;
  const lignes = new DataFilter(copierLignes_(datas.cases_partnumber_data))
    .AddCriteria(C.STATUT, statut => statut != "CANCEL") // eslint-disable-line eqeqeq
    .AddCriteria(C.PART_NUMBER, pn => !estVide_(pn))
    .AddCriteria(C.CATEGORIE, categorie => categorie !== "")
    .ApplyFilters()
    .GetFilteredData();

  const famille = categorie => {
    const c = String(categorie);
    if (c.startsWith("Equipment") || c.startsWith("Tools") || c.startsWith("Airframe")) return "Equipement";
    if (c.startsWith("Materials") || c.startsWith("Industrial")) return "Materials";
    return categorie;
  };
  lignes.forEach(row => { row[C.CATEGORIE] = famille(row[C.CATEGORIE]); });

  const parPN = new Map();
  lignes.forEach(row => {
    const pn = row[C.PART_NUMBER];
    if (!parPN.has(pn)) parPN.set(pn, { categories: new Set(), rows: [] });
    parPN.get(pn).categories.add(row[C.CATEGORIE]);
    parPN.get(pn).rows.push(row);
  });

  const resultat = [];
  parPN.forEach(g => { if (g.categories.size > 1) g.rows.forEach(r => resultat.push(r)); });
  return resultat;
}


/** Cas LBO ouverts sans type LBO (T1/T2/T3), non rejetés. */
function lbo_wout_type(datas) {
  const L = COLONNES.PN_LBO;
  const H = COLONNES.HISTORY;
  const pn_lbo = copierLignes_(datas.pn_lbo_data);
  const largeurLbo = pn_lbo[0].length;
  const COL_STATUT_AJOUTE = largeurLbo; // colonne ajoutée ci-dessous

  pn_lbo[0].push("Status_code", "Obsolescence_gate", "Case_Leader_prenom", "Case_Leader_nom");

  // Statut, OG et Case Leader du cas (cases_history)
  const infosCas = new Map();
  datas.cases_history_data.slice(1).forEach(row => {
    infosCas.set(row[H.CASE_NUMBER], [row[H.STATUT], row[H.OG], row[H.CL_PRENOM], row[H.CL_NOM]]);
  });
  for (let i = 1; i < pn_lbo.length; i++) {
    pn_lbo[i].push(...(infosCas.get(pn_lbo[i][L.CASE_NUMBER]) || ["", "", "", ""]));
  }

  const TYPES = ["t1", "t2", "t3"];
  return new DataFilter(pn_lbo)
    .AddCriteria(L.LBO_TYPE, type => estVide_(type))
    .AddCriteria(L.REJET, rejet => rejet == "NO") // eslint-disable-line eqeqeq
    .AddCriteria(COL_STATUT_AJOUTE, statut => CONFIG.STATUTS.OUVERTS.includes(statut))
    .ApplyFilters()
    .RemoveDuplicates(L.CASE_NUMBER)
    .GetFilteredData()
    .filter(row => !TYPES.some(t => String(row[L.TITRE]).toLowerCase().includes(t)));
}


/**
 * Cas OG5 (depuis 2022) dont un scénario LBO / NOGO / REPAIR appliqué "prend
 * le lead" (pas de 3F / QUALIFICATION / REDESIGN dans le même groupe).
 */
function lbo_nogo_repair_OG5(datas) {
  const C = COLONNES.SOLUTION;
  const MOTS_NOGO_IGNORES = ["no data", "not use", "no impact", "not relevant", "not used"];
  const SCENARIOS_LEAD = ["LBO", "NOGO", "REPAIR"];
  const SCENARIOS_DEFINITIFS = ["3F", "QUALIFICATION", "REDESIGN"];

  const lignes = new DataFilter(copierLignes_(datas.cases_solution_data))
    .AddCriteria(C.OG, og => og == "OG5") // eslint-disable-line eqeqeq
    .AddCriteria(C.SOLUTION_STATE, state => state == "Applied") // eslint-disable-line eqeqeq
    .AddCriteria(C.STATUT, statut => !["CANCEL", "CLOSED", "STOCK"].includes(statut))
    .AddCriteria(C.CASE_NUMBER, cas => anneeDuCas_(cas) >= 22)
    .ApplyFilters()
    .GetFilteredData()
    // NOGO "sans objet" retirés (l'ancienne boucle en sautait certains par erreur)
    .filter(row => !(row[C.SCENARIO_TYPE] == "NOGO" && // eslint-disable-line eqeqeq
      MOTS_NOGO_IGNORES.some(m => String(row[C.COMMENTAIRE]).toLowerCase().includes(m))));

  const parCas = new Map();
  lignes.forEach(row => {
    if (!parCas.has(row[C.CASE_NUMBER])) parCas.set(row[C.CASE_NUMBER], []);
    parCas.get(row[C.CASE_NUMBER]).push(row);
  });

  const valides = [];
  parCas.forEach((rows, cas) => {
    const parGroupeProgramme = new Map();
    const parGroupe = new Map();
    let bloque = false;
    let leadTrouve = false;
    const contientLesDeux = set => SCENARIOS_LEAD.some(s => set.has(s)) && SCENARIOS_DEFINITIFS.some(s => set.has(s));

    rows.forEach(row => {
      const scenario = row[C.SCENARIO_TYPE];
      const cleGP = `${cas}-${row[C.GROUP_ID]}-${row[C.PROGRAMME]}`;
      const cleG = `${cas}-${row[C.GROUP_ID]}`;
      if (!parGroupeProgramme.has(cleGP)) parGroupeProgramme.set(cleGP, new Set());
      if (!parGroupe.has(cleG)) parGroupe.set(cleG, new Set());
      parGroupeProgramme.get(cleGP).add(scenario);
      parGroupe.get(cleG).add(scenario);
      if (contientLesDeux(parGroupeProgramme.get(cleGP)) || contientLesDeux(parGroupe.get(cleG))) bloque = true;
      if (SCENARIOS_LEAD.includes(scenario)) leadTrouve = true;
    });

    if (!bloque && leadTrouve) rows.forEach(r => valides.push(r));
  });

  return new DataFilter(valides).RemoveDuplicates(C.CASE_NUMBER).GetFilteredData();
}


/** Cas LBO OG4-OG6 actifs sans LBO deadline. */
function lbo_deadline(datas) {
  const C = COLONNES.SOLUTION;
  return new DataFilter(copierLignes_(datas.cases_solution_data))
    .AddCriteria(C.STATUT, statut => !CONFIG.STATUTS.EXCLUS_RESUME.includes(statut))
    .AddCriteria(C.LBO_DEADLINE, lbo => estVide_(lbo))
    .AddCriteria(C.OG, og => CONFIG.OG.OG4_A_OG6.includes(og))
    .AddCriteria(C.SCENARIO_TYPE, scenario => scenario == "LBO") // eslint-disable-line eqeqeq
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}


/** Scénarios OG4-OG6 actifs sans Solution_state. */
function solution_state(datas) {
  const C = COLONNES.SOLUTION;
  return new DataFilter(copierLignes_(datas.cases_solution_data))
    .AddCriteria(C.STATUT, statut => !CONFIG.STATUTS.EXCLUS_RESUME.includes(statut))
    .AddCriteria(C.SOLUTION_STATE, state => estVide_(state))
    .AddCriteria(C.SCENARIO_TYPE, scenario => !estVide_(scenario))
    .AddCriteria(C.OG, og => CONFIG.OG.OG4_A_OG6.includes(og))
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}


/** Cas actifs sans date de dernière modification. */
function case_last_modif_date(datas) {
  const C = COLONNES.HISTORY;
  return new DataFilter(copierLignes_(datas.cases_history_data))
    .AddCriteria(C.STATUT, statut => !CONFIG.STATUTS.EXCLUS_RESUME.includes(statut))
    .AddCriteria(C.LAST_MODIF_DATE, modif => estVide_(modif))
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}
