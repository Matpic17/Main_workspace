/**
 * =============================================================================
 *  Other_in_Looker.gs — Filtres sur l'extract cases_partnumber
 * =============================================================================
 */

/** PN renseignés mais absents de SAP (catégorie SAP vide), hors cas CANCEL. Onglet : "PN not in SAP". */
function pn_not_in_SAP(datas) {
  const C = COLONNES.PARTNUMBER;
  return new DataFilter(copierLignes_(datas.cases_partnumber_data))
    .AddCriteria(C.PART_NUMBER, pn => !estVide_(pn))
    .AddCriteria(C.CATEGORIE_SAP, categorie => estVide_(categorie))
    .AddCriteria(C.STATUT, statut => statut != "CANCEL") // eslint-disable-line eqeqeq
    .ApplyFilters()
    .GetFilteredData();
}

/**
 * Obsolete_component contenant une date (format jj/mm/…, jj.mm.… ou jj-mm-…),
 * hors cas CANCEL et hors exceptions CONFIG.EXCLUSIONS.OBSOLETE_COMPONENT.
 * Onglet : "Wrong info in Obsolete_component".
 */
function obsolete_component(datas) {
  const C = COLONNES.PARTNUMBER;
  const RESSEMBLE_A_UNE_DATE = /^\d{2}[\/.\-]\d{2}[\/.\-].*/;
  return new DataFilter(copierLignes_(datas.cases_partnumber_data))
    .AddCriteria(C.OBSOLETE_COMPONENT, valeur => typeof valeur === "string" && RESSEMBLE_A_UNE_DATE.test(valeur))
    .AddCriteria(C.STATUT, statut => statut != "CANCEL") // eslint-disable-line eqeqeq
    .AddCriteria(C.OBSOLETE_COMPONENT, valeur => !CONFIG.EXCLUSIONS.OBSOLETE_COMPONENT.includes(valeur))
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}

/**
 * Cas ouverts dont AUCUNE ligne n'a de PN renseigné. Une ligne par cas.
 * Onglet : "Cases without PN".
 */
function case_wout_PN(datas) {
  const C = COLONNES.PARTNUMBER;
  const candidats = new DataFilter(copierLignes_(datas.cases_partnumber_data))
    .AddCriteria(C.STATUT, statut => CONFIG.STATUTS.OUVERTS.includes(statut))
    .ApplyFilters()
    .GetFilteredData();

  const casSansPN = garderGroupesValides_(candidats, C.CASE_NUMBER, row => row[C.PART_NUMBER] === "");

  return new DataFilter(casSansPN).RemoveDuplicates(C.CASE_NUMBER).GetFilteredData();
}
