#!/usr/bin/env python3
import calendar
import datetime as dt
import html as html_lib
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = 'https://openagenda.com'
AGENDA_PAGE = ROOT + '/fr/francetravail'
AGENDA_PORTAL = ROOT + '/francetravail'
OUT = os.environ.get('EVENTS_OUT', 'events-idf.json')
TZ = ZoneInfo('Europe/Paris')
IDF_CODES = {'75','77','78','91','92','93','94','95'}
UA = 'FRAI-Calendar/1.0 (+https://xdsawyerlol.github.io/FRAI/)'


def fetch(url, timeout=35):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml,text/calendar,*/*',
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', errors='replace')


def month_window():
    today = dt.datetime.now(TZ).date()
    start_month = (today.replace(day=1) - dt.timedelta(days=1)).replace(day=1)
    y, m = today.year, today.month
    m += 2
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    last = calendar.monthrange(y, m)[1]
    return start_month, dt.date(y, m, last)


def detect_uid(page):
    patterns = [
        r'data-agenda-uid=["\'](\d+)',
        r'["\']agendaUid["\']\s*[:=]\s*["\']?(\d+)',
        r'["\']uid["\']\s*:\s*(\d+)\s*,\s*["\']slug["\']\s*:\s*["\']francetravail["\']',
        r'["\']slug["\']\s*:\s*["\']francetravail["\']\s*,\s*["\']uid["\']\s*:\s*(\d+)',
        r'/agendas/(\d+)/',
    ]
    for p in patterns:
        m = re.search(p, page, re.I)
        if m:
            return m.group(1)
    return None


def unfold_ics(text):
    out=[]
    for line in text.replace('\r\n','\n').replace('\r','\n').split('\n'):
        if line.startswith((' ', '\t')) and out:
            out[-1] += line[1:]
        else:
            out.append(line)
    return out


def ics_unescape(v):
    return (v.replace('\\n','\n').replace('\\N','\n')
             .replace('\\,',',').replace('\\;',';').replace('\\\\','\\')).strip()


def parse_dt(raw, params=''):
    raw = raw.strip()
    if not raw:
        return None
    try:
        if re.fullmatch(r'\d{8}', raw):
            d = dt.datetime.strptime(raw, '%Y%m%d').replace(tzinfo=TZ)
        elif raw.endswith('Z'):
            d = dt.datetime.strptime(raw, '%Y%m%dT%H%M%SZ').replace(tzinfo=dt.timezone.utc).astimezone(TZ)
        else:
            fmt = '%Y%m%dT%H%M%S' if len(raw) >= 15 else '%Y%m%dT%H%M'
            d = dt.datetime.strptime(raw[:15] if fmt.endswith('%S') else raw[:13], fmt).replace(tzinfo=TZ)
        return d
    except Exception:
        return None


def classify(text):
    s = text.lower()
    if re.search(r'\bmrs\b|recrutement par simulation|méthode de recrutement par simulation|methode de recrutement par simulation', s):
        return 'mrs'
    if 'job dating' in s or 'jobdating' in s or 'job-dating' in s:
        return 'jobdating'
    if 'alternance' in s or 'apprentissage' in s or 'contrat de professionnalisation' in s:
        return 'alternance'
    if 'sans cv' in s or 'sans curriculum' in s:
        return 'sanscv'
    if re.search(r'\bintelligence artificielle\b|\bia\b', s):
        return 'ia'
    return 'autre'


def dept_from_text(text):
    m = re.search(r'\b(75|77|78|91|92|93|94|95)\d{3}\b', text)
    return m.group(1) if m else None


def clean_city(value):
    value = re.sub(r'\s+', ' ', (value or '')).strip(' ,;-')
    value = re.sub(r'^(?:ville de|commune de)\s+', '', value, flags=re.I)
    return value[:90]


def city_from_location(location):
    text = re.sub(r'\s+', ' ', location or '').strip()
    if not text:
        return ''
    matches = list(re.finditer(r'\b(?:75|77|78|91|92|93|94|95)\d{3}\s+([^,;|]+)', text, re.I))
    if matches:
        candidate = matches[-1].group(1)
        candidate = re.split(r'\s+-\s+|\s+\|\s+', candidate, maxsplit=1)[0]
        candidate = clean_city(candidate)
        if candidate:
            return candidate
    first = clean_city(re.split(r'\s+-\s+|,|;|\|', text, maxsplit=1)[0])
    if first and not re.match(r'^(agence|france travail|visio|webinaire|en ligne)\b', first, re.I):
        return first
    return ''


def clean_url(value):
    return (value or '').strip().rstrip(".,;:!?)\\]}\'\"")


def normalized_key(value):
    value = unicodedata.normalize('NFKD', value or '').encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', ' ', value.lower()).strip()


def best_event_url(title, desc, explicit_url=''):
    candidates=[]
    if explicit_url:
        candidates.append(clean_url(explicit_url))
    candidates.extend(clean_url(u) for u in re.findall(r'https?://[^\s<>"\']+', desc or ''))
    for u in candidates:
        if re.search(r'mesevenementsemploi\.francetravail\.fr/mes-evenements-emploi/evenement/\d+', u, re.I):
            return u
    for u in candidates:
        if re.search(r'openagenda\.com/(?:fr/)?francetravail/events/', u, re.I):
            return u
    for u in candidates:
        if u.startswith(('http://','https://')):
            return u
    return AGENDA_PAGE + '?' + urllib.parse.urlencode({'search': title})


def looks_like_image_url(url):
    if not url.startswith(('http://', 'https://')):
        return False
    lower = url.lower()
    return ('cdn.openagenda.com/' in lower
            or 'img.openagenda.com/' in lower
            or re.search(r'\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$', lower) is not None)


def image_from_ics(data, description=''):
    for key in ('IMAGE', 'ATTACH'):
        params, raw = data.get(key, ('', ''))
        url = clean_url(raw)
        if not url.startswith(('http://', 'https://')):
            continue
        is_image_attachment = 'FMTTYPE=IMAGE/' in params.upper()
        if key == 'IMAGE' or is_image_attachment or looks_like_image_url(url):
            return url
    for raw in re.findall(r'https?://[^\s<>"\']+', description or ''):
        url = clean_url(raw)
        if looks_like_image_url(url):
            return url
    return ''


def image_from_jsonld(value):
    if isinstance(value, str):
        return clean_url(value) if value.startswith(('http://', 'https://')) else ''
    if isinstance(value, list):
        for item in value:
            url = image_from_jsonld(item)
            if url:
                return url
        return ''
    if isinstance(value, dict):
        for key in ('url', 'contentUrl', '@id'):
            url = image_from_jsonld(value.get(key))
            if url:
                return url
    return ''


def parse_ics(text):
    lines = unfold_ics(text)
    blocks=[]; cur=None
    for line in lines:
        if line == 'BEGIN:VEVENT':
            cur=[]
        elif line == 'END:VEVENT' and cur is not None:
            blocks.append(cur); cur=None
        elif cur is not None:
            cur.append(line)
    events=[]
    for block in blocks:
        data={}
        for line in block:
            if ':' not in line:
                continue
            lhs, val = line.split(':',1)
            key = lhs.split(';',1)[0].upper()
            params = lhs[len(key):]
            if key not in data:
                data[key]=(params, ics_unescape(val))
        start = parse_dt(data.get('DTSTART',('', ''))[1], data.get('DTSTART',('', ''))[0])
        if not start:
            continue
        title = data.get('SUMMARY',('', 'Événement France Travail'))[1]
        desc = data.get('DESCRIPTION',('', ''))[1]
        loc = data.get('LOCATION',('', ''))[1]
        explicit_url = data.get('URL',('', ''))[1]
        url = best_event_url(title, desc, explicit_url)
        image = image_from_ics(data, desc)
        uid = data.get('UID',('', url or title))[1]
        cats = data.get('CATEGORIES',('', ''))[1]
        dep = dept_from_text(' '.join([loc, desc, title]))
        if dep and dep not in IDF_CODES:
            continue
        blob=' '.join([title,desc,cats])
        events.append({
            'id': uid + '|' + start.isoformat(),
            'date': start.date().isoformat(),
            'time': start.strftime('%H:%M'),
            'title': title,
            'location': loc,
            'city': city_from_location(loc),
            'department': dep,
            'category': classify(blob),
            'url': url,
            'image': image,
        })
    uniq={}
    for e in events:
        uniq[e['id']]=e
    return sorted(uniq.values(), key=lambda x:(x['date'],x['time'],x['title'].lower()))


def jsonld_events_from_page(page, enforce_idf=True):
    events=[]
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', page, re.I|re.S):
        try:
            obj=json.loads(html_lib.unescape(raw.strip()))
        except Exception:
            continue
        candidates=obj if isinstance(obj,list) else [obj]
        for o in candidates:
            if not isinstance(o,dict) or o.get('@type')!='Event':
                continue
            try:
                start=dt.datetime.fromisoformat(str(o.get('startDate','')).replace('Z','+00:00'))
                if start.tzinfo is None:
                    start=start.replace(tzinfo=TZ)
                else:
                    start=start.astimezone(TZ)
            except Exception:
                continue
            loc=o.get('location') or {}
            addr=(loc.get('address') or {}) if isinstance(loc,dict) else {}
            region=str(addr.get('addressRegion') or '')
            postal=str(addr.get('postalCode') or '')
            dep=dept_from_text(postal+' '+region)
            region_ascii=normalized_key(region)
            if enforce_idf and dep not in IDF_CODES and 'ile de france' not in region_ascii:
                continue
            title=str(o.get('name') or 'Événement France Travail')
            desc=str(o.get('description') or '')
            raw_url=str(o.get('url') or o.get('@id') or '')
            locality = clean_city(str(addr.get('addressLocality') or ''))
            loc_name = str(loc.get('name') or locality or '') if isinstance(loc,dict) else ''
            events.append({
                'id': str(o.get('@id') or raw_url or title) + '|' + start.isoformat(),
                'date': start.date().isoformat(),
                'time': start.strftime('%H:%M'),
                'title': title,
                'location': loc_name,
                'city': locality or city_from_location(loc_name),
                'department': dep,
                'category': classify(title+' '+desc),
                'url': best_event_url(title, desc, raw_url),
                'image': image_from_jsonld(o.get('image')),
            })
    return events


def enrich_images_from_portal(events, start, end):
    if not events:
        return 0, 0
    by_title={}
    by_date_title={}
    for event in events:
        title_key=normalized_key(event.get('title'))
        if not title_key:
            continue
        by_title.setdefault(title_key, []).append(event)
        by_date_title.setdefault((event.get('date'), title_key), []).append(event)

    params={
        'limit':'100',
        'adminLevel1':'Île-de-France',
        'timings[gte]':start.isoformat()+'T00:00:00+02:00',
        'timings[lte]':end.isoformat()+'T23:59:59+02:00',
    }
    qs=urllib.parse.urlencode(params)
    image_sources=0
    enriched=0
    previous_signature=None
    max_pages=max(2, min(80, (len(events)//20)+5))

    for page_no in range(1, max_pages+1):
        base=AGENDA_PORTAL+'/events' if page_no==1 else AGENDA_PORTAL+f'/events/p/{page_no}'
        try:
            page=fetch(base+'?'+qs)
        except Exception as exc:
            print(f'Image enrichment stopped on page {page_no}: {type(exc).__name__}: {exc}')
            break
        portal_events=jsonld_events_from_page(page, enforce_idf=False)
        if not portal_events:
            break
        signature=tuple((e.get('date'), normalized_key(e.get('title'))) for e in portal_events[:10])
        if page_no>1 and signature==previous_signature:
            break
        previous_signature=signature
        page_with_images=0
        for source in portal_events:
            image=source.get('image') or ''
            if not image:
                continue
            page_with_images += 1
            image_sources += 1
            title_key=normalized_key(source.get('title'))
            exact=by_date_title.get((source.get('date'), title_key), [])
            targets=exact or by_title.get(title_key, [])
            for target in targets:
                if not target.get('image'):
                    target['image']=image
                    enriched += 1
        print(f'Image enrichment page {page_no}: events={len(portal_events)} images={page_with_images}')
        if len(portal_events) < 20:
            break
    return image_sources, enriched


def scrape_fallback(start, end):
    params={'adminLevel1':'Île-de-France','timings[gte]':start.isoformat(),'timings[lte]':end.isoformat()}
    qs=urllib.parse.urlencode(params)
    events=[]
    previous_signature=None
    for page_no in range(1,80):
        base=AGENDA_PORTAL+'/events' if page_no==1 else AGENDA_PORTAL+f'/events/p/{page_no}'
        try:
            txt=fetch(base+'?'+qs)
        except Exception:
            break
        found=jsonld_events_from_page(txt, enforce_idf=False)
        if not found:
            break
        signature=tuple((e.get('date'), normalized_key(e.get('title'))) for e in found[:10])
        if page_no>1 and signature==previous_signature:
            break
        previous_signature=signature
        events.extend(found)
        if len(found)<20:
            break
    uniq={e['id']:e for e in events}
    return sorted(uniq.values(), key=lambda x:(x['date'],x['time'],x['title'].lower()))


def main():
    start,end=month_window()
    source='none'; uid=None; events=[]; error=None
    try:
        page=fetch(AGENDA_PAGE)
        uid=detect_uid(page)
        if uid:
            params={
                'timings[gte]':start.isoformat()+'T00:00:00+02:00',
                'timings[lte]':end.isoformat()+'T23:59:59+02:00',
                'adminLevel1':'Île-de-France',
            }
            ics_url=f'{ROOT}/agendas/{uid}/events.v2.ics?'+urllib.parse.urlencode(params)
            events=parse_ics(fetch(ics_url))
            source='openagenda-ics'
            image_sources,enriched=enrich_images_from_portal(events,start,end)
            print(f'OpenAgenda image enrichment: sources={image_sources}; enriched_timings={enriched}')
        if not events:
            events=scrape_fallback(start,end)
            source='openagenda-public-pages'
    except Exception as exc:
        error=f'{type(exc).__name__}: {exc}'
        try:
            events=scrape_fallback(start,end)
            source='openagenda-public-pages'
        except Exception as exc2:
            error=(error or '')+' | fallback: '+f'{type(exc2).__name__}: {exc2}'
    payload={
        'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
        'range':{'from':start.isoformat(),'to':end.isoformat()},
        'agendaUid':uid,
        'source':source,
        'error':error,
        'count':len(events),
        'events':events,
    }
    with open(OUT,'w',encoding='utf-8') as f:
        json.dump(payload,f,ensure_ascii=False,separators=(',',':'))
    image_count=sum(1 for e in events if e.get('image'))
    print(f'Generated {OUT}: {len(events)} events; images={image_count}; source={source}; uid={uid}; error={error}')

if __name__=='__main__':
    main()
