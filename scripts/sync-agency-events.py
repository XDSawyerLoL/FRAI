#!/usr/bin/env python3
import json
import shutil
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

API = 'https://frai-agency-events.onrender.com'
PUBLIC = 'https://xdsawyerlol.github.io/FRAI'
OUT = Path('agency-events.js')
IMG_DIR = Path('agency-images')


def read_existing_events():
    if not OUT.exists():
        return None
    try:
        text = OUT.read_text(encoding='utf-8').strip()
        prefix = 'window.FRAI_AGENCY_EVENTS='
        if not text.startswith(prefix):
            return None
        first = text.split(';', 1)[0]
        data = json.loads(first[len(prefix):])
        return data.get('events') if isinstance(data, dict) else None
    except Exception:
        return None


def ext_for(content_type):
    content_type = (content_type or '').lower().split(';')[0].strip()
    return {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}.get(content_type, '.jpg')


def write_feed(events):
    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'count': len(events),
        'events': events,
    }
    js = (
        'window.FRAI_AGENCY_EVENTS=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n'
        'if(window.FRAI_EVENTS_IDF&&Array.isArray(window.FRAI_EVENTS_IDF.events)){\n'
        '  const seen=new Set(window.FRAI_EVENTS_IDF.events.map(e=>String(e&&e.id||\'\')));\n'
        '  for(const e of window.FRAI_AGENCY_EVENTS.events||[]){\n'
        '    const id=String(e&&e.id||\'\');\n'
        '    if(!id||seen.has(id)) continue;\n'
        '    window.FRAI_EVENTS_IDF.events.push(e);\n'
        '    seen.add(id);\n'
        '  }\n'
        '}\n'
    )
    OUT.write_text(js, encoding='utf-8')


today = date.today()
until = today + timedelta(days=730)
url = f'{API}/events?from={today.isoformat()}&to={until.isoformat()}'
req = urllib.request.Request(url, headers={'User-Agent': 'FRAI-agency-sync/2.0'})
with urllib.request.urlopen(req, timeout=45) as r:
    payload = json.load(r)

events = payload.get('events') if isinstance(payload, dict) else []
if not isinstance(events, list):
    events = []

if IMG_DIR.exists():
    shutil.rmtree(IMG_DIR)
IMG_DIR.mkdir(parents=True, exist_ok=True)
(IMG_DIR / '.gitkeep').write_text('', encoding='utf-8')

clean = []
for e in events:
    if not isinstance(e, dict) or not e.get('id'):
        continue
    item = dict(e)
    event_id = str(item.get('id'))
    image_url = str(item.get('image') or '').strip()
    public_image = ''

    if image_url:
        try:
            img_req = urllib.request.Request(image_url, headers={'User-Agent': 'FRAI-agency-sync/2.0'})
            with urllib.request.urlopen(img_req, timeout=25) as img:
                raw = img.read(1_000_001)
                if len(raw) <= 1_000_000:
                    ext = ext_for(img.headers.get('Content-Type'))
                    p = IMG_DIR / f'{event_id}{ext}'
                    p.write_bytes(raw)
                    public_image = f'{PUBLIC}/{p.as_posix()}'
        except Exception as exc:
            print(f'Image skipped for {event_id}: {exc}')

    item['image'] = public_image
    item['source'] = 'agency'
    item['agency'] = True
    item['endTime'] = item.pop('end_time', '')
    item['registrationUrl'] = item.pop('registration_url', '')
    item['url'] = f'{PUBLIC}/evenement-agence.html?id={quote(event_id)}'
    clean.append(item)

if read_existing_events() == clean:
    print(f'Agency events unchanged: {len(clean)} events')
else:
    write_feed(clean)
    print(f'Synced {len(clean)} agency events')
