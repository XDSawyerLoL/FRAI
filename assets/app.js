const $ = (id) => document.getElementById(id);

const els = {
  messages: $('messages'),
  composer: $('composer'),
  input: $('userInput'),
  send: $('sendBtn'),
  settingsBtn: $('settingsBtn'),
  settingsDialog: $('settingsDialog'),
  importBtn: $('importEventsBtn'),
  fileInput: $('eventsFileInput'),
  defaultCity: $('defaultCityInput'),
  apiUrl: $('apiUrlInput'),
  engine: $('engineSelect'),
  geminiKeyBlock: $('geminiKeyBlock'),
  geminiKey: $('geminiKeyInput'),
  saveSettings: $('saveSettingsBtn'),
  clearData: $('clearDataBtn'),
  status: $('statusLine'),
  voice: $('voiceBtn'),
  quickActions: $('quickActions'),
};

const STORAGE_KEY = 'assistant_emploi_github_pages_v1';
const DEFAULT_SETTINGS = {
  defaultCity: '',
  apiUrl: '',
  engine: 'local',
  geminiKey: '',
};

let state = {
  settings: { ...DEFAULT_SETTINGS },
  events: [],
  knowledge: null,
  importedEventsCount: 0,
};

const FALLBACK_KNOWLEDGE = {
  ateliers: [
    { code: 'R01', axe: 'Choisir un métier', titre: 'Construire et affiner mon projet professionnel au regard du marché du travail', duree: '1 journée', objectif: 'Identifier son profil, confronter son projet au marché et construire des pistes professionnelles réalistes.' },
    { code: 'R04', axe: 'Se former', titre: 'Mes démarches en ligne avec France Travail', duree: '1/2 journée', objectif: 'Gagner en autonomie sur l’espace personnel, les documents, les candidatures et les échanges en ligne.' },
    { code: 'R02', axe: 'Préparer sa candidature', titre: 'Faire le point sur mes compétences professionnelles et concevoir un CV percutant', duree: '1 journée', objectif: 'Identifier ses compétences et produire un CV clair, ciblé et exploitable.' },
    { code: 'R03', axe: 'Préparer sa candidature', titre: 'Réaliser mon CV en langue étrangère : anglais, allemand, espagnol', duree: '1/2 journée', objectif: 'Adapter son CV à une candidature internationale.' },
    { code: 'R05', axe: 'Préparer sa candidature', titre: 'Organiser et optimiser ma recherche d’emploi', duree: '1 journée', objectif: 'Structurer sa recherche, planifier ses démarches et mieux exploiter les outils disponibles.' },
    { code: 'R06', axe: 'Créer une entreprise', titre: 'M’imaginer créateur d’entreprise', duree: '1/2 journée', objectif: 'Explorer l’entrepreneuriat comme piste possible de retour à l’emploi.' },
    { code: 'R07', axe: 'Créer une entreprise', titre: 'Structurer mon projet de création d’entreprise', duree: '1 journée', objectif: 'Clarifier les étapes, ressources et points de vigilance d’un projet de création.' }
  ],
  prestations: [
    { code: 'AP3', titre: 'Activ’Projet', duree: '8 à 12 semaines', objectif: 'Définir ou confirmer un projet professionnel réaliste.' },
    { code: 'GCO', titre: 'Prépa Compétences', duree: '2 à 8 semaines', objectif: 'Sécuriser l’entrée en formation et vérifier l’adéquation projet/formation.' },
    { code: 'VS2', titre: 'Valoriser son image professionnelle', duree: '2 à 3 semaines', objectif: 'Améliorer sa présentation, sa posture et sa communication professionnelle.' },
    { code: 'UES', titre: 'Un Emploi Stable', duree: '8 à 12 semaines', objectif: 'Renforcer les techniques de recherche d’emploi pour viser un emploi durable.' },
    { code: 'AGC', titre: 'Agil’Cadres', duree: '9 mois max', objectif: 'Accompagner le retour à l’emploi durable des cadres.' },
    { code: 'EMG', titre: 'Activ’Créa Émergence', duree: '8 semaines', objectif: 'Explorer la création ou reprise d’entreprise comme solution de retour à l’emploi.' },
    { code: 'DES', titre: 'Défi Santé Emploi', duree: 'jusqu’à 7 mois', objectif: 'Travailler le retour à l’emploi lorsque la santé constitue un frein.' },
    { code: 'AIN', titre: 'Activ’International', duree: '8 à 12 semaines', objectif: 'Étudier et préparer un projet professionnel à l’international.' }
  ],
  dispositifs: {
    mes_evenements: 'Mes Événements Emploi permet de trouver des salons, job datings, ateliers, conférences, visites d’entreprise et réunions d’information.',
    pmsmp: 'La PMSMP / immersion facilitée sert à tester un métier ou une entreprise sur une courte période, pour confirmer un projet ou préparer une reconversion.',
    poe: 'La POE, Préparation Opérationnelle à l’Emploi, sert à financer une formation avant embauche quand il manque des compétences pour un poste identifié.',
    bonne_boite: 'La Bonne Boîte aide à cibler les entreprises qui ont statistiquement le plus de chances de recruter autour d’un métier et d’un lieu.',
    bonne_alternance: 'La Bonne Alternance permet de chercher des offres, des formations et des entreprises à potentiel pour l’apprentissage ou la professionnalisation.'
  }
};

