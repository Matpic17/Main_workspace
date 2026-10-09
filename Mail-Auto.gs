/**
 * =============================================================================
 *  Mail-Auto.gs — Rapport hebdomadaire par mail
 * =============================================================================
 *  1. Relève les anomalies par Case Leader dans les onglets CONFIG.MAIL.ONGLETS_ANALYSES
 *  2. Les compare, CAS PAR CAS, à l'archive de la semaine précédente :
 *       - semaine précédente = dernière date STRICTEMENT antérieure à aujourd'hui,
 *         onglet par onglet (juste aussi en MODE TEST et en cas de relance) ;
 *       - chaque onglet est comparé à SON onglet d'archive (ongletBDD de getFiltresImport_) ;
 *       - une anomalie est identifiée par la clé de son onglet (`cle` de getFiltresImport_) ;
 *       - "new" = clé absente de l'onglet d'archive à la date précédente, "old" = présente
 *         (même règle que la colonne "Nouveau / Existant" de l'archive) ;
 *       - les noms sont comparés sans tenir compte de la casse ni des espaces.
 *  3. Félicite ceux qui avaient des anomalies et n'en ont plus
 *  4. Envoie à chaque OCL son détail : "21 case(s) … (1 new, 20 old, +1)"
 *       (+1 = évolution par rapport au nombre de la personne la semaine précédente)
 *  5. Envoie le récapitulatif global à CONFIG.EMAILS.RECAP_GLOBAL
 *  Tous les envois passent par envoyerMail_ (respecte le MODE TEST).
 * =============================================================================
 */
