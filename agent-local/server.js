import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8798;
const USER_DATA_DIR = path.join(__dirname, '.browser-profile');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..')));

let contextPromise = null;
async function getContext() {
  if (!contextPromise) {
    contextPromise = chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      viewport: { width: 1366, height: 900 },
      args: ['--start-maximized'],
    });
  }
  return contextPromise;
}

function cleanText(v = '') {
  return String(v || '').replace(/\s+/g, ' ').trim();
}
function includesAny(text, patterns) {
  const t = cleanText(text).toLowerCase();
  return patterns.some(p => t.includes(String(p).toLowerCase()));
}
async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function smartFill(page, patterns, value) {
  if (!value) return false;
  const ok = await page.evaluate(({ patterns, value }) => {
    const pats = patterns.map(p => new RegExp(p, 'i'));
    const labelFor = (el) => {
      const id = el.id;
      const lab = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const parentLabel = el.closest('label');
      return [lab?.innerText, parentLabel?.innerText].filter(Boolean).join(' ');
    };
    const inputs = [...document.querySelectorAll('input, textarea, [contenteditable="true"]')];
    for (const el of inputs) {
      const text = [el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('name'), el.id, el.title, labelFor(el)].filter(Boolean).join(' ');
      if (pats.some(r => r.test(text))) {
        el.focus();
        if (el.isContentEditable) el.textContent = value;
        else el.value = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, { patterns, value });
  if (ok) {
    await wait(400);
    try { await page.keyboard.press('Enter'); } catch {}
    await wait(800);
  }
  return ok;
}

async function clickByText(page, texts) {
  for (const text of texts) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(text, 'i') }).first();
      if (await btn.count()) { await btn.click({ timeout: 1500 }); await wait(1200); return true; }
    } catch {}
    try {
      const link = page.getByRole('link', { name: new RegExp(text, 'i') }).first();
      if (await link.count()) { await link.click({ timeout: 1500 }); await wait(1200); return true; }
    } catch {}
  }
  return false;
}

async function clickLabelContaining(page, words) {
  return await page.evaluate((words) => {
    const labels = [...document.querySelectorAll('label, button, [role="checkbox"], input[type="checkbox"]')];
    const lowWords = words.map(w => String(w).toLowerCase());
    for (const el of labels) {
      const txt = (el.innerText || el.getAttribute('aria-label') || el.value || '').toLowerCase();
      if (!txt || !lowWords.some(w => txt.includes(w))) continue;
      try { el.click(); return true; } catch {}
    }
    return false;
  }, words);
}

async function acceptCookies(page) {
  await clickByText(page, ['Accepter', 'Tout accepter', 'OK', 'J’accepte', "J'accepte"]).catch(() => {});
}

