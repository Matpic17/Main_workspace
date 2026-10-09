/**
 * =============================================================================
 *  Get_Email.gs — Recherche d'une adresse mail dans l'annuaire de l'entreprise
 * =============================================================================
 *  Utilisable dans le code ET comme formule de cellule : =GET_EMAIL(A2)
 *
 *  Ordre de recherche :
 *    1. adresses imposées (CONFIG.EMAILS.FORCEES)      → pas d'appel API
 *    2. cache (1 h)                                     → pas d'appel API
 *    3. annuaire (People API), précédé de la pause de sécurité
 *       CONFIG.EMAILS.PAUSE_API_ANNUAIRE_MS (2 s)
 *
 *  Renvoie toujours un TEXTE : l'adresse, "" si nom vide, ou un message
 *  commençant par "#" ("#N/A - …", "#ERREUR: …").
 * =============================================================================
 */
function GET_EMAIL(name) {
  if (!name || typeof name !== "string" || name.trim() === "") return "";

  const nomMinuscule = name.toLowerCase().trim();

  // 1. Adresse imposée
  const forcee = CONFIG.EMAILS.FORCEES[nomMinuscule];
  if (forcee) return forcee;

  // 2. Cache
  const cache = CacheService.getScriptCache();
  const cacheKey = "email_" + nomMinuscule;
  const enCache = cache.get(cacheKey);
  if (enCache != null) return enCache;

  // 3. Annuaire — pause de sécurité AVANT chaque appel réel à l'API
  Utilities.sleep(CONFIG.EMAILS.PAUSE_API_ANNUAIRE_MS);
  try {
    const response = People.People.searchDirectoryPeople({
      query: name,
      readMask: "emailAddresses,names",
      sources: ["DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"]
    });
    const people = (response && response.people) || [];

    if (people.length === 0) {
      const nonTrouve = "#N/A - Nom non trouvé";
      cache.put(cacheKey, nonTrouve, CONFIG.EMAILS.DUREE_CACHE_S);
      return nonTrouve;
    }

    const email = choisirEmail_(people);
    if (!email) {
      const sansEmail = "#N/A - Pas d'e-mail trouvé";
      cache.put(cacheKey, sansEmail, CONFIG.EMAILS.DUREE_CACHE_S);
      return sansEmail;
    }

    cache.put(cacheKey, email, CONFIG.EMAILS.DUREE_CACHE_S);
    return email;

  } catch (e) {
    return "#ERREUR: " + e.message; // non mis en cache : on retentera au prochain appel
  }
}

/**
 * Plusieurs personnes trouvées : on privilégie une adresse interne
 * (@airbus.com, sans ".external"), sinon la première trouvée.
 */
function choisirEmail_(people) {
  const premiereAdresse = p => (p && p.emailAddresses && p.emailAddresses[0] && p.emailAddresses[0].value) || "";

  if (people.length > 1) {
    const internes = people
      .map(premiereAdresse)
      .filter(adr => adr && !adr.includes(CONFIG.EMAILS.MARQUEUR_EXTERNE) && adr.includes(CONFIG.EMAILS.DOMAINE_INTERNE));
    if (internes.length >= 1) return internes[0];
  }
  return premiereAdresse(people[0]);
}
