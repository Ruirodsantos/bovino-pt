"""Candidate photos from Wikimedia Commons CATEGORIES (runs in GitHub Actions).

Search-based candidates (commons_candidates.py) found few photos. Commons organises breed photos
in categories ("Category:Cachena cattle" ...), so this lists the files of the best-matching
categories (and one level of sub-categories). Free licences only (CC BY, CC BY-SA, CC0, public domain),
JPEG, width >= 1400. Records author, licence, description and categories so the breed can be confirmed
before anything is published. Output: research/image-candidates/k-<key>/NN.jpg + index.json.
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
# key -> (category search terms, words a category title must contain)
TARGETS = {
    "alentejana": (["Alentejana cattle", "Alentejana cow", "Raça Alentejana"], ["alentejana"]),
    "algarvia": (["Algarvia cattle", "Raça Algarvia"], ["algarvia"]),
    "arouquesa": (["Arouquesa cattle", "Arouquesa"], ["arouquesa"]),
    "barrosa": (["Barrosã cattle", "Barrosã"], ["barros"]),
    "brava-de-lide": (["Toiro de lide Portugal", "Bravo bulls Portugal"], ["bull", "toiro", "lide"]),
    "cachena": (["Cachena cattle", "Cachena"], ["cachena"]),
    "garvonesa": (["Garvonesa"], ["garvonesa"]),
    "jarmelista": (["Jarmelista"], ["jarmelista"]),
    "marinhoa": (["Marinhoa"], ["marinhoa"]),
    "maronesa": (["Maronesa cattle", "Maronesa"], ["maronesa"]),
    "mertolenga": (["Mertolenga cattle", "Mertolenga"], ["mertolen"]),
    "minhota": (["Minhota cattle", "Minhota"], ["minhota"]),
    "mirandesa": (["Mirandesa cattle", "Mirandesa cow", "Mirandesa"], ["mirandesa", "mirandes"]),
    "preta": (["Preta cattle", "Raça Preta"], ["preta"]),
    "ramo-grande": (["Ramo Grande cattle", "Ramo Grande"], ["ramo grande"]),
    "scenes-azores": (["Cattle in the Azores", "Cows in the Azores", "Agriculture in the Azores", "Terceira Island pastures"], ["azores", "açores", "terceira", "são jorge"]),
    "scenes-portugal": (["Cattle in Portugal", "Cows in Portugal", "Cattle in Trás-os-Montes", "Cattle in Alentejo"], ["portugal", "alentejo", "trás-os-montes", "minho", "barroso"]),
    "scenes-meat": (["Portuguese beef", "Beef steak", "Posta mirandesa", "Cachena beef"], ["beef", "steak", "posta", "carne"]),
}


def get(params: dict) -> dict:
    for i in range(3):
        r = requests.get(API, params={"format": "json", **params}, headers=UA, timeout=60)
        if r.status_code == 200:
            return r.json()
        print("HTTP", r.status_code, r.text[:100])
        time.sleep(4 * (i + 1))
    return {}


def find_categories(terms: list[str], must: list[str]) -> list[str]:
    cats: list[str] = []
    for t in terms:
        j = get({"action": "query", "list": "search", "srsearch": t, "srnamespace": 14, "srlimit": 15})
        for s in j.get("query", {}).get("search", []):
            title = s["title"]
            if any(m in title.lower() for m in must) and title not in cats:
                cats.append(title)
        time.sleep(0.5)
    return cats[:8]


def members(cat: str, kind: str) -> list[str]:
    out, cont = [], {}
    for _ in range(4):
        j = get({"action": "query", "list": "categorymembers", "cmtitle": cat, "cmtype": kind, "cmlimit": 200, **cont})
        out += [m["title"] for m in j.get("query", {}).get("categorymembers", [])]
        if "continue" not in j:
            break
        cont = j["continue"]
    return out


def info(titles: list[str]) -> list[dict]:
    res = []
    for i in range(0, len(titles), 40):
        j = get({"action": "query", "titles": "|".join(titles[i:i + 40]), "prop": "imageinfo|categories", "cllimit": 30,
                 "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 640})
        res += list(j.get("query", {}).get("pages", {}).values())
        time.sleep(0.5)
    return res


def main() -> None:
    for key, (terms, must) in TARGETS.items():
        d = OUT / f"k-{key}"
        idxf = d / "index.json"
        if idxf.exists() and json.loads(idxf.read_text(encoding="utf-8")).get("results"):
            continue
        d.mkdir(parents=True, exist_ok=True)
        cats = find_categories(terms, must)
        files: list[str] = []
        for c in cats:
            files += members(c, "file")
            for sub in members(c, "subcat")[:6]:
                files += members(sub, "file")[:60]
        files = list(dict.fromkeys(files))[:300]
        res = []
        for pg in info(files):
            ii = (pg.get("imageinfo") or [None])[0]
            if not ii or not ii.get("mime", "").startswith("image/jpeg") or ii.get("width", 0) < 1400:
                continue
            m = ii.get("extmetadata", {})
            lic = TXT(m.get("LicenseShortName", {}).get("value"))
            if not FREE.match(lic):
                continue
            res.append({"title": pg["title"], "author": TXT(m.get("Artist", {}).get("value")), "license": lic,
                        "license_url": m.get("LicenseUrl", {}).get("value"), "page": ii["descriptionurl"], "image": ii["url"],
                        "thumb": ii.get("thumburl"), "size": f"{ii['width']}x{ii['height']}",
                        "description": TXT(m.get("ImageDescription", {}).get("value"))[:300],
                        "categories": [c["title"].removeprefix("Category:") for c in pg.get("categories", [])][:15],
                        "date": TXT(m.get("DateTimeOriginal", {}).get("value"))})
        out = []
        for r in res[:45]:
            f = d / f"{len(out):02d}.jpg"
            try:
                b = requests.get(r["thumb"] or r["image"], headers=UA, timeout=60)
                b.raise_for_status()
                im = Image.open(io.BytesIO(b.content)).convert("RGB")
                im.thumbnail((640, 640))
                im.save(f, "JPEG", quality=76)
                out.append({"file": f.name, **r})
            except Exception as e:
                print("thumb fail", r["title"], e)
        idxf.write_text(json.dumps({"key": key, "categories": cats, "results": out}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(key, len(cats), "cats", len(out), "photos")


if __name__ == "__main__":
    main()
