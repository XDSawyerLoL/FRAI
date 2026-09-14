#!/usr/bin/env python3
import json
from pathlib import Path

src = Path('events-idf.json')
dst = Path('events-idf.js')

data = json.loads(src.read_text(encoding='utf-8'))
payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
dst.write_text('window.FRAI_EVENTS_IDF=' + payload + ';\n', encoding='utf-8')
print(f'Generated {dst}: {len(data.get("events", []))} events')
