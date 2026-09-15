#!/usr/bin/env python3
import json
import os
import re
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = os.environ.get('GITHUB_REPOSITORY', 'XDSawyerLoL/FRAI')
TOKEN = os.environ.get('GITHUB_TOKEN', '')
API = f'https://api.github.com/repos/{REPO}/issues'
ALLOWED_ASSOCIATIONS = {'OWNER', 'MEMBER', 'COLLABORATOR'}

DEPARTMENTS = {
    'Paris (75)': '75',
    'Seine-et-Marne (77)': '77',
    'Yvelines (78)': '78',
    'Essonne (91)': '91',
    'Hauts-de-Seine (92)': '92',
    'Seine-Saint-Denis (93)': '93',
    'Val-de-Marne (94)': '94',
    "Val-d'Oise (95)": '95',
    'Val-d’Oise (95)': '95',
}

CATEGORY_MAP = {
    'mrs': 'mrs',
    'job dating': 'jobdating',
    'alternance': 'alternance',
    'recrutement sans cv': 'sanscv',
    'intelligence artificielle': 'ia',
    'atelier / information': 'autre',
    'autre': 'autre',
}


def normalize(value):
    value = unicodedata.normalize('NFD', str(value or ''))
    value = ''.join(c for c in value if unicodedata.category(c) != 'Mn')
    return value.lower().strip()


def fetch_open_issues():
    if not TOKEN:
        raise RuntimeError('GITHUB_TOKEN missing')
    issues = []
    page = 1
    while True:
        url = f'{API}?state=open&per_page=100&page={page}'
        req = urllib.request.Request(url, headers={
            'Accept': 'application/vnd.github+json',
            'Authorization': f'Bearer {TOKEN}',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'FRAI-Agency-Events/1.0',
        })
        with urllib.request.urlopen(req, timeout=30) as response:
            batch = json.load(response)
        if not batch:
            break
        issues.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return issues


def parse_fields(body):
    body = body or ''
    fields = {}
    matches = re.findall(r'(?ms)^###\s+(.+?)\s*\n+(.*?)(?=^###\s+|\Z)', body)
    for label, value in matches:
        value = value.strip()
        if value in {'_No response_', 'No response'}:
            value = ''
        fields[label.strip()] = value
    return fields


def valid_date(value):
    try:
        datetime.strptime(value, '%Y-%m-%d')
        return value
    except Exception:
        return None


def valid_time(value):
    value = (value or '').strip()
    if not value:
        return ''
    if re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
        return value
    return ''


def public_url(value):
    value = (value or '').strip()
    return value if re.match(r'^https://', value, re.I) else ''


def event_from_issue(issue):
    title_prefix = '[AGENCE]'
    if not str(issue.get('title', '')).upper().startswith(title_prefix):
        return None
    if issue.get('pull_request'):
        return None
    if str(issue.get('author_association', '')).upper() not in ALLOWED_ASSOCIATIONS:
        return None

    fields = parse_fields(issue.get('body'))
    event_title = fields.get("Titre de l'événement", '').strip() or str(issue.get('title', '')).replace('[AGENCE]', '', 1).strip()
    date = valid_date(fields.get('Date', '').strip())
    start_time = valid_time(fields.get('Heure de début', ''))
    if not event_title or not date or not start_time:
        return None

    end_time = valid_time(fields.get('Heure de fin', ''))
    department_label = fields.get('Département', '').strip()
    department = DEPARTMENTS.get(department_label)
    if not department:
        m = re.search(r'\b(75|77|78|91|92|93|94|95)\b', department_label)
        department = m.group(1) if m else ''

    category_label = fields.get('Catégorie', '').strip()
    category = CATEGORY_MAP.get(normalize(category_label), 'autre')
    city = fields.get('Ville', '').strip()
    address = fields.get('Adresse / lieu', '').strip()
    description = fields.get('Description', '').strip()
    image = public_url(fields.get('Image (URL)', ''))
    registration = public_url(fields.get("Lien d'inscription", ''))
    issue_url = issue.get('html_url', '')

    capacity_raw = re.sub(r'\D+', '', fields.get('Nombre de places', ''))
    capacity = int(capacity_raw) if capacity_raw else None

    return {
        'id': f"agency-{issue.get('number')}",
        'date': date,
        'time': start_time,
        'endTime': end_time,
        'title': event_title,
        'location': address or city,
        'city': city,
        'department': department,
        'category': category,
        'image': image,
        'url': registration or issue_url,
        'registrationUrl': registration,
        'description': description,
        'capacity': capacity,
        'source': 'agency',
        'agency': True,
        'issueNumber': issue.get('number'),
        'issueUrl': issue_url,
    }


def main():
    events = []
    for issue in fetch_open_issues():
        event = event_from_issue(issue)
        if event:
            events.append(event)

    events.sort(key=lambda e: (e.get('date', ''), e.get('time', ''), e.get('title', '').lower()))
    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'count': len(events),
        'events': events,
    }

    Path('agency-events.json').write_text(
        json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n',
        encoding='utf-8'
    )
    Path('agency-events.js').write_text(
        'window.FRAI_AGENCY_EVENTS=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8'
    )
    print(f'Generated agency-events.json/js: {len(events)} published agency events')


if __name__ == '__main__':
    main()
