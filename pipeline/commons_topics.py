"""Candidate photos per TOPIC (meat, cooking, farm-to-table) from Wikimedia Commons (runs in GitHub Actions).

Same rules as commons_candidates.py: free licences only (CC BY, CC BY-SA, CC0, public domain), JPEG,
width >= 1400, author + licence + description recorded so each photo can be checked before it is published.
Output: research/image-candidates/t-<topic>/NN.jpg (thumbs) + index.json. Nothing is published here.
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
FREE = re.compile(r"^(cc[- ]by(-sa)?|cc0|pd|public domain)", re.I)
TXT = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()
TOPICS = {
    "sal": ["salt steak", "fleur de sel", "coarse sea salt", "salting meat", "sprinkling salt steak"],
    "crosta": ["seared steak crust", "searing steak pan", "steak cast iron skillet", "maillard steak"],
    "descanso": ["resting steak", "steak resting rack", "sliced steak medium rare"],
    "pontos": ["steak doneness", "medium rare steak", "rare steak cross section"],
    "termometro": ["meat thermometer steak", "probe thermometer meat"],
    "brasa": ["charcoal grilled steak", "grilling beef embers", "barbecue beef grill"],
    "estufado": ["beef stew", "braised beef", "pot roast"],
    "maturacao": ["dry aged beef", "dry aging cabinet", "aged beef steak"],
    "marmoreado": ["marbled beef", "beef marbling raw", "raw ribeye steak"],
    "cor": ["raw beef steak", "raw beef red meat butcher", "fresh beef cuts"],
    "fibra": ["slicing steak against the grain", "carving steak", "beef grain muscle fibre"],
    "cortes": ["beef cuts butcher", "butcher cutting beef", "beef primal cuts"],
    "osso": ["t-bone steak", "tomahawk steak", "bone-in ribeye"],
    "servir": ["steak plated restaurant", "steak dinner served", "steak with potatoes"],
    "vinho": ["red wine glass steak", "red wine tasting"],
    "nascimento": ["calf newborn cow", "calf suckling cow", "cow with calf pasture"],
    "alimentacao": ["cattle hay feeding", "cattle grazing pasture", "silage feed cattle"],
    "transporte": ["cattle transport truck", "livestock trailer cattle", "cattle market fair"],
    "matadouro": ["slaughterhouse beef hanging carcasses", "beef carcass chiller", "carcass grading beef"],
    "talho": ["butcher shop beef counter", "butcher beef display", "meat counter beef"],
    "rotulo": ["beef package label supermarket", "meat packaging label"],
}


def search(q: str) -> list[dict]:
    r = requests.get(API, params={"action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
                                  "gsrlimit": 30, "gsrsearch": q, "prop": "imageinfo",
                                  "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 600}, headers=UA, timeout=60)
    r.raise_for_status()
    return list((r.json().get("query") or {}).get("pages", {}).values())


def main() -> None:
    for topic, queries in TOPICS.items():
        d = OUT / f"t-{topic}"
        if (d / "index.json").exists():
            continue
        d.mkdir(parents=True, exist_ok=True)
        seen, items = set(), []
        for q in queries:
            try:
                pages = search(q)
            except Exception as e:
                print("FAIL", q, e)
                continue
            for p in pages:
                ii = (p.get("imageinfo") or [{}])[0]
                meta = ii.get("extmetadata") or {}
                lic = TXT((meta.get("LicenseShortName") or {}).get("value"))
                if p["title"] in seen or ii.get("mime") != "image/jpeg" or ii.get("width", 0) < 1400 or not FREE.match(lic):
                    continue
                seen.add(p["title"])
                items.append({"title": p["title"], "page": ii.get("descriptionurl"), "url": ii.get("url"), "thumb": ii.get("thumburl"),
                              "width": ii.get("width"), "height": ii.get("height"), "license": lic,
                              "author": TXT((meta.get("Artist") or {}).get("value")),
                              "description": TXT((meta.get("ImageDescription") or {}).get("value"))[:300], "query": q})
            time.sleep(1)
        for i, it in enumerate(items[:16]):
            try:
                im = Image.open(io.BytesIO(requests.get(it["thumb"], headers=UA, timeout=60).content)).convert("RGB")
                im.save(d / f"{i:02d}.jpg", quality=70)
                it["file"] = f"{i:02d}.jpg"
            except Exception as e:
                print("thumb fail", it["title"], e)
            time.sleep(0.5)
        (d / "index.json").write_text(json.dumps(items[:16], ensure_ascii=False, indent=1), encoding="utf-8")
        print(topic, len(items))


if __name__ == "__main__":
    main()