function envoyerRapportPersonnaliseParMail() {
  return executerAvecAlerte_("envoyerRapportPersonnaliseParMail", () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const NOMS_DES_ONGLETS = CONFIG.MAIL.ONGLETS_ANALYSES;
    const reglesOnglets = reglesComparaisonMail_(NOMS_DES_ONGLETS);

    const imageBlob = DriveApp.getFileById(CONFIG.IDS.IMAGE_LOGO_RAPPORT).getBlob();
    const imageFelicitation = DriveApp.getFileById(CONFIG.IDS.IMAGE_FELICITATIONS).getBlob();
    const year = new Date().getFullYear();
    const weekNumber = getWeekNumber();
    const ocl_list = getNames().map(normaliserNom_);

    // --- ÉTAPE 1 : anomalies actuelles par personne ---
    log_("Étape 1 : agrégation des données actuelles...");
    const rapportParPersonne = {};
    NOMS_DES_ONGLETS.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        log_(`Attention : onglet non trouvé : "${sheetName}". Il est ignoré.`);
        return;
      }
      const values = sheet.getDataRange().getValues();
      log_(`Analyse de l'onglet "${sheetName}" (${values.length - 1} lignes de données)...`);
      for (let i = 1; i < values.length; i++) {
        ajouterCasAuRapport_(rapportParPersonne, sheetName, values[i], reglesOnglets[sheetName].cle);
      }
    });

    // --- ÉTAPE 1.5 : semaine précédente ---
    log_("Étape 1.5 : récupération des données de la semaine précédente...");
    const precedent = recupererRapportSemainePrecedente(NOMS_DES_ONGLETS, CONFIG.IDS.BDD_ARCHIVE);

    // --- ÉTAPE 2 : félicitations (anomalies la semaine dernière, plus aucune cette semaine) ---
    log_("Étape 2 : mails de félicitations...");
    Object.keys(precedent.rapport).forEach(cleNom => {
      if (Object.prototype.hasOwnProperty.call(rapportParPersonne, cleNom)) return;
      const name = precedent.rapport[cleNom].nom;
      try {
        const destinataire = GET_EMAIL(name);
        const sujet = `Data management report ${year}-W${weekNumber}, CONGRATULATION !`;
        const corpsDuMail = `
      <div>
        Hello ${name}, it's TOM !<br><br>
        I have some great news for you: your scope is now 100% clean !   All your issues have been resolved !!<br>
        <div>
          <img src="cid:logoRapport" style="width: 600px; margin-top: 15px;">
        </div>

        <br>Congratulations on the great work !
        <br><br>Best regards,<br>Automatic system for data management<br>

      </div>`;
        if (envoyerMail_(destinataire, sujet, corpsDuMail, { logoRapport: imageFelicitation })) {
          log_(`Mail de félicitations envoyé pour ${name} (${destinataire}).`);
        }
      } catch (e) {
        log_(`ERREUR lors de l'envoi du mail de félicitations pour ${name} : ${e.message}`);
      }
    });

    // --- ÉTAPE 3 : mails individuels (OCL uniquement) ---
    log_("Étape 3 : mails individuels...");
    let total_issues = 0;
    let total_new = 0;
    for (const cleNom in rapportParPersonne) {
      const personne = rapportParPersonne[cleNom].nom;
      const onglets = rapportParPersonne[cleNom].onglets;
      let totalCases = 0;
      const lignesDeResume = [];

      for (const sheetName in onglets) {
        const d = decompterNouveaux_(onglets[sheetName], precedent.cles[sheetName], clesPrecedentesPersonne_(precedent, cleNom, sheetName));
        totalCases += d.total;
        total_issues += d.total;
        total_new += d.nouveaux;
        const typeElement = CONFIG.MAIL.ONGLETS_LIBELLE_SCENARIO.includes(sheetName.toLowerCase()) ? "scenario(s)" : "case(s)";
        lignesDeResume.push(`- ${d.total} ${typeElement} in the category "${sheetName}" (${texteNouveauxAnciens_(d)})`);
      }

      // Vérification OCL AVANT la recherche d'adresse (évite des appels annuaire inutiles)
      if (totalCases > 0 && ocl_list.includes(cleNom)) {
        try {
          const destinataire = GET_EMAIL(personne);
          const sujet = `Data management report ${year}-W${weekNumber} : ${totalCases} errors`;
          const corpsDuMail = `
        <div>
          Hello ${personne}, it's TOM !<br><br>
          Make me happy, solve the issues below :<br>
          ${lignesDeResume.join('<br>')}<br><br>
          In case you want to show all the cases, you can find the list in this Looker, section "Email categories" :<br>
          ${CONFIG.LIENS.LOOKER_EMAIL_CATEGORIES}<br><br>
          Best regards,<br>Automatic system for data management<br>
          <div>
            <img src="cid:logoRapport" style="width: 250px; margin-top: 15px;">
          </div>
        </div>`;
          if (envoyerMail_(destinataire, sujet, corpsDuMail, { logoRapport: imageBlob })) {
            log_(`Mail envoyé pour ${personne} (${destinataire}).`);
          }
        } catch (e) {
          log_(`ERREUR lors de l'envoi du mail pour ${personne} : ${e.message}`);
        }
      }
    }

    // --- ÉTAPE 4 : récapitulatif global ---
    log_("Étape 4 : récapitulatif global...");
    const tableauRecapHTML = creerTableauRecapHTML(rapportParPersonne, precedent, NOMS_DES_ONGLETS);
    try {
      const sujet = `Data management recap for ${year}-W${weekNumber} : ${total_issues} errors`;
      const corpsDuMail = `
    <div>
      Hello Florent, it's TOM !<br><br>
      This is the global recap of the issues for this week. Total: <b>${total_issues}</b> errors (${total_new} new).<br><br>
      ${tableauRecapHTML}
      <br>
      Best regards,<br>
      Automatic system for data management<br>
      <div>
        <img src="cid:logoRapport" style="width: 250px; margin-top: 15px;">
      </div>
    </div>`;
      if (envoyerMail_(CONFIG.EMAILS.RECAP_GLOBAL, sujet, corpsDuMail, { logoRapport: imageBlob })) {
        log_("Récapitulatif global envoyé.");
      }
    } catch (e) {
      log_(`ERREUR lors de l'envoi du récapitulatif global : ${e.message}`);
    }
  });
}


/**
 * Pour chaque onglet du mail : type de clé et onglet d'archive correspondant
 * (lus dans getFiltresImport_ ; à défaut : clé "cas" et onglet d'archive du même nom).
 * @returns {Object<string, {cle: string, ongletArchive: string}>}
 */
function reglesComparaisonMail_(nomsDesOnglets) {
  const filtres = {};
  getFiltresImport_().forEach(f => { filtres[f.onglet] = f; });
  const regles = {};
  nomsDesOnglets.forEach(nom => {
    const f = filtres[nom];
    regles[nom] = { cle: (f && f.cle) || "cas", ongletArchive: (f && f.ongletBDD) || nom };
  });
  return regles;
}


