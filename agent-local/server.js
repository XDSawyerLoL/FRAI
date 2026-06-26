/* Assistant France Travail - agent local
   Lance un petit serveur local qui peut :
   - recevoir les demandes du tchat GitHub Pages ;
   - appeler OpenAI si une clé est fournie ;
   - ouvrir un navigateur Playwright pour rechercher sur Mes Événements Emploi et Se former.
*/
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if(req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 8798);
const EVENTS_URL = 'https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/evenements';
const FORMATIONS_URL = 'https://candidat.francetravail.fr/formations/recherche?filtreEstFormationEnCoursOuAVenir=formEnCours&filtreEstFormationTerminee=formEnCours&range=0-9&tri=0';

const KNOWLEDGE = {
  ateliers: [
    { titre: 'R01 — Construire et affiner mon projet professionnel au regard du marché du travail', type:'Atelier', duree:'1 journée', lien:'https://www.francetravail.fr/candidat/les-ateliers-francetravail.html' },
    { titre: 'R02 — Faire le point sur mes compétences professionnelles et concevoir un CV percutant', type:'Atelier', duree:'1 journée', lien:'https://www.francetravail.fr/candidat/les-ateliers-francetravail.html' },
    { titre: 'R03 — Réaliser mon CV en langue étrangère : anglais, allemand, espagnol', type:'Atelier', duree:'1/2 journée', lien:'https://www.francetravail.fr/candidat/les-ateliers-francetravail.html' },
    { titre: 'R04 — Mes démarches en ligne avec France Travail', type:'Atelier', duree:'1/2 journée', lien:'https://www.francetravail.fr/candidat/les-ateliers-francetravail.html' },
    { titre: 'R05 — Organiser et optimiser ma recherche d’emploi', type:'Atelier', duree:'1 journée', lien:'https://www.francetravail.fr/candidat/les-ateliers-francetravail.html' },
    { titre: 'R06 — M’imaginer créateur d’entreprise', type:'Atelier', duree:'1/2 journée', lien:'https://www.francetravail.fr/candidat/les-ateliers-francetravail.html' },
    { titre: 'R07 — Structurer mon projet de création d’entreprise', type:'Atelier', duree:'1 journée', lien:'https://www.francetravail.fr/candidat/les-ateliers-francetravail.html' }
  ],
  dispositifs: [
    { titre:'PMSMP / Immersion facilitée', type:'Dispositif', description:'Découvrir un métier, confirmer un projet ou initier une démarche de recrutement en situation réelle.', lien:'https://immersion-facile.beta.gouv.fr/' },
    { titre:'POE — Préparation opérationnelle à l’emploi', type:'Dispositif', description:'Formation avant embauche quand un employeur est intéressé mais qu’il manque des compétences pour le poste.', lien:'https://www.francetravail.fr/candidat/en-formation/mes-aides-financieres/la-preparation-operationnelle-a.html' },
    { titre:'La Bonne Boîte', type:'Outil', description:'Identifier les entreprises à fort potentiel d’embauche pour candidater spontanément.', lien:'https://labonneboite.francetravail.fr/' },
    { titre:'La Bonne Alternance', type:'Outil', description:'Trouver offres, formations et entreprises qui recrutent en alternance.', lien:'https://labonnealternance.apprentissage.beta.gouv.fr/' }
  ]
};

