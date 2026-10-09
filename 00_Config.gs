/**
 * =============================================================================
 *  00_Config.gs — PARAMÈTRES CENTRALISÉS DU PROJET
 * =============================================================================
 *  Tout ce qui peut changer (IDs Drive, noms d'onglets, index de colonnes,
 *  équipes, listes de statuts, adresses mail…) est regroupé ici.
 *  Les autres fichiers ne contiennent plus aucun ID ni index de colonne en dur.
 *
 *  Index de colonnes : BASE 0  →  A = 0, B = 1, … Z = 25, AA = 26, AZ = 51, BA = 52…
 *
 *  👉 Pour contrôler les index contre les en-têtes réels des extracts :
 *     lancer verifierIndicesColonnes() (fichier 99_Diagnostic) puis lire le journal.
 *
 *  ⚠️ Règle Apps Script : les constantes déclarées ici (const …) ne doivent être
 *     déclarées dans AUCUN autre fichier du projet.
 * =============================================================================
 */

const CONFIG = {

  // ---------------------------------------------------------------------------
  // MODE TEST — passer ACTIF à false une fois le refacto validé
  // ---------------------------------------------------------------------------
  // Quand ACTIF = true :
  //  • aucun mail n'est envoyé aux Case Leaders ni à Florent :
  //      - si EMAIL_REDIRECTION est rempli, TOUS les mails partent à cette adresse
  //        (le vrai destinataire est rappelé au début de l'objet du mail) ;
  //      - sinon, les mails sont seulement décrits dans le journal d'exécution ;
  //  • les fichiers EXTERNES ne sont pas modifiés (BDD archive, onglets Infos/WIP,
  //    BDD Obso management, fichier Logistics, création du pn_to_sol, sources
  //    Looker) : le journal indique ce qui aurait été écrit ;
  //    → mettre ECRITURES_EXTERNES à true UNIQUEMENT après avoir remplacé les IDs
  //      de la section IDS par ceux de COPIES de ces fichiers ;
  //  • le classeur actif est mis à jour normalement.
  MODE_TEST: {
    ACTIF: false,
    EMAIL_REDIRECTION: "mathieu.picaud.external@airbus.com",
    ECRITURES_EXTERNES: false
  },

  // ---------------------------------------------------------------------------
  // IDs GOOGLE DRIVE / SHEETS
  // ---------------------------------------------------------------------------
  IDS: {
    DOSSIER_EXTRACTS:    "0ACEvsK712Yj6Uk9PVA",                          // dossier des extracts TOM
    DOSSIER_SAP:         "1JAD3mWlL8Q19wzbFhU6CFCifoFBNvzTv",            // dossier de l'extract SAP (Logistics R00)
    BDD_ARCHIVE:         "1W0_NpL4E8Lmd_PED9U4tygL0bfsNVzurvTcNzijcgkU", // BDD : archives, Infos, WIP (lue aussi par les mails)
    BDD_OBSO_MANAGEMENT: "1aDK1Ykub7spwTtrIe0d9WGxj3iO4Q-mR7q6jBOUE6NM", // BDD du Looker Obso management (LBO_BB)
    FICHIER_LOGISTICS:   "1avjOXCrwPr58AmI9mSTtPzaqvXNkl1lou3pSmMYkJeo", // Obso flag cleaning + IN OUT WIP PN
    FICHIER_LISTE_OCL:   "11VPET-9JI5_wMsujaVldKnCq6PGI8K84sMrD46lOrVQ", // liste des OCL (onglet "concat")
    IMAGE_LOGO_RAPPORT:  "1utRWcNyf6tHHvDQzuVs1q00vOg97vSIm",
    IMAGE_FELICITATIONS: "1SBv0mYMkXZjUlAYUD0CMZPwZdkCzvhAx",
    DOC_DOCUMENTATION:   "19Sm8tXjYujYoVdNkkh3WL9BW93o4D5iEeCXUf266ZxE"
  },

  // ---------------------------------------------------------------------------
  // MAILS
  // ---------------------------------------------------------------------------
  EMAILS: {
    RECAP_GLOBAL: "florent.le-cardiec@airbus.com",
    // Votre adresse : reçoit un mail si import_extract() ou main() échoue (vide = désactivé)
    ALERTE_ERREUR: "",
    // Adresses imposées (clé = "prénom nom" en minuscules) : l'annuaire n'est pas interrogé
    FORCEES: {
      "valentin durand": "valentin.durand.external@airbus.com",
      "akashdeep singh": "akashdeep.singh.external@airbus.com",
      "julien rihani":   "julien.j.rihani@airbus.com"
    },
    DOMAINE_INTERNE: "@airbus.com",
    MARQUEUR_EXTERNE: ".external",
    // Pause de sécurité avant CHAQUE appel réel à l'annuaire (évite le blocage de l'API).
    // Les noms déjà en cache ne déclenchent ni appel ni pause.
    PAUSE_API_ANNUAIRE_MS: 2000,
    DUREE_CACHE_S: 3600
  },

  LIENS: {
    LOOKER_EMAIL_CATEGORIES: "https://lookerstudio.google.com/s/l_iKhFrSnBY"
  },

  // ---------------------------------------------------------------------------
  // ONGLETS (hors onglets des filtres, déclarés dans getFiltresImport_ de Main.gs)
  // ---------------------------------------------------------------------------
  ONGLETS: {
    ACCUEIL:            "Accueil",
    RESUME_CASE_LEADER: "Case leader summary",
    OCL_SUMMARY_RECAP:  "OCL summary recap",
    BDD_INFOS:          "Infos",
    BDD_WIP:            "WIP",
    LISTE_OCL:          "concat",
    LOGISTICS_CLEANING: "Obso flag cleaning",
    LOGISTICS_IN_OUT:   "IN OUT WIP PN",
    PN_TO_SOL:          "Feuille 1"
  },

  // ---------------------------------------------------------------------------
  // MAIL HEBDOMADAIRE (Mail-Auto.gs)
  // ---------------------------------------------------------------------------
  MAIL: {
    // Onglets du classeur actif analysés pour les mails (le 2e sert de référence pour les dates d'archive)
    ONGLETS_ANALYSES: [
      "Not updated",
      "OG4-OG5 status check",
      "OG4-OG5 cases without scenario (not applied)",
      "Case_category code (empty)",
      "PnWoutSD",
      "LMP_prio_empty"
    ],
    // Onglets pour lesquels le mail parle de "scenario(s)" au lieu de "case(s)" (en minuscules)
    ONGLETS_LIBELLE_SCENARIO: ["not updated", "og4-og5 status check"]
  },

  // ---------------------------------------------------------------------------
  // ARCHIVE (BDD) - colonne "Nouveau / Existant"
  // ---------------------------------------------------------------------------
  ARCHIVE : {
    ENTETE_NOUVEAU : "Old / new topic",
    VALEUR_NOUVEAU: "New",
    VALEUR_EXISTANT: "Old",
    FORMAT_DATE: "dd/mm/yyyy"
  },

  // ---------------------------------------------------------------------------
  // STATUTS DE CAS (colonne COLONNES.CAS.STATUT)
  // ---------------------------------------------------------------------------
  STATUTS: {
    OUVERTS:             ["IMPL", "INVEST", "QUALIF", "ASSESS", "STOCK"],
    EXCLUS_RESUME:       ["CANCEL", "CLOSED", "SOLVED", "OnHOLD"], // exclus du résumé Case Leader, des mails et de plusieurs filtres
    FERMES:              ["CANCEL", "CLOSED", "SOLVED"],
    WIP_EXCLUS_STANDARD: ["ALERT", "CLOSED", "CANCEL", "SOLVED"],  // colonnes WIP standard
    WIP_EXCLUS_RATIOS:   ["CLOSED", "CANCEL", "SOLVED"]            // colonne global_ratios (garde ALERT)
  },

  // ---------------------------------------------------------------------------
  // OBSOLESCENCE GATES (colonne COLONNES.CAS.OG)
  // ---------------------------------------------------------------------------
  OG: {
    OG4_A_OG6:          ["OG4", "OG5", "OG5a", "OG5b", "OG6"],
    OG4_OG5:            ["OG4", "OG5", "OG5a", "OG5b"],
    EXCLUS_PN_SANS_SD:  ["OG0", "OG1"],
    EXCLUS_LBO_BB:      ["OG0", "OG5", "OG5a", "OG5b", "OG6"],
    WIP:                ["OG0", "OG1", "OG2", "OG3", "OG4", "OG5", "OG5a"]
  },

  // ---------------------------------------------------------------------------
  // ÉQUIPES (WIP mensuel) — nom de famille du Case Leader, casse indifférente
  // ---------------------------------------------------------------------------
  // L'ordre des équipes ci-dessous = ordre des colonnes de l'onglet WIP.
  // NB : "NAMSI" était déclaré à la fois en EQUIPMENT et en NH90 ; c'est NH90 qui
  //      s'appliquait réellement → conservé en NH90 uniquement (à confirmer).
  EQUIPES: {
    NH90: ["CROSNIER", "SIMON", "CHARLES", "GARZETTI", "COVES", "VONGSAY", "NAMSI", "HERAUD", "PAYAN",
           "NAYL", "CHEVALIER", "GRANDREMY", "AUBRIS", "CHEVALIER-JAGOT", "SARINENA", "STAGNITTA"],
    MATERIAL: ["EVANGELOU", "BLIN", "LEGENTIL", "MARET", "DAVIN", "GAGNEAU", "FRAISSE", "BLANC",
               "LAURENT", "DURAND"],
    EQUIPMENT: ["BACH", "ALEXANDRE", "MAIRE", "HAEUSSLER", "BLANCHET", "LORENZINI", "TRAMIER",
                "SOUIDI", "RIHANI", "PAROT", "SELMI", "GODINEAU", "MEUNIER", "FOUQUET", "BARBIER",
                "MULLER", "SAINTOT", "MOTET", "GIMENES", "BOUILLOUX"],
    TIGER: ["BOOS", "ESCHBACH", "SINGH", "SCHREIBER", "REITER", "PICAUD", "KOLLER", "LAURENT-PEAN"]
  },
  EQUIPE_INCONNUE: "UNKNOWN",

  MOIS_FR: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août",
            "Septembre", "Octobre", "Novembre", "Décembre"],

  // ---------------------------------------------------------------------------
  // EXCLUSIONS MANUELLES
  // ---------------------------------------------------------------------------
  EXCLUSIONS: {
    // Valeurs d'Obsolete_component qui ressemblent à une date mais sont valides
    OBSOLETE_COMPONENT: ["30-01-C647-1221", "56-77-10G", "51-03-4660-0000",
                         "16-24-131-04-1", "16-35-531-12-1", "2105-01-22"]
  },

  // ---------------------------------------------------------------------------
  // LOGISTICS (Logistics.gs) — colonnes repérées par NOM D'EN-TÊTE
  // ---------------------------------------------------------------------------
  LOGISTICS: {
    // En-têtes du fichier pn_to_sol généré (dans cet ordre)
    ENTETES_PN_TO_SOL: [
      "Part_number", "Part_sap_designation", "Obso_flag", "Case_number",
      "Case_creation_date", "Case_description", "Case_review_date",
      "Obsolete_component", "Impact_on_repair_capability", "Case_category_code",
      "Case_status_code", "Obsolescence_gate_code", "Supplier_name",
      "Case_leader_last_name", "Scenario_type_code", "Scenario_title",
      "Scenario_description",
      "SCENARIO_LBO_type", "SCENARIO_LBO_subtype",
      "Sizing_element", "Prev_lbo_cost",
      "Group_initial_shortage_date", "Group_new_shortage_date", "PN_initial_shortage_date", "PN_new_shortage_date",
      "Group_name", "Program", "Variant", "Solution_decision_date", "Solution_decision_maker",
      "Solution_decision_comment", "Solution_state", "Solution_status",
      "Implementation_type_code", "Implementation_first_field_value",
      "Implementation_status", "PN_Group_ID", "SOL_Group_ID",
      "Scenario_ID", "LBO_deadline", "Cause_category_code"
    ],
    ENTETE_SCENARIO_ID: "Scenario_ID",
    ENTETE_PN_GROUP_ID: "PN_Group_ID",      // rempli avec PARTNUMBER.PN_GROUP_ID
    ENTETE_SOL_GROUP_ID: "SOL_Group_ID",    // rempli avec SOLUTION.GROUP_ID
    ENTETE_LBO_TYPE: "SCENARIO_LBO_type",
    ENTETE_LBO_SOUS_TYPE: "SCENARIO_LBO_subtype",
    ENTETES_PN_LBO: { ID: "scenario.id", TYPE: "lbo_scenario_data.lbo_type", SOUS_TYPE: "lbo_scenario_data.lbo_subtype" },
    ENTETES_HISTORY: { CASE: "Case_number", DATE: "Case_history_date", OG: "New_obsolescence_gate_code" },
    // Colonnes du pn_to_sol utilisées par les règles R00 à R14
    ENTETES_REGLES: {
      PN: "Part_number", CAT: "Case_category_code", STATUS: "Case_status_code",
      SCENARIO: "Scenario_type_code", DATE_INIT: "Group_initial_shortage_date",
      DATE_NEW: "Group_new_shortage_date", GROUP_ID: "PN_Group_ID", FLAG: "Obso_flag",
      STATE: "Solution_state", CAUSE: "Cause_category_code", CASE: "Case_number"
    },
    STATUTS_FERMES: ["SOLVED", "CANCEL", "CLOSED"],
    STATUTS_R01: ["ALERT", "CANCEL"],
    EXCEPTIONS_R02_R03_R05: ["CANCEL", "CLOSED", "ALERT"],
    STATUTS_IGNORES_CLEANING: ["CANCEL", "ALERT"],
    CATEGORIES_EQUIPEMENT: ["EQUIPEMENT", "EQUIPMENT", "AIRFRAME ITEM", "TOOLS"],
    DUPLIQUER_LIGNES: false,
    // La dernière date OG1 d'un cas doit être postérieure à cette date pour "Cleaning OK"
    DATE_PIVOT_OG1: { annee: 2021, mois0: 11, jour: 31 } // 31/12/2021 23:59:59
  },

  // ---------------------------------------------------------------------------
  // SOURCES LOOKER (Mise_à_jour_Looker_Obso_mngt.gs) — IMPORTRANGE
  // ---------------------------------------------------------------------------
  SOURCES_LOOKER: {
    "contract": {
      fileId: "1z2HVZWCCRnWiR-q9Uc8cNyw5BOz7vGroJYoTSwkbQk4",
      tabs: ["OBSO ALERTS", "OBSO NOTIFICATIONS", "OBSO HISTORY",
             "TREATMENT ALERTS", "TREATMENT NOTIFICATIONS", "TREATMENT HISTORY"]
    },
    "cases_partnumber":     { fileId: "1EBoAkR_71U5SHEO6wUdgyPN4y7rc5lfqaHrfWqHCFaI", useFirstTab: true, sourceTabName: "CASE > PN" },
    "cases_solution":       { fileId: "1F223VXpIsBNRlWpJoFMSYL1g5VtofwPP-BQwZrwCO84", useFirstTab: true, sourceTabName: "CASE > SOLUTION" },
    "cases_history":        { fileId: "1p50sBzrZ3Ni3e2w5UUwp2MjCPZe1xPY9GUCo0PSWk5E", useFirstTab: true, sourceTabName: "CASE > HISTORY" },
    "pn_LBO":               { fileId: "1Ob3_J_RQvl41kONdXqdLQbBH0MJXxJENFWo_hqdBJek", useFirstTab: true, sourceTabName: "PN_Scenario_tree_node" },
    "action_solution_pn":   { fileId: "1ylGxsGkG5Yata2ft-oRjNCX4Swn9_RNgGEa8xvh_MaA", useFirstTab: true, sourceTabName: "SOLUTIONS-ACTIONS > PN-VENDORS" },
    "case_program_variant": { fileId: "1SBIPB9v2-2EOmWdWcVeqqunhumiK8pGGNSuIegJgm5A", useFirstTab: true, sourceTabName: "CASE > PROGRAM & VARIANTS" },
    "pn_to_sol":            { fileId: "1FpLJDdqp1MQP_oKvGsME_JwoUfn7y623xh-Uwitbp6U", useFirstTab: true, sourceTabName: "Feuille 1" }
  },

  // Reconnaissance des extracts dans le dossier : mots-clés du nom de fichier (dans l'ordre)
  TYPES_FICHIERS_EXTRACTS: {
    cases_partnumber:     ["cases", "partnumber"],
    cases_solution:       ["cases", "solution"],
    cases_history:        ["cases", "history"],
    pn_LBO:               ["partnumber", "lbo"],
    contract:             ["contract"],
    action_solution_pn:   ["actions", "solutions", "partnumber"],
    case_program_variant: ["cases", "program", "variants"],
    pn_to_sol:            ["pn", "to", "sol"]
  },

  IMPORTRANGE: {
    TAILLE_LOT: 3000,        // lignes par appel IMPORTRANGE
    LIGNE_DEBUT_SOURCE: 2,   // 1 = en-tête, 2 = données
    LIGNE_DEBUT_DEST: 2      // 1 = écraser l'en-tête, 2 = sous l'en-tête
  }
};


