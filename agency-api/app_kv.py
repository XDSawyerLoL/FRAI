import base64
import hashlib
import html
import json
import os
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

import redis
from flask import Flask, Response, jsonify, make_response, request

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024

REDIS_URL = os.environ.get('REDIS_URL', 'redis://red-dakgqdh594qs73e1enn0:6379').strip()
PUBLIC_SITE = os.environ.get('PUBLIC_SITE', 'https://xdsawyerlol.github.io/FRAI').rstrip('/')
IP_SALT = os.environ.get('IP_SALT', 'frai-public-events').strip()
ALLOWED_DEPARTMENTS = {'75','77','78','91','92','93','94','95'}
ALLOWED_CATEGORIES = {'mrs','jobdating','alternance','sanscv','ia','autre'}
ALLOWED_IMAGE_TYPES = {'image/jpeg','image/png','image/webp'}
EVENT_PREFIX = 'frai:event:'
IMAGE_PREFIX = 'frai:image:'
INDEX_KEY = 'frai:events:index'
RATE_PREFIX = 'frai:rate:'

store = redis.Redis.from_url(REDIS_URL, decode_responses=False, socket_timeout=5, socket_connect_timeout=5)


def cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    return resp


@app.after_request
def after_request(resp):
    return cors(resp)


def payload_from_request():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict(flat=True)


def iframe_transport(payload=None):
    payload = payload or {}
    return request.form.get('_transport') == 'iframe' or payload.get('_transport') == 'iframe'


def reply(data, status=200, payload=None):
    if iframe_transport(payload):
        safe = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
        body = (
            '<!doctype html><meta charset="utf-8">'
            '<script>try{parent.postMessage('
            + safe
            + ',"*")}catch(e){}<\/script>'
        )
        return Response(body, status=status, mimetype='text/html')
    return jsonify(data), status


def clean_text(value, max_len, required=False):
    value = re.sub(r'\s+', ' ', str(value or '')).strip()
    if required and not value:
        raise ValueError('Champ obligatoire manquant')
    return value[:max_len]


def valid_url(value):
    value = str(value or '').strip()
    if not value:
        return ''
    parsed = urlparse(value)
    if parsed.scheme not in {'http','https'} or not parsed.netloc:
        raise ValueError('Lien invalide')
    return value[:1200]


def client_ip_hash():
    raw = request.headers.get('X-Forwarded-For', request.remote_addr or '')
    ip = raw.split(',')[0].strip()
    return hashlib.sha256(f'{IP_SALT}:{ip}'.encode()).hexdigest()


def parse_image(data_uri):
    if not data_uri:
        return b'', ''
    if not isinstance(data_uri, str) or not data_uri.startswith('data:') or ';base64,' not in data_uri:
        raise ValueError('Image invalide')
    header, encoded = data_uri.split(';base64,', 1)
    mime = header[5:].lower().strip()
    if mime not in ALLOWED_IMAGE_TYPES:
        raise ValueError('Format image non autorisé')
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError('Image invalide') from exc
    if len(raw) > 800_000:
        raise ValueError('Image trop lourde (800 Ko max)')
    return raw, mime


def event_key(event_id):
    return f'{EVENT_PREFIX}{event_id}'


def image_key(event_id):
    return f'{IMAGE_PREFIX}{event_id}'


def event_score(iso_date):
    return datetime.fromisoformat(f'{iso_date}T12:00:00+00:00').timestamp()


def ttl_for_event(iso_date):
    target = datetime.fromisoformat(f'{iso_date}T23:59:59+00:00') + timedelta(days=14)
    seconds = int((target - datetime.now(timezone.utc)).total_seconds())
    return max(86400, min(seconds, 86400 * 745))


def public_event(e, base_url):
    out = dict(e)
    eid = out['id']
    out['image'] = f'{base_url}/images/{eid}' if out.get('has_image') else ''
    out['url'] = f'{PUBLIC_SITE}/evenement-agence.html?id={eid}'
    out['source'] = 'public'
    out.pop('has_image', None)
    return out


def agency_event(e, base_url):
    out = public_event(e, base_url)
    out['source'] = 'agency'
    out['agency'] = True
    out['endTime'] = out.pop('end_time', '')
    out['registrationUrl'] = ''
    return out


def load_event(event_id):
    raw = store.get(event_key(event_id))
    if not raw:
        return None
    try:
        return json.loads(raw.decode('utf-8'))
    except Exception:
        return None


def list_events(from_d, to_d):
    min_score = event_score(from_d.isoformat())
    max_score = event_score(to_d.isoformat())
    ids = store.zrangebyscore(INDEX_KEY, min_score, max_score, start=0, num=2500)
    events = []
    stale = []
    for raw_id in ids:
        event_id = raw_id.decode() if isinstance(raw_id, bytes) else str(raw_id)
        e = load_event(event_id)
        if e and e.get('status') == 'published':
            events.append(e)
        else:
            stale.append(event_id)
    if stale:
        store.zrem(INDEX_KEY, *stale)
    events.sort(key=lambda e: (e.get('date',''), e.get('time','99:99'), e.get('title','').lower()))
    return events


@app.route('/health', methods=['GET'])
def health():
    try:
        store.ping()
        return jsonify({'ok': True, 'storage': 'render-key-value'})
    except Exception:
        return jsonify({'ok': False}), 503