init();

async function init() {
  loadLocalState();
  bindEvents();
  await loadKnowledge();
  await loadBundledEvents();
  updateStatus();
  addMessage('assistant', welcomeMessage());
  autoResizeTextarea();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function bindEvents() {
  els.composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text) return;
    els.input.value = '';
    autoResizeTextarea();
    await handleUserMessage(text);
  });

  els.input.addEventListener('input', autoResizeTextarea);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      els.composer.requestSubmit();
    }
  });

  els.quickActions.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-prompt]');
    if (!btn) return;
    els.input.value = btn.dataset.prompt;
    els.composer.requestSubmit();
  });

  els.settingsBtn.addEventListener('click', () => openSettings());
  els.importBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', importEventsFile);

  els.engine.addEventListener('change', () => {
    els.geminiKeyBlock.classList.toggle('hidden', els.engine.value !== 'gemini');
  });

  els.saveSettings.addEventListener('click', () => {
    state.settings.defaultCity = els.defaultCity.value.trim();
    state.settings.apiUrl = els.apiUrl.value.trim();
    state.settings.engine = els.engine.value;
    state.settings.geminiKey = els.geminiKey.value.trim();
    saveLocalState();
    updateStatus();
    addMessage('assistant', 'Réglages enregistrés. Si tu demandes “dans ma ville”, j’utiliserai : ' + (state.settings.defaultCity || 'aucune ville définie'));
  });

  els.clearData.addEventListener('click', () => {
    if (!confirm('Réinitialiser les réglages et les événements importés ?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state.settings = { ...DEFAULT_SETTINGS };
    state.events = [];
    state.importedEventsCount = 0;
    saveLocalState();
    updateStatus();
    addMessage('assistant', 'Données réinitialisées. Recharge la page pour repartir proprement.');
  });

  setupVoice();
}

async function handleUserMessage(text) {
  addMessage('user', text);
  setBusy(true);
  try {
    let response;
    if (state.settings.engine === 'gemini' && state.settings.geminiKey) {
      response = await answerWithGemini(text);
    } else {
      response = await answerLocal(text);
    }
    addMessage('assistant', response.text, response.cards || []);
  } catch (err) {
    console.error(err);
    addMessage('assistant', 'Je n’ai pas pu traiter la demande. Erreur : ' + (err?.message || err));
  } finally {
    setBusy(false);
  }
}

function welcomeMessage() {
  return `Bonjour. Je peux orienter sur les ateliers, prestations et dispositifs emploi.\n\nJe peux aussi chercher dans des événements importés. Pour GitHub Pages, il faut soit :\n- remplir le fichier data/evenements.csv ;\n- importer un CSV/JSON ;\n- utiliser une API intranet autorisée dans les réglages.\n\nExemples :\n“Quels événements emploi à Boulogne-Billancourt ?”\n“Quel atelier pour refaire mon CV ?”\n“Je veux tester un métier en immersion.”`;
}

async function answerLocal(text) {
  const raw = text.trim();
  const q = normalize(raw);
  const city = extractCity(raw) || state.settings.defaultCity;

  if (looksLikeEventsQuery(q)) {
    const events = await findEvents({ q, city });
    return eventsAnswer(events, city, raw);
  }

  if (hasAny(q, ['atelier', 'ateliers', 'r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07'])) {
    return { text: ateliersAnswer(q) };
  }

  if (hasAny(q, ['prestation', 'prestations', 'activ projet', 'activprojet', 'prepacompetences', 'prepa competences', 'agil cadres', 'defi sante', 'emploi stable'])) {
    return { text: prestationsAnswer(q) };
  }

  if (hasAny(q, ['cv', 'candidature', 'lettre', 'entretien', 'recherche emploi', 'recherche d emploi'])) {
    return { text: candidatureAnswer(q) };
  }

  if (hasAny(q, ['immersion', 'pmsmp', 'tester un metier', 'decouvrir un metier', 'stage'])) {
    return { text: dispositifAnswer('pmsmp') };
  }

  if (hasAny(q, ['poe', 'preparation operationnelle', 'formation avant embauche', 'avant embauche'])) {
    return { text: dispositifAnswer('poe') };
  }

  if (hasAny(q, ['bonne boite', 'entreprise', 'candidature spontanee', 'candidatures spontanees', 'recrutent'])) {
    return { text: dispositifAnswer('bonne_boite') };
  }

  if (hasAny(q, ['alternance', 'apprentissage', 'apprenti', 'cfa', 'professionnalisation'])) {
    return { text: dispositifAnswer('bonne_alternance') };
  }

  if (hasAny(q, ['creation', 'entreprise', 'auto entrepreneur', 'creer ma boite', 'crea'])) {
    return { text: creationAnswer() };
  }

  if (hasAny(q, ['sante', 'handicap', 'frein', 'blocage', 'mobilite'])) {
    return { text: freinAnswer(q) };
  }

  return { text: generalOrientation(raw) };
}

function ateliersAnswer(q) {
  const k = state.knowledge || FALLBACK_KNOWLEDGE;
  let list = k.ateliers;
  if (hasAny(q, ['cv', 'competence', 'competences'])) list = list.filter(a => ['R02', 'R03'].includes(a.code));
  if (hasAny(q, ['organiser', 'optimiser', 'recherche'])) list = list.filter(a => a.code === 'R05');
  if (hasAny(q, ['projet', 'metier', 'reconversion'])) list = list.filter(a => a.code === 'R01');
  if (hasAny(q, ['ligne', 'demarche', 'espace personnel'])) list = list.filter(a => a.code === 'R04');
  if (hasAny(q, ['creation', 'entreprise'])) list = list.filter(a => ['R06', 'R07'].includes(a.code));
  return `Ateliers adaptés :\n\n${list.map(a => `**${a.code} – ${a.titre}**\nAxe : ${a.axe}\nDurée : ${a.duree}\nUtilité : ${a.objectif}`).join('\n\n')}\n\nAction conseillée : vérifier les prochaines dates dans Mes Événements Emploi ou auprès du conseiller.`;
}

function prestationsAnswer(q) {
  const k = state.knowledge || FALLBACK_KNOWLEDGE;
  let list = k.prestations;
  if (hasAny(q, ['projet', 'reconversion', 'metier'])) list = list.filter(p => ['AP3', 'GCO'].includes(p.code));
  if (hasAny(q, ['cv', 'image', 'entretien', 'presentation'])) list = list.filter(p => p.code === 'VS2');
  if (hasAny(q, ['cadre'])) list = list.filter(p => p.code === 'AGC');
  if (hasAny(q, ['stable', 'trouver emploi', 'retrouver emploi'])) list = list.filter(p => p.code === 'UES');
  if (hasAny(q, ['creation', 'entreprise'])) list = list.filter(p => p.code === 'EMG');
  if (hasAny(q, ['sante'])) list = list.filter(p => p.code === 'DES');
  if (hasAny(q, ['international', 'etranger'])) list = list.filter(p => p.code === 'AIN');
  return `Prestations pertinentes :\n\n${list.map(p => `**${p.code} – ${p.titre}**\nDurée : ${p.duree}\nObjectif : ${p.objectif}`).join('\n\n')}`;
}

function candidatureAnswer(q) {
  if (hasAny(q, ['cv', 'competence', 'competences'])) {
    return `Pour le CV, l’orientation prioritaire est :\n\n**R02 – Faire le point sur mes compétences professionnelles et concevoir un CV percutant**\nDurée : 1 journée.\n\nComplément possible : **VS2 – Valoriser son image professionnelle**, surtout si la personne bloque sur la posture, l’entretien ou la façon de se présenter.\n\nAction : demander les prochains ateliers CV dans la ville ou importer les événements disponibles.`;
  }
  return `Pour préparer une candidature :\n\n1. **R02** si le CV doit être reconstruit.\n2. **R05** si la recherche d’emploi manque d’organisation.\n3. **VS2** si le frein concerne la présentation, l’entretien ou la posture.\n4. **La Bonne Boîte** pour cibler les candidatures spontanées.`;
}

function dispositifAnswer(key) {
  const k = state.knowledge || FALLBACK_KNOWLEDGE;
  const d = k.dispositifs;
  if (key === 'pmsmp') return `**PMSMP / Immersion facilitée**\n\n${d.pmsmp}\n\nÀ proposer quand la personne veut découvrir un métier, vérifier une reconversion, valider une formation ou reprendre confiance en situation réelle.\n\nAction : chercher une entreprise d’accueil puis sécuriser la convention avec le prescripteur.`;
  if (key === 'poe') return `**POE – Préparation Opérationnelle à l’Emploi**\n\n${d.poe}\n\nÀ proposer quand une entreprise est intéressée par un candidat mais qu’il manque une compétence précise avant l’embauche.\n\nAction : identifier l’offre ou l’employeur, puis construire la formation avec France Travail.`;
  if (key === 'bonne_boite') return `**La Bonne Boîte**\n\n${d.bonne_boite}\n\nÀ proposer pour cibler les candidatures spontanées.\n\nMéthode : métier + ville + rayon, puis prioriser les entreprises les plus cohérentes avec le profil.`;
  if (key === 'bonne_alternance') return `**La Bonne Alternance**\n\n${d.bonne_alternance}\n\nÀ proposer dès qu’il y a une recherche d’apprentissage, de contrat pro, de CFA ou de formation en alternance.\n\nAction : chercher à la fois les offres publiées, les formations et les entreprises à potentiel.`;
  return d[key] || 'Dispositif non trouvé.';
}

function creationAnswer() {
  return `Pour une création d’entreprise :\n\n1. **R06 – M’imaginer créateur d’entreprise** si la personne explore seulement l’idée.\n2. **R07 – Structurer mon projet de création d’entreprise** si le projet est déjà identifié.\n3. **Activ’Créa Émergence EMG** si la création/reprise devient une vraie piste de retour à l’emploi.\n\nAction : clarifier l’idée, le client cible, les ressources, le statut envisagé et les risques.`;
}

function freinAnswer(q) {
  if (hasAny(q, ['sante', 'handicap'])) {
    return `Si la santé est un frein au retour à l’emploi :\n\n**Défi Santé Emploi DES** peut être pertinent.\nDurée : jusqu’à 7 mois.\nObjectif : travailler le retour à l’emploi en tenant compte de la situation de santé.\n\nAction : évaluer si le frein santé bloque directement la disponibilité, la mobilité, le rythme ou le type de poste visé.`;
  }
  return `Quand il y a un frein périphérique, il faut d’abord identifier sa nature : santé, mobilité, garde d’enfant, logement, numérique, confiance, langue ou disponibilité.\n\nEnsuite l’assistant peut orienter vers l’atelier ou la prestation adaptée.`;
}

function generalOrientation(raw) {
  return `J’ai compris la demande, mais il me manque un angle clair.\n\nJe peux répondre sur :\n- les événements emploi dans une ville ;\n- les ateliers R01 à R07 ;\n- les prestations AP3, GCO, VS2, UES, AGC, EMG, DES, AIN ;\n- l’immersion PMSMP ;\n- la POE ;\n- La Bonne Boîte ;\n- La Bonne Alternance.\n\nFormule utile : “Je cherche [emploi / alternance / immersion / CV] à [ville]”.`;
}

async function findEvents({ q, city }) {
  const keyword = extractKeyword(q);
  let all = [...state.events];

  if (state.settings.apiUrl && city) {
    try {
      const apiEvents = await fetchIntranetEvents(city, keyword);
      all = [...apiEvents, ...all];
    } catch (err) {
      console.warn('API intranet indisponible', err);
    }
  }

  const normalizedCity = normalize(city || '');
  const normalizedKeyword = normalize(keyword || '');
  return all
    .filter(ev => {
      const blob = normalize(Object.values(ev).join(' '));
      const cityOk = !normalizedCity || blob.includes(normalizedCity) || normalize(ev.ville || ev.city || '').includes(normalizedCity);
      const keywordOk = !normalizedKeyword || blob.includes(normalizedKeyword);
      return cityOk && keywordOk;
    })
    .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')))
    .slice(0, 8);
}

function eventsAnswer(events, city, raw) {
  if (!city) {
    return {
      text: `Je peux chercher les événements, mais il me manque la ville.\n\nIndique une ville ou règle une ville par défaut avec ⚙. Exemple : “événements emploi à Boulogne-Billancourt”.`
    };
  }

  if (!events.length) {
    return {
      text: `Je n’ai trouvé aucun événement importé pour **${city}**.\n\nSur GitHub Pages, l’application ne peut pas lire directement l’intranet France Travail sauf si une API autorisée existe.\n\nSolutions propres :\n1. remplir le fichier **data/evenements.csv** dans le dépôt GitHub ;\n2. cliquer sur **Importer** et charger un export CSV/JSON ;\n3. configurer une URL API intranet dans ⚙ si la DSI l’autorise.\n\nEn attendant, ouvre Mes Événements Emploi et exporte/copier les résultats dans le CSV.`
    };
  }

  return {
    text: `J’ai trouvé **${events.length} événement(s)** pour **${city}**.`,
    cards: events.map(eventToCard)
  };
}

function eventToCard(ev) {
  const title = ev.titre || ev.title || ev.nom || 'Événement emploi';
  const date = [ev.date, ev.heure || ev.time].filter(Boolean).join(' ');
  const lieu = [ev.ville || ev.city, ev.lieu || ev.location].filter(Boolean).join(' · ');
  const meta = [date, lieu, ev.type, ev.modalite || ev.mode].filter(Boolean).join(' · ');
  const desc = ev.description || ev.resume || ev.summary || '';
  const link = ev.lien || ev.url || ev.link || '';
  return { title, meta, desc, link };
}

async function fetchIntranetEvents(city, keyword) {
  const url = state.settings.apiUrl
    .replaceAll('{city}', encodeURIComponent(city || ''))
    .replaceAll('{ville}', encodeURIComponent(city || ''))
    .replaceAll('{keyword}', encodeURIComponent(keyword || ''))
    .replaceAll('{q}', encodeURIComponent(keyword || ''));
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.events)) return data.events;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

