(() => {
  const API_BASE = 'https://frai-agency-events.onrender.com';
  const MAX_IMAGE = 800000;

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  function msg(text, kind='') {
    const el = document.getElementById('publicMsg');
    if (!el) return;
    el.className = `public-msg${kind ? ' ' + kind : ''}`;
    el.textContent = text;
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return reject(new Error('Format image non autorisé.'));
      if (file.size > MAX_IMAGE) return reject(new Error('Image trop lourde : 800 Ko maximum.'));
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('Impossible de lire l’image.'));
      r.readAsDataURL(file);
    });
  }

  function matches(events, sig) {
    return (events || []).filter(e =>
      e.date === sig.date &&
      norm(e.title) === norm(sig.title) &&
      norm(e.city) === norm(sig.city)
    ).length;
  }

  function refreshRemoteEvents() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const timer = setTimeout(() => { s.remove(); reject(new Error('Délai de vérification dépassé.')); }, 7000);
      s.src = `${API_BASE}/events.js?verify=${Date.now()}_${Math.random().toString(36).slice(2)}`;
      s.async = true;
      s.onload = () => {
        clearTimeout(timer);
        s.remove();
        resolve(Array.isArray(window.FRAI_AGENCY_EVENTS?.events) ? window.FRAI_AGENCY_EVENTS.events : []);
      };
      s.onerror = () => {
        clearTimeout(timer);
        s.remove();
        reject(new Error('Impossible de vérifier la publication.'));
      };
      document.head.appendChild(s);
    });
  }

  function postHidden(payload) {
    const token = `frai_submit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement('iframe');
    frame.name = token;
    frame.style.display = 'none';
    frame.setAttribute('aria-hidden','true');

    const f = document.createElement('form');
    f.method = 'POST';
    f.action = `${API_BASE}/events`;
    f.target = token;
    f.style.display = 'none';

    Object.entries(payload).forEach(([k,v]) => {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = k;
      i.value = v == null ? '' : String(v);
      f.appendChild(i);
    });

    document.body.appendChild(frame);
    document.body.appendChild(f);
    f.submit();
    setTimeout(() => { f.remove(); frame.remove(); }, 30000);
  }

  async function waitForAppearance(sig, beforeCount) {
    const deadline = Date.now() + 24000;
    let lastError = null;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1700));
      try {
        const events = await refreshRemoteEvents();
        if (matches(events, sig) > beforeCount) return true;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError) throw lastError;
    return false;
  }

  document.addEventListener('submit', async e => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'publicEventForm') return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const btn = document.getElementById('publicSubmit');
    if (btn) btn.disabled = true;
    msg('Publication en cours…');

    try {
      const fd = new FormData(form);
      const payload = {};
      ['title','date','time','end_time','department','city','location','category','description','registration_url','organizer','capacity','website']
        .forEach(k => payload[k] = fd.get(k) || '');
      payload.image = await readImage(document.getElementById('publicImage')?.files?.[0]);

      const sig = { title: payload.title, date: payload.date, city: payload.city };
      const before = matches(window.FRAI_AGENCY_EVENTS?.events || [], sig);

      postHidden(payload);
      msg('Envoi effectué. Vérification de la publication…');

      const ok = await waitForAppearance(sig, before);
      if (!ok) throw new Error('La publication n’a pas été confirmée par le serveur.');

      msg('Événement publié. Actualisation…', 'ok');
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      msg(err?.message || 'Publication impossible.', 'error');
      if (btn) btn.disabled = false;
    }
  }, true);
})();
