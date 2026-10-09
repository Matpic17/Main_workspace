/**
 * =============================================================================
 *  Classe.gs — DataFilter : filtres chaînables sur un tableau 2D
 * =============================================================================
 *  Utilisation :
 *    new DataFilter(copierLignes_(data))
 *      .AddCriteria(COLONNES.CAS.STATUT, s => s !== "CANCEL")
 *      .ApplyFilters()
 *      .RemoveDuplicates(COLONNES.CAS.CASE_NUMBER)
 *      .GetFilteredData();
 *
 *  ⚠️ ApplyFilters() repart TOUJOURS des données d'origine : appeler
 *     RemoveDuplicates() APRÈS ApplyFilters() (comme dans tout le projet).
 *  ⚠️ Les lignes renvoyées sont les mêmes objets que ceux passés au
 *     constructeur : passer une copie (copierLignes_) si on les modifie.
 * =============================================================================
 */
class DataFilter {

  /** @param {Array<Array<*>>} data  tableau de lignes */
  constructor(data) {
    if (!Array.isArray(data)) throw new Error("DataFilter : les données doivent être un tableau de lignes.");
    this.data = data;
    this.criteria = [];
    this.filteredData = [...data];
  }

  /**
   * Ajoute un critère : la ligne est gardée si filterFunction(row[columnIndex]) est vrai.
   * @param {number} columnIndex  index base 0
   * @param {function(*): boolean} filterFunction
   * @returns {DataFilter}
   */
  AddCriteria(columnIndex, filterFunction) {
    this.criteria.push({ columnIndex: columnIndex, filterFunction: filterFunction });
    return this;
  }

  /**
   * Garde la première ligne rencontrée pour chaque valeur de la colonne.
   * @param {number} columnIndexForDupRemoval  index base 0
   * @returns {DataFilter}
   */
  RemoveDuplicates(columnIndexForDupRemoval) {
    const seen = new Set();
    this.filteredData = this.filteredData.filter(row => {
      const value = row[columnIndexForDupRemoval];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
    return this;
  }

  /**
   * Applique TOUS les critères (ET logique) aux données d'origine.
   * @returns {DataFilter}
   */
  ApplyFilters() {
    this.filteredData = this.data.filter(row =>
      this.criteria.every(criterion => criterion.filterFunction(row[criterion.columnIndex]))
    );
    return this;
  }

  /** @returns {Array<Array<*>>} */
  GetFilteredData() {
    return this.filteredData;
  }
}
