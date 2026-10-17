"""Download images and documents listed in YAML manifests (runs in GitHub Actions)."""
from __future__ import annotations

import io
import json
import re
from pathlib import Path

import requests
import yaml
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
UA = {"User-Agent": "bovino-pt/0.1 (+https://github.com/Ruirodsantos/bovino-pt)"}
IMG_OUT = ROOT / "apps/web/public/img"
CREDITS = ROOT / "apps/web/src/data/images.json"
DOC_OUT = ROOT / "research/fetched"
SIZES = {"lg": 1800, "md": 900, "sm": 480}


def images() -> None:
    man = ROOT / "assets/images.yaml"
    if not man.exists():
        return
    items = yaml.safe_load(man.read_text(encoding="utf-8"))["images"]
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    credits = json.loads(CREDITS.read_text(encoding="utf-8")) if CREDITS.exists() else {}
    report = []
    for it in items:
        iid = it["id"]
        target = IMG_OUT / f"{iid}-md.webp"
        if target.exists() and iid in credits:
            continue
        try:
            r = requests.get(it["url"], headers=UA, timeout=60)
            r.raise_for_status()
            im = ImageOps.exif_transpose(Image.open(io.BytesIO(r.content))).convert("RGB")
        except Exception as e:  # keep going; report the failure
            report.append(f"FAIL {iid}: {e}")
            continue
        w, h = im.size
        if "crop" in it:   # crop as fractions [left, top, right, bottom]
            l, t, rr, b = it["crop"]
            im = im.crop((int(l * w), int(t * h), int(rr * w), int(b * h)))
            w, h = im.size
        for name, width in SIZES.items():
            out = im if w <= width else im.resize((width, round(h * width / w)), Image.LANCZOS)
            out.save(IMG_OUT / f"{iid}-{name}.webp", "WEBP", quality=80, method=6)
        credits[iid] = {k: it.get(k) for k in ("alt", "caption", "author", "license", "source_page", "subject", "breed", "verified_note")}
        credits[iid].update(width=w, height=h)
        report.append(f"OK   {iid} {w}x{h}")
    CREDITS.parent.mkdir(parents=True, exist_ok=True)
    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n".join(report))
    (IMG_OUT / "_fetch_report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:80]


def documents() -> None:
    man = ROOT / "research/fetch.yaml"
    if not man.exists():
        return
    for it in yaml.safe_load(man.read_text(encoding="utf-8")).get("documents", []):
        d = DOC_OUT / slug(it["id"])
        if (d / "text.txt").exists():
            continue
        d.mkdir(parents=True, exist_ok=True)
        meta = {"url": it["url"], "id": it["id"]}
        try:
            r = requests.get(it["url"], headers=UA, timeout=90)
            meta["status"] = r.status_code
            ctype = r.headers.get("content-type", "")
            if "pdf" in ctype or it["url"].lower().endswith(".pdf"):
                import pdfplumber
                with pdfplumber.open(io.BytesIO(r.content)) as pdf:
                    pages = [f"=== página {i + 1} ===\n{p.extract_text() or ''}" for i, p in enumerate(pdf.pages)]
                text = "\n".join(pages)
                if len(r.content) < 15_000_000:
                    (d / "original.pdf").write_bytes(r.content)
            else:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(r.text, "html.parser")
                for t in soup(["script", "style", "nav", "footer"]):
                    t.decompose()
                text = soup.get_text("\n", strip=True)
                imgs = [i.get("src") for i in BeautifulSoup(r.text, "html.parser").find_all("img") if i.get("src")]
                meta["images"] = imgs[:80]
        except Exception as e:
            meta["error"] = str(e)
            text = ""
        (d / "text.txt").write_text(text, encoding="utf-8")
        (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
        print("DOC", it["id"], meta.get("status"), len(text))


if __name__ == "__main__":
    images()
    documents()
