const DEFAULT_REPO = 'XDSawyerLoL/FRAI';
const DEFAULT_BRANCH = 'main';
const ALLOWED_DEPARTMENTS = ['75','77','78','91','92','93','94','95'];
const ALLOWED_CATEGORIES = ['mrs','jobdating','alternance','sanscv','ia','autre'];

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><html><body style="font-family:Arial;padding:24px"><h2>FRAI Event Bridge</h2><p>Service actif.</p></body></html>');
}

function doPost(e) {
  try {
    const p = e && e.parameter ? e.parameter : {};
    if (String(p.website || '').trim()) throw new Error('Requête refusée.');

    const title = clean(p.title, 160);
    const date = clean(p.date, 10);
    const department = clean(p.department, 2);
    const city = clean(p.city, 120);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !ALLOWED_DEPARTMENTS.includes(department) || !city) {
      throw new Error('Champs obligatoires invalides.');
    }

    const category = ALLOWED_CATEGORIES.includes(clean(p.category, 30)) ? clean(p.category, 30) : 'autre';
    const id = 'agency-' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyyMMdd-HHmmss') + '-' + Math.random().toString(36).slice(2, 8);
    const image = saveImageIfPresent(id, p.image_base64 || '', p.image_type || '');

    const event = {
      id,
      source: 'agency',
      title,
      date,
      time: clean(p.time, 5),
      end_time: clean(p.end_time, 5),
      department,
      city,
      location: clean(p.location, 240),
      organizer: clean(p.organizer, 160),
      capacity: numberOrBlank(p.capacity),
      registration_url: safeUrl(p.registration_url),
      description: clean(p.description, 4000),
      category,
      image,
      published: true,
      url: 'evenement-agence.html?id=' + encodeURIComponent(id),
      created_at: new Date().toISOString()
    };

    putGithubFile('agency-submissions/' + id + '.json', JSON.stringify(event, null, 2), 'Add agency event ' + id);
    return successPage(event);
  } catch (err) {
    return errorPage(err && err.message ? err.message : 'Publication impossible.');
  }
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function numberOrBlank(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : '';
}

function safeUrl(value) {
  const s = String(value || '').trim();
  return /^https:\/\//i.test(s) ? s.slice(0, 1200) : '';
}

function saveImageIfPresent(id, dataUrl, mime) {
  const value = String(dataUrl || '');
  if (!value) return '';
  const m = value.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw new Error('Format d’image invalide.');
  const type = m[1];
  const raw = m[2];
  const bytes = Utilities.base64Decode(raw);
  if (bytes.length > 800 * 1024) throw new Error('Image trop lourde (800 Ko maximum).');
  const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp';
  putGithubBase64('agency-images/' + id + '.' + ext, Utilities.base64Encode(bytes), 'Add agency event image ' + id);
  return 'agency-images/' + id + '.' + ext;
}

function githubConfig() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Le bridge GitHub n’est pas configuré.');
  return {
    token,
    repo: props.getProperty('GITHUB_REPO') || DEFAULT_REPO,
    branch: props.getProperty('GITHUB_BRANCH') || DEFAULT_BRANCH
  };
}

function putGithubFile(path, text, message) {
  putGithubBase64(path, Utilities.base64Encode(text, Utilities.Charset.UTF_8), message);
}

function putGithubBase64(path, content, message) {
  const cfg = githubConfig();
  const url = 'https://api.github.com/repos/' + cfg.repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  const payload = JSON.stringify({ message, content, branch: cfg.branch });
  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload,
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('GitHub a refusé la publication (' + code + ').');
}

function successPage(event) {
  const title = html(event.title);
  const id = html(event.id);
  return HtmlService.createHtmlOutput(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Événement publié</title><style>body{font-family:Arial;background:#f5f7fa;margin:0;padding:24px;color:#101828}.card{max-width:640px;margin:40px auto;background:#fff;border:1px solid #d0d5dd;border-radius:14px;padding:24px}.ok{color:#067647;font-weight:800}.btn{display:inline-flex;margin-top:16px;padding:12px 16px;border-radius:8px;background:#0063cb;color:#fff;text-decoration:none;font-weight:700}</style></head><body><div class="card"><h1>Événement publié</h1><p class="ok">${title}</p><p>La création GitHub a été effectuée. L’événement apparaîtra dans l’agenda après le build automatique, généralement en moins de deux minutes.</p><p style="font-size:12px;color:#667085">Référence : ${id}</p><a class="btn" href="https://xdsawyerlol.github.io/FRAI/evenements.html">Retour à l’agenda</a></div></body></html>`);
}

function errorPage(message) {
  return HtmlService.createHtmlOutput(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Publication impossible</title></head><body style="font-family:Arial;background:#f5f7fa;padding:24px"><div style="max-width:640px;margin:40px auto;background:#fff;border:1px solid #d0d5dd;border-radius:14px;padding:24px"><h1>Publication impossible</h1><p>${html(message)}</p><p><a href="https://xdsawyerlol.github.io/FRAI/ajouter-evenement.html">Revenir au formulaire</a></p></div></body></html>`);
}

function html(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
