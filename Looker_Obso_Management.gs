/**
 * =============================================================================
 *  Looker_Obso_Management.gs — KPI "LBO Bridge Buy" du Looker Obso management
 * =============================================================================
 */

/**
 * Groupes (et programmes) couverts par un LBO Bridge Buy T1/T2 appliqué, sans
 * solution définitive adaptée à l'échéance de la shortage date.
 * Renvoie une ligne par groupe/programme en alerte, avec le message en
 * dernière colonne. Onglet : "LBO_BB" (+ BDD Obso management).
 */
function lbo_bb_t1(datas) {
  const C = COLONNES.SOLUTION;

  // --- 1. Échéances ---
  const today = new Date();
  const limitDate1Y = new Date(today);
  limitDate1Y.setFullYear(today.getFullYear() + 1);
  const limitDate3Y = new Date(today);
  limitDate3Y.setFullYear(today.getFullYear() + 3);

  // --- 2. Filtrage initial (en-tête exclu) ---
  const activeRows = datas.cases_solution_data.slice(1).filter(row =>
    !CONFIG.OG.EXCLUS_LBO_BB.includes(String(row[C.OG])) &&
    !CONFIG.STATUTS.FERMES.includes(String(row[C.STATUT]))
  );

  // --- 3. Cartographie groupe → (global + programmes) ---
  const creerContexte = () => ({
    lbo_type: null,          // "T1" / "T2"
    is_lbo_repair: false,
    redesign_state: "none",  // none / proposed / applied_ongoing
    threeF_state: "none",
    sd_1y_critical: false,
    sd_3y_critical: false,
    is_resolved: false,      // Redesign/3F appliqué et terminé (6/6)
    is_nogo: false,
    rows: []
  });

  const hierarchy = new Map();

  activeRows.forEach(row => {
    const groupId = row[C.GROUP_ID];
    const program = String(row[C.PROGRAMME]).trim();

    if (!hierarchy.has(groupId)) hierarchy.set(groupId, { global: creerContexte(), programs: new Map() });
    const groupData = hierarchy.get(groupId);

    let context;
    if (program === "") {
      context = groupData.global;
    } else {
      if (!groupData.programs.has(program)) groupData.programs.set(program, creerContexte());
      context = groupData.programs.get(program);
    }
    context.rows.push(row);

    // A. Shortage date (nouvelle, sinon initiale)
    const newSD = row[C.GROUP_NEW_SD];
    const oldSD = row[C.GROUP_INITIAL_SD];
    const checkDate = (newSD && newSD !== "") ? new Date(newSD) : (oldSD && oldSD !== "" ? new Date(oldSD) : null);
    if (checkDate) {
      if (checkDate < limitDate1Y) context.sd_1y_critical = true;
      if (checkDate < limitDate3Y) context.sd_3y_critical = true;
    }

    // B. Scénarios
    const sc = String(row[C.SCENARIO_TYPE]).trim().toUpperCase();
    const state = String(row[C.SOLUTION_STATE]).trim().toLowerCase();
    const title = String(row[C.SCENARIO_TITLE]).trim().toLowerCase();
    const detail = String(row[C.SOLUTION_STATUS]).trim().toLowerCase();

    // 1. LBO Bridge Buy (T1/T2) et Repair
    if (sc === "LBO" && state === "applied" && (title.includes("bb") || title.includes("bridge"))) {
      if (title.includes("cat.1") || title.includes("t1")) context.lbo_type = "T1";
      else if (title.includes("cat.2") || title.includes("t2")) context.lbo_type = "T2";

      if (context.lbo_type && /(repair|r[eé]pa)/i.test(title)) context.is_lbo_repair = true;
    }

    // 2. Redesign et 3F
    if (sc === "REDESIGN" || sc === "3F") {
      let targetState = "none";
      if (state === "applied") {
        if (detail.includes("6/6")) context.is_resolved = true;
        else targetState = "applied_ongoing";
      } else if (state === "proposed") {
        targetState = "proposed";
      }

      if (targetState !== "none") {
        if (sc === "REDESIGN") {
          if (context.redesign_state !== "applied_ongoing") context.redesign_state = targetState;
        } else if (context.threeF_state !== "applied_ongoing") {
          context.threeF_state = targetState;
        }
      }
    }

    if (sc === "NOGO" && state === "applied") context.is_nogo = true;
  });

  // --- 4. Décision (un programme hérite du contexte global de son groupe) ---
  function evaluateContext(data, parentData) {
    const is_resolved = data.is_resolved || (parentData ? parentData.is_resolved : false);
    const is_nogo = data.is_nogo || (parentData ? parentData.is_nogo : false);
    if (is_resolved || is_nogo) return null;

    const eff_LBO = data.lbo_type || (parentData ? parentData.lbo_type : null);
    if (!eff_LBO) return null;

    const eff_Repair = data.is_lbo_repair || (parentData ? parentData.is_lbo_repair : false);
    const eff_Redesign = data.redesign_state !== "none" ? data.redesign_state : (parentData ? parentData.redesign_state : "none");
    const eff_3F = data.threeF_state !== "none" ? data.threeF_state : (parentData ? parentData.threeF_state : "none");

    // Par ordre de priorité
    if (data.sd_3y_critical && eff_Redesign === "none" && eff_3F === "none") return `${eff_LBO} : SD< 3 years without solution proposed`;
    if (data.sd_3y_critical && eff_Redesign === "proposed")                  return `${eff_LBO} : SD< 3 years with redesign proposed`;
    if (data.sd_1y_critical && eff_3F === "proposed")                        return `${eff_LBO} : SD< 1 year with 3F proposed`;
    if (data.sd_3y_critical && eff_Redesign === "applied_ongoing")           return `${eff_LBO} : SD< 3 years with redesign applied`;
    if (data.sd_1y_critical && eff_3F === "applied_ongoing")                 return `${eff_LBO} : SD< 1 year with 3F applied`;
    if (eff_Repair)                                                          return `${eff_LBO} : LBO BB For repair only`;
    return null;
  }

  // --- 5. Sortie : si un programme du groupe est en alerte, on n'affiche pas la ligne "globale" ---
  const final_output = [];
  hierarchy.forEach(groupData => {
    const candidates = [];
    const globalCtx = groupData.global;

    if (globalCtx.rows.length > 0) {
      const msg = evaluateContext(globalCtx, null);
      if (msg) candidates.push({ type: "GLOBAL", row: globalCtx.rows[0], message: msg });
    }
    groupData.programs.forEach(progCtx => {
      const msg = evaluateContext(progCtx, globalCtx);
      if (msg) candidates.push({ type: "PROGRAM", row: progCtx.rows[0], message: msg });
    });

    const hasPrograms = candidates.some(c => c.type === "PROGRAM");
    candidates.forEach(c => {
      if (hasPrograms && c.type === "GLOBAL") return;
      final_output.push([...c.row, c.message]);
    });
  });

  return final_output;
}
