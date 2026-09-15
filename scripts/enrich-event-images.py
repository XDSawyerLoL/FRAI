#!/usr/bin/env python3
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = 'https://openagenda.com'
ODS = 'https://data.iledefrance.fr/api/explore/v2.1/catalog/datasets/evenements-publics-cibul/records'
DATA = Path('events-idf.json')
UA = 'FRAI-Calendar/1.0 (+https://xdsawyerlol.github.io/FRAI/)'


def norm(value):
    value = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', ' ', value.lower()).strip()


def local_text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get('fr') or value.get('en') or next(iter(value.values()), '')
    return ''


def fetch_json(url, timeout=45):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'application/json,text/plain,*/*',
    })
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8', errors='replace'))


def source_dates(event):
    dates = set()
    for timing in event.get('timings') or []:
        raw = timing.get('start') or timing.get('begin') or ''
        if raw:
            dates.add(str(raw)[:10])
    for key in ('firstDate', 'lastDate', 'firstdate_begin', 'lastdate_begin'):
        raw = event.get(key)
        if raw:
            dates.add(str(raw)[:10])
    return dates


def apply_source(source, by_exact, by_title):
    image = source.get('thumbnail') or source.get('image') or source.get('originalImage') or source.get('originalimage') or ''
    if not image:
        return 0, False
    title_key = norm(local_text(source.get('title')) or source.get('title_fr'))
    if not title_key:
        return 0, True
    matched = []
    for day in source_dates(source):
        matched.extend(by_exact.get((day, title_key), []))
    if not matched:
        matched = by_title.get(title_key, [])
    enriched = 0
    seen = set()
    for event in matched:
        eid = event.get('id') or id(event)
        if eid in seen:
            continue
        seen.add(eid)
        if not event.get('image'):
            event['image'] = image
            enriched += 1
        if source.get('canonicalurl') and (not event.get('url') or 'openagenda.com/fr/francetravail?search=' in event.get('url', '')):
            event['url'] = source['canonicalurl']
    return enriched, True


def enrich_from_idf_open_data(agenda_uid, date_from, date_to, by_exact, by_title):
    offset = 0
    total = None
    source_events = 0
    source_images = 0
    enriched = 0
    newest = None
    oldest = None
    max_pages = 80

    while (total is None or offset < total) and offset < max_pages * 100:
        where = f'originagenda_uid="{agenda_uid}"'
        params = {
            'select': 'uid,slug,canonicalurl,title_fr,image,thumbnail,originalimage,firstdate_begin,lastdate_begin',
            'where': where,
            'order_by': 'firstdate_begin desc',
            'limit': 100,
            'offset': offset,
        }
        url = ODS + '?' + urllib.parse.urlencode(params)
        data = fetch_json(url)
        batch = data.get('results') or []
        total = int(data.get('total_count') or len(batch))
        if not batch:
            break
        source_events += len(batch)

        stop_after_page = True
        for source in batch:
            day = str(source.get('firstdate_begin') or '')[:10]
            if day:
                newest = newest or day
                oldest = day
                if not date_from or day >= date_from:
                    stop_after_page = False
            if date_from and day and day < date_from:
                continue
            if date_to and day and day > date_to:
                continue
            gained, has_image = apply_source(source, by_exact, by_title)
            if has_image:
                source_images += 1
            enriched += gained

        offset += len(batch)
        if stop_after_page and date_from:
            break
        if len(batch) < 100:
            break

    print(f'IDF open data thumbnails: total={total}; read={source_events}; images={source_images}; enriched={enriched}; newest={newest}; oldest={oldest}')
    return enriched


def enrich_from_legacy_export(agenda_uid, date_from, date_to, by_exact, by_title):
    params_base = {'limit': 300}
    if date_from:
        params_base['oaq[from]'] = date_from
    if date_to:
        params_base['oaq[to]'] = date_to
    offset = 0
    total = None
    source_events = 0
    source_images = 0
    enriched = 0

    while total is None or offset < total:
        params = dict(params_base)
        params['offset'] = offset
        url = f'{ROOT}/agendas/{agenda_uid}/events.json?' + urllib.parse.urlencode(params)
        data = fetch_json(url)
        batch = data.get('events') or []
        total = int(data.get('total') or len(batch))
        if not batch:
            break
        source_events += len(batch)
        for source in batch:
            gained, has_image = apply_source(source, by_exact, by_title)
            if has_image:
                source_images += 1
            enriched += gained
        offset += len(batch)
        if len(batch) < int(data.get('limit') or params_base['limit']):
            break
        if offset > 10000:
            break

    print(f'Legacy OpenAgenda thumbnails: total={total}; read={source_events}; images={source_images}; enriched={enriched}')
    return enriched


def main():
    payload = json.loads(DATA.read_text(encoding='utf-8'))
    target = payload.get('events') or []
    agenda_uid = str(payload.get('agendaUid') or '38495884')
    if not target:
        print('Thumbnail enrichment: no target events')
        return

    by_exact = {}
    by_title = {}
    for event in target:
        key = norm(event.get('title'))
        if not key:
            continue
        by_title.setdefault(key, []).append(event)
        by_exact.setdefault((event.get('date'), key), []).append(event)

    date_from = (payload.get('range') or {}).get('from')
    date_to = (payload.get('range') or {}).get('to')
    enriched = 0

    try:
        enriched += enrich_from_idf_open_data(agenda_uid, date_from, date_to, by_exact, by_title)
    except Exception as exc:
        print(f'IDF open data thumbnails unavailable: {type(exc).__name__}: {exc}')

    try:
        enriched += enrich_from_legacy_export(agenda_uid, date_from, date_to, by_exact, by_title)
    except Exception as exc:
        print(f'Legacy OpenAgenda thumbnails unavailable: {type(exc).__name__}: {exc}')

    DATA.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    total_images = sum(1 for event in target if event.get('image'))
    print(f'Thumbnail enrichment complete: enriched={enriched}; target_images={total_images}/{len(target)}')


if __name__ == '__main__':
    main()
