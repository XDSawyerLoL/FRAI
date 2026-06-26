// Assistant France Travail — Agent cloud Cloudflare Worker
// Déploiement gratuit possible sur Cloudflare Workers Free.
// Secrets recommandés dans Cloudflare : OPENAI_API_KEY, FT_CLIENT_ID, FT_CLIENT_SECRET, FT_SCOPE, FT_MEE_SEARCH_URL, FT_FORMATION_SEARCH_URL.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname === "/health") return json({ ok: true, service: "assistant-france-travail-cloud-agent" });
    if (url.pathname === "/api/agent" && request.method === "POST") {
      try {
        const body = await request.json();
        const result = await handleAgent(body, env);
        return json(result);
      } catch (e) {
        return json({ ok: false, reply: "L’agent cloud a rencontré une erreur technique.", error: String(e?.message || e) }, 500);
      }
    }
    return json({ ok: true, endpoints: ["POST /api/agent", "GET /health"] });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
}

async function handleAgent(body, env) {
  const message = String(body.message || "").trim();
  const city = extractCity(message) || String(body.city || env.DEFAULT_CITY || "").trim();
  const job = extractJob(message);
  const intent = detectIntent(message);
  const model = body.model || env.OPENAI_MODEL || "gpt-4.1-mini";
  const openaiKey = env.OPENAI_API_KEY || body.openaiKey || "";

  const output = {
    ok: true,
    intent,
    city,
    job,
    sourceMode: [],
    events: [],
    formations: [],
    recommendations: [],
    officialLinks: officialLinks(city, job),
    reply: ""
  };

  // Mémorisation simple de ville côté client : le frontend s'en charge, ici on répond clairement.
  if (/\b(ma\s+ville\s+est|ville\s+est|j'habite\s+(à|a))\b/i.test(message) && city && intent === "general") {
    output.reply = `Ville prise en compte : ${city}. Je peux maintenant chercher les événements et formations autour de cette ville.`;
    return output;
  }

  if ((intent === "events" || intent === "both") && !city) {
    output.reply = "Pour chercher les événements emploi, j’ai besoin d’une ville ou d’un département. Exemple : “Événements emploi à Boulogne-Billancourt”.";
    return output;
  }

  if (intent === "events" || intent === "both") {
    const events = await searchEvents({ city, job, message, env, openaiKey, model });
    output.events = events.items;
    output.sourceMode.push(events.mode);
  }

  if (intent === "training" || intent === "both") {
    const formations = await searchFormations({ city, job, message, env, openaiKey, model });
    output.formations = formations.items;
    output.sourceMode.push(formations.mode);
  }

  if (intent === "general") {
    output.recommendations = localRecommendations(message, city, job);
    output.sourceMode.push("base_locale");
  }

  output.reply = buildReply(output, message);

  // Reformulation ChatGPT facultative : uniquement si OpenAI est disponible.
  if (openaiKey && env.OPENAI_REWRITE !== "false") {
    try {
      const rewritten = await rewriteWithOpenAI({ openaiKey, model, message, output });
      if (rewritten) output.reply = rewritten;
      output.sourceMode.push("openai_rewrite");
    } catch (_) {}
  }

  return output;
}

function detectIntent(s) {
  const t = norm(s);
  const hasEvent = /(evenement|événement|evennement|agenda|forum|job dating|salon|rencontre|reunion d information|réunion d information|que se passe)/i.test(t);
  const hasTraining = /(formation|se former|financement|financee|financée|region|région|cpf|afpr|poe|preparation operationnelle|préparation opérationnelle)/i.test(t);
  if (hasEvent && hasTraining) return "both";
  if (hasEvent) return "events";
  if (hasTraining) return "training";
  return "general";
}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function extractCity(s) {
  const raw = String(s||"");
  const patterns = [
    /(?:ma ville est|ville est|j'habite à|j'habite a|autour de|près de|pres de|à|a|sur)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ' -]{2,60})/i,
    /(?:dans ma ville|ma ville)/i
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m && m[1]) return cleanText(m[1]);
  }
  return "";
}
function extractJob(s) {
  const raw = String(s||"");
  const known = ["agent administratif", "assistante administrative", "secrétaire", "comptable", "développeur", "vendeur", "hôte de caisse", "conseiller clientèle", "product owner"];
  const low = norm(raw);
  for (const k of known) if (low.includes(norm(k))) return k;
  const patterns = [/je suis\s+([^,.;!?]{3,50})/i, /métier\s+([^,.;!?]{3,50})/i, /metier\s+([^,.;!?]{3,50})/i, /formation\s+([^,.;!?]{3,50})/i];
  for (const p of patterns) { const m = raw.match(p); if (m) return cleanText(m[1]); }
  return "";
}
function cleanText(s){return String(s||"").trim().replace(/[.?!,;:]+$/g,"").replace(/\s+/g," ");}

