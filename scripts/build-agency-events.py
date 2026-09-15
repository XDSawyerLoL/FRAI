#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUBMISSIONS = ROOT / "agency-submissions"
OUTPUT = ROOT / "agency-events.js"


def valid_event(data):
    required = ["id", "title", "date", "department", "city"]
    return isinstance(data, dict) and all(str(data.get(k, "")).strip() for k in required)


def duplicate_key(data):
    return tuple(str(data.get(k, "")).strip().casefold() for k in (
        "title", "date", "time", "end_time", "department", "city", "registration_url"
    ))


def main():
    unique = {}
    if SUBMISSIONS.exists():
        for path in sorted(SUBMISSIONS.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception as exc:
                print(f"Skip {path.name}: {exc}")
                continue
            if not valid_event(data):
                print(f"Skip invalid event: {path.name}")
                continue
            if data.get("published", True) is False:
                continue
            data["source"] = "agency"
            data.setdefault("category", "autre")
            data.setdefault("url", f"evenement-agence.html?id={data['id']}")
            unique[duplicate_key(data)] = data

    events = list(unique.values())
    events.sort(key=lambda e: (e.get("date", ""), e.get("time", ""), e.get("title", "")))
    payload = {"generatedAt": "", "count": len(events), "events": events}
    js = "window.FRAI_AGENCY_EVENTS=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    js += "if(window.FRAI_EVENTS_IDF&&Array.isArray(window.FRAI_EVENTS_IDF.events)){\n"
    js += "  const seen=new Set(window.FRAI_EVENTS_IDF.events.map(e=>String(e&&e.id||'')));\n"
    js += "  for(const e of window.FRAI_AGENCY_EVENTS.events||[]){\n"
    js += "    const id=String(e&&e.id||'');\n"
    js += "    if(!id||seen.has(id)) continue;\n"
    js += "    window.FRAI_EVENTS_IDF.events.push(e);\n"
    js += "    seen.add(id);\n"
    js += "  }\n"
    js += "}\n"
    OUTPUT.write_text(js, encoding="utf-8")
    print(f"Built {OUTPUT.name}: {len(events)} agency events")


if __name__ == "__main__":
    main()
