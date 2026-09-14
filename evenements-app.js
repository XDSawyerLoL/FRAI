(() => {
  const zones = {
    idf: { label: 'Île-de-France', department: null, code: null },
    '75': { label: 'Paris (75)', department: 'Paris', code: '75' },
    '77': { label: 'Seine-et-Marne (77)', department: 'Seine-et-Marne', code: '77' },
    '78': { label: 'Yvelines (78)', department: 'Yvelines', code: '78' },
    '91': { label: 'Essonne (91)', department: 'Essonne', code: '91' },
    '92': { label: 'Hauts-de-Seine (92)', department: 'Hauts-de-Seine', code: '92' },
    '93': { label: 'Seine-Saint-Denis (93)', department: 'Seine-Saint-Denis', code: '93' },
    '94': { label: 'Val-de-Marne (94)', department: 'Val-de-Marne', code: '94' },
    '95': { label: 'Val-d’Oise (95)', department: "Val-d'Oise", code: '95' }
  };

  const categoryLabels = {
    mrs: 'MRS', jobdating: 'Job dating', alternance: 'Alternance',
    sanscv: 'Sans CV', ia: 'IA', autre: 'Autre'
  };

  const q = document.getElementById('q');
  const zone = document.getElementById('zone');
  const frame = document.getElementById('frame');
  const viewer = document.getElementById('viewer');
  const status = document.getElementById('status');
  const listView = document.getElementById('listView');
  const agendaView = document.getElementById('agendaView');
  const agendaPanel = document.getElementById('agendaPanel');
  const calendar = document.getElementById('calendar');
  const agendaTitle = document.getElementById('agendaTitle');
  const agendaData = document.getElementById('agendaData');
  const dayDetails = document.getElementById('dayDetails');

  const now = new Date();
  const PAGE_SIZE = 6;
  let activeMode = 'list';
  let selectedDate = null;
  let calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let calendarEvents = [];
  let calendarLoaded = false;
  let calendarLoading = false;
  let detailsPage = 0;

  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sameDay = (a, b) => a && b && isoDate(a) === isoDate(b);
  const cleanKeyword = v => (v || '').trim() || 'MRS';
  const formatDateFr = d => new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(d);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function categoryKey(value) {
    return categoryLabels[value] ? value : 'autre';
  }

  function zoneEvents() {
    const z = zones[zone.value] || zones.idf;
    return calendarEvents.filter(e => !z.code || e.department === z.code);
  }

  function eventsForDate(d) {
    const target = isoDate(d);
    return zoneEvents()
      .filter(e => e.date === target)
      .sort((a, b) => (a.time || '').localeCompare(b.time || '') || (a.title || '').localeCompare(b.title || ''));
  }

  async function loadCalendarData(force = false) {
    if (calendarLoaded && !force) return;
    if (calendarLoading) return;
    calendarLoading = true;
    agendaData.className = 'agenda-data';
    agendaData.textContent = 'Chargement des événements…';

    try {
      let data = window.FRAI_EVENTS_IDF || null;
      if (!data) {
        const src = new URL('events-idf.json', window.location.href).toString();
        const response = await fetch(`${src}?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json();
      }

      calendarEvents = Array.isArray(data.events) ? data.events : [];
      calendarLoaded = true;

      if (!selectedDate) {
        selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const range = data?.range?.from && data?.range?.to
        ? ` · ${data.range.from.split('-').reverse().join('/')} → ${data.range.to.split('-').reverse().join('/')}`
        : '';
      agendaData.textContent = `${calendarEvents.length} événements IDF disponibles${range}`;
    } catch (err) {
      console.error('Agenda FRAI', err);
      calendarLoaded = false;
      agendaData.textContent = 'Agenda temporairement indisponible. La vue liste reste disponible.';
    } finally {
      calendarLoading = false;
      renderCalendar();
      renderDayDetails();
    }
  }

  function urlFor(keyword, key) {
    const z = zones[key] || zones.idf;
    const u = new URL('https://openagenda.com/fr/francetravail');
    u.searchParams.set('search', cleanKeyword(keyword));
    u.searchParams.set('adminLevel1', 'Île-de-France');
    if (z.department) u.searchParams.set('adminLevel2', z.department);
    u.searchParams.append('relative[]', 'current');
    u.searchParams.append('relative[]', 'upcoming');
    return u.toString();
  }

  function runList(keyword, key) {
    const z = zones[key] || zones.idf;
    q.value = cleanKeyword(keyword);
    zone.value = key;
    status.textContent = `Résultats pour « ${q.value} » — ${z.label}`;
    frame.src = urlFor(q.value, key);
  }

  function renderCalendar() {
    calendar.innerHTML = '';
    agendaTitle.textContent = new Intl.DateTimeFormat('fr-FR', {
      month: 'long', year: 'numeric'
    }).format(calendarMonth);

    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(label => {
      const e = document.createElement('div');
      e.className = 'dow';
      e.textContent = label;
      calendar.appendChild(e);
    });

    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const first = new Date(y, m, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(y, m, 1 - mondayOffset);

    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const evs = calendarLoaded ? eventsForDate(d) : [];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      if (d.getMonth() !== m) b.classList.add('other');
      if (sameDay(d, now)) b.classList.add('today');
      if (sameDay(d, selectedDate)) b.classList.add('selected');

      const num = document.createElement('span');
      num.className = 'daynum';
      num.textContent = d.getDate();
      b.appendChild(num);

      const dots = document.createElement('span');
      dots.className = 'dots';
      [...new Set(evs.map(e => categoryKey(e.category)))].forEach(cat => {
        const dot = document.createElement('i');
        dot.className = `dot dot-${cat}`;
        dot.title = categoryLabels[cat];
        dots.appendChild(dot);
      });
      b.appendChild(dots);

      const count = document.createElement('span');
      count.className = 'daycount';
      count.textContent = evs.length ? `${evs.length}` : '';
      b.appendChild(count);

      b.title = `${formatDateFr(d)} — ${evs.length} événement${evs.length > 1 ? 's' : ''}`;
      b.addEventListener('click', () => {
        selectedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        calendarMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        detailsPage = 0;
        renderCalendar();
        renderDayDetails();
      });
      calendar.appendChild(b);
    }
  }

  function renderDayDetails() {
    if (!selectedDate) {
      dayDetails.innerHTML = '<div class="day-empty">Choisissez un jour dans le calendrier.</div>';
      return;
    }

    const evs = calendarLoaded ? eventsForDate(selectedDate) : [];
    const z = zones[zone.value] || zones.idf;
    let html = `<div class="day-details-head"><div><div class="day-details-title">${esc(formatDateFr(selectedDate))}</div><div class="day-total">${evs.length} événement${evs.length > 1 ? 's' : ''} · ${esc(z.label)}</div></div></div>`;

    if (!calendarLoaded) {
      html += '<div class="day-empty">Chargement des événements…</div>';
      dayDetails.innerHTML = html;
      return;
    }

    if (!evs.length) {
      html += '<div class="day-empty">Aucun événement recensé pour cette journée dans la zone sélectionnée.</div>';
      dayDetails.innerHTML = html;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(evs.length / PAGE_SIZE));
    if (detailsPage >= totalPages) detailsPage = totalPages - 1;
    const start = detailsPage * PAGE_SIZE;
    const visible = evs.slice(start, start + PAGE_SIZE);

    html += '<div class="event-day-list">' + visible.map(e => {
      const cat = categoryKey(e.category);
      return `<article class="day-event">
        <i class="edot dot-${cat}"></i>
        <div class="etime">${esc(e.time || '—')}</div>
        <div>
          <div class="etitle">${esc(e.title || 'Événement France Travail')}</div>
          <div class="elocation">${esc(e.location || 'Lieu non précisé')}</div>
          <div class="ecat"><i class="dot dot-${cat}"></i>${esc(categoryLabels[cat])}</div>
        </div>
      </article>`;
    }).join('') + '</div>';

    if (totalPages > 1) {
      html += `<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-top:10px">
        <button id="prevEvents" type="button" class="more-events" style="width:auto;margin:0;justify-self:start;padding:0 12px" ${detailsPage === 0 ? 'disabled' : ''}>‹ Précédents</button>
        <span style="font-size:11px;color:#667085;font-weight:700">${detailsPage + 1} / ${totalPages}</span>
        <button id="nextEvents" type="button" class="more-events" style="width:auto;margin:0;justify-self:end;padding:0 12px" ${detailsPage >= totalPages - 1 ? 'disabled' : ''}>Suivants ›</button>
      </div>`;
    }

    dayDetails.innerHTML = html;
    document.getElementById('prevEvents')?.addEventListener('click', () => {
      if (detailsPage > 0) { detailsPage--; renderDayDetails(); }
    });
    document.getElementById('nextEvents')?.addEventListener('click', () => {
      if (detailsPage < totalPages - 1) { detailsPage++; renderDayDetails(); }
    });
  }

  function setView(mode) {
    activeMode = mode;
    const agenda = mode === 'agenda';
    agendaPanel.classList.toggle('open', agenda);
    agendaPanel.setAttribute('aria-hidden', String(!agenda));
    viewer.classList.toggle('hidden', agenda);
    agendaView.classList.toggle('active', agenda);
    listView.classList.toggle('active', !agenda);
    agendaView.setAttribute('aria-pressed', String(agenda));
    listView.setAttribute('aria-pressed', String(!agenda));

    if (agenda) {
      if (!selectedDate) selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      detailsPage = 0;
      status.textContent = `Agenda — ${(zones[zone.value] || zones.idf).label}`;
      renderCalendar();
      renderDayDetails();
      loadCalendarData();
    } else {
      runList(q.value, zone.value);
    }
  }

  document.getElementById('f').addEventListener('submit', e => {
    e.preventDefault();
    setView('list');
    runList(q.value, zone.value);
  });

  zone.addEventListener('change', () => {
    detailsPage = 0;
    if (activeMode === 'agenda') {
      status.textContent = `Agenda — ${(zones[zone.value] || zones.idf).label}`;
      renderCalendar();
      renderDayDetails();
    } else {
      runList(q.value, zone.value);
    }
  });

  document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    q.value = b.dataset.q;
    setView('list');
    runList(q.value, zone.value);
  }));

  listView.addEventListener('click', () => setView('list'));
  agendaView.addEventListener('click', () => setView('agenda'));

  document.getElementById('prevMonth').addEventListener('click', () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    selectedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    detailsPage = 0;
    renderCalendar();
    renderDayDetails();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    selectedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    detailsPage = 0;
    renderCalendar();
    renderDayDetails();
  });

  document.getElementById('clearDate').addEventListener('click', () => {
    selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    detailsPage = 0;
    renderCalendar();
    renderDayDetails();
  });

  runList('MRS', 'idf');
})();