async function answerWithGemini(text) {
  const localDraft = await answerLocal(text);
  const context = buildContextForLLM(text, localDraft);
  const payload = {
    contents: [{ role: 'user', parts: [{ text: context }] }],
    generationConfig: { temperature: 0.25, maxOutputTokens: 900 }
  };
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(state.settings.geminiKey)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Gemini HTTP ' + res.status);
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n').trim();
  return { text: out || localDraft.text, cards: localDraft.cards || [] };
}

function buildContextForLLM(userText, localDraft) {
  const k = state.knowledge || FALLBACK_KNOWLEDGE;
  return `Tu es un assistant d'orientation emploi pour France Travail. Réponds en français, clairement, comme un chat IA. Ne fabrique pas d'événements. Si les événements ne sont pas dans le contexte, explique qu'il faut importer un CSV/JSON ou brancher une API intranet autorisée.\n\nBase ateliers: ${JSON.stringify(k.ateliers)}\nBase prestations: ${JSON.stringify(k.prestations)}\nDispositifs: ${JSON.stringify(k.dispositifs)}\nÉvénements disponibles: ${JSON.stringify(state.events.slice(0, 80))}\n\nQuestion utilisateur: ${userText}\n\nBrouillon local fiable: ${localDraft.text}`;
}

function looksLikeEventsQuery(q) {
  return hasAny(q, ['evenement', 'evenements', 'mes evenements emploi', 'job dating', 'forum', 'salon', 'atelier disponible', 'ateliers disponibles', 'reunion information', 'conference']) && !hasAny(q, ['liste des ateliers', 'quels ateliers sont disponibles']);
}

