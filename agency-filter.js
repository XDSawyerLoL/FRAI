(() => {
  const checkbox = document.getElementById('agencyOnly');
  const data = window.FRAI_EVENTS_IDF;
  if (!checkbox || !data || !Array.isArray(data.events)) return;

  const liveEvents = data.events;
  const allEvents = liveEvents.slice();
  const label = document.getElementById('agencyOnlyLabel');
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const agencyCount = allEvents.filter(e => e && e.source === 'agency' && (!e.date || e.date >= todayIso)).length;
  if (label) label.textContent = `Événements agence uniquement${agencyCount ? ` (${agencyCount})` : ''}`;

  function rerender() {
    const filtered = checkbox.checked ? allEvents.filter(e => e && e.source === 'agency') : allEvents;
    liveEvents.splice(0, liveEvents.length, ...filtered);
    checkbox.closest('.agency-filter')?.classList.toggle('active', checkbox.checked);
    const zone = document.getElementById('zone');
    if (zone) zone.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function decorateAgencyEvents() {
    document.querySelectorAll('a.event-card, a.day-event-link').forEach(card => {
      const href = card.getAttribute('href') || '';
      if (!href.includes('evenement-agence.html?id=')) return;
      if (card.classList.contains('agency-event')) return;
      card.classList.add('agency-event');
      const badge = document.createElement('span');
      badge.className = 'agency-badge';
      badge.textContent = 'Agence';
      if (card.classList.contains('event-card')) {
        const content = card.querySelector('.event-card-content');
        const title = card.querySelector('.event-card-title');
        if (content && title) content.insertBefore(badge, title);
      } else {
        const meta = card.querySelector('.event-meta-line');
        if (meta) meta.insertBefore(badge, meta.firstChild);
      }
    });
  }

  checkbox.addEventListener('change', rerender);
  const observer = new MutationObserver(decorateAgencyEvents);
  observer.observe(document.body, { childList: true, subtree: true });
  decorateAgencyEvents();
})();