/**
 * Ajoute (si pertinent) l'anomalie d'une ligne au rapport
 * { nomNormalisé: { nom, onglets: { onglet: Set(clés) } } }.
 * Même règle pour les données actuelles et pour l'archive.
 *
 * @param {Object} rapport
 * @param {string} sheetName
 * @param {Array} row      ligne SANS la date d'archive
 * @param {string} typeCle
 */
function ajouterCasAuRapport_(rapport, sheetName, row, typeCle) {
  const C = COLONNES.CAS;
  if (row.length <= C.CL_NOM) return;
  if (CONFIG.STATUTS.EXCLUS_RESUME.includes(row[C.STATUT])) return;

  const cle = cleLigne_(typeCle, row);
  const personne = `${row[C.CL_PRENOM]} ${row[C.CL_NOM]}`.trim();
  if (!cle || !personne) return;

  const cleNom = normaliserNom_(personne);
  if (!rapport[cleNom]) rapport[cleNom] = { nom: personne, onglets: {} };
  if (!rapport[cleNom].onglets[sheetName]) rapport[cleNom].onglets[sheetName] = new Set();
  rapport[cleNom].onglets[sheetName].add(cle);
}


/**
 * Archive de la semaine précédente, onglet par onglet.
 * @param {string[]} nomsDesOnglets
 * @param {string} idFichierArchive
 * @returns {{rapport: Object, cles: Object<string, Set<string>>, jours: Object<string, ?string>}}
 *   rapport : même structure que rapportParPersonne (statuts exclus retirés) → félicitations
 *   cles    : TOUTES les clés présentes à la date précédente, par onglet → new / old
 */
function recupererRapportSemainePrecedente(nomsDesOnglets, idFichierArchive) {
  const resultat = { rapport: {}, cles: {}, jours: {} };
  try {
    const ssArchive = SpreadsheetApp.openById(idFichierArchive);
    const regles = reglesComparaisonMail_(nomsDesOnglets);

    nomsDesOnglets.forEach(sheetName => {
      const { cle: typeCle, ongletArchive } = regles[sheetName];
      resultat.cles[sheetName] = new Set();
      const sheet = ssArchive.getSheetByName(ongletArchive);
      if (!sheet) {
        log_(`  -> "${sheetName}" : onglet d'archive « ${ongletArchive} » introuvable, tout sera compté "new".`);
        return;
      }
      const precedent = lireArchivePrecedente_(sheet);
      resultat.jours[sheetName] = precedent.jour;
      precedent.lignes.forEach(ligneArchive => {
        const row = ligneArchive.slice(1); // sans la date
        const cle = cleLigne_(typeCle, row);
        if (cle) resultat.cles[sheetName].add(cle);
        ajouterCasAuRapport_(resultat.rapport, sheetName, row, typeCle);
      });
      log_(`  -> "${sheetName}" comparé à l'archive « ${ongletArchive} » du ${jourLisible_(precedent.jour)} (${resultat.cles[sheetName].size} élément(s)).`);
    });
  } catch (e) {
    log_(`  -> ERREUR lors de la lecture de l'archive : ${e.message}`);
  }
  return resultat;
}


/**
 * Décompte d'une catégorie pour une personne :
 *   nouveaux / anciens : clés absentes / présentes dans l'onglet d'archive à la date précédente
 *   delta              : nombre actuel − nombre de la MÊME personne la semaine précédente
 * @param {Set<string>=} cles                     clés actuelles de la personne
 * @param {Set<string>=} clesPrecedentes          toutes les clés de l'onglet à la date précédente
 * @param {Set<string>=} clesPrecedentesPersonne  clés de la personne à la date précédente
 */
function decompterNouveaux_(cles, clesPrecedentes, clesPrecedentesPersonne) {
  const total = cles ? cles.size : 0;
  let nouveaux = 0;
  if (cles) cles.forEach(c => { if (!clesPrecedentes || !clesPrecedentes.has(c)) nouveaux++; });
  const avant = clesPrecedentesPersonne ? clesPrecedentesPersonne.size : 0;
  return { total: total, nouveaux: nouveaux, anciens: total - nouveaux, delta: total - avant };
}