async function searchEvents({ city, job, message, env, openaiKey, model }) {
  // 1) API France Travail officielle/configurable si credentials et endpoint sont fournis.
  if (env.FT_MEE_SEARCH_URL && (env.FT_CLIENT_ID && env.FT_CLIENT_SECRET || env.FT_BEARER_TOKEN)) {
    try {
      const data = await callFranceTravailApi(env.FT_MEE_SEARCH_URL, { city, query: job || message, range: "0-9" }, env);
      const items = mapGenericItems(data, "event");
      if (items.length) return { mode: "api_france_travail_evenements", items };
    } catch (e) {}
  }

  // 2) Recherche web OpenAI, utile quand l’API officielle n’est pas branchée.
  if (openaiKey) {
    try {
      const items = await openAIWebSearch(openaiKey, model, buildEventSearchPrompt(city, job, message), "events");
      if (items.length) return { mode: "openai_web_search_officiel", items };
    } catch (e) {}
  }

  // 3) Fallback honnête : pas d'invention, lien officiel.
  return { mode: "lien_officiel", items: [] };
}

async function searchFormations({ city, job, message, env, openaiKey, model }) {
  if (env.FT_FORMATION_SEARCH_URL && (env.FT_CLIENT_ID && env.FT_CLIENT_SECRET || env.FT_BEARER_TOKEN)) {
    try {
      const data = await callFranceTravailApi(env.FT_FORMATION_SEARCH_URL, { city, query: job || message, range: "0-9" }, env);
      const items = mapGenericItems(data, "training");
      if (items.length) return { mode: "api_france_travail_formations", items };
    } catch (e) {}
  }

  if (openaiKey) {
    try {
      const items = await openAIWebSearch(openaiKey, model, buildTrainingSearchPrompt(city, job, message), "formations");
      if (items.length) return { mode: "openai_web_search_officiel", items };
    } catch (e) {}
  }

  return { mode: "lien_officiel", items: [] };
}

async function callFranceTravailApi(template, params, env) {
  const token = env.FT_BEARER_TOKEN || await getFTToken(env);
  let url = template;
  for (const [k,v] of Object.entries(params)) url = url.replaceAll(`{${k}}`, encodeURIComponent(v || ""));
  const r = await fetch(url, { headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" } });
  if (!r.ok) throw new Error(`API France Travail ${r.status}`);
  return await r.json();
}

let cachedToken = null;
async function getFTToken(env) {
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 30000) return cachedToken.token;
  const tokenUrl = env.FT_OAUTH_TOKEN_URL || "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire";
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  if (env.FT_SCOPE) body.set("scope", env.FT_SCOPE);
  const basic = btoa(`${env.FT_CLIENT_ID}:${env.FT_CLIENT_SECRET}`);
  const r = await fetch(tokenUrl, { method: "POST", headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`OAuth France Travail ${r.status}`);
  const data = await r.json();
  cachedToken = { token: data.access_token, exp: Date.now() + ((data.expires_in || 1200) * 1000) };
  return cachedToken.token;
}

function mapGenericItems(data, kind) {
  const arr = Array.isArray(data) ? data : data?.resultats || data?.results || data?.items || data?.content || data?.evenements || data?.formations || [];
  return arr.slice(0, 8).map(x => ({
    title: x.titre || x.title || x.intitule || x.nom || x.name || (kind === "event" ? "Événement emploi" : "Formation"),
    date: x.date || x.dateDebut || x.startDate || x.start || x.periode || "",
    city: x.ville || x.city || x.commune || x.lieu?.ville || "",
    location: x.lieu || x.address || x.adresse || x.organisme || x.place || "",
    modality: x.modalite || x.modality || x.type || "",
    funding: x.financement || x.financeur || x.funding || "",
    description: x.description || x.resume || x.summary || x.objectif || x.contenu || "",
    url: x.url || x.lien || x.link || x.permalink || x.ficheUrl || ""
  })).filter(x => x.title);
}

function buildEventSearchPrompt(city, job, message) {
  return `Tu es un agent de recherche pour un conseiller France Travail. Recherche uniquement sur des sources officielles, en priorité mesevenementsemploi.francetravail.fr et francetravail.fr. Demande utilisateur: ${message}. Ville: ${city || "non précisée"}. Métier/secteur: ${job || "non précisé"}. Retourne au maximum 5 événements emploi actuels ou à venir. Ne fabrique rien. Réponds uniquement en JSON strict sous la forme {"items":[{"title":"","date":"","city":"","location":"","modality":"","description":"","url":""}]}. Si tu ne trouves pas de fiche vérifiable, retourne {"items":[]}.`;
}
function buildTrainingSearchPrompt(city, job, message) {
  return `Tu es un agent de recherche pour un conseiller France Travail. Recherche uniquement sur des sources officielles, en priorité candidat.francetravail.fr/formations/recherche et francetravail.fr. Demande utilisateur: ${message}. Ville: ${city || "non précisée"}. Métier/secteur: ${job || "agent administratif si implicite"}. Besoin: financement Région ou France Travail si mentionné. Retourne au maximum 5 formations actuelles ou à venir avec financements visibles si possible. Ne fabrique rien. Réponds uniquement en JSON strict sous la forme {"items":[{"title":"","date":"","city":"","location":"","funding":"","description":"","url":""}]}. Si tu ne trouves pas de fiche vérifiable, retourne {"items":[]}.`;
}

async function openAIWebSearch(openaiKey, model, prompt, key) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, tools: [{ type: "web_search" }], input: prompt })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json();
  const text = extractOpenAIText(data);
  const parsed = parseJsonFromText(text);
  const items = parsed?.items || parsed?.[key] || [];
  return Array.isArray(items) ? items.slice(0, 8).map(x => ({
    title: x.title || x.titre || "Information",
    date: x.date || "",
    city: x.city || x.ville || "",
    location: x.location || x.lieu || "",
    modality: x.modality || x.modalite || "",
    funding: x.funding || x.financement || "",
    description: x.description || x.resume || x.summary || "",
    url: x.url || x.lien || x.link || ""
  })).filter(x => x.url || x.title) : [];
}
function extractOpenAIText(data) {
  if (data.output_text) return data.output_text;
  const chunks=[];
  for (const o of data.output || []) for (const c of o.content || []) if (c.text) chunks.push(c.text);
  return chunks.join("\n");
}
function parseJsonFromText(text) {
  try { return JSON.parse(text); } catch (_) {}
  const m = String(text||"").match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}

