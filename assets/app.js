const $ = (id) => document.getElementById(id);

const els = {
  messages: $('messages'),
  composer: $('composer'),
  input: $('userInput'),
  send: $('sendBtn'),
  settingsBtn: $('settingsBtn'),
  settingsDialog: $('settingsDialog'),
  importEventsBtn: $('importEventsBtn'),
  eventsFileInput: $('eventsFileInput'),
  importLbiBtn: $('importLbiBtn'),
  lbiFileInput: $('lbiFileInput'),
  defaultCity: $('defaultCityInput'),
  apiUrl: $('apiUrlInput'),
  lbiUrl: $('lbiUrlInput'),
  engine: $('engineSelect'),
  geminiKeyBlock: $('geminiKeyBlock'),
  geminiKey: $('geminiKeyInput'),
  saveSettings: $('saveSettingsBtn'),
  clearData: $('clearDataBtn'),
  status: $('statusLine'),
  eventsSourceChip: $('eventsSourceChip'),
  lbiSourceChip: $('lbiSourceChip'),
  voice: $('voiceBtn'),
  quickActions: $('quickActions'),
};

const STORAGE_KEY = 'assistant_france_travail_github_v3';
const DEFAULT_SETTINGS = {
  defaultCity: '',
  apiUrl: '',
  lbiUrl: '',
  engine: 'local',
  geminiKey: '',
};

let state = {
  settings: { ...DEFAULT_SETTINGS },
  knowledge: null,
  events: [],
  lbi: [],
  importedEventsCount: 0,
  importedLbiCount: 0,
};

const officialLinks = {
  mee: 'https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/',
  bonneBoite: 'https://labonneboite.francetravail.fr/',
  bonneAlternance: 'https://labonnealternance.apprentissage.beta.gouv.fr/',
  immersion: 'https://immersion-facile.beta.gouv.fr/',
  laBonneInfo: 'https://la-bonne-info.francetravail.net/',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .trim();
}

