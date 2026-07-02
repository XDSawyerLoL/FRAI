/*
  Assistant FRAI — Cloudflare Worker v6.4
  Orchestrateur API France Travail + Gemini/GPT

  Principe :
  - Le navigateur ne connaît aucune clé API.
  - Le Worker analyse la demande, choisit les API utiles, récupère les données disponibles,
    puis demande à Gemini/GPT de rédiger une réponse claire et orientée parcours.
  - Si une API n'est pas encore habilitée/configurée, elle est ignorée proprement.

  Variables Cloudflare utiles :
  - FRANCE_TRAVAIL_CLIENT_ID
  - FRANCE_TRAVAIL_CLIENT_SECRET
  - FRANCE_TRAVAIL_SCOPE : tous les scopes autorisés, séparés par espaces
  - FT_SCOPE_OFFRES, FT_SCOPE_EVENTS, FT_SCOPE_FORMATIONS, FT_SCOPE_MARCHE_TRAVAIL,
    FT_SCOPE_BONNE_BOITE, FT_SCOPE_ROME_METIERS, FT_SCOPE_ROME_COMPETENCES,
    FT_SCOPE_ROME_FICHES, FT_SCOPE_ROME_CONTEXTES, FT_SCOPE_AGENCES,
    FT_SCOPE_CADRE_VIE, FT_SCOPE_ACCES_EMPLOI, FT_SCOPE_ROMEO optional
  - GEMINI_API_KEY
  - GEMINI_MODEL = gemini-2.5-flash-lite
  - OPENAI_API_KEY optional
  - OPENAI_MODEL = gpt-4.1-mini optional

  Endpoints configurables si les chemins de ton habilitation diffèrent :
  - FT_OFFRES_URL
  - FT_EVENTS_URL
  - FT_FORMATIONS_URL
  - FT_MARCHE_TRAVAIL_URL
  - FT_ACCES_EMPLOI_URL
  - FT_AGENCES_URL
  - FT_CADRE_VIE_URL
  - FT_BONNE_BOITE_URL
  - FT_ROMEO_URL
  - FT_ROME_METIERS_URL
  - FT_ROME_COMPETENCES_URL
  - FT_ROME_FICHES_URL
  - FT_ROME_CONTEXTES_URL
*/

const TOKEN_CACHE = new Map();

const WORKER_MODE = "v6.6-action-results-no-duplicate-links";
const PUBLIC_ENDPOINTS = ["/health", "/api/agent", "/debug-intent", "/debug-plan", "/debug-run", "/debug-offres", "/debug-diagnostic", "/debug-events"];

const DEFAULT_CITY = "Issy-les-Moulineaux";

const DEFAULT_ENDPOINTS = {
  offres: "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search",
  events: "https://api.francetravail.io/partenaire/evenements/v1/mee/evenements?size=30&page=0&sort=dateEvenement,asc",

  // Les endpoints ci-dessous sont volontairement configurables.
  // Selon les habilitations France Travail, les chemins et paramètres exacts peuvent varier.
  formations: "",
  marcheTravail: "",
  accesEmploi: "",
  agences: "",
  cadreVie: "",
  bonneBoite: "",
  romeo: "",
  romeMetiers: "",
  romeCompetences: "",
  romeFiches: "",
  romeContextes: ""
};

const RATE_LIMIT_MS = {
  offres: 120,
  cadreVie: 600,
  events: 120,
  formations: 120,
  agences: 1200,
  marcheTravail: 120,
  accesEmploi: 120,
  romeCompetences: 1200,
  romeContextes: 1200,
  romeFiches: 1200,
  romeMetiers: 1200,
  bonneBoite: 600,
  romeo: 400
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    const headers = {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (path === "/health") {
      return json({
        ok: true,
        service: "assistant-frai-api",
        status: "online",
        mode: WORKER_MODE,
        llm: {
          gemini: Boolean(env.GEMINI_API_KEY),
          openai: Boolean(env.OPENAI_API_KEY),
          gemini_model: env.GEMINI_MODEL || "gemini-2.5-flash-lite",
          openai_model: env.OPENAI_MODEL || "gpt-4.1-mini"
        },
        france_travail: {
          client_id_detected: Boolean(env.FRANCE_TRAVAIL_CLIENT_ID || env.FT_CLIENT_ID || env.CLIENT_ID),
          client_secret_detected: Boolean(env.FRANCE_TRAVAIL_CLIENT_SECRET || env.FT_CLIENT_SECRET || env.CLIENT_SECRET),
          scope_detected: Boolean(env.FRANCE_TRAVAIL_SCOPE || env.FT_SCOPE),
          configured_optional_endpoints: configuredOptionalEndpoints(env),
          configured_scopes: configuredScopes(env)
        },
        endpoints: PUBLIC_ENDPOINTS
      }, headers);
    }

    if (path === "/debug-intent") {
      const message = url.searchParams.get("message") || "";
      const ville = url.searchParams.get("ville") || DEFAULT_CITY;
      const analysis = analyzeLocal(message, ville);
      const entities = extractEntities(message, ville);

      return json({
        ok: true,
        mode: WORKER_MODE,
        message,
        ville,
        normalized: normalize(message),
        analysis,
        entities
      }, headers);
    }

    if (path === "/debug-plan") {
      const message = url.searchParams.get("message") || "";
      const ville = url.searchParams.get("ville") || DEFAULT_CITY;
      const analysis = analyzeLocal(message, ville);
      const entities = extractEntities(message, ville);
      const plan = buildApiPlan(analysis, entities, message);

      return json({
        ok: true,
        mode: WORKER_MODE,
        message,
        ville,
        analysis,
        entities,
        plan,
        endpoint_status: endpointStatus(env, plan),
        scope_status: scopeStatus(env, plan)
      }, headers);
    }

    if (["/debug-run", "/debug-api", "/api/debug-run"].includes(path)) {
      const message = url.searchParams.get("message") || "";
      const ville = url.searchParams.get("ville") || DEFAULT_CITY;
      const analysis = analyzeLocal(message, ville);
      const entities = extractEntities(message, ville);
      const plan = buildApiPlan(analysis, entities, message);
      const apiContext = await buildApiContext(env, { message, ville, analysis, entities, plan });

      return json({
        ok: true,
        mode: WORKER_MODE,
        message,
        ville,
        analysis,
        entities,
        plan,
        endpoint_status: endpointStatus(env, plan),
        scope_status: scopeStatus(env, plan),
        apiContext: summarizeApiContextForFrontend(apiContext),
        officialLinks: buildOfficialLinks(analysis.intent, apiContext),
        services: []
      }, headers);
    }

    if (["/debug-offres", "/api/debug-offres"].includes(path)) {
      const ville = url.searchParams.get("ville") || DEFAULT_CITY;
      const metier = url.searchParams.get("metier") || "boulanger";
      const message = url.searchParams.get("message") || `Je cherche un travail de ${metier} à ${ville}`;
      const analysis = analyzeLocal(message, ville);
      const entities = extractEntities(message, ville);
      entities.metier = entities.metier || metier;
      entities.keywords = entities.keywords || buildKeywords(message, entities.metier);
      const plan = ["offres", "bonneBoite", "marcheTravail", "romeMetiers"];
      const apiContext = await buildApiContext(env, { message, ville, analysis, entities, plan });

      return json({
        ok: true,
        mode: WORKER_MODE,
        message,
        ville,
        metier: entities.metier,
        plan,
        endpoint_status: endpointStatus(env, plan),
        scope_status: scopeStatus(env, plan),
        diagnostic: buildOperationalDiagnostic(env, { message, ville, analysis, entities, plan, apiContext }),
        offres: apiContext.offres,
        bonneBoite: apiContext.bonneBoite,
        marcheTravail: apiContext.marcheTravail,
        officialLinks: buildOfficialLinks("recherche_emploi", apiContext)
      }, headers);
    }

    if (["/debug-diagnostic", "/api/debug-diagnostic"].includes(path)) {
      const ville = url.searchParams.get("ville") || DEFAULT_CITY;
      const live = ["1", "true", "oui"].includes(String(url.searchParams.get("live") || "").toLowerCase());
      const sampleMessage = url.searchParams.get("message") || "Je cherche un travail de boulanger à Issy-les-Moulineaux";
      const diagnostics = await buildFullDiagnostic(env, { ville, sampleMessage, live });
      return json(diagnostics, headers);
    }

    if (path === "/debug-events") {
      const ville = url.searchParams.get("ville") || DEFAULT_CITY;
      const mois = url.searchParams.get("mois") || "juillet";
      const period = parsePeriod(mois);
      const geo = await geocodeCity(ville);

      const result = await fetchEvents(env, {
        ville,
        dateDebut: period.dateDebut,
        dateFin: period.dateFin,
        latitude: geo.latitude,
        longitude: geo.longitude,
        rayon: Number(url.searchParams.get("rayon") || 10)
      });

      return json({
        ok: true,
        context: {
          ville,
          periode: period.label,
          dateDebut: period.dateDebut,
          dateFin: period.dateFin,
          latitude: geo.latitude,
          longitude: geo.longitude,
          rayon: Number(url.searchParams.get("rayon") || 10)
        },
        token: result.tokenInfo,
        api_status: result.apiStatus,
        totalElements: result.totalElements,
        events: result.events.slice(0, 20)
      }, headers);
    }

    if (path !== "/api/agent") {
      return json({
        ok: true,
        message: "Worker actif",
        endpoints: PUBLIC_ENDPOINTS
      }, headers);
    }

    let body = {};
    try {
      body = await request.json();
    } catch (_) {}

    const message = String(body.message || body.prompt || body.question || "").trim();
    let ville = String(body.city || body.ville || "").trim();
    if (isNationalSearch(message)) {
      ville = "France";
    } else if (!ville) {
      ville = String(extractCity(message) || DEFAULT_CITY).trim();
    }

    if (!message) {
      return json({
        ok: true,
        provider: "moteur métier local",
        intent: "diagnostic",
        reply: "Décrivez la situation ou le besoin : métier visé, ville, blocage principal ou objectif. Exemple : je veux devenir assistant administratif mais je manque de confiance en entretien.",
        events: [],
        formations: [],
        recommendations: [],
        officialLinks: buildLinksByIntent("diagnostic")
      }, headers);
    }

    const analysis = analyzeLocal(message, ville);
    const entities = extractEntities(message, ville);
    const plan = buildApiPlan(analysis, entities, message);
    const apiContext = await buildApiContext(env, { message, ville, analysis, entities, plan });

    const fallback = buildFallbackReply({ message, ville, analysis, entities, plan, apiContext });
    const llm = await generateFinalReply(env, { message, ville, analysis, entities, plan, apiContext, fallback });
    const reply = ensureAdvisorCompleteness(llm.reply || fallback, { message, ville, analysis, entities, plan, apiContext });

    return json({
      ok: true,
      mode: WORKER_MODE,
      provider: llm.provider,
      intent: analysis.intent,
      analysis,
      entities,
      plan,
      reply,
      events: apiContext.events.items.slice(0, 3),
      offres: apiContext.offres.items.slice(0, 3),
      formations: apiContext.formations.items.slice(0, 3),
      services: [],
      actionLinks: buildOfficialLinks(analysis.intent, apiContext),
      recommendations: buildRecommendations(analysis, apiContext),
      apiContext: summarizeApiContextForFrontend(apiContext),
      officialLinks: buildOfficialLinks(analysis.intent, apiContext)
    }, headers);
  }
};

function normalizePath(pathname) {
  const clean = String(pathname || "/").replace(/\/+$/g, "");
  return clean || "/";
}

function json(data, headers) {
  return new Response(JSON.stringify(data), { headers });
}

/* =========================================================
   ANALYSE MÉTIER LOCALE
========================================================= */

