/**
 * =============================================================================
 *  OG0.gs — Filtres sur l'extract cases_history
 * =============================================================================
 */

/** Cas actifs sans code cause. Onglet : "Case_cause_code (empty)". */
function case_cause_code(datas) {
  const C = COLONNES.HISTORY;
  return new DataFilter(copierLignes_(datas.cases_history_data))
    .AddCriteria(C.STATUT, statut => !CONFIG.STATUTS.EXCLUS_RESUME.includes(statut))
    .AddCriteria(C.CAUSE_CODE, cause => estVide_(cause))
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}

/** Cas actifs sans date de notification fournisseur. Onglet : "supplier_notif". */
function supplier_notif(datas) {
  const C = COLONNES.HISTORY;
  return new DataFilter(copierLignes_(datas.cases_history_data))
    .AddCriteria(C.STATUT, statut => !CONFIG.STATUTS.EXCLUS_RESUME.includes(statut))
    .AddCriteria(C.SUPPLIER_NOTIF_DATE, notif => estVide_(notif))
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}

/**
 * Cas (depuis 2022, non fermés) dont le résumé ne contient pas toutes les
 * rubriques du modèle. Onglet : "Case_summary empty".
 */
function case_summary(datas) {
  const C = COLONNES.HISTORY;
  const RUBRIQUES_OBLIGATOIRES = ["Summary", "Procurable", "Repairable", "Missing part",
                                  "Resolution strategy", "Resolution status"];
  const ENTETE_STATUT = "Case_status_code"; // exclut la ligne d'en-tête

  return new DataFilter(copierLignes_(datas.cases_history_data))
    .AddCriteria(C.CASE_SUMMARY, resume => !RUBRIQUES_OBLIGATOIRES.every(r => String(resume).includes(r)))
    .AddCriteria(C.STATUT, statut => !CONFIG.STATUTS.FERMES.includes(statut) && statut !== ENTETE_STATUT)
    .AddCriteria(C.CASE_NUMBER, cas => anneeDuCas_(cas) >= 22)
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}

/** Cas actifs avec une date de notification dans le futur (désactivé dans import_extract). */
function case_notif_date_futur(datas) {
  const C = COLONNES.HISTORY;
  const maintenant = new Date();
  return new DataFilter(copierLignes_(datas.cases_history_data))
    .AddCriteria(C.STATUT, statut => !CONFIG.STATUTS.EXCLUS_RESUME.includes(statut))
    .AddCriteria(C.SUPPLIER_NOTIF_DATE, notif => notif > maintenant)
    .ApplyFilters()
    .RemoveDuplicates(C.CASE_NUMBER)
    .GetFilteredData();
}