@app.route('/events', methods=['GET','POST','OPTIONS'])
def events_route():
    if request.method == 'OPTIONS':
        return make_response('', 204)

    if request.method == 'GET':
        today = date.today()
        try:
            from_d = date.fromisoformat(request.args.get('from', today.isoformat()))
            to_d = date.fromisoformat(request.args.get('to', (today + timedelta(days=730)).isoformat()))
        except ValueError:
            return jsonify({'error': 'Période invalide'}), 400
        base_url = request.url_root.rstrip('/')
        return jsonify({'events': [public_event(e, base_url) for e in list_events(from_d, to_d)]})

    payload = payload_from_request()
    transport = iframe_transport(payload)
    if payload.get('website'):
        return reply({'type':'frai-event-created','ok':True}, 201, payload)

    ip_hash = client_ip_hash()
    hour = datetime.now(timezone.utc).strftime('%Y%m%d%H')
    rate_key = f'{RATE_PREFIX}{ip_hash}:{hour}'
    try:
        count = store.incr(rate_key)
        if count == 1:
            store.expire(rate_key, 3700)
        if count > 8:
            return reply({'type':'frai-event-created','ok':False,'error':'Trop de publications récentes. Réessayez plus tard.'}, 429, payload)
    except Exception:
        return reply({'type':'frai-event-created','ok':False,'error':'Service temporairement indisponible.'}, 503, payload)

    try:
        title = clean_text(payload.get('title'), 160, True)
        city = clean_text(payload.get('city'), 120, True)
        location = clean_text(payload.get('location'), 240, False)
        organizer = clean_text(payload.get('organizer'), 160, False)
        description = str(payload.get('description') or '').strip()[:4000]
        department = str(payload.get('department') or '').strip()
        if department not in ALLOWED_DEPARTMENTS:
            raise ValueError('Département invalide')
        category = str(payload.get('category') or 'autre').strip()
        if category not in ALLOWED_CATEGORIES:
            category = 'autre'
        event_date = date.fromisoformat(str(payload.get('date') or ''))
        if event_date < date.today() or event_date > date.today() + timedelta(days=730):
            raise ValueError('Date hors période autorisée')
        start_time = str(payload.get('time') or '').strip()
        end_time = str(payload.get('end_time') or '').strip()
        if start_time:
            datetime.strptime(start_time, '%H:%M')
        if end_time:
            datetime.strptime(end_time, '%H:%M')
        registration_url = valid_url(payload.get('registration_url'))
        capacity = payload.get('capacity')
        if capacity in ('', None):
            capacity = None
        else:
            capacity = max(1, min(100000, int(capacity)))
        image_raw, image_mime = parse_image(payload.get('image'))
    except (ValueError, TypeError) as exc:
        return reply({'type':'frai-event-created','ok':False,'error':str(exc)}, 400, payload)

    event_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    event = {
        'id': event_id,
        'title': title,
        'date': event_date.isoformat(),
        'time': start_time,
        'end_time': end_time,
        'department': department,
        'city': city,
        'location': location or city,
        'category': category,
        'description': description,
        'registration_url': registration_url,
        'organizer': organizer,
        'capacity': capacity,
        'has_image': bool(image_raw),
        'created_at': created_at,
        'status': 'published'
    }

    ttl = ttl_for_event(event['date'])
    try:
        pipe = store.pipeline()
        pipe.set(event_key(event_id), json.dumps(event, ensure_ascii=False).encode('utf-8'), ex=ttl)
        pipe.zadd(INDEX_KEY, {event_id: event_score(event['date'])})
        if image_raw:
            image_payload = json.dumps({'mime': image_mime, 'data': base64.b64encode(image_raw).decode('ascii')}).encode('utf-8')
            pipe.set(image_key(event_id), image_payload, ex=ttl)
        pipe.execute()
    except Exception:
        return reply({'type':'frai-event-created','ok':False,'error':'Impossible d’enregistrer l’événement pour le moment.'}, 503, payload)

    url = f'{PUBLIC_SITE}/evenement-agence.html?id={event_id}'
    return reply({'type':'frai-event-created','ok':True,'id':event_id,'url':url}, 201, payload)


@app.route('/events/<event_id>', methods=['GET'])
def one_event(event_id):
    try:
        uuid.UUID(event_id)
    except ValueError:
        return jsonify({'error': 'Événement introuvable'}), 404
    e = load_event(event_id)
    if not e or e.get('status') != 'published':
        return jsonify({'error': 'Événement introuvable'}), 404
    return jsonify(public_event(e, request.url_root.rstrip('/')))


@app.route('/events.js', methods=['GET'])
def events_js():
    today = date.today()
    until = today + timedelta(days=730)
    base_url = request.url_root.rstrip('/')
    items = [agency_event(e, base_url) for e in list_events(today, until)]
    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'count': len(items),
        'events': items
    }
    js = 'window.FRAI_AGENCY_EVENTS=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n'
    resp = Response(js, mimetype='application/javascript; charset=utf-8')
    resp.headers['Cache-Control'] = 'no-store, max-age=0'
    return resp


@app.route('/images/<event_id>', methods=['GET'])
def event_image(event_id):
    try:
        uuid.UUID(event_id)
    except ValueError:
        return '', 404
    raw = store.get(image_key(event_id))
    if not raw:
        return '', 404
    try:
        item = json.loads(raw.decode('utf-8'))
        data = base64.b64decode(item.get('data',''))
        mime = item.get('mime') or 'application/octet-stream'
    except Exception:
        return '', 404
    resp = make_response(data)
    resp.headers['Content-Type'] = mime
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '10000')))
