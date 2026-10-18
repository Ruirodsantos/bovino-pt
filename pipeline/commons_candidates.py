"""Candidate breed photos from Wikimedia Commons (runs in GitHub Actions).

Allowed by the founder on 2026-10-18 (replaces the earlier "never Wikimedia" rule).
For each breed it searches File: pages, keeps only free licences (CC BY, CC BY-SA, CC0, public domain),
and records author, licence, categories and description, so the breed can be confirmed before publishing.
Output: research/image-candidates/c-<breed>/NN.jpg (thumbs) + index.json. Nothing is published here.
"""
from __future__ import annotations

import html
import io
import json
import re
import time
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research/image-candidates"
UA = {"User-Agent": "bovino-pt/0.1 (https://github.com/Ruirodsantos/bovino-pt; research project) python-requests"}
API = "https://commons.wikimedia.org/w/api.php"
BREEDS = {
    "alentejana": ["Alentejana cattle", "raça Alentejana bovino", "Alentejana cow Portugal"],
    "algarvia": ["Algarvia cattle", "raça Algarvia bovino"],
    "arouquesa": ["Arouquesa cattle", "raça Arouquesa", "Arouquesa cow"],
    "barrosa": ["Barrosã cattle", "Barrosa cattle", "raça Barrosã"],
    "brava-de-lide": ["Brava de Lide", "Toiro bravo Portugal", "Portuguese fighting bull"],
    "cachena": ["Cachena cattle", "raça Cachena", "Cachena cow"],
    "garvonesa": ["Garvonesa cattle", "raça Garvonesa"],
    "jarmelista": ["Jarmelista cattle", "raça Jarmelista"],
    "marinhoa": ["Marinhoa cattle", "raça Marinhoa"],
    "maronesa": ["Maronesa cattle", "raça Maronesa", "Maronesa cow"],
    "mertolenga": ["Mertolenga cattle", "raça Mertolenga", "Mertolengo cow"],
    "minhota": ["Minhota cattle", "raça Minhota bovino"],
    "mirandesa": ["Mirandesa cattle", "raça Mirandesa", "Mirandesa cow", "Posta mirandesa vaca"],
    "preta": ["Preta cattle Portugal", "raça Preta bovino"],
    "ramo-grande": ["Ramo Grande cattle", "Ramo Grande Açores bovino"],
}
FREE = re.compile(r"^(cc[- ]by(-sa)?|cc0|pd|public domain)", re.I)
TXT = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def search(term: str) -> list[dict]:
    p = {"action": "query", "format": "json", "generator": "search", "gsrsearch": term, "gsrnamespace": 6,
         "gsrlimit": 25, "prop": "imageinfo|categories", "cllimit": 30, "iiprop": "url|extmetadata|size|mime",
         "iiurlwidth": 640}
    for i in range(3):
        r = requests.get(API, params=p, headers=UA, timeout=60)
        if r.status_code == 200:
            return list((r.json().get("query") or {}).get("pages", {}).values())
        print("HTTP", r.status_code, term, r.text[:120])
        time.sleep(5 * (i + 1))
    return []


def main() -> None:
    for slug, terms in BREEDS.items():
        d = OUT / f"c-{slug}"
        idxf = d / "index.json"
        if idxf.exists() and json.loads(idxf.read_text(encoding="utf-8")).get("results"):
            continue
        d.mkdir(parents=True, exist_ok=True)
        seen, res = set(), []
        for t in terms:
            for pg in search(t):
                ii = (pg.get("imageinfo") or [None])[0]
                if not ii or pg["title"] in seen or not ii.get("mime", "").startswith("image/jpeg"):
                    continue
                seen.add(pg["title"])
                m = ii.get("extmetadata", {})
                lic = TXT(m.get("LicenseShortName", {}).get("value"))
                if not FREE.match(lic) or ii.get("width", 0) < 1000:
                    continue
                res.append({"title": pg["title"], "author": TXT(m.get("Artist", {}).get("value")), "license": lic,
                            "license_url": m.get("LicenseUrl", {}).get("value"), "page": ii["descriptionurl"],
                            "image": ii["url"], "thumb": ii.get("thumburl"), "size": f"{ii['width']}x{ii['height']}",
                            "description": TXT(m.get("ImageDescription", {}).get("value"))[:300],
                            "categories": [c["title"].removeprefix("Category:") for c in pg.get("categories", [])][:15],
                            "date": TXT(m.get("DateTimeOriginal", {}).get("value"))})
            time.sleep(1)
        out = []
        for r in res[:20]:
            f = d / f"{len(out):02d}.jpg"
            try:
                b = requests.get(r["thumb"] or r["image"], headers=UA, timeout=60)
                b.raise_for_status()
                im = Image.open(io.BytesIO(b.content)).convert("RGB")
                im.thumbnail((640, 640))
                im.save(f, "JPEG", quality=78)
                out.append({"file": f.name, **r})
            except Exception as e:
                print("thumb fail", r["title"], e)
        idxf.write_text(json.dumps({"breed": slug, "results": out}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(slug, len(out))


if __name__ == "__main__":
    main()
