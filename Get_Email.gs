function GET_EMAIL(name) {
  // Si la cellule est vide, on ne retourne rien
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return ""; 
  }

  // Utilisation du cache pour éviter de surcharger les serveurs et accélérer la feuille
  const cache = CacheService.getScriptCache();
  const cacheKey = "email_" + name.toLowerCase().trim();
  const cachedValue = cache.get(cacheKey);
  if (cachedValue != null) {
    return cachedValue;
  }

  try {
    // Options de recherche dans l'annuaire de l'entreprise
    const options = {
      query: name,
      readMask: 'emailAddresses,names', // On demande uniquement les noms et e-mails
      sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE']
    };
    
    // Exécute la recherche
    const response = People.People.searchDirectoryPeople(options);
    const people = response.people;

    // Gère le cas où personne n'est trouvé
    if (!people || people.length === 0) {
      const notFoundMessage = "#N/A - Nom non trouvé";
      cache.put(cacheKey, notFoundMessage, 3600); // Met en cache "non trouvé" pendant 1h
      return notFoundMessage;
    }

    // Prend le premier résultat (le plus pertinent en général)
    var person;
    if(people.length > 1){
      let peopleMail = people.map(subject => subject.emailAddresses[0].value);

      let filterPeople = peopleMail.filter(value => !value.includes(".external") && value.includes("@airbus.com"))

      if(filterPeople.length >= 1){
        person = [filterPeople[0]];
      } else {
        person = people[0].emailAddresses[0].value;
      }

    } else {
      person = people[0].emailAddresses[0].value;
    }

    if(name.toLowerCase() == "valentin durand"){
      person = "valentin.durand.external@airbus.com"
    } else if(name.toLowerCase() == "akashdeep singh") {
      person = "akashdeep.singh.external@airbus.com"
    } else if(name.toLowerCase() == "julien rihani") {
      person = "julien.j.rihani@airbus.com"
    }

    // Gère le cas où la personne existe mais n'a pas d'adresse e-mail
    if (!person || person.length === 0) {
       const noEmailMessage = "#N/A - Pas d'e-mail trouvé";
       cache.put(cacheKey, noEmailMessage, 3600);
       return noEmailMessage;
    }

    // Récupère la première adresse e-mail
    const result = person;
    cache.put(cacheKey, result, 3600); // Met en cache le résultat pendant 1h
    return result;

  } catch (e) {
    // Attrape les erreurs (ex: API non activée)
    return "#ERREUR: " + e.message;
  }
}
