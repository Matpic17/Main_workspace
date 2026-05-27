//Classe permettant de faire des filtres sur les données pour les "ranger" dans les onglets
class DataFilter {
    constructor(data) {
      this.data = data; // Base de données à filtrer (un tableau de tableaux)
      this.criteria = []; // Liste des critères de filtrage
      this.filteredData = [...data];
    }

    // Méthode pour ajouter un critère de filtrage
    AddCriteria(columnIndex, filterFunction) {
      this.criteria.push({
        columnIndex: columnIndex, 
        filterFunction: filterFunction
      });
      return this; // Permet d'enchaîner les appels
    }

    RemoveDuplicates(columnIndexForDupRemoval) {
      const seen = new Set();
      this.filteredData = this.filteredData.filter(row => {
        const value = row[columnIndexForDupRemoval];
        if (seen.has(value)) {
          return false; // Si la valeur est déjà dans "seen", on ignore la ligne
        } else {
          seen.add(value); // Sinon, on ajoute la valeur à "seen" et conserve la ligne
          return true;
        }
      });

      return this; // Permet d'enchaîner les appels
    }

    // Méthode pour appliquer les critères de filtrage et supprimer les doublons
    ApplyFilters() {
      // Appliquer chaque critère à la base de données
      this.filteredData = this.data.filter(row => {
        return this.criteria.every(criterion => {
          const columnIndex = criterion.columnIndex;
          const filterFunction = criterion.filterFunction;
          return filterFunction(row[columnIndex]);
        });
      });

      return this; // Permet d'enchaîner les appels
    }

    // Récupère les données filtrées
    GetFilteredData() {
      return this.filteredData;
    }
  }
