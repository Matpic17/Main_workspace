function lbo_bb_t1(datas) { // KPI dans le looker obso management

  // --- 1. CONFIGURATION ---
  var today = new Date();
  
  var limitDate1Y = new Date(today);
  limitDate1Y.setFullYear(today.getFullYear() + 1); 
  
  var limitDate3Y = new Date(today);
  limitDate3Y.setFullYear(today.getFullYear() + 3);

  const IDX = {
    OG: 44, STATUS: 41, SCENARIO: 55, TITLE: 57, GROUP_ID: 64,
    NEW_SD: 66, OLD_SD: 67, PROGRAM: 69, SOL_STATE: 72, REDESIGN_STATUS: 73
  };

  var rawData = datas.cases_solution_data;

  // --- 2. FILTRAGE INITIAL ---
  var activeRows = rawData.filter(row => {
    let og = String(row[IDX.OG]);
    let status = String(row[IDX.STATUS]);
    return !["OG0", "OG5", "OG5a", "OG5b", "OG6"].includes(og) && 
           !["CANCEL", "CLOSED", "SOLVED"].includes(status);
  });

  // --- 3. CARTOGRAPHIE HIERARCHIQUE ---
  var hierarchy = new Map();

  function createContext() {
    return {
      lbo_type: null,         
      is_lbo_repair: false,   
      redesign_state: "none", 
      threeF_state: "none",   
      sd_1y_critical: false,  
      sd_3y_critical: false,  
      is_resolved: false, 
      is_nogo: false,
      rows: []
    };
  }

  activeRows.forEach(row => {
    let groupId = row[IDX.GROUP_ID];
    let program = String(row[IDX.PROGRAM]).trim(); 
    
    if (!hierarchy.has(groupId)) {
      hierarchy.set(groupId, { global: createContext(), programs: new Map() });
    }
    let groupData = hierarchy.get(groupId);

    let context = (program === "") ? groupData.global : (
      groupData.programs.has(program) ? groupData.programs.get(program) : groupData.programs.set(program, createContext()).get(program)
    );

    context.rows.push(row);

    // A. Analyse des Dates (SD)
    let new_SD = row[IDX.NEW_SD];
    let old_SD = row[IDX.OLD_SD];
    let checkDate = (new_SD && new_SD !== "") ? new Date(new_SD) : (old_SD && old_SD !== "" ? new Date(old_SD) : null);
    
    if (checkDate) {
      if (checkDate < limitDate1Y) context.sd_1y_critical = true;
      if (checkDate < limitDate3Y) context.sd_3y_critical = true;
    }

    // B. Scenarios (LBO / Redesign / 3F)
    let sc = String(row[IDX.SCENARIO]).trim().toUpperCase();
    let state = String(row[IDX.SOL_STATE]).trim().toLowerCase();
    let title = String(row[IDX.TITLE]).trim().toLowerCase();
    let r_detail = String(row[IDX.REDESIGN_STATUS]).trim().toLowerCase();

    // 1. Check LBO Bridge Buy et Repair
    if (sc === "LBO" && state === "applied" && (title.includes("bb") || title.includes("bridge"))) {
      if (title.includes("cat.1") || title.includes("t1")) context.lbo_type = "T1";
      else if (title.includes("cat.2") || title.includes("t2")) context.lbo_type = "T2";

      if (context.lbo_type && /(repair|r[eé]pa)/i.test(title)) {
        context.is_lbo_repair = true;
      }
    }

    // 2. Check Redesign et 3F
    if (sc === "REDESIGN" || sc === "3F") {
      let targetState = "none";
      
      if (state === "applied") {
        if (r_detail.includes("6/6")) {
          context.is_resolved = true; // On lève le drapeau de résolution !
        } else {
          targetState = "applied_ongoing";
        }
      } else if (state === "proposed") {
        targetState = "proposed";
      }

      if (targetState !== "none") {
        if (sc === "REDESIGN") {
          if (context.redesign_state !== "applied_ongoing") context.redesign_state = targetState;
        } else if (sc === "3F") {
          if (context.threeF_state !== "applied_ongoing") context.threeF_state = targetState;
        }
      }
    }

    if (sc === "NOGO" && state === "applied") {
      context.is_nogo = true;
    }
  });

  // --- 4. CONSOLIDATION & DECISION (HERITAGE) ---
  var final_output = [];

  // Helper interne pour évaluer un contexte et générer le message prioritaire
  function evaluateContext(data, parentData) {
    
    // Héritage de l'exclusion absolue (Le bouclier 6/6)
    let is_resolved = data.is_resolved || (parentData ? parentData.is_resolved : false);
    let is_nogo = data.is_nogo || (parentData ? parentData.is_nogo : false);
    
    // Si le dossier est résolu ou NOGO, on l'exclut immédiatement
    if (is_resolved || is_nogo) return null;

    // Héritage du LBO (Contient "T1" ou "T2")
    let eff_LBO = data.lbo_type || (parentData ? parentData.lbo_type : null);
    
    // Si pas de LBO Bridge Buy (T1 ou T2), on arrête tout de suite
    if (!eff_LBO) return null;

    let eff_Repair = data.is_lbo_repair || (parentData ? parentData.is_lbo_repair : false);
    let eff_Redesign = data.redesign_state !== "none" ? data.redesign_state : (parentData ? parentData.redesign_state : "none");
    let eff_3F = data.threeF_state !== "none" ? data.threeF_state : (parentData ? parentData.threeF_state : "none");

    // --- ÉVALUATION STRICTE PAR ORDRE DE PRIORITÉ ---

    // Priorité 1 : Pas de solution avec SD < 3 ans
    if (data.sd_3y_critical && eff_Redesign === "none" && eff_3F === "none") {
      return `${eff_LBO} : SD< 3 years without solution proposed`;
    }

    // Priorité 2 : Redesign proposé avec SD < 3 ans
    if (data.sd_3y_critical && eff_Redesign === "proposed") {
      return `${eff_LBO} : SD< 3 years with redesign proposed`;
    }

    // Priorité 3 : 3F proposé avec SD < 1 an
    if (data.sd_1y_critical && eff_3F === "proposed") {
      return `${eff_LBO} : SD< 1 year with 3F proposed`;
    }

    // Priorité 4 : Redesign appliqué (non terminé) avec SD < 3 ans
    if (data.sd_3y_critical && eff_Redesign === "applied_ongoing") {
      return `${eff_LBO} : SD< 3 years with redesign applied`;
    }

    // Priorité 5 : 3F appliqué (non terminé) avec SD < 1 an
    if (data.sd_1y_critical && eff_3F === "applied_ongoing") {
      return `${eff_LBO} : SD< 1 year with 3F applied`;
    }

    // Priorité 6 : LBO Repair
    if (eff_Repair) {
      return `${eff_LBO} : LBO BB For repair only`;
    }

    return null; 
  }

  hierarchy.forEach((groupData, groupId) => {
    let candidates = [];
    let globalCtx = groupData.global;

    // A. Traitement du GLOBAL
    if (globalCtx.rows.length > 0) {
      let msg = evaluateContext(globalCtx, null);
      if (msg) candidates.push({ type: 'GLOBAL', row: globalCtx.rows[0], message: msg });
    }

    // B. Traitement des PROGRAMMES
    groupData.programs.forEach((progCtx, progName) => {
      let msg = evaluateContext(progCtx, globalCtx);
      if (msg) candidates.push({ type: 'PROGRAM', row: progCtx.rows[0], message: msg });
    });

    // --- 5. FILTRAGE ET DEDUPLICATION ---
    let hasPrograms = candidates.some(c => c.type === 'PROGRAM');
    
    candidates.forEach(c => {
      if (hasPrograms && c.type === 'GLOBAL') return; // Skip
      
      let outputRow = [...c.row];
      outputRow.push(c.message);
      final_output.push(outputRow);
    });
  });

  return final_output;
}