function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function classify(message){
  const m = norm(message);
  if(/(evenement|evennements|agenda|job\s*dating|forum|salon|reunion|atelier|que se passe|rencontre)/.test(m)) return 'events';
  if(/(formation|former|se former|financement|financee|region|france travail|cpf|poe|administratif|metier)/.test(m)) return 'formations';
  if(/(immersion|pmsmp|decouvrir un metier|tester un metier)/.test(m)) return 'orientation';
  return 'general';
}
function extractCity(message, fallback){
  const text = String(message||'');
  const patterns = [
    /(?:ma ville est|ville\s*:\s*|à|a|sur|autour de|près de|proche de)\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9'’\- ]{2,60})/i,
    /dans\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9'’\- ]{2,60})/i
  ];
  for(const p of patterns){
    const match = text.match(p);
    if(match && !/ma ville|votre ville|la ville/i.test(match[1])) return cleanup(match[1]);
  }
  return cleanup(fallback || '');
}
function cleanup(s){ return String(s||'').split(/[,.!?;]/)[0].trim(); }
function extractMetier(message){
  const text = String(message||'');
  const patterns = [
    /je suis\s+([^,.!?;]{3,80})/i,
    /m[eé]tier\s*:?\s*([^,.!?;]{3,80})/i,
    /formation\s+(?:de|en|pour)\s+([^,.!?;]{3,80})/i,
    /cherche\s+(?:une\s+)?formation\s+(?:de|en|pour)?\s*([^,.!?;]{3,80})/i
  ];
  for(const p of patterns){ const m = text.match(p); if(m) return cleanup(m[1]).replace(/je cherche.*$/i,'').trim(); }
  if(/agent administratif/i.test(text)) return 'agent administratif';
  return '';
}
function wantsFinancing(message){ return /(financement|financee|financée|region|région|france travail|cpf|aide)/i.test(message); }

