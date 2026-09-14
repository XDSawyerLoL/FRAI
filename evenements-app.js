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
  const categoryLabels = { mrs: 'MRS', jobdating: 'Job dating', alternance: 'Alternance', sanscv: 'Sans CV', ia: 'IA', autre: 'Autre' };
  const q = document.getElementById('q');
  const zone = document.getElementById('zone');
  const frame = document.getElementById('frame');
  const status = document.getElementById('status');
  const listView = document.getElementById('listView');
  const agendaView = document.getElementById('agendaView');
  const agendaPanel = document.getElementById('agendaPanel');
  const calendar = document.getElementById('calendar');
  const agendaTitle = document.getElementById('agendaTitle');
  const agendaData = document.getElementById('agendaData');
  const dayDetails = document.getElementById('dayDetails');
  let selectedDate = null;
  let calendarMonth = new Date();
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  let calendarEvents = [];
  let calendarLoaded = false;
  let calendarLoading = false;

  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const cleanKeyword = v => (v || '').trim() || 'MRS';
  const formatDateFr = d => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zoneEvents = () => { const z = zones[zone.value] || zones.idf; return calendarEvents.filter(e => !z.code || e.department === z.code); };
  const eventsForDate = d => zoneEvents().filter(e => e.date === isoDate(d)).sort((a, b) => (a.time || '').localeCompare(b.time || '') || (a.title || '').localeCompare(b.title || ''));

  async function loadCalendarData(force = false) {
    if (calendarLoaded && !force) return;
    if (calendarLoading) return;
    calendarLoading = true;
    agendaData.className = 'agenda-data';
    agendaData.textContent = 'Chargement des événements du calendrier…';
    try {
      let data = window.FRAI_EVENTS_IDF || null;
      if (!data) {
        let lastError = null;
        const urls = [
          new URL('events-idf.json', window.location.href).toString(),
          'https://xdsawyerlol.github.io/FRAI/events-idf.json'
        ];
        for (const src of urls) {
          try {
            const r = await fetch(`${src}?v=${Date.now()}`, { cache: 'no-store' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            data = await r.json();
            break;
          } catch (err) { lastError = err; }
        }
        if (!data) throw lastError || new Error('Données calendrier introuvables');
      }
      calendarEvents = Array.isArray(data.events) ? data.events : [];
      calendarLoaded = true;
      agendaData.className = 'agenda-data';
      agendaData.textContent = `${calendarEvents.length} événements IDF chargés pour le calendrier.`;
    } catch (err) {
      console.error('Calendrier FRAI', err);
      calendarLoaded = false;
      agendaData.className = 'agenda-data warn';
      agendaData.innerHTML = 'Impossible de charger les points. <button id="retryCalendar" type="button" class="retry">Réessayer</button>';
      document.getElementById('retryCalendar')?.addEventListener('click', () => loadCalendarData(true));
    } finally {
      calendarLoading = false;
      renderCalendar();
      renderDayDetails();
    }
  }

  function urlFor(keyword, key, date) {
    const z = zones[key] || zones.idf;
    const u = new URL('https://openagenda.com/fr/francetravail');
    u.searchParams.set('search', cleanKeyword(keyword));
    u.searchParams.set('adminLevel1', 'Île-de-France');
    if (z.department) u.searchParams.set('adminLevel2', z.department);
    if (date) {
      const iso = isoDate(date);
      u.searchParams.set('timings[gte]', iso);
      u.searchParams.set('timings[lte]', iso);
    } else {
      u.searchParams.append('relative[]', 'current');
      u.searchParams.append('relative[]', 'upcoming');
    }
    return u.toString();
  }

  function run(keyword, key) {
    const z = zones[key] || zones.idf;
    q.value = cleanKeyword(keyword);
    zone.value = key;
    status.textContent = `Résultats pour « ${q.value} » — ${z.label}${selectedDate ? ` — ${formatDateFr(selectedDate)}` : ''}`;
    frame.src = urlFor(q.value, key, selectedDate);
  }

  function setView(mode) {
    const agenda = mode === 'agenda';
    agendaPanel.classList.toggle('open', agenda);
    agendaPanel.setAttribute('aria-hidden', String(!agenda));
    agendaView.classList.toggle('active', agenda);
    listView.classList.toggle('active', !agenda);
    agendaView.setAttribute('aria-pressed', String(agenda));
    listView.setAttribute('aria-pressed', String(!agenda));
    if (agenda) {
      renderCalendar();
      renderDayDetails();
      loadCalendarData();
    } else if (selectedDate) {
      selectedDate = null;
      run(q.value, zone.value);
    }
  }

  function renderCalendar() {
    calendar.innerHTML = '';
    agendaTitle.textContent = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(calendarMonth);
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(x => { const e = document.createElement('div'); e.className = 'dow'; e.textContent = x; calendar.appendChild(e); });
    const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
    const first = new Date(y, m, 1), mondayOffset = (first.getDay() + 6) % 7, start = new Date(y, m, 1 - mondayOffset), today = new Date();
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const evs = eventsForDate(d);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'day';
      if (d.getMonth() !== m) b.classList.add('other');
      if (sameDay(d, today)) b.classList.add('today');
      if (sameDay(d, selectedDate)) b.classList.add('selected');
      const num = document.createElement('span'); num.className = 'daynum'; num.textContent = d.getDate(); b.appendChild(num);
      const dots = document.createElement('span'); dots.className = 'dots';
      evs.slice(0, 6).forEach(ev => { const dot = document.createElement('i'); dot.className = `dot dot-${categoryLabels[ev.category] ? ev.category : 'autre'}`; dot.title = categoryLabels[ev.category] || 'Autre'; dots.appendChild(dot); });
      if (evs.length > 6) { const more = document.createElement('span'); more.className = 'more'; more.textContent = `+${evs.length - 6}`; dots.appendChild(more); }
      b.appendChild(dots);
      b.title = `${formatDateFr(d)} — ${evs.length} événement${evs.length > 1 ? 's' : ''}`;
      b.addEventListener('click', () => { selectedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()); calendarMonth = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendar(); renderDayDetails(); run(q.value, zone.value); });
      calendar.appendChild(b);
    }
  }

  function renderDayDetails() {
    if (!selectedDate) { dayDetails.innerHTML = '<div class="day-empty">Cliquez sur un jour pour voir les événements prévus.</div>'; return; }
    const evs = eventsForDate(selectedDate);
    let h = `<div class="day-details-title">${esc(formatDateFr(selectedDate))}</div>`;
    if (!calendarLoaded) { h += '<div class="day-empty">Chargement des événements…</div>'; dayDetails.innerHTML = h; return; }
    if (!evs.length) { h += '<div class="day-empty">Aucun événement chargé pour cette journée dans la zone sélectionnée.</div>'; dayDetails.innerHTML = h; return; }
    h += '<div class="event-day-list">' + evs.map(e => `<div class="day-event"><i class="edot dot-${esc(categoryLabels[e.category] ? e.category : 'autre')}"></i><div class="etime">${esc(e.time || '')}</div><div><div class="etitle">${esc(e.title)}</div><div class="elocation">${esc(e.location || 'Lieu non précisé')}</div></div>${e.url ? `<a class="elink" href="${esc(e.url)}" target="_blank" rel="noopener">Voir ↗</a>` : ''}</div>`).join('') + '</div>';
    dayDetails.innerHTML = h;
  }

  document.getElementById('f').addEventListener('submit', e => { e.preventDefault(); run(q.value, zone.value); });
  zone.addEventListener('change', () => { renderCalendar(); renderDayDetails(); run(q.value, zone.value); });
  document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => run(b.dataset.q, zone.value)));
  listView.addEventListener('click', () => setView('list'));
  agendaView.addEventListener('click', () => setView('agenda'));
  document.getElementById('prevMonth').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); selectedDate = null; renderCalendar(); renderDayDetails(); });
  document.getElementById('nextMonth').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); selectedDate = null; renderCalendar(); renderDayDetails(); });
  document.getElementById('clearDate').addEventListener('click', () => { selectedDate = null; renderCalendar(); renderDayDetails(); run(q.value, zone.value); });
  run('MRS', 'idf');
})();
