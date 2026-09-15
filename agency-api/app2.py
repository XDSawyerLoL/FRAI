import json
from datetime import date, timedelta, datetime, timezone

from flask import Response, request

from app import app, db, event_json


@app.route('/events.js', methods=['GET'])
def events_js():
    today = date.today()
    until = today + timedelta(days=730)
    with db() as conn, conn.cursor() as cur:
        cur.execute('''
            SELECT id,title,event_date,start_time,end_time,department,city,location,
                   category,description,registration_url,organizer,capacity,
                   (image_data IS NOT NULL) AS has_image,created_at
            FROM public_events
            WHERE status='published' AND event_date BETWEEN %s AND %s
            ORDER BY event_date,start_time NULLS LAST,title
            LIMIT 2500
        ''', (today, until))
        rows = cur.fetchall()

    base_url = request.url_root.rstrip('/')
    items = []
    for row in rows:
        e = event_json(row, base_url)
        e['source'] = 'agency'
        e['agency'] = True
        e['endTime'] = e.pop('end_time', '')
        e['registrationUrl'] = ''
        items.append(e)

    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'count': len(items),
        'events': items,
    }
    js = 'window.FRAI_AGENCY_EVENTS=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n'
    resp = Response(js, mimetype='application/javascript; charset=utf-8')
    resp.headers['Cache-Control'] = 'no-store, max-age=0'
    return resp