/** Clés d'une personne pour un onglet dans l'archive précédente (undefined si aucune). */
function clesPrecedentesPersonne_(precedent, cleNom, onglet) {
  const personne = precedent.rapport[cleNom];
  return personne ? personne.onglets[onglet] : undefined;
}

// Couleurs des mails : new en bleu, old en noir, évolution en vert si positive / rouge si négative
const COULEURS_MAIL_ = { NEW: "#0000FF", OLD: "#000000", HAUSSE: "#FF0000", BAISSE: "#008000", STABLE: "#000000" };

/** Évolution colorée : "+1" (vert), "-2" (rouge), "+0" (noir). */
function texteDelta_(delta) {
  const couleur = delta > 0 ? COULEURS_MAIL_.HAUSSE : delta < 0 ? COULEURS_MAIL_.BAISSE : COULEURS_MAIL_.STABLE;
  return `<span style="color:${couleur};">${delta < 0 ? delta : "+" + delta}</span>`;
}

/** "1 new, 20 old, +1" avec les couleurs. */
function texteNouveauxAnciens_(d) {
  return `<span style="color:${COULEURS_MAIL_.NEW};">${d.nouveaux} new</span>, ` +
         `<span style="color:${COULEURS_MAIL_.OLD};">${d.anciens} old</span>, ` +
         texteDelta_(d.delta);
}


/**
 * Tableau HTML récapitulatif (personnes × catégories) : "21 (1 new, 20 old, +1)".
 * @param {Object} rapportActuel   rapportParPersonne
 * @param {Object} precedent       résultat de recupererRapportSemainePrecedente
 * @param {string[]} nomsDesOnglets
 */
function creerTableauRecapHTML(rapportActuel, precedent, nomsDesOnglets) {
  let html = `<p>Voici le détail par personne et par catégorie :</p>
              <table style="border: 1px solid black; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt;">
                <thead>
                  <tr style="background-color: #f2f2f2;">
                    <th style="border: 1px solid black; padding: 8px;">Personne</th>`;
  nomsDesOnglets.forEach(nomOnglet => {
    html += `<th style="border: 1px solid black; padding: 8px;">${nomOnglet}</th>`;
  });
  html += `     </tr>
              </thead>
              <tbody>`;

  Object.keys(rapportActuel)
    .sort((a, b) => rapportActuel[a].nom.localeCompare(rapportActuel[b].nom))
    .forEach(cleNom => {
      html += `<tr>
                 <td style="border: 1px solid black; padding: 8px;">${rapportActuel[cleNom].nom}</td>`;
      nomsDesOnglets.forEach(nomOnglet => {
        const d = decompterNouveaux_(rapportActuel[cleNom].onglets[nomOnglet], precedent.cles[nomOnglet],
                                     clesPrecedentesPersonne_(precedent, cleNom, nomOnglet));
        let cellule = "0";
        if (d.total > 0) cellule = `${d.total} (${texteNouveauxAnciens_(d)})`;
        else if (d.delta !== 0) cellule = `0 (${texteDelta_(d.delta)})`;
        html += `<td style="border: 1px solid black; padding: 8px; text-align: center;">${cellule}</td>`;
      });
      html += `</tr>`;
    });

  html += `  </tbody>
           </table>`;
  return html;
}


/** Numéro de semaine ISO 8601 de la date du jour. */
function getWeekNumber() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7); // jeudi de la semaine
  const week1 = new Date(date.getFullYear(), 0, 4);           // le 4 janvier est toujours en S1
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}


/** Noms des OCL actifs (en minuscules), lus dans CONFIG.IDS.FICHIER_LISTE_OCL / onglet "concat". */
function getNames() {
  const ss = SpreadsheetApp.openById(CONFIG.IDS.FICHIER_LISTE_OCL);
  const sheet = ss.getSheetByName(CONFIG.ONGLETS.LISTE_OCL);
  if (!sheet) {
    log_(`Attention : la feuille "${CONFIG.ONGLETS.LISTE_OCL}" est introuvable.`);
    return [];
  }
  const noms = new Set();
  for (const row of sheet.getRange("A2:A").getValues()) {
    const val = row[0];
    if (val === null || val === "") break;
    if (typeof val === "string") noms.add(val.toLowerCase().trim());
  }
  return Array.from(noms);
}
