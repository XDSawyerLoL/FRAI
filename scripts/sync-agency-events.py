#!/usr/bin/env python3
import json
import shutil
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote

API = 'https://frai-agency-events.onrender.com'
OUT = Path('agency-events-local.js')
IMG_DIR = Path('agency-images')

today = date.today()
until = today + timedelta(days=730)
url = f'{API}/events?from={today.isoformat()}&to={until.isoformat()}'

req = urllib.request.Request(url, headers={'User-Agent':'FRAI-agency-sync/1.0'})
with urllib.request.urlopen(req, timeout=30) as r:
    payload = json.load(r)

events = payload.get('events') if isinstance(payload, dict) else []
if not isinstance(events, list):
    events = []

if IMG_DIR.exists():
    shutil.rmtree(IMG_DIR)
IMG_DIR.mkdir(parents=True, exist_ok=True)

def ext_for(content_type):
    content_type = (content_type or '').lower().split(';')[0].strip()
    return {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}.get(content_type, '.jpg')

clean = []
for e in events:
    if not isinstance(e, dict) or not e.get('id'):
        continue
    item = dict(e)
    event_id = str(item.get('id'))
    image_url = str(item.get('image') or '').strip()
    local_image = ''
    if image_url:
        try:
            img_req = urllib.request.Request(image_url, headers={'User-Agent':'FRAI-agency-sync/1.0'})
            with urllib.request.urlopen(img_req, timeout=20) as img:
                raw = img.read(1_000_001)
                if len(raw) <= 1_000_000:
                    ext = ext_for(img.headers.get('Content-Type'))
                    p = IMG_DIR / f'{event_id}{ext}'
                    p.write_bytes(raw)
                    local_image = p.as_posix()
        except Exception as exc:
            print(f'Image skipped for {event_id}: {exc}')
    item['image'] = local_image
    item['source'] = 'agency'
    item['agency'] = True
    item['endTime'] = item.pop('end_time', '')
    item['registrationUrl'] = item.pop('registration_url', '')
    item['url'] = f'evenement-agence-local.html?id={quote(event_id)}'
    clean.append(item)

result = {
    'generatedAt': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
    'count': len(clean),
    'events': clean,
}
OUT.write_text(
    'window.FRAI_AGENCY_EVENTS=' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n',
    encoding='utf-8',
)
print(f'Synced {len(clean)} agency events')
