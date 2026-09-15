(() => {
  const API_BASE = 'https://frai-agency-events.onrender.com';
  const DATA_URL_MAX = 800000;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const inTwoYears = () => { const d=new Date(); d.setFullYear(d.getFullYear()+2); return d.toISOString().slice(0,10); };

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .public-add-btn{height:42px;background:#0b6bcb;color:#fff;border:0;border-radius:9px;padding:0 14px;font-size:13px;font-weight:800;white-space:nowrap}
      .public-add-btn:hover{background:#075aa9}.public-event-card{border-color:#f0b55b!important}.public-event-badge{display:inline-flex;align-items:center;border:1px solid #f5c77e;background:#fff5e6;color:#8a4b00;border-radius:999px;padding:2px 6px;font-size:9px;font-weight:800;white-space:nowrap}
      .public-modal{position:fixed;inset:0;z-index:9999;background:rgba(16,24,40,.55);display:none;align-items:center;justify-content:center;padding:18px}.public-modal.open{display:flex}.public-dialog{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 24px 80px rgba(16,24,40,.25);padding:18px}.public-dialog-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.public-dialog h2{margin:0;font-size:20px}.public-dialog p{margin:4px 0 0;color:#667085;font-size:12px;line-height:1.4}.public-close{width:38px;height:38px;padding:0;background:#f2f4f7;color:#344054;border:1px solid #d0d5dd;font-size:22px}.public-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.public-form-grid .full{grid-column:1/-1}.public-form-grid label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#344054}.public-form-grid input,.public-form-grid select,.public-form-grid textarea{width:100%;border:1px solid #aeb8c5;border-radius:8px;background:#fff;padding:10px 11px;font:inherit}.public-form-grid input,.public-form-grid select{height:43px}.public-form-grid textarea{min-height:92px;resize:vertical}.public-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:14px}.public-cancel{height:40px;background:#fff;color:#344054;border:1px solid #d0d5dd}.public-submit{height:40px;background:#0063cb}.public-form-msg{margin-right:auto;font-size:12px;color:#667085}.public-form-msg.error{color:#b42318}.public-form-msg.ok{color:#067647}.public-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}.public-help{font-size:11px!important;font-weight:400!important;color:#667085!important}.public-image-preview{display:none;margin-top:6px;width:100%;max-height:160px;object-fit:cover;border-radius:8px;border:1px solid #e4e7ec}.public-image-preview.on{display:block}
      @media(max-width:700px){.public-form-grid{grid-template-columns:1fr}.public-form-grid .full{grid-column:auto}.public-add-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function modalMarkup() {
    return `
      <div id="publicEventModal" class="public-modal" role="dialog" aria-modal="true" aria-labelledby="publicEventTitle">
        <div class="public-dialog">
          <div class="public-dialog-head"><div><h2 id="publicEventTitle">Ajouter un événement</h2><p>Publication publique sans compte. L’événement apparaît dans la grille et l’agenda après validation du formulaire.</p></div><button id="publicClose" class="public-close" type="button" aria-label="Fermer">×</button></div>
          <form id="publicEventForm">
            <div class="public-form-grid">
              <label class="full">Titre *<input name="title" maxlength="160" required placeholder="Ex. Atelier recrutement sans CV"></label>
              <label>Date *<input name="date" type="date" required></label>
              <label>Catégorie<select name="category"><option value="autre">Autre</option><option value="mrs">MRS</option><option value="jobdating">Job dating</option><option value="alternance">Alternance</option><option value="sanscv">Sans CV</option><option value="ia">IA</option></select></label>
              <label>Début<input name="time" type="time"></label>
              <label>Fin<input name="end_time" type="time"></label>
              <label>Département *<select name="department" required><option value="92">Hauts-de-Seine (92)</option><option value="75">Paris (75)</option><option value="77">Seine-et-Marne (77)</option><option value="78">Yvelines (78)</option><option value="91">Essonne (91)</option><option value="93">Seine-Saint-Denis (93)</option><option value="94">Val-de-Marne (94)</option><option value="95">Val-d’Oise (95)</option></select></label>
              <label>Ville *<input name="city" maxlength="120" required placeholder="Issy-les-Moulineaux"></label>
              <label class="full">Adresse / lieu<input name="location" maxlength="240" placeholder="Adresse, agence, salle…"></label>
              <label>Organisateur<input name="organizer" maxlength="160" placeholder="Nom de l’organisateur"></label>
              <label>Nombre de places<input name="capacity" type="number" min="1" max="100000" placeholder="Facultatif"></label>
              <label class="full">Lien d’inscription<input name="registration_url" type="url" placeholder="https://…"></label>
              <label class="full">Description<textarea name="description" maxlength="4000" placeholder="Décrivez l’événement, le public visé et les modalités."></textarea></label>
              <label class="full">Image<input id="publicImage" name="image_file" type="file" accept="image/jpeg,image/png,image/webp"><span class="public-help">JPG, PNG ou WebP — 800 Ko maximum.</span><img id="publicImagePreview" class="public-image-preview" alt="Aperçu"></label>
              <label class="public-hp" aria-hidden="true">Site web<input name="website" tabindex="-1" autocomplete="off"></label>
            </div>
            <div class="public-actions"><span id="publicFormMsg" class="public-form-msg"></span><button id="publicCancel" class="public-cancel" type="button">Annuler</button><button id="publicSubmit" class="public-submit" type="submit">Publier l’événement</button></div>
          </form>
        </div>
      </div>`;
  }

  function openModal() {
    const modal=document.getElementById('publicEventModal');
    modal.classList.add('open');
    document.body.style.overflow='hidden';
    setTimeout(()=>modal.querySelector('input[name="title"]')?.focus(),50);
  }
  function closeModal() {
    document.getElementById('publicEventModal')?.classList.remove('open');
    document.body.style.overflow='';
  }

  function readImage(file) {
    return new Promise((resolve,reject)=>{
      if (!file) return resolve('');
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return reject(new Error('Format image non autorisé.'));
      if (file.size > DATA_URL_MAX) return reject(new Error('Image trop lourde : 800 Ko maximum.'));
      const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result||'')); reader.onerror=()=>reject(new Error('Impossible de lire l’image.')); reader.readAsDataURL(file);
    });
  }

  function decoratePublicCards() {
    document.querySelectorAll('a.event-card[href*="evenement-agence.html?id="]').forEach(card=>{
      card.classList.add('public-event-card');
      const bottom=card.querySelector('.event-card-bottom');
      if (bottom && !bottom.querySelector('.public-event-badge')) bottom.insertAdjacentHTML('afterbegin','<span class="public-event-badge">Ajout public</span>');
    });
    document.querySelectorAll('a.day-event-link[href*="evenement-agence.html?id="]').forEach(card=>{
      if (!card.querySelector('.public-event-badge')) card.querySelector('.event-meta-line')?.insertAdjacentHTML('afterbegin','<span class="public-event-badge">Ajout public</span>');
    });
  }

  async function fetchAndMerge() {
    try {
      const r=await fetch(`${API_BASE}/events?from=${today()}&to=${inTwoYears()}`,{cache:'no-store'});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data=await r.json();
      const incoming=Array.isArray(data.events)?data.events:[];
      const target=window.FRAI_EVENTS_IDF?.events;
      if (!Array.isArray(target)) return;
      const ids=new Set(target.map(e=>e.id).filter(Boolean));
      incoming.forEach(e=>{ if (!ids.has(e.id)) { target.push(e); ids.add(e.id); } });
      document.getElementById('zone')?.dispatchEvent(new Event('change',{bubbles:true}));
      setTimeout(decoratePublicCards,80);
    } catch (err) {
      console.warn('Public agency events unavailable',err);
    }
  }

  async function submitForm(ev) {
    ev.preventDefault();
    const form=ev.currentTarget, msg=document.getElementById('publicFormMsg'), btn=document.getElementById('publicSubmit');
    msg.className='public-form-msg'; msg.textContent='Publication…'; btn.disabled=true;
    try {
      const fd=new FormData(form);
      const payload={};
      ['title','date','time','end_time','department','city','location','category','description','registration_url','organizer','capacity','website'].forEach(k=>payload[k]=fd.get(k)||'');
      payload.image=await readImage(document.getElementById('publicImage')?.files?.[0]);
      const r=await fetch(`${API_BASE}/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(data.error||'Publication impossible.');
      msg.className='public-form-msg ok'; msg.textContent='Événement publié.';
      form.reset();
      form.querySelector('input[name="date"]').min=today();
      document.getElementById('publicImagePreview')?.classList.remove('on');
      await fetchAndMerge();
      const search=document.getElementById('q'); if (search) { search.value=''; search.dispatchEvent(new Event('input',{bubbles:true})); }
      setTimeout(closeModal,650);
    } catch (err) {
      msg.className='public-form-msg error'; msg.textContent=err.message||'Publication impossible.';
    } finally { btn.disabled=false; }
  }

  function init() {
    injectStyles();
    document.body.insertAdjacentHTML('beforeend',modalMarkup());
    const switcher=document.querySelector('.view-switch');
    if (switcher) switcher.insertAdjacentHTML('afterbegin','<button id="publicAddEvent" class="public-add-btn" type="button">+ Ajouter un événement</button>');
    else document.querySelector('.toolbar')?.insertAdjacentHTML('beforeend','<button id="publicAddEvent" class="public-add-btn" type="button">+ Ajouter un événement</button>');

    const dateInput=document.querySelector('#publicEventForm input[name="date"]'); if(dateInput) dateInput.min=today();
    document.getElementById('publicAddEvent')?.addEventListener('click',openModal);
    document.getElementById('publicClose')?.addEventListener('click',closeModal);
    document.getElementById('publicCancel')?.addEventListener('click',closeModal);
    document.getElementById('publicEventModal')?.addEventListener('click',e=>{if(e.target.id==='publicEventModal')closeModal()});
    document.getElementById('publicEventForm')?.addEventListener('submit',submitForm);
    document.getElementById('publicImage')?.addEventListener('change',e=>{
      const file=e.target.files?.[0], preview=document.getElementById('publicImagePreview');
      if (!file) { preview.classList.remove('on'); return; }
      const u=URL.createObjectURL(file); preview.src=u; preview.classList.add('on'); preview.onload=()=>URL.revokeObjectURL(u);
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
    const observer=new MutationObserver(()=>decoratePublicCards());
    ['listGrid','dayDetails'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,subtree:true})});
    fetchAndMerge();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