async function rewriteWithOpenAI({ openaiKey, model, message, output }) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: `Tu es un assistant France Travail. Réponds en français, clairement, sans inventer. Demande: ${message}\nDonnées trouvées: ${JSON.stringify({ events: output.events, formations: output.formations, recommendations: output.recommendations, sourceMode: output.sourceMode })}\nRédige une réponse courte orientée action. Si aucune donnée n'est trouvée, dis que la source n'a pas renvoyé de résultat et propose le lien officiel.`
    })
  });
  if (!r.ok) return "";
  const data = await r.json();
  return extractOpenAIText(data).trim();
}

function localRecommendations(message, city, job) {
  const t=norm(message);
  const rec=[];
  if(/cv|candidature|competence|compétence/.test(t)) rec.push({kind:"Atelier",title:"R02 — Faire le point sur mes compétences professionnelles et concevoir un CV percutant",description:"Faire le point sur ses compétences et produire un CV clair, lisible et adapté au marché.",url:"https://www.francetravail.fr/candidat/les-ateliers-francetravail.html"});
  if(/immersion|tester|decouvrir un metier|découvrir un métier|pmsmp/.test(t)) rec.push({kind:"Dispositif",title:"PMSMP — Immersion professionnelle",description:"Permet de découvrir un métier ou confirmer un projet directement en entreprise.",url:"https://immersion-facile.beta.gouv.fr/"});
  if(/poe|formation avant embauche|employeur/.test(t)) rec.push({kind:"Dispositif",title:"POE — Préparation opérationnelle à l’emploi",description:"Formation avant embauche pour combler l’écart entre les compétences actuelles et celles attendues sur un poste.",url:"https://www.francetravail.fr/candidat/en-formation/mes-aides-financieres/la-preparation-operationnelle-a.html"});
  if(!rec.length) rec.push({kind:"Service",title:"La Bonne Info",description:"Base de fiches utiles à intégrer via export ou API interne si disponible.",url:"https://la-bonne-info.francetravail.net/"});
  return rec;
}

function officialLinks(city, job) {
  const q = encodeURIComponent(job || "");
  const l = encodeURIComponent(city || "");
  return [
    { label: "Mes Événements Emploi", url: "https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/evenements" },
    { label: "Recherche de formations France Travail", url: `https://candidat.francetravail.fr/formations/recherche?quoi=${q}&lieux=${l}&filtreEstFormationEnCoursOuAVenir=formEnCours&filtreEstFormationTerminee=formEnCours&range=0-9&tri=0` },
    { label: "Ateliers France Travail", url: "https://www.francetravail.fr/candidat/les-ateliers-francetravail.html" }
  ];
}

function buildReply(output, message) {
  const parts=[];
  if (output.events.length) parts.push(`J’ai trouvé ${output.events.length} événement(s) correspondant à la demande${output.city ? ` autour de ${output.city}` : ""}.`);
  if (output.formations.length) parts.push(`J’ai trouvé ${output.formations.length} formation(s) à examiner${output.job ? ` pour ${output.job}` : ""}.`);
  if (output.recommendations.length) parts.push("Voici l’orientation la plus pertinente au regard de la demande.");
  if (!parts.length) {
    if (output.intent === "events") return `Je n’ai pas reçu de résultat exploitable depuis la source événementielle pour ${output.city || "la ville demandée"}. Je te mets le lien officiel pour vérifier directement, et il faudra brancher l’API Mes Événements Emploi pour fiabiliser la recherche automatique.`;
    if (output.intent === "training") return `Je n’ai pas reçu de résultat formation exploitable depuis la source disponible. Je te mets le lien officiel de recherche formation France Travail ; pour automatiser complètement, il faut brancher l’API formation/France Travail en secret côté Worker.`;
    return "Je peux chercher les événements emploi, les formations et recommander les dispositifs adaptés. Indique une ville, un métier et le besoin exact.";
  }
  return parts.join("\n");
}