function extractCity(text) {
  const cleaned = text.trim();
  const patterns = [
    /(?:à|a|autour de|près de|pres de|sur|dans)\s+([A-Za-zÀ-ÿ'’\- ]{2,60})(?:\?|\.|,|$)/i,
    /ma ville/i
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (!m) continue;
    if (m[0].toLowerCase().includes('ma ville')) return state.settings.defaultCity;
    let city = (m[1] || '').trim();
    city = city.replace(/\b(emploi|evenements?|job dating|forums?|salons?|ateliers?)\b.*$/i, '').trim();
    return city;
  }
  return '';
}

function extractKeyword(q) {
  if (q.includes('job dating')) return 'job dating';
  if (q.includes('forum')) return 'forum';
  if (q.includes('salon')) return 'salon';
  if (q.includes('alternance')) return 'alternance';
  if (q.includes('atelier')) return 'atelier';
  return '';
}

function hasAny(text, needles) {
  return needles.some(n => text.includes(normalize(n)));
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addMessage(role, text, cards = []) {
  const row = document.createElement('article');
  row.className = `message-row ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'Toi' : 'IA';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = renderText(text);
  cards.forEach(card => bubble.appendChild(renderCard(card)));
  row.append(avatar, bubble);
  els.messages.appendChild(row);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return html;
}

function renderCard(card) {
  const div = document.createElement('div');
  div.className = 'event-card';
  const h = document.createElement('h3');
  h.textContent = card.title;
  div.appendChild(h);
  if (card.meta) {
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    meta.textContent = card.meta;
    div.appendChild(meta);
  }
  if (card.desc) {
    const p = document.createElement('p');
    p.textContent = card.desc;
    div.appendChild(p);
  }
  if (card.link) {
    const a = document.createElement('a');
    a.href = card.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Ouvrir le lien';
    div.appendChild(a);
  }
  return div;
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('\n', '<br>');
}

function autoResizeTextarea() {
  els.input.style.height = 'auto';
  els.input.style.height = Math.min(170, els.input.scrollHeight) + 'px';
}

function setBusy(busy) {
  els.send.disabled = busy;
  els.send.textContent = busy ? '…' : '➤';
}

function openSettings() {
  els.defaultCity.value = state.settings.defaultCity || '';
  els.apiUrl.value = state.settings.apiUrl || '';
  els.engine.value = state.settings.engine || 'local';
  els.geminiKey.value = state.settings.geminiKey || '';
  els.geminiKeyBlock.classList.toggle('hidden', els.engine.value !== 'gemini');
  els.settingsDialog.showModal();
}

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.settings = { ...DEFAULT_SETTINGS, ...(saved.settings || {}) };
    state.events = Array.isArray(saved.events) ? saved.events : [];
    state.importedEventsCount = saved.importedEventsCount || state.events.length || 0;
  } catch {
    state.settings = { ...DEFAULT_SETTINGS };
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    settings: state.settings,
    events: state.events,
    importedEventsCount: state.importedEventsCount,
  }));
}

function updateStatus() {
  const parts = [];
  parts.push(state.settings.engine === 'gemini' ? 'Gemini' : 'Local gratuit');
  if (state.settings.defaultCity) parts.push('ville : ' + state.settings.defaultCity);
  parts.push(state.events.length + ' événement(s)');
  els.status.textContent = parts.join(' · ');
}

async function loadKnowledge() {
  try {
    const res = await fetch('./data/knowledge.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('no knowledge');
    state.knowledge = await res.json();
  } catch {
    state.knowledge = FALLBACK_KNOWLEDGE;
  }
}

async function loadBundledEvents() {
  const before = state.events.length;
  try {
    const resJson = await fetch('./data/evenements.json', { cache: 'no-store' });
    if (resJson.ok) {
      const json = await resJson.json();
      const arr = Array.isArray(json) ? json : (json.events || json.results || []);
      mergeEvents(arr);
    }
  } catch {}

  try {
    const resCsv = await fetch('./data/evenements.csv', { cache: 'no-store' });
    if (resCsv.ok) {
      const csv = await resCsv.text();
      mergeEvents(parseCSV(csv));
    }
  } catch {}

  if (state.events.length !== before) saveLocalState();
}

function mergeEvents(events) {
  const clean = (events || []).map(normalizeEvent).filter(e => e.titre || e.title || e.nom);
  const seen = new Set(state.events.map(e => eventKey(e)));
  for (const ev of clean) {
    const key = eventKey(ev);
    if (seen.has(key)) continue;
    seen.add(key);
    state.events.push(ev);
  }
}

function normalizeEvent(ev) {
  const out = {};
  for (const [k,v] of Object.entries(ev || {})) {
    out[String(k).trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v;
  }
  if (out.title && !out.titre) out.titre = out.title;
  if (out.city && !out.ville) out.ville = out.city;
  if (out.url && !out.lien) out.lien = out.url;
  return out;
}

function eventKey(ev) {
  return normalize([ev.titre || ev.title || ev.nom, ev.date, ev.ville || ev.city, ev.lieu || ev.location].join('|'));
}

async function importEventsFile() {
  const file = els.fileInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    let rows;
    if (file.name.toLowerCase().endsWith('.json')) {
      const json = JSON.parse(text);
      rows = Array.isArray(json) ? json : (json.events || json.results || []);
    } else {
      rows = parseCSV(text);
    }
    const before = state.events.length;
    mergeEvents(rows);
    state.importedEventsCount += Math.max(0, state.events.length - before);
    saveLocalState();
    updateStatus();
    addMessage('assistant', `${state.events.length - before} événement(s) importé(s). Tu peux maintenant demander : “événements dans ma ville”.`);
  } catch (err) {
    addMessage('assistant', 'Import impossible. Vérifie que le fichier est bien en CSV ou JSON.');
  } finally {
    els.fileInput.value = '';
  }
}

function parseCSV(text) {
  const rows = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return rows;
  const headers = splitCSVLine(lines.shift()).map(h => h.trim().toLowerCase());
  for (const line of lines) {
    const values = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if ((ch === ',' || ch === ';') && !inQuotes) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.voice.style.display = 'none';
    return;
  }
  const rec = new SpeechRecognition();
  rec.lang = 'fr-FR';
  rec.interimResults = false;
  rec.continuous = false;
  els.voice.addEventListener('click', () => {
    try { rec.start(); els.voice.textContent = '…'; } catch {}
  });
  rec.onresult = (event) => {
    const text = Array.from(event.results).map(r => r[0]?.transcript || '').join(' ').trim();
    if (text) {
      els.input.value = text;
      autoResizeTextarea();
      els.composer.requestSubmit();
    }
  };
  rec.onend = () => { els.voice.textContent = '🎙️'; };
}