function formatDate(date, time) {
  if (!date) return time ? `Horaire : ${escapeHtml(time)}` : 'Date à préciser';
  const raw = String(date).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  let label = raw;
  if (iso) {
    const d = new Date(`${raw}T12:00:00`);
    if (!Number.isNaN(d.getTime())) label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
  return time ? `${label} à ${escapeHtml(time)}` : label;
}

function textToHtml(text) {
  const safe = escapeHtml(text);
  return safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function addMessage(role, content, options = {}) {
  const row = document.createElement('article');
  row.className = `message-row ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'VOUS' : 'IA';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (options.html) bubble.innerHTML = content;
  else bubble.innerHTML = `<p>${textToHtml(content)}</p>`;
  row.append(avatar, bubble);
  els.messages.appendChild(row);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function setStatus() {
  const city = state.settings.defaultCity ? ` · territoire : ${state.settings.defaultCity}` : '';
  const ev = state.events.length ? `${state.events.length} événement(s) chargé(s)` : (state.settings.apiUrl ? 'agenda API configuré' : 'agenda à connecter');
  const lbi = state.lbi.length ? `${state.lbi.length} fiche(s) La Bonne Info` : (state.settings.lbiUrl ? 'La Bonne Info API configurée' : 'La Bonne Info à connecter');
  els.status.textContent = `${ev} · ${lbi}${city}`;
  if (els.eventsSourceChip) {
    els.eventsSourceChip.textContent = state.events.length ? `Agenda chargé : ${state.events.length}` : (state.settings.apiUrl ? 'Agenda connecté par API' : 'Agenda à connecter');
    els.eventsSourceChip.classList.toggle('active', Boolean(state.events.length || state.settings.apiUrl));
  }
  if (els.lbiSourceChip) {
    els.lbiSourceChip.textContent = state.lbi.length ? `La Bonne Info : ${state.lbi.length}` : (state.settings.lbiUrl ? 'La Bonne Info par API' : 'La Bonne Info à connecter');
    els.lbiSourceChip.classList.toggle('active', Boolean(state.lbi.length || state.settings.lbiUrl));
  }
}

function loadStored() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    state.events = Array.isArray(data.events) ? data.events : [];
    state.lbi = Array.isArray(data.lbi) ? data.lbi : [];
    state.importedEventsCount = state.events.length;
    state.importedLbiCount = state.lbi.length;
  } catch (_) {}
}

function saveStored() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    settings: state.settings,
    events: state.events,
    lbi: state.lbi,
  }));
  setStatus();
}

async function fetchJson(path, fallback) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (_) { return fallback; }
}

async function fetchText(path, fallback = '') {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.text();
  } catch (_) { return fallback; }
}

function detectDelimiter(line) {
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  return semi >= comma ? ';' : ',';
}

function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  const split = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === delim && !inQuotes) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };
  const headers = split(lines[0]).map(h => normalize(h));
  return lines.slice(1).map(line => {
    const values = split(line);
    const item = {};
    headers.forEach((h, i) => item[h] = values[i] || '');
    return mapEvent(item);
  }).filter(e => e.titre || e.title);
}

function mapEvent(raw = {}) {
  const get = (...keys) => keys.map(k => raw[k] ?? raw[normalize(k)]).find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
  return {
    titre: get('titre', 'title', 'nom', 'libelle'),
    date: get('date', 'startDate', 'date_debut', 'date début', 'debut'),
    heure: get('heure', 'time', 'hour', 'horaire'),
    ville: get('ville', 'city', 'commune'),
    lieu: get('lieu', 'location', 'adresse', 'place'),
    type: get('type', 'categorie', 'category', 'format'),
    modalite: get('modalite', 'modalité', 'mode', 'online'),
    secteur: get('secteur', 'sector', 'domaine'),
    lien: get('lien', 'url', 'link', 'fiche'),
    description: get('description', 'resume', 'résumé', 'summary', 'contenu'),
  };
}

function mapLbi(raw = {}) {
  if (typeof raw === 'string') {
    return { titre: raw.slice(0, 80), categorie: 'Import texte', contenu: raw, motsCles: [] };
  }
  const get = (...keys) => keys.map(k => raw[k] ?? raw[normalize(k)]).find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
  let mots = get('motsCles', 'mots_clés', 'keywords', 'tags');
  if (typeof mots === 'string') mots = mots.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(mots)) mots = [];
  return {
    titre: get('titre', 'title', 'question', 'nom'),
    categorie: get('categorie', 'category', 'rubrique', 'theme'),
    contenu: get('contenu', 'content', 'texte', 'description', 'reponse', 'réponse'),
    lien: get('lien', 'url', 'link'),
    motsCles: mots,
  };
}

async function loadBaseData() {
  state.knowledge = await fetchJson('data/knowledge.json', fallbackKnowledge());

  if (!state.importedEventsCount) {
    const evJson = await fetchJson('data/evenements.json', []);
    const evCsv = parseCsv(await fetchText('data/evenements.csv', ''));
    state.events = [...(Array.isArray(evJson) ? evJson.map(mapEvent) : []), ...evCsv].filter(e => e.titre);
  }

  if (!state.importedLbiCount) {
    const lbiJson = await fetchJson('data/la-bonne-info.json', []);
    state.lbi = Array.isArray(lbiJson) ? lbiJson.map(mapLbi).filter(x => x.titre || x.contenu) : [];
  }
  setStatus();
}

function fallbackKnowledge() {
  return { ateliers: [], prestations: [], dispositifs: [], intentions: [] };
}

function wantsEvents(q) {
  return /\b(evenement|événement|evenements|événements|job dating|forum|salon|atelier|reunion|réunion|agenda)\b/i.test(q);
}
function wantsLbi(q) {
  return /\b(la bonne info|bonne info|fiche info|actualisation|allocation|indemnisation|droit|demarche|démarche|espace personnel)\b/i.test(q);
}
function wantsListAteliers(q) {
  return /\b(atelier|prestation|dispositif|accompagnement)\b/i.test(q) && !wantsEvents(q);
}

function extractCity(q) {
  const text = String(q).replace(/[?!.]/g, ' ');
  const patterns = [
    /(?:à|a|sur|dans|autour de|près de|proche de)\s+([A-Za-zÀ-ÿ' -]{2,45})/i,
    /ville\s*:?\s*([A-Za-zÀ-ÿ' -]{2,45})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      return m[1].trim().replace(/\s+(et|pour|avec|en|du|de|des|le|la|les)\s.*$/i, '').trim();
    }
  }
  if (/ma ville|chez moi|autour de moi/i.test(text)) return state.settings.defaultCity || '';
  return state.settings.defaultCity || '';
}

function extractKeyword(q) {
  const n = normalize(q);
  const words = [];
  ['cv','commerce','administratif','alternance','industrie','formation','immersion','handicap','cadre','numérique','santé','transport','restauration','service','poe'].forEach(w => {
    if (n.includes(normalize(w))) words.push(w);
  });
  return words.join(' ');
}

async function getEvents(city, keyword) {
  let apiEvents = [];
  if (state.settings.apiUrl) {
    const url = state.settings.apiUrl
      .replaceAll('{city}', encodeURIComponent(city || ''))
      .replaceAll('{keyword}', encodeURIComponent(keyword || ''));
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data.items || data.results || data.evenements || []);
        apiEvents = arr.map(mapEvent).filter(e => e.titre);
      }
    } catch (_) {}
  }
  const all = [...apiEvents, ...state.events];
  const cityN = normalize(city || '');
  const keyN = normalize(keyword || '');
  let filtered = all;
  if (cityN) filtered = filtered.filter(e => normalize(`${e.ville} ${e.lieu}`).includes(cityN));
  if (keyN) filtered = filtered.filter(e => normalize(`${e.titre} ${e.type} ${e.secteur} ${e.description}`).includes(keyN) || keyN.split(' ').some(k => normalize(`${e.titre} ${e.type} ${e.secteur} ${e.description}`).includes(k)));
  filtered.sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));
  return filtered.slice(0, 8);
}

async function getLbiResults(q) {
  const keyword = q.replace(/cherche dans la bonne info\s*:?/i, '').trim();
  let apiResults = [];
  if (state.settings.lbiUrl) {
    const url = state.settings.lbiUrl.replaceAll('{keyword}', encodeURIComponent(keyword));
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data.items || data.results || data.fiches || []);
        apiResults = arr.map(mapLbi).filter(x => x.titre || x.contenu);
      }
    } catch (_) {}
  }
  const n = normalize(keyword || q);
  return [...apiResults, ...state.lbi]
    .map(item => ({ item, score: scoreText(n, `${item.titre} ${item.categorie} ${item.contenu} ${(item.motsCles || []).join(' ')}`) }))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, 6)
    .map(x => x.item);
}

function scoreText(query, target) {
  const q = normalize(query);
  const t = normalize(target);
  if (!q) return 0;
  let score = 0;
  if (t.includes(q)) score += 10;
  q.split(/\s+/).filter(w => w.length > 2).forEach(w => { if (t.includes(w)) score += 1; });
  return score;
}

function eventCards(events) {
  return `<div class="cards">${events.map(e => {
    const title = escapeHtml(e.titre || 'Événement emploi');
    const date = formatDate(e.date, e.heure);
    const lieu = [e.lieu, e.ville].filter(Boolean).join(' · ') || 'Lieu à vérifier sur la fiche';
    const type = e.type || 'Événement emploi';
    const modalite = e.modalite || 'Modalité à vérifier';
    const secteur = e.secteur ? `<span class="pill">${escapeHtml(e.secteur)}</span>` : '';
    const desc = e.description ? `<p class="card-desc">${escapeHtml(e.description)}</p>` : '<p class="card-desc">Consultez la fiche pour vérifier les conditions de participation, le public concerné et les modalités d’inscription.</p>';
    const href = e.lien || officialLinks.mee;
    const cta = e.lien ? 'Voir la fiche et s’inscrire' : 'Rechercher sur Mes Événements Emploi';
    return `<article class="event-card">
      <div class="event-header">
        <span class="event-label">Événement France Travail</span>
        <span class="pill primary">${escapeHtml(type)}</span>
      </div>
      <div class="card-top">
        <h3>${title}</h3>
        <div class="event-grid" role="list">
          <div role="listitem"><span>Date et horaire</span><strong>${escapeHtml(date)}</strong></div>
          <div role="listitem"><span>Lieu</span><strong>${escapeHtml(lieu)}</strong></div>
          <div role="listitem"><span>Modalité</span><strong>${escapeHtml(modalite)}</strong></div>
        </div>
        <div class="meta">${secteur}</div>
        ${desc}
      </div>
      <div class="card-actions"><a class="primary" target="_blank" rel="noopener" href="${escapeHtml(href)}">${cta}</a></div>
    </article>`;
  }).join('')}</div>`;
}

function infoCards(items) {
  return `<div class="cards">${items.map(it => {
    const title = escapeHtml(it.titre || 'Fiche information');
    const cat = it.categorie ? `<span class="pill primary">${escapeHtml(it.categorie)}</span>` : '';
    const words = (it.motsCles || []).slice(0,4).map(w => `<span class="pill">${escapeHtml(w)}</span>`).join('');
    const content = escapeHtml(String(it.contenu || '').slice(0, 900));
    const link = it.lien ? `<div class="card-actions"><a class="primary" target="_blank" rel="noopener" href="${escapeHtml(it.lien)}">Ouvrir la fiche source</a></div>` : '';
    return `<article class="info-card"><h3>${title}</h3><div class="meta">${cat}${words}</div><p class="card-desc">${content}</p>${link}</article>`;
  }).join('')}</div>`;
}

function emptyEvents(city) {
  const cityLabel = city ? ` pour <strong>${escapeHtml(city)}</strong>` : '';
  return `<div class="empty-state"><p><strong>Aucun événement disponible${cityLabel} dans les sources chargées.</strong></p><p>Pour une réponse fiable au demandeur d’emploi, l’agenda doit provenir d’un export CSV/JSON ou d’une API interne autorisée. L’assistant ne crée pas de résultat fictif.</p><p>Vous pouvez poursuivre l’orientation avec les ateliers, prestations, PMSMP, POE, La Bonne Boîte ou La Bonne Alternance.</p><p><a class="inline-action" target="_blank" rel="noopener" href="${officialLinks.mee}">Consulter Mes Événements Emploi</a></p></div>`;
}

function emptyLbi() {
  return `<div class="empty-state"><p><strong>La Bonne Info n’est pas encore disponible dans cette instance.</strong></p><p>Pour exploiter la base complète, chargez un export JSON/Markdown/TXT ou renseignez une API interne dans les paramètres.</p><p>Format JSON attendu : <code>[{"titre":"...","categorie":"...","contenu":"...","motsCles":["..."]}]</code></p><p><a class="inline-action" target="_blank" rel="noopener" href="${officialLinks.laBonneInfo}">Ouvrir La Bonne Info</a></p></div>`;
}

function listAteliersAndPrestations() {
  const k = state.knowledge;
  const ateliers = k.ateliers.map(a => `<li><strong>${escapeHtml(a.code)} — ${escapeHtml(a.titre)}</strong> · ${escapeHtml(a.duree)}<br>${escapeHtml(a.objectif)}</li>`).join('');
  const prestations = k.prestations.map(p => `<li><strong>${escapeHtml(p.code)} — ${escapeHtml(p.titre)}</strong> · ${escapeHtml(p.duree)}<br>${escapeHtml(p.objectif)}</li>`).join('');
  return `<p>Voici la base d’orientation intégrée.</p><p><strong>Ateliers conseil</strong></p><ul>${ateliers}</ul><p><strong>Prestations</strong></p><ul>${prestations}</ul>`;
}

function recommend(q) {
  const n = normalize(q);
  const k = state.knowledge;
  const scored = [];
  [...k.ateliers, ...k.prestations].forEach(item => {
    const hay = normalize(`${item.code} ${item.titre} ${item.axe} ${item.objectif} ${(item.declencheurs || []).join(' ')}`);
    let score = 0;
    if (hay.includes(n)) score += 10;
    n.split(/\s+/).filter(w => w.length > 2).forEach(w => { if (hay.includes(w)) score++; });
    if (score) scored.push({ item, score, type: item.code?.startsWith('R') ? 'Atelier' : 'Prestation' });
  });
  k.dispositifs.forEach(item => {
    const hay = normalize(`${item.titre} ${item.resume} ${item.orientation} ${(item.motsCles || []).join(' ')}`);
    let score = 0;
    n.split(/\s+/).filter(w => w.length > 2).forEach(w => { if (hay.includes(w)) score++; });
    if (score) scored.push({ item, score, type: 'Dispositif' });
  });
  return scored.sort((a,b) => b.score - a.score).slice(0, 5);
}

function recommendationHtml(q) {
  const recos = recommend(q);
  if (!recos.length) {
    return `<p>Je peux orienter sur les événements, ateliers, prestations, PMSMP, POE, La Bonne Boîte, La Bonne Alternance et La Bonne Info.</p><p>Précise le besoin : métier visé, ville, objectif et urgence.</p>`;
  }
  const cards = recos.map(({item, type}) => `<article class="info-card"><h3>${escapeHtml(type)} · ${escapeHtml(item.code ? item.code + ' — ' : '')}${escapeHtml(item.titre)}</h3><p class="card-desc">${escapeHtml(item.objectif || item.resume || '')}</p>${item.duree ? `<p class="card-desc"><strong>Durée :</strong> ${escapeHtml(item.duree)}</p>` : ''}${item.orientation ? `<p class="card-desc"><strong>Quand le proposer :</strong> ${escapeHtml(item.orientation)}</p>` : ''}</article>`).join('');
  return `<p>Au regard de la demande, je proposerais en priorité :</p><div class="cards">${cards}</div><p>Action utile : compléter avec une recherche d’événements dans la ville ou un ciblage d’entreprises si l’objectif est le retour rapide à l’emploi.</p>`;
}

async function localAnswer(q) {
  if (wantsEvents(q)) {
    const city = extractCity(q);
    const keyword = extractKeyword(q);
    if (!city) {
      return `<p>Pour chercher les événements, j’ai besoin d’une ville ou d’un département.</p><p>Exemple : <strong>événements emploi à Boulogne-Billancourt</strong>.</p>`;
    }
    const events = await getEvents(city, keyword);
    if (!events.length) return `<p>J’ai cherché les événements emploi${city ? ` autour de <strong>${escapeHtml(city)}</strong>` : ''}${keyword ? ` avec le mot-clé <strong>${escapeHtml(keyword)}</strong>` : ''}.</p>${emptyEvents(city)}`;
    return `<p>J’ai trouvé ${events.length} événement(s) correspondant(s)${city ? ` autour de <strong>${escapeHtml(city)}</strong>` : ''}.</p>${eventCards(events)}`;
  }
  if (wantsLbi(q)) {
    const results = await getLbiResults(q);
    if (!results.length) return `<p>Je peux chercher dans La Bonne Info, mais aucune fiche exploitable n’est chargée pour l’instant.</p>${emptyLbi()}`;
    return `<p>Voici les fiches La Bonne Info les plus proches de la demande.</p>${infoCards(results)}`;
  }
  if (wantsListAteliers(q)) return listAteliersAndPrestations();
  return recommendationHtml(q);
}

async function geminiAnswer(q) {
  const key = state.settings.geminiKey;
  if (!key) return localAnswer(q);
  const context = JSON.stringify({ knowledge: state.knowledge, events: state.events.slice(0, 20), lbi: state.lbi.slice(0, 20) }).slice(0, 24000);
  const prompt = `Tu es un assistant d'orientation France Travail. Réponds clairement, sans inventer d'événement. Si aucun événement n'est dans le contexte, dis qu'il faut importer ou consulter Mes Événements Emploi. Contexte: ${context}\n\nDemande: ${q}`;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!res.ok) throw new Error('Gemini error');
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
    return `<p>${textToHtml(text)}</p>`;
  } catch (_) {
    return `<p>Le moteur Gemini n’a pas répondu. Je bascule sur la réponse locale.</p>${await localAnswer(q)}`;
  }
}

async function handleUser(q) {
  addMessage('user', q);
  els.send.disabled = true;
  const typingId = showTyping();
  try {
    const html = state.settings.engine === 'gemini' ? await geminiAnswer(q) : await localAnswer(q);
    removeTyping(typingId);
    addMessage('assistant', html, { html: true });
  } catch (e) {
    removeTyping(typingId);
    addMessage('assistant', `<p>Je n’ai pas réussi à traiter la demande. Vérifie le fichier importé ou l’URL API configurée.</p>`, { html: true });
  } finally {
    els.send.disabled = false;
    els.input.focus();
  }
}

function showTyping() {
  const id = `typing-${Date.now()}`;
  const row = document.createElement('article');
  row.id = id;
  row.className = 'message-row assistant';
  row.innerHTML = `<div class="avatar">IA</div><div class="bubble"><p>Recherche en cours…</p></div>`;
  els.messages.appendChild(row);
  els.messages.scrollTop = els.messages.scrollHeight;
  return id;
}
function removeTyping(id) { document.getElementById(id)?.remove(); }

function resizeTextarea() {
  els.input.style.height = 'auto';
  els.input.style.height = `${Math.min(170, els.input.scrollHeight)}px`;
}

async function importEventsFile(file) {
  const text = await file.text();
  let events = [];
  if (file.name.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : (data.items || data.results || data.evenements || []);
    events = arr.map(mapEvent).filter(e => e.titre);
  } else events = parseCsv(text);
  state.events = events;
  state.importedEventsCount = events.length;
  saveStored();
  addMessage('assistant', `<p><strong>${events.length} événement(s) importé(s).</strong></p><p>Vous pouvez maintenant demander : événements emploi dans ma ville.</p>`, { html: true });
}

async function importLbiFile(file) {
  const text = await file.text();
  let items = [];
  if (file.name.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : (data.items || data.results || data.fiches || []);
    items = arr.map(mapLbi).filter(x => x.titre || x.contenu);
  } else {
    const chunks = text.split(/\n#{1,3}\s+/).map(s => s.trim()).filter(Boolean);
    items = chunks.map((chunk, i) => {
      const lines = chunk.split(/\r?\n/);
      const titre = lines[0].replace(/^#+\s*/, '').trim() || `Fiche ${i + 1}`;
      return { titre, categorie: 'Import Markdown', contenu: lines.slice(1).join('\n').trim() || chunk, motsCles: [] };
    });
  }
  state.lbi = items;
  state.importedLbiCount = items.length;
  saveStored();
  addMessage('assistant', `<p><strong>${items.length} fiche(s) La Bonne Info importée(s).</strong></p><p>Vous pouvez maintenant demander : cherche dans La Bonne Info actualisation, allocation, formation, etc.</p>`, { html: true });
}

function initSettingsUi() {
  els.defaultCity.value = state.settings.defaultCity;
  els.apiUrl.value = state.settings.apiUrl;
  els.lbiUrl.value = state.settings.lbiUrl;
  els.engine.value = state.settings.engine;
  els.geminiKey.value = state.settings.geminiKey;
  els.geminiKeyBlock.classList.toggle('hidden', els.engine.value !== 'gemini');
}

function bindEvents() {
  els.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = els.input.value.trim();
    if (!q) return;
    els.input.value = '';
    resizeTextarea();
    handleUser(q);
  });
  els.input.addEventListener('input', resizeTextarea);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); els.composer.requestSubmit(); }
  });
  els.quickActions.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-prompt]');
    if (!btn) return;
    els.input.value = btn.dataset.prompt;
    resizeTextarea();
    els.composer.requestSubmit();
  });
  els.settingsBtn.addEventListener('click', () => { initSettingsUi(); els.settingsDialog.showModal(); });
  els.engine.addEventListener('change', () => els.geminiKeyBlock.classList.toggle('hidden', els.engine.value !== 'gemini'));
  els.saveSettings.addEventListener('click', () => {
    state.settings = {
      defaultCity: els.defaultCity.value.trim(),
      apiUrl: els.apiUrl.value.trim(),
      lbiUrl: els.lbiUrl.value.trim(),
      engine: els.engine.value,
      geminiKey: els.geminiKey.value.trim(),
    };
    saveStored();
  });
  els.clearData.addEventListener('click', () => {
    if (!confirm('Réinitialiser les réglages, événements et fiches importées ?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state.settings = { ...DEFAULT_SETTINGS };
    state.events = [];
    state.lbi = [];
    state.importedEventsCount = 0;
    state.importedLbiCount = 0;
    initSettingsUi();
    setStatus();
  });
  els.importEventsBtn.addEventListener('click', () => els.eventsFileInput.click());
  els.eventsFileInput.addEventListener('change', () => {
    const file = els.eventsFileInput.files?.[0];
    if (file) importEventsFile(file).catch(() => addMessage('assistant', 'Import impossible. Vérifie le format du fichier.'));
    els.eventsFileInput.value = '';
  });
  els.importLbiBtn.addEventListener('click', () => els.lbiFileInput.click());
  els.lbiFileInput.addEventListener('change', () => {
    const file = els.lbiFileInput.files?.[0];
    if (file) importLbiFile(file).catch(() => addMessage('assistant', 'Import La Bonne Info impossible. Vérifie le format JSON ou Markdown.'));
    els.lbiFileInput.value = '';
  });
  els.voice.addEventListener('click', startVoice);
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addMessage('assistant', 'La dictée vocale n’est pas disponible dans ce navigateur.');
    return;
  }
  const rec = new SpeechRecognition();
  rec.lang = 'fr-FR';
  rec.interimResults = false;
  rec.onresult = (event) => {
    const text = event.results?.[0]?.[0]?.transcript || '';
    els.input.value = text;
    resizeTextarea();
    els.composer.requestSubmit();
  };
  rec.start();
}

function welcome() {
  addMessage('assistant', `<p>Bonjour. Je peux orienter vers les événements emploi, ateliers conseil, prestations, PMSMP, POE, La Bonne Boîte, La Bonne Alternance et La Bonne Info.</p><p>Indiquez une ville, un métier ou un besoin. Les événements affichés proviennent uniquement d’une source chargée ou d’une API configurée.</p>`, { html: true });
}

async function init() {
  loadStored();
  bindEvents();
  initSettingsUi();
  await loadBaseData();
  welcome();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => null);
}

init();
