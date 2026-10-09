/**
 * =============================================================================
 *  99_Diagnostic.gs — Vérification des index de colonnes
 * =============================================================================
 *  verifierIndicesColonnes() : pour chaque index déclaré dans COLONNES
 *    (00_Config), affiche l'en-tête RÉEL trouvé dans les extracts les plus
 *    récents et le compare à l'en-tête attendu quand il est connu.
 *      ✅ en-tête conforme
 *      ⚠️ en-tête différent de celui attendu → vérifier la colonne
 *      ❌ index hors du fichier
 *      •  pas d'en-tête de référence → vérifier à l'œil avec la description
 *
 *  afficherEntetesExtracts() : liste complète index / lettre / en-tête des
 *    4 extracts (utile pour corriger un index dans 00_Config).
 *
 *  Lecture seule : ces fonctions ne modifient aucun fichier.
 * =============================================================================
 */

// En-têtes attendus (déduits des noms utilisés par Logistics.gs et des commentaires du code)
const ENTETES_ATTENDUS_ = {
  "CAS.CASE_NUMBER": "Case_number",
  "CAS.STATUT": "Case_status_code",
  "CAS.OG": "Obsolescence_gate_code",
  "CAS.CL_PRENOM": "Case_leader_first_name",
  "CAS.CL_NOM": "Case_leader_last_name",
  "PARTNUMBER.OBSOLETE_COMPONENT": "Obsolete_component",
  "PARTNUMBER.PN_NEW_SD": "PN_new_shortage_date",
  "PARTNUMBER.PN_INITIAL_SD": "PN_initial_shortage_date",
  "PARTNUMBER.PART_NUMBER": "Part_number",
  "SOLUTION.CATEGORY_CODE": "Case_category_code",
  "SOLUTION.CAUSE_CATEGORY": "Cause_category_code",
  "SOLUTION.SCENARIO_TYPE": "Scenario_type_code",
  "SOLUTION.SCENARIO_TITLE": "Scenario_title",
  "SOLUTION.GROUP_NEW_SD": "Group_new_shortage_date",
  "SOLUTION.GROUP_INITIAL_SD": "Group_initial_shortage_date",
  "SOLUTION.PROGRAMME": "Program",
  "SOLUTION.SOLUTION_STATE": "Solution_state",
  "SOLUTION.SOLUTION_STATUS": "Solution_status"
};

// Largeur attendue d'après les plages d'onglets de l'ancien code (A2:CA, A2:DH, A2:CW)
const LARGEURS_ATTENDUES_ = { HISTORY: 79, PARTNUMBER: 112, SOLUTION: 100 };

const EXTRACTS_A_VERIFIER_ = { HISTORY: "cases_history", PARTNUMBER: "cases_partnumber", SOLUTION: "cases_solution" };


function verifierIndicesColonnes() {
  const ids = findLatestFiles(CONFIG.IDS.DOSSIER_EXTRACTS);
  const lignes = ["VÉRIFICATION DES INDEX DE COLONNES (base 0 : A = 0)"];
  let nbPoints = 0;
  const normaliser = t => String(t).trim().toLowerCase();

  Object.keys(EXTRACTS_A_VERIFIER_).forEach(bloc => {
    const type = EXTRACTS_A_VERIFIER_[bloc];
    const id = ids && ids.get(type);
    if (!id) {
      lignes.push(`\n❌ ${type} : fichier introuvable dans le dossier des extracts`);
      nbPoints++;
      return;
    }
    const classeur = SpreadsheetApp.openById(id);
    const onglet = classeur.getSheets()[0];
    const entetes = onglet.getRange(1, 1, 1, onglet.getLastColumn()).getValues()[0];

    lignes.push(`\n=== ${type} — « ${classeur.getName()} » — ${entetes.length} colonnes` +
      (entetes.length !== LARGEURS_ATTENDUES_[bloc] ? ` (⚠️ ${LARGEURS_ATTENDUES_[bloc]} attendues d'après les plages du code)` : "") + " ===");
    if (entetes.length !== LARGEURS_ATTENDUES_[bloc]) nbPoints++;

    const colonnes = COLONNES[bloc];
    Object.keys(colonnes).forEach(nom => {
      const index = colonnes[nom];
      const cleCommune = Object.prototype.hasOwnProperty.call(COLONNES.CAS, nom) ? `CAS.${nom}` : null;
      const attendu = ENTETES_ATTENDUS_[`${bloc}.${nom}`] || (cleCommune && ENTETES_ATTENDUS_[cleCommune]);
      let etat;
      let trouve;
      if (index >= entetes.length) {
        etat = "❌";
        trouve = "(au-delà de la dernière colonne !)";
        nbPoints++;
      } else {
        trouve = `"${entetes[index]}"`;
        if (!attendu) etat = "• ";
        else if (normaliser(entetes[index]) === normaliser(attendu)) etat = "✅";
        else { etat = "⚠️"; nbPoints++; }
      }
      lignes.push(`${etat} ${bloc}.${nom} = ${index} (col ${lettreColonne_(index)}) → ${trouve}` +
        (attendu && etat !== "✅" ? `   [attendu : "${attendu}"]` : ""));
    });
  });

  lignes.push(`\n${nbPoints} point(s) à contrôler. "•" = pas d'en-tête de référence : vérifier que l'en-tête affiché correspond au nom de la constante.`);
  log_(lignes.join("\n"));
  alerteUtilisateur_(`Vérification terminée : ${nbPoints} point(s) à contrôler.\nDétail : Exécutions → journal de verifierIndicesColonnes.`);
}


function afficherEntetesExtracts() {
  const ids = findLatestFiles(CONFIG.IDS.DOSSIER_EXTRACTS);
  const lignes = [];
  ["cases_history", "cases_partnumber", "cases_solution", "pn_LBO"].forEach(type => {
    const id = ids && ids.get(type);
    if (!id) { lignes.push(`\n❌ ${type} : introuvable`); return; }
    const onglet = SpreadsheetApp.openById(id).getSheets()[0];
    const entetes = onglet.getRange(1, 1, 1, onglet.getLastColumn()).getValues()[0];
    lignes.push(`\n=== ${type} (${entetes.length} colonnes) ===`);
    entetes.forEach((e, i) => lignes.push(`${String(i).padStart(3)} | ${lettreColonne_(i).padEnd(3)} | ${e}`));
  });
  log_(lignes.join("\n"));
}