/**
 * =============================================================================
 *  INDEX DES COLONNES DES EXTRACTS (base 0)
 * =============================================================================
 *  Les valeurs sont STRICTEMENT celles de l'ancien code (aucun index n'a été
 *  modifié). La lettre de colonne est indiquée en commentaire.
 *
 *  COMMUN : colonnes que l'ancien code lit au MÊME index dans les trois extracts
 *           cases_history, cases_partnumber et cases_solution.
 * =============================================================================
 */
const COLONNES = (function () {
  const COMMUN = {
    CASE_ID:     0,  // A  — identifiant du cas (Mail, lbotest, dédoublonnage PnWoutSD)
    CASE_NUMBER: 1,  // B  — n° du cas "AA-NNNNNN" (AA = année)
    STATUT:      41, // AP — Case_status_code
    OG:          44, // AS — Obsolescence_gate_code
    CL_PRENOM:   50, // AY — prénom du Case Leader
    CL_NOM:      51  // AZ — nom du Case Leader
  };

  return {
    CAS: COMMUN,

    // ---- cases_history (onglets en A2:CA → 79 colonnes) ----
    HISTORY: Object.assign({}, COMMUN, {
      SUPPLIER_NOTIF_DATE: 11, // L  — date de notification fournisseur
      CASE_SUMMARY:        20, // U  — résumé du cas
      LAST_MODIF_DATE:     23, // X  — date de dernière modification (Not_used)
      CAUSE_CODE:          34  // AI — code cause
    }),

    // ---- cases_partnumber (onglets en A2:DH → 112 colonnes) ----
    PARTNUMBER: Object.assign({}, COMMUN, {
      OBSOLETE_COMPONENT: 13, // N  — Obsolete_component
      CATEGORIE:          31, // AF — catégorie (Equipment/Materials…) (Not_used)
      PN_GROUP_ID:        53, // BB — clé de jointure vers SOLUTION.GROUP_ID
      PN_NEW_SD:          67, // BO — nouvelle shortage date
      PN_INITIAL_SD:      66, // BP — shortage date initiale
      PN_LOGISTICS:       68, // BQ — ⚠️ Logistics ignore les lignes où cette colonne est vide
                              //      (les filtres OCL utilisent 69 pour le PN) → à vérifier
      PART_NUMBER:        69, // BR — Part number
      CATEGORIE_SAP:      70  // BS — vide = PN absent de SAP
    }),

    // ---- cases_solution (onglets en A2:CW → 100 colonnes + 1 ajoutée) ----
    SOLUTION: Object.assign({}, COMMUN, {
      LBO_DEADLINE:           6,  // G  — (Not_used)
      CATEGORY_CODE:          31, // AG — Case_category_code
      CAUSE_CATEGORY:         37, // AL — cause ("reach"…)
      SCENARIO_ID_MAIL:       53, // BB — compté dans le mail pour "Not updated" (commentaire d'origine : "Scenario ID")
      SCENARIO_TYPE:          55, // BD — LBO / NOGO / REPAIR / 3F / REDESIGN / QUALIFICATION
      SCENARIO_TITLE:         57, // BF — titre du scénario ("LBO EOL", "BB T1"…)
      GROUP_ID:               64, // BM — groupe (jointure avec PARTNUMBER.PN_GROUP_ID)
      COMMENTAIRE:            65, // BN — commentaire ("no data", "not used"…) (Not_used)
      GROUP_NEW_SD:           66, // BO — nouvelle shortage date du groupe
      GROUP_INITIAL_SD:       67, // BP — shortage date initiale du groupe
      PROGRAMME:              69, // BR — programme
      CLE_UNIQUE_NOT_UPDATED: 71, // BT — clé de dédoublonnage de "Not updated"
      SOLUTION_STATE:         72, // BU — Applied / Proposed / Rejected
      SOLUTION_STATUS:        73  // BV — "6/6 - Implementation ended", "To be updated"…
    }),

    // ---- partnumber_lbo (Not_used uniquement ; Logistics lit cet extract par en-têtes) ----
    PN_LBO: {
      CASE_NUMBER: 54, // BC
      TITRE:       68, // BQ
      LBO_TYPE:    78, // CA
      REJET:       91  // CN
    }
  };
})();


// -----------------------------------------------------------------------------
// Alias conservés pour compatibilité avec d'éventuels autres scripts du projet
// -----------------------------------------------------------------------------
const FOLDER_ID = CONFIG.IDS.DOSSIER_EXTRACTS;
const DISPATCH_CONFIG = CONFIG.SOURCES_LOOKER;
const FILE_DEFINITIONS = CONFIG.TYPES_FICHIERS_EXTRACTS;
const BATCH_SIZE_IMPORTRANGE = CONFIG.IMPORTRANGE.TAILLE_LOT;
const SOURCE_START_ROW = CONFIG.IMPORTRANGE.LIGNE_DEBUT_SOURCE;
const DEST_START_ROW = CONFIG.IMPORTRANGE.LIGNE_DEBUT_DEST;
