(() => {
  const API_BASE = 'https://frai-agency-events.onrender.com';
  const MAX_IMAGE = 800000;
  const today = () => new Date().toISOString().slice(0,10);

  function addStyles(){
    const s=document.createElement('style');
    s.textContent=`
    .public-modal{position:fixed;inset:0;z-index:9999;background:rgba(16,24,40,.55);display:none;align-items:center;justify-content:center;padding:18px}.public-modal.open{display:flex}.public-dialog{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 24px 80px rgba(16,24,40,.28);padding:18px}.public-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.public-head h2{margin:0;font-size:20px}.public-head p{margin:4px 0 0;font-size:12px;color:#667085;line-height:1.4}.public-close{width:38px;height:38px;padding:0;background:#f2f4f7;color:#344054;border:1px solid #d0d5dd;font-size:22px}.public-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.public-grid .full{grid-column:1/-1}.public-grid label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#344054}.public-grid input,.public-grid select,.public-grid textarea{width:100%;border:1px solid #aeb8c5;border-radius:8px;background:#fff;padding:10px 11px;font:inherit}.public-grid input,.public-grid select{height:43px}.public-grid textarea{min-height:96px;resize:vertical}.public-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:14px}.public-actions button{height:40px}.public-cancel{background:#fff;color:#344054;border:1px solid #d0d5dd}.public-msg{margin-right:auto;font-size:12px;color:#667085}.public-msg.error{color:#b42318}.public-msg.ok{color:#067647}.public-help{font-size:11px!important;font-weight:400!important;color:#667085!important}.public-preview{display:none;margin-top:6px;width:100%;max-height:170px;object-fit:cover;border-radius:8px;border:1px solid #e4e7ec}.public-preview.on{display:block}.public-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}
    @media(max-width:700px){.public-grid{grid-template-columns:1fr}.public-grid .full{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function modal(){return `
  <div id="publicEventModal" class="public-modal" role="dialog" aria-modal="true" aria-labelledby="publicEventTitle">
    <div class="public-dialog">
      <div class="public-head"><div><h2 id="publicEventTitle">Ajouter un événement</h2><p>Aucun compte n’est nécessaire. L’événement est publié directement dans cet agenda.</p></div><button id="publicClose" class="public-close" type="button" aria-label="Fermer">×</button></div>
      <form id="publicEventForm">
        <div class="public-grid">
          <label class="full">Titre *<input name="title" maxlength="160" required placeholder="Ex. Atelier recrutement sans CV"></label>
          <label>Date *<input name="date" type="date" required></label>
          <label>Catégorie<select name="category"><option value="autre">Autre</option><option value="mrs">MRS</option><option value="jobdating">Job dating</option><option value="alternance">Alternance</option><option value="sanscv">Sans CV</option><option value="ia">IA</option></select></label>
          <label>Début<input name="time" type="time"></label><label>Fin<input name="end_time" type="time"></label>
          <label>Département *<select name="department" required><option value="92">Hauts-de-Seine (92)</option><option value="75">Paris (75)</option><option value="77">Seine-et-Marne (77)</option><option value="78">Yvelines (78)</option><option value="91">Essonne (91)</option><option value="93">Seine-Saint-Denis (93)</option><option value="94">Val-de-Marne (94)</option><option value="95">Val-d’Oise (95)</option></select></label>
          <label>Ville *<input name="city" maxlength="120" required placeholder="Issy-les-Moulineaux"></label>
          <label class="full">Adresse / lieu<input name="location" maxlength="240" placeholder="Adresse, agence, salle…"></label>
          <label>Organisateur<input name="organizer" maxlength="160" placeholder="Nom de l’organisateur"></label>
          <label>Nombre de places<input name="capacity" type="number" min="1" max="100000" placeholder="Facultatif"></label>
          <label class="full">Lien d’inscription<input name="registration_url" type="url" placeholder="https://…"></label>
          <label class="full">Description<textarea name="description" maxlength="4000" placeholder="Décrivez l’événement, le public visé et les modalités."></textarea></label>
          <label class="full">Image<input id="publicImage" type="file" accept="image/jpeg,image/png,image/webp"><span class="public-help">JPG, PNG ou WebP — 800 Ko maximum.</span><img id="publicPreview" class="public-preview" alt="Aperçu"></label>
          <label class="public-hp" aria-hidden="true">Site web<input name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <div class="public-actions"><span id="publicMsg" class="public-msg"></span><button id="publicCancel" class="public-cancel" type="button">Annuler</button><button id="publicSubmit" type="submit">Publier</button></div>
      </form>
    </div>
  </div>`}

  const open=()=>{document.getElementById('publicEventModal')?.classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>document.querySelector('#publicEventForm input[name="title"]')?.focus(),50)};
  const close=()=>{document.getElementById('publicEventModal')?.classList.remove('open');document.body.style.overflow=''};

  function readImage(file){return new Promise((resolve,reject)=>{
    if(!file)return resolve('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return reject(new Error('Format image non autorisé.'));
    if(file.size>MAX_IMAGE)return reject(new Error('Image trop lourde : 800 Ko maximum.'));
    const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Impossible de lire l’image.'));r.readAsDataURL(file);
  })}

  async function submit(e){
    e.preventDefault();
    const form=e.currentTarget,msg=document.getElementById('publicMsg'),btn=document.getElementById('publicSubmit');
    msg.className='public-msg';msg.textContent='Publication…';btn.disabled=true;
    try{
      const fd=new FormData(form),p={};
      ['title','date','time','end_time','department','city','location','category','description','registration_url','organizer','capacity','website'].forEach(k=>p[k]=fd.get(k)||'');
      p.image=await readImage(document.getElementById('publicImage')?.files?.[0]);
      const r=await fetch(`${API_BASE}/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Publication impossible.');
      msg.className='public-msg ok';msg.textContent='Événement publié. Actualisation…';
      setTimeout(()=>window.location.reload(),650);
    }catch(err){msg.className='public-msg error';msg.textContent=err.message||'Publication impossible.';btn.disabled=false}
  }

  function init(){
    addStyles();document.body.insertAdjacentHTML('beforeend',modal());
    const add=document.querySelector('.add-event');
    if(add){add.removeAttribute('href');add.removeAttribute('target');add.removeAttribute('rel');add.setAttribute('role','button');add.style.cursor='pointer';add.addEventListener('click',e=>{e.preventDefault();open()})}
    document.querySelector('#publicEventForm input[name="date"]')?.setAttribute('min',today());
    document.getElementById('publicClose')?.addEventListener('click',close);document.getElementById('publicCancel')?.addEventListener('click',close);
    document.getElementById('publicEventModal')?.addEventListener('click',e=>{if(e.target.id==='publicEventModal')close()});document.getElementById('publicEventForm')?.addEventListener('submit',submit);
    document.getElementById('publicImage')?.addEventListener('change',e=>{const f=e.target.files?.[0],p=document.getElementById('publicPreview');if(!f){p.classList.remove('on');return}const u=URL.createObjectURL(f);p.src=u;p.classList.add('on');p.onload=()=>URL.revokeObjectURL(u)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
