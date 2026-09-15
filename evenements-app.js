(() => {
  const zones = {
    idf: { label: 'Île-de-France', code: null },
    '75': { label: 'Paris (75)', code: '75' },
    '77': { label: 'Seine-et-Marne (77)', code: '77' },
    '78': { label: 'Yvelines (78)', code: '78' },
    '91': { label: 'Essonne (91)', code: '91' },
    '92': { label: 'Hauts-de-Seine (92)', code: '92' },
    '93': { label: 'Seine-Saint-Denis (93)', code: '93' },
    '94': { label: 'Val-de-Marne (94)', code: '94' },
    '95': { label: 'Val-d’Oise (95)', code: '95' }
  };

  const categoryLabels = {
    mrs: 'MRS', jobdating: 'Job dating', alternance: 'Alternance',
    sanscv: 'Sans CV', ia: 'IA', autre: 'Autre'
  };

  const q = document.getElementById('q');
  const zone = document.getElementById('zone');
  const city = document.getElementById('city');
  const status = document.getElementById('status');
  const listPanel = document.getElementById('listPanel');
  const listGrid = document.getElementById('listGrid');
  const listSummary = document.getElementById('listSummary');
  const listPager = document.getElementById('listPager');
  const listView = document.getElementById('listView');
  const agendaView = document.getElementById('agendaView');
  const agendaPanel = document.getElementById('agendaPanel');
  const calendar = document.getElementById('calendar');
  const agendaTitle = document.getElementById('agendaTitle');
  const agendaData = document.getElementById('agendaData');
  const dayDetails = document.getElementById('dayDetails');

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const LIST_PAGE_SIZE = 12;
  const DAY_PAGE_SIZE = 6;
  let activeMode = 'list';
  let selectedDate = null;
  let calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let events = [];
  let loaded = false;
  let loading = false;
  let listPage = 0;
  let detailsPage = 0;

  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sameDay = (a, b) => a && b && isoDate(a) === isoDate(b);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const formatDateFr = d => new Intl.DateTimeFormat('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(d);
  const formatCardDate = iso => {
    const d = new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat('fr-FR', { weekday:'short', day:'numeric', month:'short' }).format(d);
  };
  const categoryKey = value => categoryLabels[value] ? value : 'autre';
  const eventPageUrl = e => e?.url || `https://openagenda.com/fr/francetravail?search=${encodeURIComponent(e?.title || '')}`;
  const eventImageUrl = e => /^https?:\/\//i.test(e?.image || '') ? e.image : '';

  function currentZone() { return zones[zone.value] || zones.idf; }
  function currentCity() { return city.value || ''; }

  function geographicEvents() {
    const z = currentZone();
    const selectedCity = currentCity();
    return events.filter(e => {
      if (z.code && e.department !== z.code) return false;
      if (selectedCity && e.city !== selectedCity) return false;
      return true;
    });
  }

  function searchableEvents() {
    const term = normalize(q.value);
    return geographicEvents().filter(e => {
      if (e.date < todayIso) return false;
      if (!term) return true;
      const hay = normalize([e.title, e.location, e.city, categoryLabels[categoryKey(e.category)]].join(' '));
      return hay.includes(term);
    }).sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||'') || (a.title||'').localeCompare(b.title||''));
  }

  function eventsForDate(d) {
    const target = isoDate(d);
    return geographicEvents().filter(e => e.date === target)
      .sort((a,b) => (a.time||'').localeCompare(b.time||'') || (a.title||'').localeCompare(b.title||''));
  }

  function populateCities() {
    const previous = city.value;
    const z = currentZone();
    const cities = [...new Set(events
      .filter(e => !z.code || e.department === z.code)
      .map(e => (e.city || '').trim())
      .filter(Boolean))]
      .sort((a,b) => a.localeCompare(b,'fr',{sensitivity:'base'}));

    city.innerHTML = '<option value="">Toutes les villes</option>' + cities.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    city.disabled = !loaded || cities.length === 0;
    if (cities.includes(previous)) city.value = previous;
    else city.value = '';
  }

  async function loadData(force=false) {
    if (loaded && !force) return;
    if (loading) return;
    loading = true;
    status.textContent = 'Chargement des événements…';
    agendaData.textContent = 'Chargement du calendrier…';
    try {
      let data = window.FRAI_EVENTS_IDF || null;
      if (!data) {
        const src = new URL('events-idf.json', window.location.href).toString();
        const r = await fetch(`${src}?v=${Date.now()}`, { cache:'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        data = await r.json();
      }
      events = Array.isArray(data.events) ? data.events : [];
      loaded = true;
      populateCities();
      const range = data?.range?.from && data?.range?.to ? ` · ${data.range.from.split('-').reverse().join('/')} → ${data.range.to.split('-').reverse().join('/')}` : '';
      agendaData.textContent = `${events.length} événements IDF disponibles${range}`;
      if (!selectedDate) selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      status.textContent = `${events.length} événements chargés — Île-de-France`;
    } catch (err) {
      console.error('FRAI events', err);
      loaded = false;
      status.textContent = 'Impossible de charger les événements pour le moment.';
      agendaData.textContent = 'Agenda temporairement indisponible.';
    } finally {
      loading = false;
      renderList();
      renderCalendar();
      renderDayDetails();
    }
  }

  function renderList() {
    if (!loaded) {
      listGrid.innerHTML = '<div class="empty-list">Chargement des événements…</div>';
      listSummary.textContent = '';
      listPager.innerHTML = '';
      return;
    }
    const filtered = searchableEvents();
    const totalPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE));
    if (listPage >= totalPages) listPage = totalPages - 1;
    const start = listPage * LIST_PAGE_SIZE;
    const visible = filtered.slice(start, start + LIST_PAGE_SIZE);
    const z = currentZone();
    const c = currentCity();
    listSummary.textContent = `${filtered.length} résultat${filtered.length>1?'s':''} · ${z.label}${c ? ` · ${c}` : ''}`;
    status.textContent = `Résultats pour « ${q.value || 'tous les événements'} » — ${z.label}${c ? ` — ${c}` : ''}`;

    if (!visible.length) {
      listGrid.innerHTML = '<div class="empty-list">Aucun événement ne correspond à cette recherche.</div>';
    } else {
      listGrid.innerHTML = visible.map(e => {
        const cat = categoryKey(e.category);
        const image = eventImageUrl(e);
        const media = image
          ? `<div class="event-thumb"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('event-thumb-empty');this.remove()"></div>`
          : `<div class="event-thumb event-thumb-empty" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m7 17 3-3 2 2 2-2 3 3"/></svg></div>`;
        return `<a class="event-card" href="${esc(eventPageUrl(e))}" target="_blank" rel="noopener noreferrer" title="Ouvrir la fiche de cet événement">
          ${media}
          <div class="event-card-content">
            <div class="event-card-top"><span class="event-date">${esc(formatCardDate(e.date))}</span><span class="event-time">${esc(e.time || '—')}</span></div>
            <div class="event-card-title">${esc(e.title || 'Événement France Travail')}</div>
            <div class="event-card-location">${esc(e.city || e.location || 'Lieu non précisé')}${e.city && e.location && normalize(e.location)!==normalize(e.city) ? ` · ${esc(e.location)}` : ''}</div>
            <div class="event-card-bottom"><span class="event-category"><i class="dot dot-${cat}"></i>${esc(categoryLabels[cat])}</span><span class="event-open">Voir ↗</span></div>
          </div>
        </a>`;
      }).join('');
    }

    if (totalPages > 1) {
      listPager.innerHTML = `<button id="prevList" type="button" ${listPage===0?'disabled':''}>‹ Précédents</button><span>${listPage+1} / ${totalPages}</span><button id="nextList" type="button" ${listPage>=totalPages-1?'disabled':''}>Suivants ›</button>`;
      document.getElementById('prevList')?.addEventListener('click', () => { if (listPage>0) { listPage--; renderList(); } });
      document.getElementById('nextList')?.addEventListener('click', () => { if (listPage<totalPages-1) { listPage++; renderList(); } });
    } else listPager.innerHTML = '';
  }

  function renderCalendar() {
    calendar.innerHTML = '';
    agendaTitle.textContent = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(calendarMonth);
    ['L','M','M','J','V','S','D'].forEach(label => {
      const e=document.createElement('div'); e.className='dow'; e.textContent=label; calendar.appendChild(e);
    });
    const y=calendarMonth.getFullYear(), m=calendarMonth.getMonth();
    const first=new Date(y,m,1), mondayOffset=(first.getDay()+6)%7, start=new Date(y,m,1-mondayOffset);
    for (let i=0;i<42;i++) {
      const d=new Date(start); d.setDate(start.getDate()+i);
      const evs=loaded?eventsForDate(d):[];
      const b=document.createElement('button'); b.type='button'; b.className='day';
      if (d.getMonth()!==m) b.classList.add('other');
      if (sameDay(d,now)) b.classList.add('today');
      if (sameDay(d,selectedDate)) b.classList.add('selected');
      b.innerHTML=`<span class="daynum">${d.getDate()}</span><span class="dots"></span><span class="daycount">${evs.length||''}</span>`;
      const dots=b.querySelector('.dots');
      [...new Set(evs.map(e=>categoryKey(e.category)))].forEach(cat=>{const dot=document.createElement('i');dot.className=`dot dot-${cat}`;dot.title=categoryLabels[cat];dots.appendChild(dot)});
      b.title=`${formatDateFr(d)} — ${evs.length} événement${evs.length>1?'s':''}`;
      b.addEventListener('click',()=>{selectedDate=new Date(d.getFullYear(),d.getMonth(),d.getDate());calendarMonth=new Date(d.getFullYear(),d.getMonth(),1);detailsPage=0;renderCalendar();renderDayDetails()});
      calendar.appendChild(b);
    }
  }

  function renderDayDetails() {
    if (!selectedDate) { dayDetails.innerHTML='<div class="day-empty">Choisissez un jour dans le calendrier.</div>'; return; }
    const evs=loaded?eventsForDate(selectedDate):[];
    const z=currentZone(), c=currentCity();
    let html=`<div class="day-details-head"><div><div class="day-details-title">${esc(formatDateFr(selectedDate))}</div><div class="day-total">${evs.length} événement${evs.length>1?'s':''} · ${esc(z.label)}${c?` · ${esc(c)}`:''}</div></div></div>`;
    if (!loaded) { dayDetails.innerHTML=html+'<div class="day-empty">Chargement des événements…</div>'; return; }
    if (!evs.length) { dayDetails.innerHTML=html+'<div class="day-empty">Aucun événement recensé pour cette journée dans la zone sélectionnée.</div>'; return; }
    const totalPages=Math.max(1,Math.ceil(evs.length/DAY_PAGE_SIZE));
    if (detailsPage>=totalPages) detailsPage=totalPages-1;
    const start=detailsPage*DAY_PAGE_SIZE;
    html+='<div class="event-day-list">'+evs.slice(start,start+DAY_PAGE_SIZE).map(e=>{
      const cat=categoryKey(e.category);
      return `<a class="day-event day-event-link" href="${esc(eventPageUrl(e))}" target="_blank" rel="noopener noreferrer"><i class="edot dot-${cat}"></i><div class="etime">${esc(e.time||'—')}</div><div><div class="etitle">${esc(e.title||'Événement France Travail')}</div><div class="elocation">${esc(e.location||e.city||'Lieu non précisé')}</div><div class="event-meta-line"><span class="ecat"><i class="dot dot-${cat}"></i>${esc(categoryLabels[cat])}</span><span class="event-open">Voir la fiche ↗</span></div></div></a>`;
    }).join('')+'</div>';
    if (totalPages>1) html+=`<div class="pager"><button id="prevEvents" type="button" ${detailsPage===0?'disabled':''}>‹ Précédents</button><span>${detailsPage+1} / ${totalPages}</span><button id="nextEvents" type="button" ${detailsPage>=totalPages-1?'disabled':''}>Suivants ›</button></div>`;
    dayDetails.innerHTML=html;
    document.getElementById('prevEvents')?.addEventListener('click',()=>{if(detailsPage>0){detailsPage--;renderDayDetails()}});
    document.getElementById('nextEvents')?.addEventListener('click',()=>{if(detailsPage<totalPages-1){detailsPage++;renderDayDetails()}});
  }

  function setView(mode) {
    activeMode=mode;
    const agenda=mode==='agenda';
    listPanel.classList.toggle('hidden',agenda);
    agendaPanel.classList.toggle('open',agenda);
    agendaPanel.setAttribute('aria-hidden',String(!agenda));
    listView.classList.toggle('active',!agenda);
    agendaView.classList.toggle('active',agenda);
    listView.setAttribute('aria-pressed',String(!agenda));
    agendaView.setAttribute('aria-pressed',String(agenda));
    if (agenda) {
      if (!selectedDate) selectedDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      calendarMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
      detailsPage=0;
      status.textContent=`Agenda — ${currentZone().label}${currentCity()?` — ${currentCity()}`:''}`;
      renderCalendar(); renderDayDetails();
    } else renderList();
  }

  document.getElementById('f').addEventListener('submit',e=>{e.preventDefault();listPage=0;setView('list');renderList()});
  zone.addEventListener('change',()=>{populateCities();listPage=0;detailsPage=0;if(activeMode==='agenda'){renderCalendar();renderDayDetails()}else renderList()});
  city.addEventListener('change',()=>{listPage=0;detailsPage=0;if(activeMode==='agenda'){renderCalendar();renderDayDetails()}else renderList()});
  q.addEventListener('input',()=>{if(activeMode==='list'){listPage=0;renderList()}});
  document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{q.value=b.dataset.q;listPage=0;setView('list');renderList()}));
  listView.addEventListener('click',()=>setView('list'));
  agendaView.addEventListener('click',()=>setView('agenda'));
  document.getElementById('prevMonth').addEventListener('click',()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);selectedDate=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);detailsPage=0;renderCalendar();renderDayDetails()});
  document.getElementById('nextMonth').addEventListener('click',()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);selectedDate=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);detailsPage=0;renderCalendar();renderDayDetails()});
  document.getElementById('clearDate').addEventListener('click',()=>{selectedDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());calendarMonth=new Date(now.getFullYear(),now.getMonth(),1);detailsPage=0;renderCalendar();renderDayDetails()});

  loadData();
})();