async function getBrowser() {
  const { chromium } = require('playwright');
  const headless = String(process.env.HEADLESS || 'false').toLowerCase() === 'true';
  return await chromium.launch({ headless, slowMo: headless ? 0 : Number(process.env.SLOWMO || 80) });
}
async function acceptCookies(page){
  const texts = ['Tout accepter','Accepter','J’accepte','J\'accepte','OK'];
  for(const t of texts){
    try{ const btn = page.getByRole('button', { name: new RegExp(t, 'i') }).first(); if(await btn.isVisible({timeout:1000})){ await btn.click({timeout:1000}); break; } }catch(_e){}
  }
}
async function fillVisibleInputs(page, values){
  const loc = page.locator('input:visible, textarea:visible, [contenteditable="true"]:visible');
  const count = await loc.count();
  let used = 0;
  for(let i=0;i<count && used<values.length;i++){
    const item = loc.nth(i);
    try{
      const type = (await item.getAttribute('type')) || '';
      if(['hidden','checkbox','radio','submit','button'].includes(type.toLowerCase())) continue;
      const disabled = await item.isDisabled().catch(()=>false); if(disabled) continue;
      await item.click({timeout:1500});
      await item.fill(values[used], {timeout:2000});
      await page.keyboard.press('Enter').catch(()=>{});
      used++;
      await page.waitForTimeout(600);
    }catch(_e){}
  }
  return used;
}
async function clickTexts(page, regexList){
  for(const rx of regexList){
    try{
      const btn = page.getByRole('button', { name: rx }).first();
      if(await btn.isVisible({timeout:1200})){ await btn.click({timeout:3000}); await page.waitForTimeout(1200); return true; }
    }catch(_e){}
    try{
      const link = page.getByRole('link', { name: rx }).first();
      if(await link.isVisible({timeout:1200})){ await link.click({timeout:3000}); await page.waitForTimeout(1200); return true; }
    }catch(_e){}
    try{
      const any = page.getByText(rx).first();
      if(await any.isVisible({timeout:1200})){ await any.click({timeout:3000}); await page.waitForTimeout(1200); return true; }
    }catch(_e){}
  }
  return false;
}
async function scrapeCards(page, baseUrl, max=6){
  return await page.evaluate(({baseUrl, max})=>{
    function clean(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
    const nodes = [...document.querySelectorAll('article, li, section, [class*=card], [class*=Card], [class*=result], [class*=Result], [class*=event], [class*=Event]')];
    const out=[];
    const seen=new Set();
    for(const n of nodes){
      const text = clean(n.innerText);
      if(!text || text.length<35 || text.length>1400) continue;
      if(!/(\d{1,2}[\/\-. ]\d{1,2}|janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|formation|certif|presentiel|présentiel|distanciel|job|forum|atelier|réunion|reunion)/i.test(text)) continue;
      const first = text.split(/[\n\r]+| {2,}/).map(clean).filter(Boolean)[0] || text.slice(0,90);
      const a = n.querySelector('a[href]');
      let href = a ? a.getAttribute('href') : '';
      try{ if(href) href = new URL(href, baseUrl).href; }catch(e){}
      const key = first + '|' + href;
      if(seen.has(key)) continue; seen.add(key);
      out.push({ titre:first.slice(0,120), description:text.slice(0,650), link:href || baseUrl });
      if(out.length>=max) break;
    }
    return out;
  }, { baseUrl, max });
}
async function searchEvents({ city, query }){
  const cards = [];
  let browser;
  try{
    browser = await getBrowser();
    const page = await browser.newPage({ viewport:{width:1360,height:900} });
    await page.goto(EVENTS_URL, { waitUntil:'domcontentloaded', timeout:60000 });
    await acceptCookies(page);
    const values = [query, city].filter(Boolean);
    if(values.length) await fillVisibleInputs(page, values);
    await clickTexts(page, [/rechercher/i,/filtrer/i,/voir les r[eé]sultats/i,/appliquer/i]);
    await page.waitForTimeout(2500);
    const scraped = await scrapeCards(page, EVENTS_URL, 8);
    for(const c of scraped){ cards.push({ ...c, type:'Événement', city, cta:'Consulter la fiche et s’inscrire', tags:['Mes Événements Emploi'] }); }
    const keepOpen = String(process.env.KEEP_BROWSER_OPEN || 'true').toLowerCase() === 'true';
    if(!keepOpen) await browser.close();
    return { ok:true, source:'Mes Événements Emploi', cards, browserLeftOpen:keepOpen };
  }catch(error){
    try{ if(browser) await browser.close(); }catch(_e){}
    return { ok:false, source:'Mes Événements Emploi', error:String(error.message||error), cards:[] };
  }
}
async function searchFormations({ city, metier, financement }){
  let browser;
  try{
    browser = await getBrowser();
    const page = await browser.newPage({ viewport:{width:1360,height:900} });
    await page.goto(FORMATIONS_URL, { waitUntil:'domcontentloaded', timeout:60000 });
    await acceptCookies(page);
    const values = [metier || 'agent administratif', city].filter(Boolean);
    await fillVisibleInputs(page, values);
    if(financement){
      await clickTexts(page, [/financ[eé]e/i,/france travail/i,/r[eé]gion/i,/aide/i]);
    }
    await clickTexts(page, [/rechercher/i,/filtrer/i,/voir les r[eé]sultats/i,/appliquer/i]);
    await page.waitForTimeout(3000);
    const scraped = await scrapeCards(page, FORMATIONS_URL, 8);
    const cards = scraped.map(c=>({ ...c, type:'Formation', city, financement: financement ? 'Financement Région / France Travail à vérifier sur la fiche' : '', cta:'Voir la fiche formation', tags:['Se former'] }));
    const keepOpen = String(process.env.KEEP_BROWSER_OPEN || 'true').toLowerCase() === 'true';
    if(!keepOpen) await browser.close();
    return { ok:true, source:'Se former France Travail', cards, browserLeftOpen:keepOpen };
  }catch(error){
    try{ if(browser) await browser.close(); }catch(_e){}
    return { ok:false, source:'Se former France Travail', error:String(error.message||error), cards:[] };
  }
}
function fallbackAnswer(intent, city, metier, cards, err){
  if(intent === 'events'){
    if(cards.length) return `J’ai lancé la recherche sur Mes Événements Emploi pour ${city || 'la ville demandée'} et j’ai trouvé ${cards.length} résultat(s) exploitable(s). Ouvre les fiches pour vérifier les horaires, le lieu exact et les modalités d’inscription.`;
    return `Je n’ai pas récupéré de fiche exploitable automatiquement pour ${city || 'la ville demandée'}. Le navigateur a été ouvert sur Mes Événements Emploi pour vérifier directement. Si la page demande une validation ou si les champs ne sont pas reconnus, complète la recherche dans la fenêtre ouverte.`;
  }
  if(intent === 'formations'){
    if(cards.length) return `J’ai lancé la recherche formation pour ${metier || 'le métier demandé'}${city ? ' à '+city : ''}. Les financements Région ou France Travail doivent être vérifiés fiche par fiche, car ils dépendent de la session, du profil et du financeur affiché.`;
    return `Je n’ai pas récupéré de fiche formation exploitable automatiquement. Le navigateur a été ouvert sur Se former France Travail avec les critères disponibles. Vérifie les résultats dans la fenêtre ouverte, notamment les lignes financement Région / France Travail.`;
  }
  return 'Je peux chercher les événements, les formations, ou orienter vers les ateliers et dispositifs France Travail.';
}
function fallbackCards(intent){
  if(intent === 'events') return [{ titre:'Mes Événements Emploi', type:'Service officiel', description:'Calendrier des salons, job datings, forums, ateliers et réunions d’information.', link:EVENTS_URL, cta:'Ouvrir l’agenda officiel' }];
  if(intent === 'formations') return [{ titre:'Se former — France Travail', type:'Service officiel', description:'Moteur de recherche de formations avec fiches détaillées et informations de financement.', link:FORMATIONS_URL, cta:'Ouvrir la recherche formation' }];
  return KNOWLEDGE.dispositifs.map(d=>({ titre:d.titre, type:d.type, description:d.description, link:d.lien, cta:'Voir la fiche officielle' }));
}
async function callOpenAI({ apiKey, model, message, intent, city, metier, cards }){
  if(!apiKey) return null;
  const system = `Tu es un assistant France Travail. Tu réponds en français, avec un ton institutionnel clair. Tu dois t'appuyer uniquement sur les résultats fournis et les liens officiels. Tu ne dois pas inventer d'événements, de dates, de financements ou de sessions. Pour les formations, précise que le financement Région/France Travail doit être vérifié sur la fiche et avec le conseiller.`;
  const dataContext = JSON.stringify({ intent, city, metier, resultats: cards.slice(0,8), dispositifs: KNOWLEDGE.dispositifs }, null, 2);
  const body = { model: model || 'gpt-4.1-mini', input: [ { role:'system', content: system }, { role:'user', content: `Demande utilisateur: ${message}\n\nDonnées disponibles:\n${dataContext}\n\nRéponds en 6 à 10 lignes maximum, puis propose l'action suivante.` } ], max_output_tokens: 900 };
  const res = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{ 'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/json' }, body:JSON.stringify(body) });
  const json = await res.json();
  if(!res.ok) throw new Error(json.error?.message || `OpenAI HTTP ${res.status}`);
  if(json.output_text) return json.output_text;
  const parts=[];
  for(const item of json.output||[]){ for(const c of item.content||[]){ if(c.text) parts.push(c.text); } }
  return parts.join('\n').trim() || null;
}

