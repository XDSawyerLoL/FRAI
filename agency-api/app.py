import base64
import hashlib
import os
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

import psycopg2
from flask import Flask, jsonify, make_response, request

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024

DATABASE_URL = os.environ.get('DATABASE_URL', '').strip()
IP_SALT = os.environ.get('IP_SALT', 'frai-public-events').strip()
PUBLIC_SITE = os.environ.get('PUBLIC_SITE', 'https://xdsawyerlol.github.io/FRAI').rstrip('/')
ALLOWED_DEPARTMENTS = {'75','77','78','91','92','93','94','95'}
ALLOWED_CATEGORIES = {'mrs','jobdating','alternance','sanscv','ia','autre'}
ALLOWED_IMAGE_TYPES = {'image/jpeg','image/png','image/webp'}


def db():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL is missing')
    return psycopg2.connect(DATABASE_URL)


def init_db():
    with db() as conn, conn.cursor() as cur:
        cur.execute('''
            CREATE TABLE IF NOT EXISTS public_events (
                id UUID PRIMARY KEY,
                title VARCHAR(160) NOT NULL,
                event_date DATE NOT NULL,
                start_time TIME,
                end_time TIME,
                department CHAR(2) NOT NULL,
                city VARCHAR(120) NOT NULL,
                location VARCHAR(240),
                category VARCHAR(30) NOT NULL DEFAULT 'autre',
                description TEXT,
                registration_url TEXT,
                organizer VARCHAR(160),
                capacity INTEGER,
                image_data BYTEA,
                image_mime VARCHAR(60),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                ip_hash VARCHAR(64),
                status VARCHAR(20) NOT NULL DEFAULT 'published'
            )
        ''')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_public_events_date ON public_events(event_date)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_public_events_ip_created ON public_events(ip_hash, created_at)')


def cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    return resp


@app.after_request
def after_request(resp):
    return cors(resp)


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
        return None, None
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
    return psycopg2.Binary(raw), mime


def event_json(row, base_url):
    (event_id, title, event_date, start_time, end_time, department, city, location,
     category, description, registration_url, organizer, capacity, has_image, created_at) = row
    eid = str(event_id)
    return {
        'id': eid,
        'title': title,
        'date': event_date.isoformat(),
        'time': start_time.strftime('%H:%M') if start_time else '',
        'end_time': end_time.strftime('%H:%M') if end_time else '',
        'department': department,
        'city': city,
        'location': location or city,
        'category': category or 'autre',
        'description': description or '',
        'registration_url': registration_url or '',
        'organizer': organizer or '',
        'capacity': capacity,
        'image': f'{base_url}/images/{eid}' if has_image else '',
        'url': f'{PUBLIC_SITE}/evenement-agence.html?id={eid}',
        'source': 'public',
        'created_at': created_at.astimezone(timezone.utc).isoformat() if created_at else ''
    }


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'ok': True})


@app.route('/events', methods=['GET','POST','OPTIONS'])
def events_route():
    if request.method == 'OPTIONS':
        return make_response('', 204)
    if request.method == 'GET':
        today = date.today()
        from_s = request.args.get('from', today.isoformat())
        to_s = request.args.get('to', (today + timedelta(days=730)).isoformat())
        try:
            from_d = date.fromisoformat(from_s)
            to_d = date.fromisoformat(to_s)
        except ValueError:
            return jsonify({'error': 'Période invalide'}), 400
        with db() as conn, conn.cursor() as cur:
            cur.execute('''
                SELECT id,title,event_date,start_time,end_time,department,city,location,
                       category,description,registration_url,organizer,capacity,
                       (image_data IS NOT NULL) AS has_image,created_at
                FROM public_events
                WHERE status='published' AND event_date BETWEEN %s AND %s
                ORDER BY event_date,start_time NULLS LAST,title
                LIMIT 2500
            ''', (from_d, to_d))
            rows = cur.fetchall()
        base_url = request.url_root.rstrip('/')
        return jsonify({'events': [event_json(r, base_url) for r in rows]})

    payload = request.get_json(silent=True) or {}
    if payload.get('website'):
        return jsonify({'ok': True}), 201

    ip_hash = client_ip_hash()
    with db() as conn, conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM public_events WHERE ip_hash=%s AND created_at > NOW() - INTERVAL \'1 hour\'', (ip_hash,))
        if cur.fetchone()[0] >= 8:
            return jsonify({'error': 'Trop de publications récentes. Réessayez plus tard.'}), 429

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
        start_time = datetime.strptime(payload.get('time'), '%H:%M').time() if payload.get('time') else None
        end_time = datetime.strptime(payload.get('end_time'), '%H:%M').time() if payload.get('end_time') else None
        registration_url = valid_url(payload.get('registration_url'))
        capacity = payload.get('capacity')
        if capacity in ('', None):
            capacity = None
        else:
            capacity = max(1, min(100000, int(capacity)))
        image_data, image_mime = parse_image(payload.get('image'))
    except (ValueError, TypeError) as exc:
        return jsonify({'error': str(exc)}), 400

    event_id = uuid.uuid4()
    with db() as conn, conn.cursor() as cur:
        cur.execute('''
            INSERT INTO public_events
            (id,title,event_date,start_time,end_time,department,city,location,category,
             description,registration_url,organizer,capacity,image_data,image_mime,ip_hash)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ''', (event_id,title,event_date,start_time,end_time,department,city,location,category,
              description,registration_url,organizer,capacity,image_data,image_mime,ip_hash))

    return jsonify({'ok': True, 'id': str(event_id), 'url': f'{PUBLIC_SITE}/evenement-agence.html?id={event_id}'}), 201


@app.route('/events/<event_id>', methods=['GET'])
def one_event(event_id):
    try:
        uuid.UUID(event_id)
    except ValueError:
        return jsonify({'error': 'Événement introuvable'}), 404
    with db() as conn, conn.cursor() as cur:
        cur.execute('''
            SELECT id,title,event_date,start_time,end_time,department,city,location,
                   category,description,registration_url,organizer,capacity,
                   (image_data IS NOT NULL) AS has_image,created_at
            FROM public_events WHERE id=%s AND status='published'
        ''', (event_id,))
        row = cur.fetchone()
    if not row:
        return jsonify({'error': 'Événement introuvable'}), 404
    return jsonify(event_json(row, request.url_root.rstrip('/')))


@app.route('/images/<event_id>', methods=['GET'])
def event_image(event_id):
    try:
        uuid.UUID(event_id)
    except ValueError:
        return '', 404
    with db() as conn, conn.cursor() as cur:
        cur.execute('SELECT image_data,image_mime FROM public_events WHERE id=%s AND status=\'published\'', (event_id,))
        row = cur.fetchone()
    if not row or not row[0]:
        return '', 404
    resp = make_response(bytes(row[0]))
    resp.headers['Content-Type'] = row[1] or 'application/octet-stream'
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp


try:
    if DATABASE_URL:
        init_db()
except Exception as exc:
    print(f'Database init failed: {exc}', flush=True)
