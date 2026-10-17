"""Collect CANDIDATE photos for human/agent review (runs in GitHub Actions).

Reads assets/candidates.yaml:
  queries:  [text, ...]            → Openverse search (commercial-use licences, Wikimedia excluded)
  urls:     [{id, page|image}, ...] → specific photos (Unsplash/Flickr/Pexels pages or direct images)
Writes research/image-candidates/<group>/<n>.jpg (small thumbs) + index.json with licence/credit.
Nothing here is published; curated picks go to assets/images.yaml.
"""
from __future__ import annotations

import io
import json
import re
from pathlib import Path

import requests
import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research/image-candidates"
UA = {"User-Agent": "Mozilla/5.0 (bovino-pt research; +https://github.com/Ruirodsantos/bovino-pt)"}
EXCLUDE = {"wikimedia", "wikimedia_commons"}


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def thumb(url: str, path: Path) -> bool:
    try:
        r = requests.get(url, headers=UA, timeout=40)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content)).convert("RGB")
        im.thumbnail((640, 640))
        im.save(path, "JPEG", quality=78)
        return True
    except Exception as e:
        print("thumb fail", url[:80], e)
        return False


def og_image(page: str) -> tuple[str | None, str]:
    r = requests.get(page, headers=UA, timeout=40)
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', r.text)
    t = re.search(r"<title>(.*?)</title>", r.text, re.S)
    lic = re.search(r'(creativecommons\.org/[a-z/0-9.-]+|Unsplash License|Pexels License|Free to use)', r.text)
    return (m.group(1) if m else None), f"{(t.group(1).strip() if t else '')[:160]} || licence-hint: {lic.group(1) if lic else '?'}"


def main() -> None:
    cfg = yaml.safe_load((ROOT / "assets/candidates.yaml").read_text(encoding="utf-8"))
    for q in cfg.get("queries", []):
        d = OUT / f"q-{slug(q)}"
        if (d / "index.json").exists():
            continue
        d.mkdir(parents=True, exist_ok=True)
        idx = []
        try:
            j = requests.get("https://api.openverse.org/v1/images/", params={"q": q, "page_size": 30, "license_type": "commercial"},
                             headers=UA, timeout=40).json()
        except Exception as e:
            j = {"results": [], "error": str(e)}
        n = 0
        for x in j.get("results", []):
            if x.get("source") in EXCLUDE or n >= 12:
                continue
            p = d / f"{n:02d}.jpg"
            if thumb(x.get("thumbnail") or x["url"], p):
                idx.append({"file": p.name, "source": x.get("source"), "license": f"{x.get('license')} {x.get('license_version')}",
                            "title": x.get("title"), "creator": x.get("creator"), "image": x.get("url"),
                            "page": x.get("foreign_landing_url"), "tags": [t.get("name") for t in (x.get("tags") or [])][:12]})
                n += 1
        (d / "index.json").write_text(json.dumps({"query": q, "results": idx, "error": j.get("error")}, ensure_ascii=False, indent=1), encoding="utf-8")
        print("query", q, len(idx))
    for grp, items in (cfg.get("urls") or {}).items():
        d = OUT / f"u-{slug(grp)}"
        d.mkdir(parents=True, exist_ok=True)
        idxf = d / "index.json"
        idx = json.loads(idxf.read_text()) if idxf.exists() else []
        done = {i["id"] for i in idx}
        for it in items:
            if it["id"] in done:
                continue
            img, info = it.get("image"), ""
            if it.get("page"):
                try:
                    og, info = og_image(it["page"])
                    img = img or og
                except Exception as e:
                    info = f"page error {e}"
            ok = bool(img) and thumb(img, d / f"{it['id']}.jpg")
            idx.append({"id": it["id"], "page": it.get("page"), "image": img, "info": info, "ok": ok})
        idxf.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
        print("group", grp, len(idx))


if __name__ == "__main__":
    main()
