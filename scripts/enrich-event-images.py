#!/usr/bin/env python3
import datetime as dt
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = 'https://openagenda.com'
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
            dates.add(raw[:10])
    for key in ('firstDate', 'lastDate'):
        raw = event.get(key)
        if raw:
            dates.add(str(raw)[:10])
    return dates


def main():
    payload = json.loads(DATA.read_text(encoding='utf-8'))
    target = payload.get('events') or []
    agenda_uid = payload.get('agendaUid') or '38495884'
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

    try:
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
                image = source.get('thumbnail') or source.get('image') or source.get('originalImage') or ''
                if not image:
                    continue
                source_images += 1
                title_key = norm(local_text(source.get('title')))
                if not title_key:
                    continue
                dates = source_dates(source)
                matched = []
                for day in dates:
                    matched.extend(by_exact.get((day, title_key), []))
                if not matched:
                    matched = by_title.get(title_key, [])
                seen = set()
                for event in matched:
                    eid = event.get('id') or id(event)
                    if eid in seen:
                        continue
                    seen.add(eid)
                    if not event.get('image'):
                        event['image'] = image
                        enriched += 1

            offset += len(batch)
            if len(batch) < int(data.get('limit') or params_base['limit']):
                break
            if offset > 10000:
                break
    except Exception as exc:
        print(f'Thumbnail enrichment legacy export unavailable: {type(exc).__name__}: {exc}')
        return

    DATA.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    total_images = sum(1 for event in target if event.get('image'))
    print(f'Thumbnail enrichment: source_events={source_events}; source_images={source_images}; enriched={enriched}; target_images={total_images}')


if __name__ == '__main__':
    main()
