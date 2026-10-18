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
            url = it.get("url")
            if it.get("flickr_page"):
                import re as _re
                h = requests.get(it["flickr_page"], headers=UA, timeout=60).text
                m = _re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', h)
                url = m.group(1) if m else url
                url = _re.sub(r"_[a-z]\.jpg$", "_b.jpg", url) if url and "staticflickr" in url else url
            r = requests.get(url, headers=UA, timeout=60)
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
    en_file = ROOT / "assets/images_en.yaml"
    if en_file.exists():
        for k, v in (yaml.safe_load(en_file.read_text(encoding="utf-8")) or {}).items():
            if k in credits:
                credits[k]["alt_en"], credits[k]["caption_en"] = v.get("alt"), v.get("caption")
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
                if it.get("layout"):
                    import subprocess, tempfile
                    with tempfile.NamedTemporaryFile(suffix=".pdf") as tf:
                        tf.write(r.content); tf.flush()
                        first, last = it.get("pages", [1, 10_000])
                        out = subprocess.run(["pdftotext", "-layout", "-f", str(first), "-l", str(last), tf.name, "-"],
                                             capture_output=True, text=True)
                    (d / "layout.txt").write_text(out.stdout, encoding="utf-8")
                cols = int(it.get("columns", 1))
                first, last = it.get("pages", [1, 10_000])
                with pdfplumber.open(io.BytesIO(r.content)) as pdf:
                    pages = []
                    for i, p in enumerate(pdf.pages):
                        if not first <= i + 1 <= last:
                            continue
                        if cols == 1:
                            body = p.extract_text() or ""
                        else:   # two-column layout: split at the emptiest vertical band near the middle
                            words = p.extract_words()
                            W = int(p.width)
                            cover = [0] * (W + 1)
                            for wd in words:
                                for x in range(int(wd["x0"]), min(W, int(wd["x1"]) + 1)):
                                    cover[x] += 1
                            lo, hi = int(W * 0.3), int(W * 0.7)
                            split = min(range(lo, hi), key=lambda x: (sum(cover[max(0, x - 3):x + 4]), abs(x - W / 2)))
                            body = (p.crop((0, 0, split, p.height)).extract_text() or "") + "\n--- coluna ---\n" + \
                                   (p.crop((split, 0, p.width, p.height)).extract_text() or "")
                        pages.append(f"=== página {i + 1} ===\n{body}")
                text = "\n".join(pages)
                if len(r.content) < 15_000_000:
                    (d / "original.pdf").write_bytes(r.content)
            elif "html" not in ctype:
                text = r.text
            else:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(r.text, "html.parser")
                for t in soup(["script", "style", "nav", "footer"]) if "html" in ctype else []:
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