function analyzeLocal(rawMessage, ville) {
  const text = normalize(rawMessage);

  const base = {
    provider: "moteur métier local",
    intent: "diagnostic",
    confidence: 0.5,
    need: "Besoin à préciser",
    primaryService: "",
    secondaryServices: [],
    eventUsefulNow: false,
    shouldAskQuestion: true,
    reason: ""
  };

  // Priorité aux demandes d’événements : "je cherche un événement" ne doit jamais être interprété comme un métier.
  if (isExplicitEventRequest(rawMessage)) {
    return {
      ...base,
      intent: "events",
      confidence: 0.96,
      need: "Trouver une action locale ou datée utile",
      primaryService: "Mes Événements Emploi",
      secondaryServices: [],
      eventUsefulNow: true,
      shouldAskQuestion: false,
      reason: "La demande vise explicitement un événement, une date, un forum, un job dating ou une action locale."
    };
  }

  const requestedJob = extractMetier(rawMessage);
  if (requestedJob && isDirectEmploymentRequest(text)) {
    return {
      ...base,
      intent: "recherche_emploi",
      confidence: 0.96,
      need: `Trouver des opportunités concrètes pour le métier ${requestedJob}`,
      primaryService: "Offres d’emploi France Travail + La Bonne Boîte + lecture marché local",
      secondaryServices: ["Marché du travail", "MétierScope", "Un Emploi Stable", "Atelier candidature", "Mes Événements Emploi si rencontre recruteur demandée"],
      eventUsefulNow: isExplicitEventRequest(rawMessage),
      shouldAskQuestion: false,
      reason: "La demande vise directement un travail ou un poste concret sur un métier."
    };
  }

  if (hasAny(text, [
    "manque de confiance", "je manque de confiance", "pas confiance en moi", "confiance en moi",
    "je doute", "je me sens nul", "je me sens nulle", "je n ose pas", "je n'ose pas",
    "peur de l entretien", "peur de l'entretien", "stress entretien", "angoisse entretien",
    "timide", "je sais pas me vendre", "je ne sais pas me vendre", "je me devalorise",
    "j ai du mal a parler de moi", "j'ai du mal à parler de moi"
  ])) {
    return {
      ...base,
      intent: "confiance",
      confidence: 0.97,
      need: "Renforcer la confiance, la posture et la capacité à parler de soi",
      primaryService: "Valoriser son Image professionnelle",
      secondaryServices: ["Atelier entretien", "Un Emploi Stable si le projet est clair"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande porte sur la légitimité, la confiance et la présentation."
    };
  }

  if (hasAny(text, [
    "image professionnelle", "valoriser mon image", "valoriser mon profil", "posture",
    "presentation de moi", "presentation professionnelle", "parler de moi", "me presenter", "me présenter"
  ])) {
    return {
      ...base,
      intent: "image_professionnelle",
      confidence: 0.95,
      need: "Travailler l’image candidat, la posture et le discours",
      primaryService: "Valoriser son Image professionnelle",
      secondaryServices: ["Atelier entretien", "Atelier candidature"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "Le besoin porte sur la présentation professionnelle."
    };
  }

  if (hasAny(text, [
    "emploi stable", "ues", "un emploi stable", "retrouver un emploi durable", "emploi durable",
    "trouver un emploi stable", "intensifier mes recherches", "techniques de recherche",
    "accompagnement pour retrouver un emploi", "retrouver du travail durable", "retour a l emploi", "retour à l emploi"
  ])) {
    return {
      ...base,
      intent: "ues",
      confidence: 0.95,
      need: "Structurer et renforcer la recherche d’emploi vers un emploi durable",
      primaryService: "Un Emploi Stable",
      secondaryServices: ["Atelier candidature", "La Bonne Boîte", "Mes Événements Emploi si besoin recruteur"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande correspond à un accompagnement de retour à l’emploi durable."
    };
  }

  if (hasAny(text, [
    "ameliorer mes competences", "améliorer mes compétences", "competences", "compétences",
    "monter en competence", "renforcer mes competences", "developper mes competences", "progresser",
    "me perfectionner", "apprendre", "remise a niveau", "bureautique", "excel", "word",
    "outlook", "numerique", "numérique", "savoir faire", "savoir-faire"
  ])) {
    return {
      ...base,
      intent: "competences",
      confidence: 0.92,
      need: "Identifier les compétences à renforcer et choisir le bon levier",
      primaryService: "Diagnostic compétences puis UES, formation, Prépa Compétences ou PMSMP selon le cas",
      secondaryServices: ["ROME compétences", "Open Formation", "Un Emploi Stable", "PMSMP"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande parle de montée en compétences."
    };
  }

  if (hasAny(text, [
    "peur de l entretien", "peur de l'entretien", "preparer entretien", "préparer entretien",
    "entretien d embauche", "entretien d'embauche", "repondre aux questions", "stress en entretien"
  ])) {
    return {
      ...base,
      intent: "entretien",
      confidence: 0.95,
      need: "Préparer l’entretien et réduire le stress face au recruteur",
      primaryService: "Atelier entretien",
      secondaryServices: ["Valoriser son Image professionnelle", "Un Emploi Stable si projet clair"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande vise la préparation à l’entretien."
    };
  }

  if (hasAny(text, [
    "cv", "candidature", "lettre", "lettre de motivation", "adapter mon cv", "ameliorer mon cv",
    "refaire mon cv", "mon cv n est pas bon", "mon cv n'est pas bon", "postuler"
  ])) {
    return {
      ...base,
      intent: "candidature_cv",
      confidence: 0.95,
      need: "Améliorer les outils de candidature",
      primaryService: "Atelier candidature",
      secondaryServices: ["Offres d’emploi pour adapter le CV", "La Bonne Boîte", "UES"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande vise le CV ou les candidatures."
    };
  }

  if (hasAny(text, [
    "projet flou", "je ne sais pas quoi faire", "je sais pas quoi faire", "orientation", "reconversion",
    "changer de metier", "changer de métier", "choisir un metier", "choisir un métier",
    "metier qui me correspond", "activ projet", "activ'projet"
  ])) {
    return {
      ...base,
      intent: "activ_projet",
      confidence: 0.95,
      need: "Clarifier ou confirmer un projet professionnel",
      primaryService: "Activ’Projet",
      secondaryServices: ["ROMEO", "ROME métiers", "PMSMP", "Marché du travail", "Formation si projet confirmé"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande porte sur l’orientation ou la reconversion."
    };
  }

  if (hasAny(text, [
    "poe", "poei", "preparation operationnelle a l emploi", "formation avant embauche", "employeur recrute",
    "besoin employeur"
  ])) {
    return {
      ...base,
      intent: "poe",
      confidence: 0.95,
      need: "Préparer une embauche par une formation liée à un besoin employeur",
      primaryService: "POE / POEI",
      secondaryServices: ["Offres d’emploi", "Open Formation", "Mes Événements Emploi"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande correspond à une formation liée à un recrutement."
    };
  }

  if (hasAny(text, [
    "formation", "financement", "financée", "financee", "region", "région", "certification",
    "certifiante", "diplome", "diplôme", "se former", "prepa competences", "prépa compétences", "gco"
  ])) {
    return {
      ...base,
      intent: "formation",
      confidence: 0.9,
      need: "Vérifier le besoin de formation, les prérequis et le financement",
      primaryService: "Open Formation / Prépa Compétences",
      secondaryServices: ["ROME compétences", "Marché du travail", "PMSMP", "POE si employeur identifié"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande vise la formation ou le financement."
    };
  }

  if (hasAny(text, [
    "tester un metier", "tester un métier", "immersion", "pmsmp", "decouvrir un metier",
    "découvrir un métier", "valider un metier", "valider un métier", "stage d observation", "stage d'observation"
  ])) {
    return {
      ...base,
      intent: "pmsmp",
      confidence: 0.95,
      need: "Tester un métier en situation réelle",
      primaryService: "PMSMP / Immersion facilitée",
      secondaryServices: ["Activ’Projet", "ROME fiches métiers", "La Bonne Boîte", "Formation si métier confirmé"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande vise l’immersion ou la validation du métier."
    };
  }

  if (hasAny(text, [
    "creation entreprise", "création entreprise", "creer mon entreprise", "créer mon entreprise", "auto entrepreneur",
    "micro entreprise", "activ crea", "activ'créa", "activ crea emergence", "activ'créa émergence"
  ])) {
    return {
      ...base,
      intent: "creation",
      confidence: 0.95,
      need: "Clarifier et tester un projet de création d’activité",
      primaryService: "Activ’Créa Émergence",
      secondaryServices: ["Cadre de vie / territoire", "Marché local", "Atelier création"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande concerne la création d’entreprise."
    };
  }

  if (hasAny(text, [
    "sante", "santé", "handicap", "frein sante", "frein santé", "fatigue", "burn", "maladie",
    "difficulte durable", "difficulté durable", "defi sante emploi", "défi santé emploi", "cap emploi"
  ])) {
    return {
      ...base,
      intent: "sante",
      confidence: 0.95,
      need: "Adapter le parcours à un frein santé ou handicap",
      primaryService: "Défi Santé Emploi / Cap emploi selon situation",
      secondaryServices: ["PMSMP adaptée", "Projet compatible", "Agences / partenaires"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande inclut un frein santé ou handicap."
    };
  }

  if (hasAny(text, [
    "international", "etranger", "étranger", "mobilite internationale", "mobilité internationale", "europe",
    "travailler a l etranger", "travailler à l'étranger", "activ international", "activ'international"
  ])) {
    return {
      ...base,
      intent: "international",
      confidence: 0.9,
      need: "Structurer un projet de mobilité internationale",
      primaryService: "Activ’International",
      secondaryServices: ["Formation langue", "Offres", "Recherche pays / métier"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande vise l’international."
    };
  }

  if (hasAny(text, [
    "je cherche un emploi", "je cherche un travail", "chercher un travail", "trouver un travail", "trouver du travail",
    "travail de", "emploi de", "poste de", "job de", "travailler comme", "travailler en tant que",
    "trouver un emploi", "offres", "offre d emploi", "offre d'emploi", "recrute",
    "recrutement", "entreprises qui recrutent", "candidature spontanee", "candidature spontanée"
  ])) {
    return {
      ...base,
      intent: "recherche_emploi",
      confidence: 0.9,
      need: "Trouver des opportunités concrètes et organiser les démarches",
      primaryService: "Offres d’emploi / La Bonne Boîte",
      secondaryServices: ["Marché du travail", "Mes Événements Emploi", "Atelier candidature"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande vise la recherche d’emploi directe."
    };
  }

  if (hasAny(text, [
    "demenager", "déménager", "mobilite", "mobilité", "changer de ville", "territoire", "cadre de vie",
    "commune", "ville ou travailler", "où travailler", "ou travailler"
  ])) {
    return {
      ...base,
      intent: "territoire",
      confidence: 0.85,
      need: "Comparer un territoire et sa réalité d’emploi",
      primaryService: "Cadre de vie + Marché du travail",
      secondaryServices: ["Offres", "Agences", "La Bonne Boîte"],
      eventUsefulNow: false,
      shouldAskQuestion: false,
      reason: "La demande concerne la mobilité ou le territoire."
    };
  }

  if (hasAny(text, [
    "evenement", "événement", "agenda", "job dating", "forum", "salon", "reunion d'information",
    "réunion d'information", "rencontrer un recruteur", "rencontrer des recruteurs", "rencontrer des employeurs",
    "que se passe", "autour de moi", "près de moi", "pres de moi", "dans ma ville",
    "en janvier", "en fevrier", "en février", "en mars", "en avril", "en mai", "en juin", "en juillet",
    "en aout", "en août", "en septembre", "en octobre", "en novembre", "en decembre", "en décembre",
    "date", "dates", "inscription", "s'inscrire", "m'inscrire"
  ])) {
    return {
      ...base,
      intent: "events",
      confidence: 0.9,
      need: "Trouver une action datée ou locale",
      primaryService: "Mes Événements Emploi",
      secondaryServices: ["Préparation candidature avant événement"],
      eventUsefulNow: true,
      shouldAskQuestion: false,
      reason: "La demande vise une action locale, datée, un forum, un job dating ou une réunion."
    };
  }

  if (hasAny(text, ["atelier", "ateliers"])) {
    return {
      ...base,
      intent: "diagnostic",
      confidence: 0.7,
      need: "Choisir le bon atelier selon l’objectif",
      primaryService: "Atelier France Travail à préciser",
      secondaryServices: ["Atelier CV", "Atelier entretien", "Atelier projet", "Atelier marché du travail"],
      eventUsefulNow: false,
      shouldAskQuestion: true,
      reason: "Le mot atelier seul est ambigu : il faut savoir atelier pour quoi."
    };
  }

  return base;
}

/* =========================================================
   ENTITÉS : MÉTIER, ROME, VILLE, PÉRIODE
========================================================= */

function extractEntities(message, ville) {
  const text = String(message || "");
  const normalized = normalize(text);

  const romeMatch = text.match(/\b[A-Z][0-9]{4}\b/i);
  const romeCode = romeMatch ? romeMatch[0].toUpperCase() : "";

  const metier = extractMetier(text);
  const keywords = buildKeywords(text, metier);
  const period = parsePeriod(text);

  return {
    ville,
    metier,
    romeCode,
    keywords,
    period,
    wantsNational: isNationalSearch(text),
    wantsRemote: hasAny(normalized, ["teletravail", "télétravail", "remote", "a distance", "à distance"]),
    wantsAlternance: hasAny(normalized, ["alternance", "apprentissage", "contrat pro", "contrat d apprentissage"]),
    wantsFormation: hasAny(normalized, ["formation", "certification", "diplome", "diplôme", "se former"])
  };
}

function extractMetier(text) {
  const raw = String(text || "");

  const patterns = [
    /(?:travail|emploi|poste|job)\s+(?:de|d'|comme|en tant que)\s+([^,.!?;]{3,80})/i,
    /(?:devenir|être|etre|faire|viser|vise|cherche|chercher|trouver|travailler comme|travailler en tant que|poste de|métier de|metier de|emploi de)\s+([^,.!?;]{3,80})/i,
    /(?:dans|en)\s+(administratif|commerce|logistique|restauration|hôtellerie|hotellerie|secrétariat|secretariat|comptabilité|comptabilite|informatique|numérique|numerique|vente|accueil|rh|ressources humaines|boulangerie|pâtisserie|patisserie)(?=\b|[,.!?;])/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match && match[1]) {
      const cleaned = cleanMetier(match[1]);
      if (cleaned && !isInvalidMetierCandidate(cleaned)) return normalizeKnownMetier(cleaned);
    }
  }

  const known = [
    "boulanger pâtissier", "boulangère pâtissière", "boulanger-pâtissier", "boulanger", "boulangere", "boulangère", "patissier", "pâtissier", "pâtissière", "patisserie", "boucher", "bouchère",
    "assistant administratif", "assistante administrative", "agent administratif", "secretaire", "secrétaire",
    "assistant de gestion", "gestionnaire administratif", "chargé d'accueil", "charge d accueil",
    "vendeur", "vendeuse", "employé libre service", "employe libre service", "magasinier", "préparateur de commandes", "preparateur de commandes",
    "serveur", "serveuse", "cuisinier", "cuisinière", "aide soignant", "aide-soignant", "auxiliaire de vie",
    "developpeur", "développeur", "product owner", "comptable", "rh", "ressources humaines"
  ];

  const nraw = normalize(raw);
  for (const k of known) {
    if (nraw.includes(normalize(k))) return normalizeKnownMetier(k);
  }

  return "";
}

function normalizeKnownMetier(value) {
  const v = normalize(String(value || "")).replace(/\s+/g, " ").trim();
  const map = {
    "boulangere": "boulanger",
    "boulangerie": "boulanger",
    "boulanger patissier": "boulanger pâtissier",
    "boulangere patissiere": "boulanger pâtissier",
    "boulanger-patissier": "boulanger pâtissier",
    "patissier": "pâtissier",
    "patisserie": "pâtissier",
    "secretaire": "secrétaire",
    "charge d accueil": "chargé d'accueil",
    "employe libre service": "employé libre service",
    "preparateur de commandes": "préparateur de commandes",
    "developpeur": "développeur"
  };
  return map[v] || String(value || "").replace(/\s+/g, " ").trim();
}

function cleanMetier(value) {
  return String(value || "")
    .replace(/\s+(?:mais|et|avec|pour|car|parce que|autour de|près de|proche de|à|a|en|sur)\s+.*$/i, "")
    .replace(/^(un|une|le|la|l'|du|de la|des|d'un|d'une)\s+/i, "")
    .replace(/^(travail|emploi|poste|job)\s+(de|d'|comme|en tant que)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}

function isInvalidMetierCandidate(value) {
  const v = normalize(String(value || "")).replace(/\s+/g, " ").trim();
  if (!v || v.length < 3) return true;
  return hasAny(v, [
    "evenement", "événement", "event", "agenda", "forum", "salon", "job dating",
    "offre", "offres", "service", "services", "lien", "liens", "atelier", "date", "inscription",
    "travail", "emploi", "poste", "job", "quelque chose", "action locale"
  ]);
}

function buildKeywords(text, metier) {
  if (metier) return metier;

  const normalized = normalize(text);

  if (hasAny(normalized, ["boulanger", "boulangere", "boulangerie", "pain", "viennoiserie"])) {
    return "boulanger";
  }

  if (hasAny(normalized, ["patisserie", "pâtisserie", "patissier", "pâtissier"])) {
    return "pâtissier";
  }

  if (hasAny(normalized, ["administratif", "secretaire", "secretariat", "accueil", "bureautique"])) {
    return "assistant administratif";
  }

  if (hasAny(normalized, ["commerce", "vente", "vendeur", "vendeuse", "magasin"])) {
    return "vente commerce";
  }

  if (hasAny(normalized, ["logistique", "magasinier", "preparateur", "caces"])) {
    return "logistique magasinier";
  }

  if (hasAny(normalized, ["informatique", "developpeur", "numerique", "digital", "product owner"])) {
    return "informatique numérique";
  }

  return "";
}

function isDirectEmploymentRequest(text) {
  const t = normalize(text || "");
  return hasAny(t, [
    "je cherche", "je recherche", "chercher", "rechercher", "trouver", "travail", "emploi", "poste", "job",
    "offre", "offres", "recrute", "recrutement", "cdi", "cdd", "interim", "intérim",
    "travailler comme", "travailler en tant que", "embauche", "embaucher"
  ]) && !hasAny(t, [
    "je ne sais pas quoi faire", "projet flou", "orientation", "reconversion", "changer de metier", "changer de métier",
    "formation", "se former", "diplome", "diplôme", "apprendre le metier", "apprendre le métier"
  ]);
}

/* =========================================================
   PLAN D'APPELS API
========================================================= */

function buildApiPlan(analysis, entities, message) {
  const intent = analysis.intent;

  const plans = {
    confiance: [],
    image_professionnelle: [],
    entretien: ["offres"],
    ues: ["offres", "bonneBoite", "marcheTravail"],
    candidature_cv: ["offres", "bonneBoite"],
    competences: ["romeMetiers", "romeCompetences", "formations", "marcheTravail"],
    activ_projet: ["romeMetiers", "romeFiches", "romeContextes", "marcheTravail", "romeo", "formations"],
    formation: ["romeMetiers", "romeCompetences", "formations", "marcheTravail", "offres"],
    pmsmp: ["romeMetiers", "romeFiches", "romeContextes", "bonneBoite"],
    poe: ["offres", "formations", "events"],
    recherche_emploi: ["offres", "bonneBoite", "marcheTravail", "romeMetiers", "romeFiches", "events"],
    territoire: ["cadreVie", "marcheTravail", "offres", "agences"],
    creation: ["cadreVie", "marcheTravail", "events"],
    sante: ["events", "agences"],
    international: ["offres", "formations", "events"],
    events: ["events"],
    diagnostic: []
  };

  let plan = plans[intent] || [];

  if (!entities.keywords && !entities.romeCode) {
    plan = plan.filter(x => !["offres", "formations", "marcheTravail", "romeCompetences", "romeFiches", "romeContextes", "bonneBoite"].includes(x));
  }

  // Ne jamais appeler les événements juste parce que le mot atelier est présent.
  if (intent !== "events" && !analysis.eventUsefulNow && !isExplicitEventRequest(message)) {
    plan = plan.filter(x => x !== "events");
  }

  return [...new Set(plan)];
}

/* =========================================================
   ORCHESTRATION API
========================================================= */

async function buildApiContext(env, state) {
  const { message, ville, analysis, entities, plan } = state;
  const geo = await geocodeCity(ville);

  const ctx = emptyApiContext();
  ctx.meta.plan = plan;
  ctx.meta.ville = ville;
  ctx.meta.geo = geo;
  ctx.meta.entities = entities;

  // ROME : appels limités à 1/s. On les fait en séquentiel.
  const romeSteps = plan.filter(x => x.startsWith("rome"));
  for (const step of romeSteps) {
    await sleep(RATE_LIMIT_MS[step] || 1100);
    if (step === "romeMetiers") ctx.romeMetiers = await fetchRomeMetiers(env, { message, ville, entities });
    if (step === "romeCompetences") ctx.romeCompetences = await fetchRomeCompetences(env, { message, ville, entities, ctx });
    if (step === "romeFiches") ctx.romeFiches = await fetchRomeFiches(env, { message, ville, entities, ctx });
    if (step === "romeContextes") ctx.romeContextes = await fetchRomeContextes(env, { message, ville, entities, ctx });
  }

  const parallel = [];

  if (plan.includes("offres")) parallel.push(["offres", fetchOffres(env, { message, ville, entities, geo })]);
  if (plan.includes("formations")) parallel.push(["formations", fetchFormations(env, { message, ville, entities, geo })]);
  if (plan.includes("marcheTravail")) parallel.push(["marcheTravail", fetchMarcheTravail(env, { message, ville, entities, geo, ctx })]);
  if (plan.includes("accesEmploi")) parallel.push(["accesEmploi", fetchAccesEmploi(env, { message, ville, entities, geo, ctx })]);
  if (plan.includes("bonneBoite")) parallel.push(["bonneBoite", fetchBonneBoite(env, { message, ville, entities, geo, ctx })]);
  if (plan.includes("agences")) parallel.push(["agences", fetchAgences(env, { message, ville, entities, geo })]);
  if (plan.includes("cadreVie")) parallel.push(["cadreVie", fetchCadreVie(env, { message, ville, entities, geo })]);
  if (plan.includes("romeo")) parallel.push(["romeo", fetchRomeo(env, { message, ville, entities, geo, ctx })]);

  if (plan.includes("events")) {
    const period = entities.period || parsePeriod(message);
    parallel.push(["events", fetchEvents(env, {
      ville,
      dateDebut: period.dateDebut,
      dateFin: period.dateFin,
      latitude: geo.latitude,
      longitude: geo.longitude,
      rayon: 10
    })]);
  }

  const results = await Promise.allSettled(parallel.map(x => x[1]));
  results.forEach((result, index) => {
    const name = parallel[index][0];
    if (result.status === "fulfilled") {
      ctx[name] = result.value;
    } else {
      ctx[name] = apiError(name, String(result.reason || "Erreur inconnue"));
    }
  });

  return ctx;
}

function emptyApiContext() {
  const blank = name => ({ name, ok: false, skipped: true, status: 0, count: 0, items: [], summary: "Non appelé" });
  return {
    meta: { plan: [], ville: "", geo: null, entities: null },
    offres: blank("offres"),
    events: blank("events"),
    formations: blank("formations"),
    marcheTravail: blank("marcheTravail"),
    accesEmploi: blank("accesEmploi"),
    bonneBoite: blank("bonneBoite"),
    agences: blank("agences"),
    cadreVie: blank("cadreVie"),
    romeo: blank("romeo"),
    romeMetiers: blank("romeMetiers"),
    romeCompetences: blank("romeCompetences"),
    romeFiches: blank("romeFiches"),
    romeContextes: blank("romeContextes")
  };
}

/* =========================================================
   CLIENT FRANCE TRAVAIL GÉNÉRIQUE
========================================================= */

async function getFranceTravailToken(env, apiName = "default") {
  const clientId = env.FRANCE_TRAVAIL_CLIENT_ID || env.FT_CLIENT_ID || env.CLIENT_ID;
  const clientSecret = env.FRANCE_TRAVAIL_CLIENT_SECRET || env.FT_CLIENT_SECRET || env.CLIENT_SECRET;
  const scope = scopeForApi(env, apiName);

  const tokenUrl = env.FRANCE_TRAVAIL_TOKEN_URL ||
    "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      status: 0,
      scope,
      apiName,
      has_access_token: false,
      access_token: "",
      expires_in: null,
      error: "Variables FRANCE_TRAVAIL_CLIENT_ID ou FRANCE_TRAVAIL_CLIENT_SECRET manquantes."
    };
  }

  const cacheKey = `${apiName}:${scope}`;
  const cached = TOKEN_CACHE.get(cacheKey);
  const now = Date.now();

  if (cached?.value && cached.expiresAt > now + 30_000) {
    return {
      ok: true,
      status: 200,
      scope,
      apiName,
      has_access_token: true,
      access_token: cached.value,
      expires_in: Math.floor((cached.expiresAt - now) / 1000),
      error: ""
    };
  }

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", String(clientId).trim());
  form.set("client_secret", String(clientSecret).trim());
  form.set("scope", String(scope).trim());

  const response = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "accept": "application/json"
    },
    body: form
  }, 9000);

  const text = await response.text();
  const data = safeJson(text) || {};

  if (response.ok && data.access_token) {
    TOKEN_CACHE.set(cacheKey, {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 1200) - 30) * 1000,
      scope
    });
  }

  return {
    ok: response.ok && Boolean(data.access_token),
    status: response.status,
    scope,
    apiName,
    expires_in: data.expires_in || null,
    has_access_token: Boolean(data.access_token),
    access_token: data.access_token || "",
    error: response.ok ? "" : truncate(text, 500)
  };
}

function scopeForApi(env, apiName = "default") {
  const globalScope = env.FRANCE_TRAVAIL_SCOPE || env.FT_SCOPE || "api_evenementsv1 evenements";

  const scoped = {
    offres: env.FT_SCOPE_OFFRES,
    events: env.FT_SCOPE_EVENTS || env.FT_SCOPE_EVENEMENTS,
    formations: env.FT_SCOPE_FORMATIONS,
    marcheTravail: env.FT_SCOPE_MARCHE_TRAVAIL,
    accesEmploi: env.FT_SCOPE_ACCES_EMPLOI,
    agences: env.FT_SCOPE_AGENCES,
    cadreVie: env.FT_SCOPE_CADRE_VIE,
    bonneBoite: env.FT_SCOPE_BONNE_BOITE,
    romeo: env.FT_SCOPE_ROMEO,
    romeMetiers: env.FT_SCOPE_ROME_METIERS,
    romeCompetences: env.FT_SCOPE_ROME_COMPETENCES,
    romeFiches: env.FT_SCOPE_ROME_FICHES,
    romeContextes: env.FT_SCOPE_ROME_CONTEXTES
  };

  return String(scoped[apiName] || globalScope).trim();
}

async function callFranceTravail(env, apiName, url, options = {}, timeoutMs = 9000) {
  if (!url) {
    return apiSkipped(apiName, "Endpoint non configuré. Ajoute la variable Cloudflare correspondante si cette API est habilitée.");
  }

  const token = await getFranceTravailToken(env, apiName);
  if (!token.ok) {
    return apiError(apiName, token.error || "Token France Travail indisponible", token.status);
  }

  const headers = {
    "accept": "application/json",
    ...(options.headers || {}),
    "authorization": `Bearer ${token.access_token}`
  };

  const response = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);
  const text = await response.text();
  const data = safeJson(text) || { raw: text };

  if (!response.ok) {
    return apiError(apiName, truncate(text, 500), response.status);
  }

  const items = normalizeApiItems(data);

  return {
    name: apiName,
    ok: true,
    skipped: false,
    status: response.status,
    count: items.length,
    items,
    rawSample: items.slice(0, 3),
    summary: summarizeGenericItems(apiName, items)
  };
}

function normalizeApiItems(data) {
  if (Array.isArray(data)) return data;

  const candidates = [
    data.resultats,
    data.results,
    data.content,
    data.items,
    data.liste,
    data.formations,
    data.offres,
    data.agences,
    data.etablissements,
    data.entreprises,
    data.metiers,
    data.competences,
    data.fiches,
    data.contextes,
    data._embedded?.items,
    data._embedded?.results,
    data._embedded?.content
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  // Si la réponse est un objet utile mais non listé.
  if (data && typeof data === "object") return [data];
  return [];
}

function apiSkipped(name, reason) {
  return { name, ok: false, skipped: true, status: 0, count: 0, items: [], summary: reason, error: reason };
}

function apiError(name, error, status = 0) {
  return { name, ok: false, skipped: false, status, count: 0, items: [], summary: "Erreur API", error };
}

/* =========================================================
   API SPÉCIFIQUES
========================================================= */

async function fetchOffres(env, state) {
  const apiName = "offres";
  const base = env.FT_OFFRES_URL || DEFAULT_ENDPOINTS.offres;
  const url = new URL(base);

  const keywords = state.entities.keywords || state.entities.metier || "";
  if (keywords) url.searchParams.set("motsCles", keywords);
  url.searchParams.set("range", "0-9");
  url.searchParams.set("tri", "0");

  // Offres v2 répond mieux avec commune INSEE + distance quand une ville est demandée.
  // Si la demande est nationale, on ne force pas Issy-les-Moulineaux par défaut.
  const nationalSearch = state.entities?.wantsNational || state.geo?.national || isNationalSearch(state.message) || normalize(state.ville) === "france";
  if (!nationalSearch) {
    if (state.geo?.codeInsee) url.searchParams.set("commune", state.geo.codeInsee);
    if (state.geo?.latitude && state.geo?.longitude) {
      url.searchParams.set("latitude", String(state.geo.latitude));
      url.searchParams.set("longitude", String(state.geo.longitude));
    }
    url.searchParams.set("distance", "10");
  }

  let result = await callFranceTravail(env, apiName, url.toString(), { method: "GET" }, 9000);
  if (result.ok) result.items = result.items.map(mapOffre).filter(x => x.titre || x.intitule);

  // Si la commune exacte ne remonte rien, on élargit intelligemment au bassin proche.
  if (result.ok && result.items.length === 0) {
    const wider = new URL(base);
    if (keywords) wider.searchParams.set("motsCles", keywords);
    wider.searchParams.set("range", "0-9");
    wider.searchParams.set("tri", "0");
    if (!nationalSearch) {
      if (state.geo?.codeInsee) wider.searchParams.set("commune", state.geo.codeInsee);
      if (state.geo?.latitude && state.geo?.longitude) {
        wider.searchParams.set("latitude", String(state.geo.latitude));
        wider.searchParams.set("longitude", String(state.geo.longitude));
      }
      wider.searchParams.set("distance", "30");
    }

    const retry = await callFranceTravail(env, apiName, wider.toString(), { method: "GET" }, 9000);
    if (retry.ok) {
      retry.items = retry.items.map(mapOffre).filter(x => x.titre || x.intitule);
      retry.retriedWith = "rayon 30 km";
      result = retry;
    }
  }

  result.count = result.items.length;
  result.summary = summarizeOffres(result.items);
  return result;
}

function mapOffre(o) {
  const id = o.id || o.reference || "";
  const url = o.origineOffre?.urlOrigine || o.url || o.lien || (id ? `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(id)}` : "");
  return {
    id,
    titre: o.intitule || o.titre || o.title || "",
    entreprise: o.entreprise?.nom || o.entreprise || o.company || "",
    lieu: o.lieuTravail?.libelle || o.lieu || o.location || "",
    typeContrat: o.typeContratLibelle || o.typeContrat || o.contrat || "",
    dureeTravail: o.dureeTravailLibelle || o.dureeTravail || "",
    salaire: o.salaire?.libelle || o.salaire || o.remuneration || "",
    experience: o.experienceLibelle || o.experience || "",
    description: cleanText(o.description || o.descriptif || ""),
    url
  };
}

async function fetchEvents(env, context) {
  const apiName = "events";
  const token = await getFranceTravailToken(env, apiName);

  const safeTokenInfo = {
    ok: token.ok,
    status: token.status,
    scope: token.scope,
    expires_in: token.expires_in,
    has_access_token: token.has_access_token,
    error: token.error
  };

  if (!token.ok) {
    return {
      name: apiName,
      ok: false,
      skipped: false,
      tokenInfo: safeTokenInfo,
      apiStatus: 0,
      status: 0,
      totalElements: 0,
      count: 0,
      items: [],
      events: [],
      error: token.error,
      summary: "Token indisponible"
    };
  }

  const apiUrl = env.FT_EVENTS_URL || env.FRANCE_TRAVAIL_EVENTS_API_URL || DEFAULT_ENDPOINTS.events;

  const payload = {
    dateDebut: context.dateDebut,
    dateFin: context.dateFin,
    latitude: context.latitude,
    longitude: context.longitude,
    rayon: context.rayon || 10
  };

  let response = await fetchWithTimeout(apiUrl, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token.access_token}`,
      "content-type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify(payload)
  }, 9000);

  let text = await response.text();

  if (response.status === 405 || response.status === 400) {
    const url = new URL(apiUrl);
    url.searchParams.set("dateDebut", context.dateDebut);
    url.searchParams.set("dateFin", context.dateFin);
    url.searchParams.set("latitude", String(context.latitude));
    url.searchParams.set("longitude", String(context.longitude));
    url.searchParams.set("rayon", String(context.rayon || 10));

    response = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        "authorization": `Bearer ${token.access_token}`,
        "accept": "application/json"
      }
    }, 9000);

    text = await response.text();
  }

  const data = safeJson(text) || {};
  const rawEvents = extractEvents(data);
  const events = rawEvents.map(mapEvent).filter(e => e.titre);

  return {
    name: apiName,
    ok: response.ok,
    skipped: false,
    tokenInfo: safeTokenInfo,
    apiStatus: response.status,
    status: response.status,
    totalElements: data.totalElements || data.total || events.length,
    count: events.length,
    items: events,
    events,
    summary: response.ok ? summarizeEvents(events) : "Erreur événements",
    error: response.ok ? "" : truncate(text, 500)
  };
}

function extractEvents(data) {
  if (Array.isArray(data)) return data;
  const candidates = [data.content, data.events, data.evenements, data.resultats, data.results, data._embedded?.evenements, data._embedded?.events, data.page?.content];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return findFirstEventArray(data) || [];
}

function findFirstEventArray(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      const looksLikeEvents = value.some(x => x && typeof x === "object" && (x.titre || x.title || x.dateEvenement || x.date));
      if (looksLikeEvents) return value;
    }
    if (value && typeof value === "object") {
      const found = findFirstEventArray(value);
      if (found) return found;
    }
  }
  return null;
}

function mapEvent(e) {
  return {
    id: e.id || e.idEvenement || "",
    titre: e.titre || e.title || e.nom || "",
    jour: e.jour || e.dateTexte || "",
    dateEvenement: e.dateEvenement || e.date || e.startDate || "",
    heureDebut: e.heureDebut || "",
    heureFin: e.heureFin || "",
    ville: e.ville || e.commune || e.city || "",
    codePostal: e.codePostal || e.cp || "",
    type: e.type || e.typeEvenement || "",
    objectifs: toArray(e.objectifs),
    publics: toArray(e.publics),
    benefices: toArray(e.benefices),
    modalites: toArray(e.modalites),
    operations: toArray(e.operations),
    organisme: e.organisme || e.organisateur || "",
    description: cleanText(e.description || ""),
    deroulement: cleanText(e.deroulement || ""),
    url: e.url || e.lien || (e.id ? `https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/evenement/${e.id}` : "")
  };
}

async function fetchFormations(env, state) {
  const apiName = "formations";
  const endpoint = env.FT_FORMATIONS_URL || DEFAULT_ENDPOINTS.formations;
  if (!endpoint) return apiSkipped(apiName, "Endpoint Open Formation non configuré : ajoute FT_FORMATIONS_URL.");

  const url = new URL(endpoint);
  const q = state.entities.keywords || state.entities.metier || "";
  if (q) url.searchParams.set("q", q);
  if (state.ville) url.searchParams.set("ville", state.ville);
  if (state.entities.romeCode) url.searchParams.set("codeRome", state.entities.romeCode);
  url.searchParams.set("size", "10");

  const result = await callFranceTravail(env, apiName, url.toString(), { method: "GET" }, 9000);
  if (result.ok) result.items = result.items.map(mapFormation);
  result.count = result.items.length;
  result.summary = summarizeFormations(result.items);
  return result;
}

function mapFormation(f) {
  return {
    titre: f.intitule || f.titre || f.nom || f.libelle || "",
    organisme: f.organismeFormation?.nom || f.organisme || f.nomOrganisme || "",
    ville: f.lieuFormation?.ville || f.ville || f.commune || "",
    dateDebut: f.dateDebut || f.debut || "",
    dateFin: f.dateFin || f.fin || "",
    certifiante: f.certifiante || f.estCertifiante || false,
    financement: f.financement || f.typeFinancement || "",
    url: f.url || f.lien || ""
  };
}

async function fetchRomeMetiers(env, state) {
  return fetchConfiguredSearchApi(env, "romeMetiers", env.FT_ROME_METIERS_URL || DEFAULT_ENDPOINTS.romeMetiers, state, "q");
}

async function fetchRomeCompetences(env, state) {
  return fetchConfiguredSearchApi(env, "romeCompetences", env.FT_ROME_COMPETENCES_URL || DEFAULT_ENDPOINTS.romeCompetences, state, "q");
}

async function fetchRomeFiches(env, state) {
  return fetchConfiguredSearchApi(env, "romeFiches", env.FT_ROME_FICHES_URL || DEFAULT_ENDPOINTS.romeFiches, state, "q");
}

async function fetchRomeContextes(env, state) {
  return fetchConfiguredSearchApi(env, "romeContextes", env.FT_ROME_CONTEXTES_URL || DEFAULT_ENDPOINTS.romeContextes, state, "q");
}

async function fetchMarcheTravail(env, state) {
  return fetchConfiguredSearchApi(env, "marcheTravail", env.FT_MARCHE_TRAVAIL_URL || DEFAULT_ENDPOINTS.marcheTravail, state, "q");
}

async function fetchAccesEmploi(env, state) {
  return fetchConfiguredSearchApi(env, "accesEmploi", env.FT_ACCES_EMPLOI_URL || DEFAULT_ENDPOINTS.accesEmploi, state, "q");
}

async function fetchBonneBoite(env, state) {
  return fetchConfiguredSearchApi(env, "bonneBoite", env.FT_BONNE_BOITE_URL || DEFAULT_ENDPOINTS.bonneBoite, state, "q");
}

async function fetchAgences(env, state) {
  return fetchConfiguredSearchApi(env, "agences", env.FT_AGENCES_URL || DEFAULT_ENDPOINTS.agences, state, "commune");
}

async function fetchCadreVie(env, state) {
  return fetchConfiguredSearchApi(env, "cadreVie", env.FT_CADRE_VIE_URL || DEFAULT_ENDPOINTS.cadreVie, state, "commune");
}

async function fetchRomeo(env, state) {
  const endpoint = env.FT_ROMEO_URL || DEFAULT_ENDPOINTS.romeo;
  if (!endpoint) return apiSkipped("romeo", "Endpoint ROMEO non configuré : ajoute FT_ROMEO_URL.");

  const method = String(env.FT_ROMEO_METHOD || "POST").toUpperCase();
  if (method === "GET") return fetchConfiguredSearchApi(env, "romeo", endpoint, state, "q");

  const body = {
    question: state.message,
    ville: state.ville,
    metier: state.entities.metier,
    codeRome: state.entities.romeCode
  };

  return callFranceTravail(env, "romeo", endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }, 9000);
}

async function fetchConfiguredSearchApi(env, apiName, endpoint, state, queryParamName = "q") {
  if (!endpoint) return apiSkipped(apiName, `Endpoint ${apiName} non configuré.`);

  const url = new URL(endpoint);
  const q = state.entities.romeCode || state.entities.keywords || state.entities.metier || state.message || "";

  if (queryParamName === "commune") {
    url.searchParams.set("commune", state.ville);
    url.searchParams.set("ville", state.ville);
  } else {
    url.searchParams.set(queryParamName, q);
  }

  if (state.entities.romeCode) url.searchParams.set("codeRome", state.entities.romeCode);
  if (state.entities.metier) url.searchParams.set("metier", state.entities.metier);
  if (state.ville) url.searchParams.set("ville", state.ville);
  if (state.geo?.latitude) url.searchParams.set("latitude", String(state.geo.latitude));
  if (state.geo?.longitude) url.searchParams.set("longitude", String(state.geo.longitude));
  url.searchParams.set("size", "10");

  return callFranceTravail(env, apiName, url.toString(), { method: "GET" }, 9000);
}

/* =========================================================
   RÉDACTION LLM
========================================================= */

async function generateFinalReply(env, context) {
  if (env.GEMINI_API_KEY) {
    const gemini = await callGemini(env, context);
    if (gemini.ok && gemini.reply) return gemini;
  }

  if (env.OPENAI_API_KEY) {
    const openai = await callOpenAI(env, context);
    if (openai.ok && openai.reply) return openai;
  }

  return {
    ok: true,
    provider: "moteur métier local",
    reply: context.fallback
  };
}

async function callGemini(env, context) {
  try {
    const model = env.GEMINI_MODEL || "gemini-2.5-flash-lite";

    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: FINAL_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildLLMPrompt(context) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 900 }
      })
    }, 17000);

    const data = await response.json();
    if (!response.ok) return { ok: false, provider: "Gemini", reply: "", error: data.error?.message || "Erreur Gemini" };

    const reply = extractGeminiText(data);
    return { ok: Boolean(reply), provider: "Gemini", reply };
  } catch (error) {
    return { ok: false, provider: "Gemini", reply: "", error: String(error?.message || error) };
  }
}

async function callOpenAI(env, context) {
  try {
    const model = env.OPENAI_MODEL || "gpt-4.1-mini";

    const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        instructions: FINAL_SYSTEM_PROMPT,
        input: buildLLMPrompt(context),
        temperature: 0.22,
        max_output_tokens: 900
      })
    }, 17000);

    const data = await response.json();
    if (!response.ok) return { ok: false, provider: "GPT", reply: "", error: data.error?.message || "Erreur OpenAI" };

    const reply = extractOpenAIText(data);
    return { ok: Boolean(reply), provider: "GPT", reply };
  } catch (error) {
    return { ok: false, provider: "GPT", reply: "", error: String(error?.message || error) };
  }
}

function buildLLMPrompt(context) {
  return [
    `Ville ou secteur : ${context.ville}`,
    ``,
    `Demande utilisateur :`,
    context.message,
    ``,
    `Analyse métier à respecter :`,
    JSON.stringify(context.analysis, null, 2),
    ``,
    `Entités détectées :`,
    JSON.stringify(context.entities, null, 2),
    ``,
    `Plan API utilisé :`,
    JSON.stringify(context.plan, null, 2),
    ``,
    `Données officielles disponibles. Utilise-les seulement si elles sont ok=true et utiles :`,
    JSON.stringify(compactApiContextForLLM(context.apiContext), null, 2),
    ``,
    `Réponse fallback métier à améliorer sans la contredire :`,
    context.fallback
  ].join("\n");
}

const FINAL_SYSTEM_PROMPT = `
Tu es un assistant d’orientation France Travail.

Mission :
Transformer chaque demande en parcours d’action clair. Tu ne fais pas un catalogue de ressources. Tu donnes une direction.

Règles obligatoires :
- Répondre en français simple.
- Résumer le besoin détecté en 1 ou 2 phrases.
- Donner maximum 3 étapes.
- Donner maximum 1 action prioritaire.
- Proposer maximum 2 services utiles.
- Ne jamais écrire d’URL dans le texte.
- Ne jamais utiliser de liens Markdown dans le texte.
- Ne jamais afficher une longue liste de services.
- Ne jamais écrire “Voici les services pertinents”.
- Préférer “Voici le chemin le plus logique”.
- Expliquer pourquoi chaque étape est utile.
- Donner une impulsion positive, concrète et professionnelle.
- Ne promets jamais une inscription, un financement, une formation, une prestation ou une validation automatique.
- Ne prétends pas avoir consulté des résultats en direct si les données ne sont pas fournies dans le contexte.
- Ne parle pas de technique, d’API, de Worker, de Gemini, GPT ou Cloudflare dans la réponse à l’usager.

Format obligatoire :
1. Résumé du besoin détecté.
2. Résultats utiles, uniquement si des offres, événements ou formations sont fournis.
3. Parcours conseillé en 3 étapes maximum.
4. Action prioritaire.

Important :
- Ne pas écrire de section “Services utiles” dans le texte.
- Les services et liens sont affichés par l’application sous forme de boutons.

Consignes par besoin :
- Recherche d’emploi directe : partir du métier, de la ville et du marché local, puis proposer une action ciblée.
- Événements : proposer une action locale seulement si la demande parle d’événement, forum, job dating, ville, date, inscription ou rencontre recruteur.
- Formation : vérifier d’abord métier cible, prérequis et utilité réelle avant de proposer une formation.
- CV/candidature : partir d’une cible concrète et adapter la candidature à cette cible.
- Confiance/entretien : travailler posture, preuves concrètes, discours court et entraînement.
- Projet flou : clarifier le métier puis tester avant de s’engager.

Données officielles :
- Si des offres sont fournies, cite 1 à 3 offres concrètes dans le texte : intitulé, entreprise si disponible, lieu, contrat, salaire si disponible.
- Si des événements sont fournis, cite 1 à 3 événements concrets dans le texte : titre, date, ville, intérêt.
- Si aucune donnée exploitable n’est fournie, indique simplement le chemin logique suivant.
- Les boutons et liens sont affichés par l’application, pas dans ton texte.
`;

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || "").join("\n").trim();
}

function extractOpenAIText(data) {
  if (data.output_text) return String(data.output_text).trim();
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      if (content.type === "text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

/* =========================================================
   FALLBACK LOCAL
========================================================= */

function buildFallbackReply({ message, ville, analysis, entities, plan, apiContext }) {
  const need = reformulateNeed(analysis, entities);
  const steps = buildAdvisorSteps(analysis.intent, entities, ville);
  const action = buildPriorityAction(analysis.intent, entities, ville);
  const dataLine = buildDataLine(apiContext);
  const results = buildConcreteResultsSection(apiContext, analysis.intent);

  const lines = [];
  lines.push("Résumé du besoin détecté");
  lines.push(need);
  if (dataLine) lines.push(dataLine);
  if (results.length) {
    lines.push("");
    lines.push("Résultats utiles");
    for (const line of results) lines.push(line);
  }
  lines.push("");
  lines.push("Parcours conseillé");
  steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}`);
    lines.push(step.why);
  });
  lines.push("");
  lines.push("Action prioritaire");
  lines.push(action);

  return lines.join("\n").trim();
}

function buildAdvisorSteps(intent, entities = {}, ville = DEFAULT_CITY) {
  const zonePhrase = formatZonePhrase(ville);
  const stepsByIntent = {
    confiance: [
      { title: "Identifier le blocage principal", why: "Savoir si le frein vient de l’entretien, de la posture ou du discours évite de partir dans tous les sens." },
      { title: "Repartir de preuves concrètes", why: "Des situations vécues donnent une base solide pour parler de soi sans se dévaloriser." },
      { title: "S’entraîner sur une présentation courte", why: "Une réponse claire et préparée rend l’échange avec un recruteur plus simple." }
    ],
    image_professionnelle: [
      { title: "Clarifier l’image à transmettre", why: "Le candidat doit être lisible rapidement pour un recruteur." },
      { title: "Structurer le discours", why: "Un message court sur les compétences et les preuves évite les présentations floues." },
      { title: "Tester la présentation", why: "Un entraînement permet de corriger ce qui bloque avant un entretien." }
    ],
    entretien: [
      { title: "Préparer les questions probables", why: "Cela réduit le stress et évite les réponses improvisées." },
      { title: "Construire 3 exemples concrets", why: "Les exemples prouvent les compétences mieux qu’une simple affirmation." },
      { title: "S’entraîner à voix haute", why: "La fluidité vient surtout de la répétition." }
    ],
    candidature_cv: [
      { title: "Partir d’une cible concrète", why: "Un CV efficace répond à un poste précis, pas à toutes les situations." },
      { title: "Adapter les compétences visibles", why: "Les bons mots-clés permettent au recruteur de comprendre rapidement la cohérence du profil." },
      { title: "Envoyer peu, mais mieux", why: "Une candidature ciblée a plus de valeur qu’un envoi massif et générique." }
    ],
    formation: [
      { title: "Définir le métier cible", why: "Une formation n’a de sens que si elle mène à un objectif professionnel clair." },
      { title: "Vérifier les prérequis", why: "Cela évite de choisir une formation trop éloignée ou inutile." },
      { title: "Confirmer l’utilité avant engagement", why: "Une immersion ou un échange conseiller peut sécuriser le choix." }
    ],
    competences: [
      { title: "Nommer les compétences à renforcer", why: "On ne choisit pas le bon outil si l’écart n’est pas clairement identifié." },
      { title: "Comparer avec les attentes du métier", why: "Le besoin peut venir du métier, du numérique, du CV ou de la confiance." },
      { title: "Choisir un levier unique", why: "Formation, atelier ou immersion doivent répondre à un blocage précis." }
    ],
    activ_projet: [
      { title: "Clarifier les pistes métier", why: "Un projet flou doit d’abord devenir une option concrète." },
      { title: "Vérifier la réalité du métier", why: "Les conditions, compétences et contraintes doivent être connues avant de s’engager." },
      { title: "Tester avant de décider", why: "Une immersion évite de construire un projet sur une idée abstraite." }
    ],
    pmsmp: [
      { title: "Choisir le métier à tester", why: "L’immersion doit répondre à une question précise." },
      { title: "Identifier des entreprises d’accueil", why: "Le test devient possible quand des structures concrètes sont ciblées." },
      { title: "Préparer l’objectif de l’immersion", why: "Observer les bons points aide à confirmer ou corriger le projet." }
    ],
    recherche_emploi: [
      { title: "Cibler le bon métier", why: `Clarifier le poste recherché ${zonePhrase} évite une recherche trop large.` },
      { title: "Identifier les entreprises utiles", why: "Certaines entreprises peuvent recruter même sans offre publiée." },
      { title: "Passer à l’action", why: "Une candidature ciblée ou un événement recruteur crée un contact concret." }
    ],
    events: [
      { title: "Choisir l’événement le plus utile", why: "Un événement doit correspondre au métier, au secteur ou au besoin immédiat." },
      { title: "Préparer une présentation courte", why: "Une rencontre recruteur se joue souvent en quelques minutes." },
      { title: "Prévoir la suite", why: "Après l’événement, il faut relancer ou candidater rapidement." }
    ],
    creation: [
      { title: "Clarifier l’idée", why: "Un projet de création doit être compréhensible et relié à un besoin réel." },
      { title: "Tester le public visé", why: "La viabilité dépend de clients ou d’usagers identifiés." },
      { title: "Sécuriser les prochaines démarches", why: "Un accompagnement évite de partir directement sur des formalités inutiles." }
    ],
    international: [
      { title: "Choisir le pays ou la zone", why: "Les démarches changent selon la destination." },
      { title: "Vérifier les prérequis", why: "Langue, diplôme, contrat et mobilité doivent être réalistes." },
      { title: "Construire une candidature adaptée", why: "Un projet international demande un positionnement clair." }
    ],
    diagnostic: [
      { title: "Préciser le métier ou le secteur", why: "Le parcours dépend d’abord de la cible professionnelle." },
      { title: "Identifier le blocage principal", why: "Le bon levier n’est pas le même pour un CV, une formation, un entretien ou une orientation." },
      { title: "Choisir la première action utile", why: "Une seule action claire vaut mieux qu’une liste de ressources." }
    ]
  };

  return stepsByIntent[intent] || stepsByIntent.diagnostic;
}

function buildPriorityAction(intent, entities = {}, ville = DEFAULT_CITY) {
  const metier = entities.metier || entities.keywords || "le métier visé";
  const zoneAction = formatZoneAction(ville);

  const actions = {
    confiance: "Écrire trois situations professionnelles où vous avez été utile, puis transformer chaque situation en compétence.",
    image_professionnelle: "Préparer une présentation de 30 secondes : métier visé, compétence forte, preuve concrète.",
    entretien: "Préparer trois réponses courtes : parcours, motivation, exemple de réussite.",
    candidature_cv: "Choisir une offre cible et adapter le titre du CV ainsi que les 5 compétences visibles.",
    formation: `Vérifier si ${metier} exige réellement une formation ou seulement une compétence complémentaire.`,
    competences: `Lister les 3 compétences manquantes pour accéder à ${metier}.`,
    activ_projet: "Choisir deux métiers possibles et en éliminer un avec des critères concrets.",
    pmsmp: `Cibler 3 entreprises ${zoneAction} pour tester ${metier} en immersion.`,
    recherche_emploi: `Cibler 5 entreprises ${zoneAction} pour ${metier}.`,
    events: `Repérer un événement emploi ${zoneAction} et préparer une présentation courte avant inscription.`,
    creation: "Formuler l’idée en une phrase : public visé, problème résolu, solution proposée.",
    international: "Choisir un pays cible et vérifier les prérequis avant de chercher des offres.",
    diagnostic: "Donner le métier visé, la ville et le blocage principal pour obtenir un parcours précis."
  };

  return actions[intent] || actions.diagnostic;
}

function reformulateNeed(analysis, entities) {
  if (entities.metier) return `Votre demande concerne le parcours vers le métier suivant : ${entities.metier}.`;

  const byIntent = {
    confiance: "Votre demande porte d’abord sur la confiance et la capacité à vous présenter sans vous dévaloriser.",
    image_professionnelle: "Votre demande porte sur la manière de présenter votre profil de façon claire et crédible.",
    entretien: "Votre demande porte sur la préparation d’un entretien et la capacité à convaincre un recruteur.",
    candidature_cv: "Votre besoin est d’améliorer une candidature pour qu’elle soit plus ciblée et plus lisible.",
    formation: "Votre besoin est de vérifier si une formation est réellement utile pour atteindre votre objectif professionnel.",
    competences: "Votre besoin est d’identifier les compétences à renforcer avant de choisir le bon levier.",
    activ_projet: "Votre besoin est de clarifier un projet professionnel avant de vous engager dans une démarche.",
    pmsmp: "Votre besoin est de tester un métier en situation réelle avant de confirmer le projet.",
    recherche_emploi: "Votre recherche semble orientée vers un poste concret. Le plus utile est donc de passer rapidement à une action ciblée.",
    events: "Votre demande porte sur une action locale ou datée.",
    creation: "Votre besoin est de structurer une idée de création avant de passer aux démarches.",
    international: "Votre besoin est de cadrer une recherche ou un projet professionnel à l’international."
  };

  return byIntent[analysis.intent] || "Votre demande nécessite d’identifier la prochaine étape utile du parcours.";
}

function buildDataLine(apiContext) {
  const parts = [];
  if (apiContext.offres.ok) parts.push(`${apiContext.offres.count} offre(s) exploitable(s)`);
  if (apiContext.formations.ok) parts.push(`${apiContext.formations.count} formation(s)`);
  if (apiContext.events.ok) parts.push(`${apiContext.events.count} événement(s)`);
  if (apiContext.bonneBoite.ok) parts.push(`${apiContext.bonneBoite.count} entreprise(s) à cibler`);
  if (!parts.length) return "";
  return `Données disponibles : ${parts.join(", ")}.`;
}

function buildConcreteResultsSection(apiContext, intent) {
  const lines = [];

  if (intent === "events" && apiContext?.events?.items?.length) {
    for (const event of apiContext.events.items.slice(0, 3)) {
      const date = event.dateEvenement ? formatDate(event.dateEvenement) : (event.jour || "date à vérifier");
      const place = [event.ville, event.codePostal].filter(Boolean).join(" ");
      lines.push(`- ${event.titre}${date ? ` — ${date}` : ""}${place ? ` — ${place}` : ""}.`);
    }
    return lines;
  }

  if (["recherche_emploi", "candidature_cv", "ues", "poe", "international"].includes(intent) && apiContext?.offres?.items?.length) {
    for (const offre of apiContext.offres.items.slice(0, 3)) {
      const details = [offre.entreprise, offre.lieu, offre.typeContrat, offre.salaire].filter(Boolean).join(" — ");
      lines.push(`- ${offre.titre}${details ? ` — ${details}` : ""}.`);
    }
    return lines;
  }

  if (intent === "formation" && apiContext?.formations?.items?.length) {
    for (const formation of apiContext.formations.items.slice(0, 3)) {
      const details = [formation.organisme, formation.ville, formation.dateDebut].filter(Boolean).join(" — ");
      lines.push(`- ${formation.titre}${details ? ` — ${details}` : ""}.`);
    }
    return lines;
  }

  return lines;
}

/* =========================================================
   LIENS & RECOMMANDATIONS
========================================================= */

function buildOfficialLinks(intent, apiContext) {
  const links = [];
  const entities = apiContext?.meta?.entities || {};
  const ville = apiContext?.meta?.ville || DEFAULT_CITY;
  const metier = entities.metier || entities.keywords || "";

  if (intent === "events") {
    links.push(...buildEventLinks(apiContext?.events?.items || []));
    if (!links.length) links.push(serviceToLink(SERVICE_CATALOG.events));
    return dedupeLinks(links).slice(0, 2);
  }

  if (["recherche_emploi", "ues", "candidature_cv", "poe", "international"].includes(intent)) {
    for (const offre of (apiContext?.offres?.items || []).slice(0, 2)) {
      if (offre.url) links.push({
        label: `Offre — ${truncate(offre.titre || "poste", 60)}`,
        title: `Offre — ${truncate(offre.titre || "poste", 60)}`,
        description: [offre.entreprise, offre.lieu, offre.typeContrat].filter(Boolean).join(" — "),
        why: "offre concrète correspondant à la recherche.",
        url: offre.url
      });
    }

    if (links.length < 2) {
      const searchUrl = buildOffresSearchUrl(metier, ville);
      if (searchUrl) links.push({
        label: `Rechercher d’autres offres${metier ? ` — ${metier}` : ""}`,
        title: `Rechercher d’autres offres${metier ? ` — ${metier}` : ""}`,
        description: "ouvrir la recherche France Travail avec le métier ciblé.",
        why: "utile pour vérifier les offres disponibles et postuler rapidement.",
        url: searchUrl
      });
    }

    if (links.length < 2) links.push(serviceToLink(SERVICE_CATALOG.bonneBoite));
    return dedupeLinks(links).slice(0, 2);
  }

  return selectBestLinks(intent, apiContext).slice(0, 2);
}

function serviceToLink(service) {
  return {
    label: service.label,
    title: service.label,
    description: service.why,
    why: service.why,
    url: service.url
  };
}

function buildOffresSearchUrl(metier, ville) {
  const url = new URL("https://candidat.francetravail.fr/offres/recherche");
  if (metier) url.searchParams.set("motsCles", metier);
  if (ville && !isNationalSearch(ville) && normalize(ville) !== "france") {
    url.searchParams.set("lieux", ville);
    url.searchParams.set("rayon", "10");
  }
  return url.toString();
}

function buildLinksByIntent(intent) {
  const fake = emptyApiContext();
  fake.meta.entities = {};
  fake.meta.ville = DEFAULT_CITY;
  return buildOfficialLinks(intent, fake);
}

function buildEventLinks(events) {
  const links = [];
  for (const event of (events || []).slice(0, 2)) {
    if (event.url) links.push({
      label: `${event.type || "Événement"} — ${truncate(event.titre, 55)}`,
      title: `${event.type || "Événement"} — ${truncate(event.titre, 55)}`,
      description: [event.dateEvenement ? formatDate(event.dateEvenement) : "", event.ville].filter(Boolean).join(" — "),
      why: "événement concret proche de la demande.",
      url: event.url
    });
  }
  return links;
}

function dedupeLinks(links) {
  const seen = new Set();
  const clean = [];
  for (const link of links || []) {
    if (!link?.url || seen.has(link.url)) continue;
    seen.add(link.url);
    clean.push(link);
  }
  return clean;
}

const SERVICE_CATALOG = {
  offres: {
    label: "Offres d’emploi France Travail",
    url: "https://candidat.francetravail.fr/offres/recherche",
    why: "à utiliser en premier quand la personne cherche un poste concret."
  },
  servicesTrouver: {
    label: "Mes services — Trouver un emploi",
    url: "https://messervices.francetravail.fr/les-services/trouver",
    why: "regroupe les services utiles pour organiser une recherche d’emploi."
  },
  ues: {
    label: "Un Emploi Stable",
    url: "https://messervices.francetravail.fr/centre-interet/un-emploi-stable",
    why: "pertinent si le projet est clair mais que les démarches doivent être structurées et suivies."
  },
  candidature: {
    label: "Organiser et optimiser ma recherche d’emploi",
    url: "https://messervices.francetravail.fr/centre-interet/organiser-et-optimiser-ma-recherche-demploi",
    why: "utile pour passer d’une recherche dispersée à un plan d’actions régulier."
  },
  entretien: {
    label: "Convaincre en entretien d’embauche",
    url: "https://messervices.francetravail.fr/centre-interet/convaincre-en-entretien-dembauche",
    why: "à proposer quand le frein est l’entretien ou la capacité à convaincre."
  },
  vsi: {
    label: "Valoriser son image professionnelle",
    url: "https://messervices.francetravail.fr/centre-interet/vsi",
    why: "adapté aux freins de confiance, posture, présentation et image candidat."
  },
  bonneBoite: {
    label: "La Bonne Boîte",
    url: "https://labonneboite.francetravail.fr/",
    why: "permet de cibler les entreprises à fort potentiel d’embauche, même sans offre publiée."
  },
  events: {
    label: "Voir les événements emploi",
    url: "https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/evenements",
    why: "pertinent pour rencontrer des recruteurs, forums, job datings et réunions d’information."
  },
  metierscope: {
    label: "MétierScope",
    url: "https://candidat.francetravail.fr/metierscope/",
    why: "utile pour vérifier les compétences, conditions d’accès, salaires indicatifs, marché et perspectives métier."
  },
  formations: {
    label: "Rechercher une formation",
    url: "https://candidat.francetravail.fr/formations/recherche?filtreEstFormationEnCoursOuAVenir=formEnCours&filtreEstFormationTerminee=formEnCours&range=0-9&tri=0",
    why: "à utiliser quand un écart de compétences bloque l’accès au poste."
  },
  competences: {
    label: "Faire le point sur mes compétences",
    url: "https://messervices.francetravail.fr/centre-interet/faire-le-point-sur-mes-competences",
    why: "utile pour identifier et nommer les compétences déjà acquises."
  },
  eccp: {
    label: "Évaluation des compétences et connaissances professionnelles",
    url: "https://messervices.francetravail.fr/centre-interet/eccp",
    why: "utile si la personne doit objectiver son niveau métier avant formation ou candidature."
  },
  pmsmp: {
    label: "Immersion professionnelle",
    url: "https://messervices.francetravail.fr/centre-interet/pmsmp",
    why: "adapté pour confirmer un métier en situation réelle avant formation ou candidature."
  },
  ateliers: {
    label: "Ateliers France Travail",
    url: "https://www.francetravail.fr/candidat/les-ateliers-francetravail.html",
    why: "utile quand le besoin doit être précisé ou travaillé avec un format court."
  },
  activProjet: {
    label: "Activ’Projet",
    url: "https://messervices.francetravail.fr/centre-interet/activprojet",
    why: "adapté quand le projet est flou ou qu’une reconversion doit être clarifiée."
  },
  activCrea: {
    label: "Activ’créa",
    url: "https://messervices.francetravail.fr/centre-interet/activ-crea",
    why: "à proposer pour vérifier une idée de création ou reprise d’entreprise."
  },
  international: {
    label: "Activ’international",
    url: "https://messervices.francetravail.fr/centre-interet/activinternational",
    why: "utile pour structurer une recherche d’emploi à l’étranger."
  }
};

function chooseRelevantServices(intent, apiContext, entities = {}) {
  return selectBestLinks(intent, apiContext)
    .map(link => ({
      label: link.label,
      url: link.url,
      why: link.why || link.description || "service utile pour passer à l’action."
    }))
    .slice(0, 2);
}

function dedupeServices(services) {
  const seen = new Set();
  return services.filter(s => {
    if (!s?.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}


function buildRecommendations(analysis, apiContext) {
  const recs = [];
  if (analysis.intent === "confiance") recs.push("Commencer par Valoriser son Image professionnelle avant un job dating.");
  if (analysis.intent === "competences") recs.push("Comparer les compétences attendues avec les acquis avant de chercher une formation.");
  if (apiContext.offres.ok && apiContext.offres.count > 0) recs.push("Utiliser les offres trouvées pour adapter le CV aux mots-clés réels.");
  if (apiContext.events.ok && apiContext.events.count > 0) recs.push("Préparer une présentation courte avant inscription à un événement.");
  if (apiContext.formations.ok && apiContext.formations.count > 0) recs.push("Vérifier les prérequis et le financement avant prescription formation.");
  return recs.slice(0, 5);
}

function ensureAdvisorCompleteness(reply, context) {
  const { ville, analysis, entities, apiContext } = context;
  const text = stripForbiddenTextSections(stripUrlsAndMarkdownLinks(String(reply || "").trim()));
  const requiredMarkers = ["Résumé du besoin détecté", "Parcours conseillé", "Action prioritaire"];
  const hasConcreteData = Boolean(apiContext?.events?.items?.length || apiContext?.offres?.items?.length || apiContext?.formations?.items?.length);

  if (requiredMarkers.every(marker => text.includes(marker)) && !hasConcreteData) {
    return text;
  }

  return buildFallbackReply({
    message: context.message || "",
    ville,
    analysis,
    entities,
    plan: context.plan || [],
    apiContext
  });
}

function stripUrlsAndMarkdownLinks(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function stripForbiddenTextSections(value) {
  return String(value || "")
    .replace(/\n+Services utiles[\s\S]*$/i, "")
    .replace(/\n+Services France Travail pertinents[\s\S]*$/i, "")
    .replace(/\n+Voici les services pertinents[\s\S]*$/i, "")
    .trim();
}

function buildConcreteOffersSection(apiContext, entities, ville) {
  const offres = apiContext?.offres?.items || [];
  const metier = entities.metier || entities.keywords || "ce métier";

  if (!apiContext?.offres || apiContext.offres.skipped) {
    return `Point emploi : les offres ne sont pas disponibles dans cette configuration. Le chemin logique est de cibler ${metier} autour de ${ville}, puis de contacter les entreprises utiles.`;
  }

  if (!offres.length) {
    return `Point emploi : aucune offre exploitable n’est remontée dans le rayon actuel pour ${metier} autour de ${ville}. Le chemin logique est d’élargir le rayon, puis de cibler les entreprises qui peuvent recruter.`;
  }

  const lines = ["Quelques offres repérées :"];
  for (const offre of offres.slice(0, 3)) {
    const bits = [offre.entreprise, offre.lieu, offre.typeContrat, offre.salaire].filter(Boolean).join(" — ");
    lines.push(`- ${offre.titre || "Offre"}${bits ? ` : ${bits}` : ""}`);
  }
  return lines.join("\n");
}

function buildMarketVerdict(apiContext, entities, ville) {
  const metier = entities.metier || entities.keywords || "ce métier";
  const nbOffres = apiContext?.offres?.items?.length || 0;
  const nbEntreprises = apiContext?.bonneBoite?.items?.length || 0;
  const salaries = extractSalaryTexts(apiContext?.offres?.items || []);

  let verdict;
  if (nbOffres >= 5) verdict = "plutôt favorable à court terme";
  else if (nbOffres >= 1) verdict = "possible, mais avec ciblage serré";
  else if (nbEntreprises >= 3) verdict = "marché caché à travailler en priorité";
  else verdict = "incertain sur le rayon actuel";

  const lines = [`Lecture marché local : pour ${metier} autour de ${ville}, le signal est ${verdict}.`];
  if (nbOffres) lines.push(`${nbOffres} offre(s) exploitable(s) sont remontées par l’API.`);
  if (nbEntreprises) lines.push(`${nbEntreprises} entreprise(s) ou résultat(s) La Bonne Boîte sont disponibles pour cibler le marché caché.`);
  if (salaries.length) lines.push(`Salaire indiqué dans les offres trouvées : ${salaries.slice(0, 3).join(" ; ")}.`);
  else lines.push("Salaire : aucune rémunération fiable n’est remontée dans les offres exploitées. Il faut vérifier dans les offres et sur MétierScope plutôt que donner un chiffre inventé.");
  return lines.join(" ");
}

function extractSalaryTexts(items) {
  const values = [];
  for (const item of items || []) {
    const s = String(item.salaire || "").trim();
    if (s && !values.includes(s)) values.push(s);
  }
  return values;
}

/* =========================================================
   COMPACTAGE CONTEXTE
========================================================= */

function compactApiContextForLLM(ctx) {
  const pick = result => ({
    ok: result.ok,
    skipped: result.skipped,
    status: result.status,
    count: result.count,
    summary: result.summary,
    error: result.ok ? "" : result.error,
    items: (result.items || []).slice(0, 5)
  });

  return {
    meta: ctx.meta,
    offres: pick(ctx.offres),
    events: pick(ctx.events),
    formations: pick(ctx.formations),
    marcheTravail: pick(ctx.marcheTravail),
    bonneBoite: pick(ctx.bonneBoite),
    agences: pick(ctx.agences),
    cadreVie: pick(ctx.cadreVie),
    romeMetiers: pick(ctx.romeMetiers),
    romeCompetences: pick(ctx.romeCompetences),
    romeFiches: pick(ctx.romeFiches),
    romeContextes: pick(ctx.romeContextes),
    romeo: pick(ctx.romeo),
    accesEmploi: pick(ctx.accesEmploi)
  };
}

function summarizeApiContextForFrontend(ctx) {
  return compactApiContextForLLM(ctx);
}

function summarizeGenericItems(name, items) {
  if (!items?.length) return `Aucun résultat exploitable pour ${name}.`;
  return `${items.length} résultat(s) exploitable(s) pour ${name}.`;
}

function summarizeOffres(items) {
  if (!items?.length) return "Aucune offre exploitable.";
  const examples = items.slice(0, 3).map(x => x.titre).filter(Boolean).join(" ; ");
  return `${items.length} offre(s) exploitable(s). Exemples : ${examples}`;
}

function summarizeFormations(items) {
  if (!items?.length) return "Aucune formation exploitable.";
  const examples = items.slice(0, 3).map(x => x.titre).filter(Boolean).join(" ; ");
  return `${items.length} formation(s) exploitable(s). Exemples : ${examples}`;
}

function summarizeEvents(items) {
  if (!items?.length) return "Aucun événement exploitable.";
  const examples = items.slice(0, 3).map(x => x.titre).filter(Boolean).join(" ; ");
  return `${items.length} événement(s) exploitable(s). Exemples : ${examples}`;
}


/* =========================================================
   DIAGNOSTIC OPÉRATIONNEL
========================================================= */

async function buildFullDiagnostic(env, { ville = DEFAULT_CITY, sampleMessage = "Je cherche un travail de boulanger à Issy-les-Moulineaux", live = false } = {}) {
  const samples = [
    sampleMessage,
    "Je veux devenir assistant administratif mais je manque de compétences",
    "Je manque de confiance en entretien",
    "Je cherche une formation CACES autour de moi",
    "Je veux tester le métier de boulanger en immersion",
    "Je veux rencontrer des recruteurs la semaine prochaine"
  ];

  const localTests = samples.map(message => {
    const analysis = analyzeLocal(message, ville);
    const entities = extractEntities(message, ville);
    const plan = buildApiPlan(analysis, entities, message);
    return {
      message,
      intent: analysis.intent,
      confidence: analysis.confidence,
      metier: entities.metier,
      keywords: entities.keywords,
      ville: entities.ville,
      period: entities.period,
      plan,
      endpoint_status: endpointStatus(env, plan),
      scope_status: scopeStatus(env, plan),
      services: chooseRelevantServices(analysis.intent, emptyApiContext(), entities).slice(0, 2)
    };
  });

  let liveRun = null;
  if (live) {
    const message = sampleMessage;
    const analysis = analyzeLocal(message, ville);
    const entities = extractEntities(message, ville);
    const plan = buildApiPlan(analysis, entities, message);
    const apiContext = await buildApiContext(env, { message, ville, analysis, entities, plan });
    liveRun = {
      message,
      ville,
      analysis,
      entities,
      plan,
      apiContext: summarizeApiContextForFrontend(apiContext),
      diagnostic: buildOperationalDiagnostic(env, { message, ville, analysis, entities, plan, apiContext }),
      officialLinks: buildOfficialLinks(analysis.intent, apiContext),
      services: chooseRelevantServices(analysis.intent, apiContext, entities).slice(0, 2)
    };
  }

  return {
    ok: true,
    mode: WORKER_MODE,
    service: "assistant-frai-api",
    readiness: computeReadiness(env),
    configuration: {
      llm: {
        gemini: Boolean(env.GEMINI_API_KEY),
        openai: Boolean(env.OPENAI_API_KEY),
        gemini_model: env.GEMINI_MODEL || "gemini-2.5-flash-lite",
        openai_model: env.OPENAI_MODEL || "gpt-4.1-mini"
      },
      france_travail: {
        client_id_detected: Boolean(env.FRANCE_TRAVAIL_CLIENT_ID || env.FT_CLIENT_ID || env.CLIENT_ID),
        client_secret_detected: Boolean(env.FRANCE_TRAVAIL_CLIENT_SECRET || env.FT_CLIENT_SECRET || env.CLIENT_SECRET),
        scope_detected: Boolean(env.FRANCE_TRAVAIL_SCOPE || env.FT_SCOPE),
        configured_optional_endpoints: configuredOptionalEndpoints(env),
        configured_scopes: configuredScopes(env)
      },
      endpoints: PUBLIC_ENDPOINTS
    },
    functional_matrix: buildFunctionalMatrix(env),
    local_tests: localTests,
    live_run: liveRun,
    synthesis: buildApplicationSynthesis(env)
  };
}

function computeReadiness(env) {
  const endpoints = configuredOptionalEndpoints(env);
  const scopes = configuredScopes(env);
  const critical = {
    worker: true,
    gemini: Boolean(env.GEMINI_API_KEY),
    ftCredentials: Boolean((env.FRANCE_TRAVAIL_CLIENT_ID || env.FT_CLIENT_ID || env.CLIENT_ID) && (env.FRANCE_TRAVAIL_CLIENT_SECRET || env.FT_CLIENT_SECRET || env.CLIENT_SECRET)),
    offres: Boolean(endpoints.offres && scopes.offres),
    events: Boolean(endpoints.events && scopes.events),
    formations: Boolean(endpoints.formations && scopes.formations),
    marcheTravail: Boolean(endpoints.marcheTravail && scopes.marcheTravail),
    bonneBoite: Boolean(endpoints.bonneBoite && scopes.bonneBoite),
    romeMetiers: Boolean(endpoints.romeMetiers && scopes.romeMetiers),
    romeCompetences: Boolean(endpoints.romeCompetences && scopes.romeCompetences)
  };

  const values = Object.values(critical);
  const score = Math.round(values.filter(Boolean).length / values.length * 100);
  return { score, critical, status: score >= 85 ? "prêt pour test utilisateur" : score >= 65 ? "utilisable mais incomplet" : "configuration insuffisante" };
}

function buildFunctionalMatrix(env) {
  const endpoints = configuredOptionalEndpoints(env);
  return [
    { besoin: "Recherche d’emploi directe", exemples: ["Je cherche un travail de boulanger à Issy-les-Moulineaux"], intent: "recherche_emploi", api: ["offres", "bonneBoite", "marcheTravail", "romeMetiers"], services: ["Offres", "La Bonne Boîte", "Un Emploi Stable", "Mes services — Trouver"], status: endpoints.offres ? "opérationnel à tester en live" : "bloqué : offres non configuré" },
    { besoin: "Écart de compétences", exemples: ["Je veux devenir assistant administratif mais je manque de compétences"], intent: "competences", api: ["ROME métiers", "ROME compétences", "formations", "marché du travail"], services: ["Faire le point sur mes compétences", "ECCP", "Formation", "PMSMP", "MétierScope"], status: endpoints.romeMetiers && endpoints.romeCompetences ? "opérationnel" : "partiel" },
    { besoin: "Formation", exemples: ["Je cherche une formation CACES"], intent: "formation", api: ["formations", "offres", "marché du travail", "ROME compétences"], services: ["Formation", "Prépa Compétences", "POE/POEI si employeur"], status: endpoints.formations ? "opérationnel à tester en live" : "bloqué : formations non configuré" },
    { besoin: "Confiance / image pro", exemples: ["Je manque de confiance en entretien"], intent: "confiance", api: [], services: ["Valoriser son Image professionnelle", "Convaincre en entretien"], status: "opérationnel sans API" },
    { besoin: "Projet flou / reconversion", exemples: ["Je ne sais pas quel métier choisir"], intent: "activ_projet", api: ["ROME", "marché du travail", "formations", "ROMEO si configuré"], services: ["Activ’Projet", "PMSMP", "MétierScope"], status: endpoints.romeMetiers ? "opérationnel partiel" : "partiel" },
    { besoin: "Immersion / PMSMP", exemples: ["Je veux tester le métier de boulanger"], intent: "pmsmp", api: ["ROME", "La Bonne Boîte"], services: ["PMSMP", "Immersion facilitée", "Activ’Projet"], status: endpoints.bonneBoite ? "opérationnel" : "partiel" },
    { besoin: "Événements / job dating", exemples: ["Je veux rencontrer des recruteurs la semaine prochaine"], intent: "events", api: ["Mes Événements Emploi"], services: ["Mes Événements Emploi"], status: endpoints.events ? "opérationnel à tester en live" : "bloqué : événements non configuré" },
    { besoin: "Territoire / agence", exemples: ["Quels services autour de ma ville ?"], intent: "territoire", api: ["agences", "cadre de vie", "marché du travail"], services: ["Agence France Travail", "Services Trouver"], status: endpoints.agences || endpoints.cadreVie ? "partiel" : "non configuré" }
  ];
}

function buildOperationalDiagnostic(env, { message, ville, analysis, entities, plan, apiContext }) {
  const problems = [];
  const strengths = [];

  if (!env.GEMINI_API_KEY) problems.push("Gemini non configuré : réponse possible en moteur local, mais moins qualitative.");
  else strengths.push("Gemini configuré pour rédiger une réponse conseiller.");

  if (!((env.FRANCE_TRAVAIL_CLIENT_ID || env.FT_CLIENT_ID || env.CLIENT_ID) && (env.FRANCE_TRAVAIL_CLIENT_SECRET || env.FT_CLIENT_SECRET || env.CLIENT_SECRET))) {
    problems.push("Identifiants France Travail manquants : les API officielles ne pourront pas être appelées.");
  } else {
    strengths.push("Identifiants France Travail détectés.");
  }

  for (const apiName of plan || []) {
    const result = apiContext?.[apiName];
    if (!result) continue;
    if (result.ok) strengths.push(`${apiName} : ${result.count || 0} résultat(s), statut ${result.status}.`);
    else if (result.skipped) problems.push(`${apiName} : non appelé ou endpoint manquant. ${result.error || result.summary || ""}`.trim());
    else problems.push(`${apiName} : erreur statut ${result.status || 0}. ${result.error || result.summary || ""}`.trim());
  }

  return {
    message,
    ville,
    intent: analysis.intent,
    metier: entities.metier,
    plan,
    strengths,
    problems,
    advisor_verdict: buildAdvisorVerdict({ analysis, entities, apiContext, ville })
  };
}

function buildAdvisorVerdict({ analysis, entities, apiContext, ville }) {
  if (analysis.intent === "recherche_emploi") {
    const offres = apiContext?.offres?.count || 0;
    const bonneBoite = apiContext?.bonneBoite?.count || 0;
    if (offres > 0) return `Priorité : exploiter les ${offres} offre(s) remontée(s), adapter le CV aux exigences récurrentes, puis compléter par La Bonne Boîte autour de ${ville}.`;
    if (bonneBoite > 0) return `Peu ou pas d’offres directes : priorité au marché caché avec La Bonne Boîte et candidatures ciblées autour de ${ville}.`;
    return `Aucun signal exploitable dans les données appelées : élargir le rayon, vérifier les intitulés proches et utiliser MétierScope/offres pour recalibrer la recherche.`;
  }
  if (analysis.intent === "competences") return "Priorité : comparer compétences attendues / compétences détenues, puis seulement prescrire formation, PMSMP ou ECCP.";
  if (analysis.intent === "formation") return "Priorité : vérifier le métier cible, les prérequis, les dates, le financement et l’existence d’offres liées avant formation.";
  if (analysis.intent === "confiance") return "Priorité : Valoriser son Image professionnelle puis entraînement entretien avec preuves concrètes.";
  return "Priorité : choisir la prochaine action utile, pas empiler des liens.";
}

function buildApplicationSynthesis(env) {
  const readiness = computeReadiness(env);
  return {
    niveau: readiness.status,
    ce_que_l_application_sait_faire: [
      "Analyser une demande en langage naturel et reconnaître le besoin principal.",
      "Choisir les API utiles au lieu de tout appeler sans logique.",
      "Remonter des offres réelles quand la demande porte sur un emploi concret.",
      "Lire le marché local avec offres, marché du travail, La Bonne Boîte et données métier disponibles.",
      "Proposer les services France Travail pertinents, avec liens cliquables.",
      "Construire un parcours conseiller en étapes : diagnostic, action immédiate, service adapté, question d’affinage."
    ],
    limites_actuelles: [
      "MétierScope n’a pas d’API configurée : l’application peut proposer le lien et reconstruire une estimation via offres + ROME + marché, mais ne doit pas prétendre interroger MétierScope directement.",
      "Les API optionnelles non configurées restent partielles : agences, cadre de vie, accès emploi, ROMEO, ROME fiches/contextes selon le /health.",
      "Les salaires ne doivent être affichés que s’ils remontent des offres ou d’une donnée officielle disponible."
    ]
  };
}

/* =========================================================
   STATUS & CONFIG
========================================================= */

function endpointStatus(env, plan) {
  const map = {
    offres: env.FT_OFFRES_URL || DEFAULT_ENDPOINTS.offres,
    events: env.FT_EVENTS_URL || env.FRANCE_TRAVAIL_EVENTS_API_URL || DEFAULT_ENDPOINTS.events,
    formations: env.FT_FORMATIONS_URL || DEFAULT_ENDPOINTS.formations,
    marcheTravail: env.FT_MARCHE_TRAVAIL_URL || DEFAULT_ENDPOINTS.marcheTravail,
    accesEmploi: env.FT_ACCES_EMPLOI_URL || DEFAULT_ENDPOINTS.accesEmploi,
    agences: env.FT_AGENCES_URL || DEFAULT_ENDPOINTS.agences,
    cadreVie: env.FT_CADRE_VIE_URL || DEFAULT_ENDPOINTS.cadreVie,
    bonneBoite: env.FT_BONNE_BOITE_URL || DEFAULT_ENDPOINTS.bonneBoite,
    romeo: env.FT_ROMEO_URL || DEFAULT_ENDPOINTS.romeo,
    romeMetiers: env.FT_ROME_METIERS_URL || DEFAULT_ENDPOINTS.romeMetiers,
    romeCompetences: env.FT_ROME_COMPETENCES_URL || DEFAULT_ENDPOINTS.romeCompetences,
    romeFiches: env.FT_ROME_FICHES_URL || DEFAULT_ENDPOINTS.romeFiches,
    romeContextes: env.FT_ROME_CONTEXTES_URL || DEFAULT_ENDPOINTS.romeContextes
  };

  const status = {};
  for (const name of plan) status[name] = Boolean(map[name]);
  return status;
}

function configuredOptionalEndpoints(env) {
  return {
    offres: Boolean(env.FT_OFFRES_URL || DEFAULT_ENDPOINTS.offres),
    events: Boolean(env.FT_EVENTS_URL || env.FRANCE_TRAVAIL_EVENTS_API_URL || DEFAULT_ENDPOINTS.events),
    formations: Boolean(env.FT_FORMATIONS_URL),
    marcheTravail: Boolean(env.FT_MARCHE_TRAVAIL_URL),
    accesEmploi: Boolean(env.FT_ACCES_EMPLOI_URL),
    agences: Boolean(env.FT_AGENCES_URL),
    cadreVie: Boolean(env.FT_CADRE_VIE_URL),
    bonneBoite: Boolean(env.FT_BONNE_BOITE_URL),
    romeo: Boolean(env.FT_ROMEO_URL),
    romeMetiers: Boolean(env.FT_ROME_METIERS_URL),
    romeCompetences: Boolean(env.FT_ROME_COMPETENCES_URL),
    romeFiches: Boolean(env.FT_ROME_FICHES_URL),
    romeContextes: Boolean(env.FT_ROME_CONTEXTES_URL)
  };
}

function configuredScopes(env) {
  const globalScope = env.FRANCE_TRAVAIL_SCOPE || env.FT_SCOPE || "";
  return {
    global: Boolean(globalScope),
    global_scope_preview: safeScopePreview(globalScope),
    offres: Boolean(env.FT_SCOPE_OFFRES || globalScope),
    events: Boolean(env.FT_SCOPE_EVENTS || env.FT_SCOPE_EVENEMENTS || globalScope),
    formations: Boolean(env.FT_SCOPE_FORMATIONS || globalScope),
    marcheTravail: Boolean(env.FT_SCOPE_MARCHE_TRAVAIL || globalScope),
    accesEmploi: Boolean(env.FT_SCOPE_ACCES_EMPLOI || globalScope),
    agences: Boolean(env.FT_SCOPE_AGENCES || globalScope),
    cadreVie: Boolean(env.FT_SCOPE_CADRE_VIE || globalScope),
    bonneBoite: Boolean(env.FT_SCOPE_BONNE_BOITE || globalScope),
    romeo: Boolean(env.FT_SCOPE_ROMEO || globalScope),
    romeMetiers: Boolean(env.FT_SCOPE_ROME_METIERS || globalScope),
    romeCompetences: Boolean(env.FT_SCOPE_ROME_COMPETENCES || globalScope),
    romeFiches: Boolean(env.FT_SCOPE_ROME_FICHES || globalScope),
    romeContextes: Boolean(env.FT_SCOPE_ROME_CONTEXTES || globalScope)
  };
}

function scopeStatus(env, plan) {
  const status = {};
  for (const apiName of plan) {
    const scope = scopeForApi(env, apiName);
    status[apiName] = {
      configured: Boolean(scope),
      scope_preview: safeScopePreview(scope)
    };
  }
  return status;
}

function safeScopePreview(scope) {
  const value = String(scope || "").trim();
  if (!value) return "";
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length <= 6) return value;
  return `${parts.slice(0, 6).join(" ")} … +${parts.length - 6}`;
}


/* =========================================================
   DATES / VILLES
========================================================= */

function parsePeriod(input) {
  const raw = String(input || "");
  const text = normalize(raw);
  const now = new Date();

  const months = [
    ["janvier", 0],
    ["fevrier", 1],
    ["février", 1],
    ["mars", 2],
    ["avril", 3],
    ["mai", 4],
    ["juin", 5],
    ["juillet", 6],
    ["aout", 7],
    ["août", 7],
    ["septembre", 8],
    ["octobre", 9],
    ["novembre", 10],
    ["decembre", 11],
    ["décembre", 11]
  ];

  let monthIndex = null;
  let explicit = false;

  for (const [name, index] of months) {
    const month = normalize(name);

    // Mot entier uniquement : "mai" est accepté, "mais" est ignoré.
    const regex = new RegExp(`\\b${escapeRegExp(month)}\\b`, "i");

    if (regex.test(text)) {
      monthIndex = index;
      explicit = true;
      break;
    }
  }

  const yearMatch = text.match(/\b(20\d{2})\b/);
  let year = yearMatch ? Number(yearMatch[1]) : now.getUTCFullYear();

  if (monthIndex !== null) {
    if (!yearMatch && monthIndex < now.getUTCMonth()) year += 1;

    const dateDebut = `${year}-${pad(monthIndex + 1)}-01`;
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const dateFin = `${year}-${pad(monthIndex + 1)}-${pad(lastDay)}`;

    return {
      explicit,
      dateDebut,
      dateFin,
      label: `${monthName(monthIndex)} ${year}`
    };
  }

  const start = now;
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    explicit: false,
    dateDebut: toDate(start),
    dateFin: toDate(end),
    label: `30 prochains jours`
  };
}

function isExplicitEventRequest(input) {
  const text = normalize(input || "");
  return hasAny(text, [
    "evenement", "événement", "agenda", "job dating", "forum", "salon", "reunion d'information",
    "réunion d'information", "rencontrer un recruteur", "rencontrer des recruteurs", "rencontrer des employeurs",
    "inscription", "s'inscrire", "m'inscrire", "autour de moi", "près de moi", "pres de moi",
    "dans ma ville", "atelier date", "atelier daté"
  ]) || parsePeriod(input).explicit;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function geocodeCity(ville) {
  const known = {
    "france": { latitude: null, longitude: null, codeInsee: "", national: true },
    "toute-la-france": { latitude: null, longitude: null, codeInsee: "", national: true },
    "issy-les-moulineaux": { latitude: 48.8245, longitude: 2.2743, codeInsee: "92040" },
    "boulogne-billancourt": { latitude: 48.8397, longitude: 2.2399, codeInsee: "92012" },
    "paris": { latitude: 48.8566, longitude: 2.3522, codeInsee: "75056" },
    "vanves": { latitude: 48.821, longitude: 2.289, codeInsee: "92075" },
    "meudon": { latitude: 48.812, longitude: 2.238, codeInsee: "92048" },
    "clamart": { latitude: 48.799, longitude: 2.266, codeInsee: "92023" },
    "nanterre": { latitude: 48.8924, longitude: 2.2153, codeInsee: "92050" },
    "cachan": { latitude: 48.7904, longitude: 2.3345, codeInsee: "94016" }
  };

  const key = normalize(ville).replace(/\s+/g, "-");
  if (known[key]) return known[key];

  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(ville)}&limit=1`;
    const response = await fetchWithTimeout(url, {}, 5000);
    const data = await response.json();
    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (coords && coords.length >= 2) {
      return { longitude: coords[0], latitude: coords[1], codeInsee: feature.properties?.citycode || "" };
    }
  } catch (_) {}

  return { latitude: 48.8245, longitude: 2.2743, codeInsee: "92040" };
}

function formatZonePhrase(ville) {
  if (isNationalSearch(ville) || normalize(ville) === "france") return "en France";
  return `autour de ${ville || DEFAULT_CITY}`;
}

function formatZoneAction(ville) {
  if (isNationalSearch(ville) || normalize(ville) === "france") return "en France";
  return `autour de ${ville || DEFAULT_CITY}`;
}

function isNationalSearch(input) {
  const text = normalize(input || "");
  return hasAny(text, ["en france", "toute la france", "partout en france", "national", "nationalement"]);
}

function extractCity(text) {
  const raw = String(text || "");
  const match = raw.match(/\b(?:à|a|sur|près de|proche de|autour de)\s+([A-ZÉÈÀÂÎÏÔÛÇ][A-Za-zÉÈÀÂÎÏÔÛÇéèàâîïôûç\- ]{2,60}?)(?=\s+(?:en|pour|avec|qui|et|du|de|au|aux|trouve|cherche)\b|[,.?!]|$)/);
  if (!match) return "";
  return match[1]
    .replace(/\s+en\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre).*$/i, "")
    .trim();
}

/* =========================================================
   OUTILS
========================================================= */

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hasAny(text, words) {
  const t = normalize(text);
  return words.some(w => t.includes(normalize(w)));
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function cleanText(text) {
  return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text, max) {
  const s = String(text || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch (_) { return null; }
}

function pad(n) { return String(n).padStart(2, "0"); }

function toDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function monthName(index) {
  return ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][index];
}

function formatShortDate(date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDate(date) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("fr-FR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  } catch { return String(date); }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