async function extractFormationResults(page) {
  await wait(2500);
  return await page.evaluate(() => {
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const anchors = [...document.querySelectorAll('a[href]')];
    const candidates = [];
    for (const a of anchors) {
      const href = new URL(a.getAttribute('href'), location.href).href;
      const title = clean(a.innerText || a.getAttribute('title'));
      if (!title || title.length < 8) continue;
      const near = clean(a.closest('article, li, section, div')?.innerText || '');
      const hay = (href + ' ' + title + ' ' + near).toLowerCase();
      if (!/formation/.test(hay)) continue;
      if (/aide|envoyer|imprimer|accueil|connexion|menu|cookies|candidat/.test(title.toLowerCase())) continue;
      candidates.push({
        titre: title.slice(0, 160),
        lien: href,
        description: near.replace(title, '').slice(0, 700),
        organisme: '',
        lieu: '',
        date: '',
        financement: ''
      });
    }
    const seen = new Set();
    return candidates.filter(c => {
      const key = c.titre + c.lien;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  });
}

async function extractEventResults(page) {
  await wait(2500);
  return await page.evaluate(() => {
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const anchors = [...document.querySelectorAll('a[href]')];
    const out = [];
    for (const a of anchors) {
      const href = new URL(a.getAttribute('href'), location.href).href;
      const title = clean(a.innerText || a.getAttribute('title'));
      if (!title || title.length < 7) continue;
      const block = clean(a.closest('article, li, section, div')?.innerText || '');
      const hay = (href + ' ' + title + ' ' + block).toLowerCase();
      if (!/(evenement|événement|job dating|forum|atelier|reunion|réunion|salon|mesevenementsemploi)/.test(hay)) continue;
      if (/connexion|accueil|menu|cookies|aide|rechercher|filtrer/.test(title.toLowerCase())) continue;
      out.push({
        titre: title.slice(0, 160),
        lien: href,
        description: block.replace(title, '').slice(0, 700),
        lieu: '', ville: '', date: '', heure: '', type: 'Événement emploi', modalite: '', secteur: ''
      });
    }
    const seen = new Set();
    return out.filter(e => {
      const key = e.titre + e.lien;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  });
}

function makeFormationSearchUrl() {
  return 'https://candidat.francetravail.fr/formations/recherche?filtreEstFormationEnCoursOuAVenir=formEnCours&filtreEstFormationTerminee=formEnCours&range=0-9&tri=0';
}

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'assistant-france-travail-agent-local' }));

app.post('/api/formations', async (req, res) => {
  const { metier = '', ville = '', financement = '', query = '' } = req.body || {};
  const ctx = await getContext();
  const page = await ctx.newPage();
  const openedUrl = makeFormationSearchUrl();
  try {
    await page.goto(openedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await acceptCookies(page);
    await wait(2500);
    await smartFill(page, ['formation', 'quelle formation', 'intitulé', 'intitule', 'métier', 'metier', 'mot.?cle', 'domaine'], metier || query);
    await smartFill(page, ['lieu', 'ville', 'localisation', 'où', 'ou'], ville);
    if (financement) {
      if (includesAny(financement, ['france travail', 'pôle emploi', 'pole emploi'])) await clickLabelContaining(page, ['France Travail', 'Pôle emploi', 'Pole emploi']);
      if (includesAny(financement, ['région', 'region'])) await clickLabelContaining(page, ['Région', 'Region', 'Conseil régional', 'Conseil regional']);
      if (includesAny(financement, ['cpf'])) await clickLabelContaining(page, ['CPF', 'Compte personnel']);
    }
    await clickByText(page, ['Rechercher', 'Valider', 'Appliquer', 'Lancer la recherche']);
    await wait(4500);
    const items = await extractFormationResults(page);
    res.json({ ok: true, openedUrl: page.url(), items });
  } catch (e) {
    res.status(200).json({ ok: false, openedUrl: page.url() || openedUrl, items: [], error: String(e.message || e) });
  }
});

app.post('/api/evenements', async (req, res) => {
  const { ville = '', keyword = '', query = '' } = req.body || {};
  const ctx = await getContext();
  const page = await ctx.newPage();
  const openedUrl = 'https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/evenements';
  try {
    await page.goto(openedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await acceptCookies(page);
    await wait(2500);
    await smartFill(page, ['quoi', 'mot.?cle', 'recherche', 'secteur', 'métier', 'metier', 'événement', 'evenement'], keyword || query || 'emploi');
    await smartFill(page, ['où', 'ou', 'lieu', 'ville', 'localisation', 'département', 'departement'], ville);
    await clickByText(page, ['Rechercher', 'Valider', 'Appliquer', 'Filtrer']);
    await wait(4500);
    const items = await extractEventResults(page);
    res.json({ ok: true, openedUrl: page.url(), items });
  } catch (e) {
    res.status(200).json({ ok: false, openedUrl: page.url() || openedUrl, items: [], error: String(e.message || e) });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Agent local prêt : http://127.0.0.1:${PORT}`);
  console.log(`Interface locale : http://127.0.0.1:${PORT}/`);
});