app.get('/api/health', (_req,res)=>res.json({ ok:true, name:'assistant-france-travail-agent', port:PORT, events:EVENTS_URL, formations:FORMATIONS_URL }));
app.post('/api/events', async (req,res)=>{ const city=extractCity(req.body.message||'', req.body.city); const query=cleanup(req.body.query||''); res.json(await searchEvents({ city, query })); });
app.post('/api/formations', async (req,res)=>{ const city=extractCity(req.body.message||'', req.body.city); const metier=cleanup(req.body.metier||extractMetier(req.body.message||'')); res.json(await searchFormations({ city, metier, financement:true })); });
app.post('/api/chat', async (req,res)=>{
  const message = String(req.body.message||'');
  const city = extractCity(message, req.body.city);
  const metier = extractMetier(message);
  const intent = classify(message);
  let cards=[]; let searchInfo=null;
  try{
    if(intent === 'events') searchInfo = await searchEvents({ city, query: metier || '' });
    else if(intent === 'formations') searchInfo = await searchFormations({ city, metier, financement:wantsFinancing(message) });
    else if(intent === 'orientation') cards = fallbackCards('general');
    if(searchInfo) cards = searchInfo.cards || [];
  }catch(e){ searchInfo = { ok:false, error:String(e.message||e) }; }
  if((intent==='events'||intent==='formations') && cards.length === 0) cards = fallbackCards(intent);
  let answer = null;
  try{ answer = await callOpenAI({ apiKey:req.body.openaiKey || process.env.OPENAI_API_KEY, model:req.body.model || process.env.OPENAI_MODEL, message, intent, city, metier, cards }); }catch(e){ answer = null; }
  if(!answer) answer = fallbackAnswer(intent, city, metier, cards, searchInfo?.error);
  res.json({ ok:true, intent, city, metier, answer, cards, searchInfo });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Assistant France Travail - agent local lancé sur http://127.0.0.1:${PORT}`);
  console.log('Laisse cette fenêtre ouverte pendant l’utilisation du tchat GitHub Pages.');
});
