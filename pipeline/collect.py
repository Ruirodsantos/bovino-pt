"""Collect raw data for every dataset in data/registry/datasets.yaml.

Runs in GitHub Actions (official statistics hosts are not reachable from agent sandboxes).
Writes data/raw/<dataset>/<YYYY-MM-DD>/response*.json + manifest.json + catalog.json.
Never edits validated data.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import requests
import yaml

sys.path.insert(0, str(Path(__file__).parent))
import jsonstat  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
UA = "bovino-pt/0.1 (+https://github.com/Ruirodsantos/bovino-pt; open-data research project)"
BASES = {
    "eurostat": "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/",
    "comext": "https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/",
}


def build_url(api: str, code: str, params: dict, since: str) -> str:
    q: list[tuple[str, str]] = [("format", "JSON"), ("lang", "en"), ("sinceTimePeriod", since)]
    for k, v in params.items():
        for item in (v if isinstance(v, list) else [v]):
            q.append((k, str(item)))
    return BASES[api] + code + "?" + urlencode(q)


def fetch(url: str, tries: int = 3) -> requests.Response:
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=120)
            if r.status_code == 200:
                return r
            last = r
            if r.status_code in (400, 404):
                return r          # deterministic error — don't hammer the server
        except requests.RequestException as e:  # network error
            last = e
        time.sleep(5 * (i + 1))
    if isinstance(last, requests.Response):
        return last
    raise RuntimeError(f"network failure: {last}")


def collect_dataset(d: dict, since: str, today: str) -> dict:
    out_dir = ROOT / "data/raw" / d["id"] / today
    out_dir.mkdir(parents=True, exist_ok=True)
    codes = d["code"] if isinstance(d["code"], list) else [d["code"]]
    # Comext queries are split per product to keep each response small and to isolate invalid codes.
    split_key = "product" if d["api"] == "comext" and isinstance(d["params"].get("product"), list) else None
    parts = d["params"][split_key] if split_key else [None]
    manifest = {"dataset": d["id"], "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                "requests": [], "used_code": None, "attempts": []}
    prev_code = None
    for code in codes:
        ok_any = False
        if manifest["requests"]:   # keep the failed attempt of the previous code for diagnosis
            manifest["attempts"].append({"code": prev_code, "requests": manifest["requests"]})
        manifest["requests"] = []
        prev_code = code
        for i, part in enumerate(parts):
            params = dict(d["params"])
            if split_key:
                params[split_key] = part
            url = build_url(d["api"], code, params, since)
            try:
                r = fetch(url)
                entry = {"url": url, "status": r.status_code, "bytes": len(r.content)}
            except RuntimeError as e:
                manifest["requests"].append({"url": url, "status": None, "error": str(e)})
                continue
            if r.status_code == 200:
                try:
                    payload = r.json()
                    if "value" not in payload:
                        raise ValueError("not JSON-stat")
                except ValueError as e:
                    entry["error"] = f"bad payload: {e}; head={r.text[:300]!r}"
                    manifest["requests"].append(entry)
                    continue
                name = f"response_{i:02d}.json"
                (out_dir / name).write_bytes(r.content)
                (out_dir / name.replace("response", "catalog")).write_text(
                    json.dumps(jsonstat.catalog(payload), ensure_ascii=False, indent=1), encoding="utf-8")
                entry.update(file=name, sha256=hashlib.sha256(r.content).hexdigest(),
                             source_updated=payload.get("updated"))
                ok_any = True
            else:
                entry["error"] = r.text[:500]
            manifest["requests"].append(entry)
            time.sleep(1)
        if ok_any:
            manifest["used_code"] = code
            break
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    return manifest


def main(only: list[str]) -> int:
    reg = yaml.safe_load((ROOT / "data/registry/datasets.yaml").read_text(encoding="utf-8"))
    since = reg["defaults"]["since"]
    today = dt.date.today().isoformat()
    failures = 0
    for d in reg["datasets"]:
        if only and d["id"] not in only:
            continue
        m = collect_dataset(d, d.get("since", since), today)
        ok = m["used_code"] is not None
        failures += 0 if ok else 1
        print(f"{'OK ' if ok else 'ERR'} {d['id']}: {sum(1 for r in m['requests'] if r.get('file'))}/{len(m['requests'])} responses")
        for r in m["requests"]:
            if r.get("error"):
                print(f"     {r.get('status')} {r['url'][:160]} :: {r['error'][:200]}")
    print(f"collection finished, {failures} dataset(s) failed")
    return 0  # failures are reported by validate/status, not by crashing the whole run


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
