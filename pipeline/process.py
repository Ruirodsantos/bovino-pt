"""Normalize + validate the latest raw snapshot of each dataset.

raw JSON-stat → observations → status (green/yellow/red) →
  data/validated/<dataset>.csv   (green rows only — the only rows the site may use)
  data/validated/<dataset>.meta.json
  data/history/review_queue.json  (yellow rows, with reasons)
  data/history/rejected.json      (red rows / failed datasets)
  data/history/revisions.csv      (append: values the source changed since our last run)
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent))
import jsonstat  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ["dataset_id", "species", "geo", "geo_label", "partner_geo", "flow", "product_code", "product_label",
          "series", "period", "period_type", "value", "unit", "source_id", "source_url", "publication_date",
          "retrieved_at", "verified_at", "status", "status_reason"]
TIME_RE = {"year": re.compile(r"^\d{4}$"), "month": re.compile(r"^\d{4}-\d{2}$")}


def norm_period(t: str) -> tuple[str, str]:
    t = str(t)
    if re.fullmatch(r"\d{4}", t):
        return t, "year"
    m = re.fullmatch(r"(\d{4})-?M?(\d{2})", t)
    if m:
        return f"{m.group(1)}-{m.group(2)}", "month"
    m = re.fullmatch(r"(\d{4})-?Q([1-4])", t)
    if m:
        return f"{m.group(1)}-Q{m.group(2)}", "quarter"
    return t, "unknown"


def matches(row: dict, dim: str, selectors: list[str]) -> bool:
    code, label = str(row.get(dim, "")), str(row.get(f"{dim}_label", "")).lower()
    for s in selectors:
        if s.startswith("~"):
            if s[1:].lower() in label:
                return True
        elif code == s:
            return True
    return False


def latest_snapshot(dataset_id: str) -> Path | None:
    base = ROOT / "data/raw" / dataset_id
    if not base.exists():
        return None
    snaps = sorted(p for p in base.iterdir() if p.is_dir() and (p / "manifest.json").exists())
    return snaps[-1] if snaps else None


def observations(d: dict, snap: Path) -> tuple[list[dict], dict]:
    manifest = json.loads((snap / "manifest.json").read_text(encoding="utf-8"))
    obs: list[dict] = []
    source_updated = None
    for req in manifest["requests"]:
        if not req.get("file"):
            continue
        ds = json.loads((snap / req["file"]).read_text(encoding="utf-8"))
        source_updated = req.get("source_updated") or source_updated
        for r in jsonstat.rows(ds):
            if not all(matches(r, dim, sel) for dim, sel in d.get("select", {}).items() if dim in r):
                continue
            geo = r.get("geo") or r.get("reporter")
            if d.get("geo_prefix") and not any(str(geo).startswith(p) for p in d["geo_prefix"]):
                continue
            if d.get("geo_prefix") and len(str(geo)) != 4:   # NUTS 2 codes only (e.g. PT11)
                continue
            period, ptype = norm_period(r.get("time") or r.get("TIME_PERIOD"))
            ind = r.get("indicators")
            unit = d.get("unit") or d["unit_by_indicator"][ind]
            mult = d.get("multiplier") or d["multiplier_by_indicator"][ind]
            flow = d.get("flow") or d["flow_by_code"][str(r.get("flow"))]
            series = "/".join(x for x in [flow, r.get("product"), ind] if x)
            obs.append({
                "dataset_id": d["id"], "species": "bovine",
                "geo": geo, "geo_label": r.get("geo_label") or r.get("reporter_label"),
                "partner_geo": r.get("partner"), "flow": flow,
                "product_code": r.get("product"), "product_label": r.get("product_label"),
                "series": series, "period": period, "period_type": ptype,
                "value": round(float(r["value"]) * mult, 4), "unit": unit,
                "source_id": d["source_id"], "source_url": next((q["url"] for q in manifest["requests"] if q.get("file")), ""),
                "publication_date": (source_updated or "")[:10] or None,
                "retrieved_at": manifest["retrieved_at"], "flag": r.get("flag"),
            })
    return obs, manifest


def classify(d: dict, obs: list[dict]) -> None:
    """Assign status. GREEN = passes all checks. YELLOW = needs a human look. RED = never published."""
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    by_series: dict[tuple, list[dict]] = {}
    for o in obs:
        by_series.setdefault((o["geo"], o["series"]), []).append(o)
    for rows in by_series.values():
        rows.sort(key=lambda o: o["period"])
        prev = None
        for o in rows:
            o["status"], o["status_reason"], o["verified_at"] = "green", "", now
            if o["value"] < 0:
                o["status"], o["status_reason"] = "red", "negative value"
            elif o["period_type"] == "unknown":
                o["status"], o["status_reason"] = "red", "unparseable period"
            elif o.get("flag") and "p" in str(o["flag"]).lower():
                o["status_reason"] = "provisional value (source flag p)"   # still green, shown as provisional
            if o["status"] == "green" and prev is not None and prev["value"] > 0:
                ch = abs(o["value"] - prev["value"]) / prev["value"]
                if ch > d.get("max_change", 1.0):
                    o["status"], o["status_reason"] = "yellow", f"change {ch:.0%} vs {prev['period']} exceeds {d.get('max_change'):.0%}"
            prev = o


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    reg = yaml.safe_load((ROOT / "data/registry/datasets.yaml").read_text(encoding="utf-8"))
    hist = ROOT / "data/history"
    hist.mkdir(parents=True, exist_ok=True)
    review, rejected, revisions, summary = [], [], [], []
    for d in reg["datasets"]:
        snap = latest_snapshot(d["id"])
        if snap is None:
            rejected.append({"dataset": d["id"], "reason": "no raw snapshot yet"})
            summary.append({"dataset": d["id"], "state": "no_data"})
            continue
        obs, manifest = observations(d, snap)
        if not obs:
            rejected.append({"dataset": d["id"], "reason": "no rows matched selectors — check catalog files",
                             "snapshot": str(snap.relative_to(ROOT))})
            summary.append({"dataset": d["id"], "state": "failed"})
            continue
        classify(d, obs)
        green = [o for o in obs if o["status"] == "green"]
        review += [o for o in obs if o["status"] == "yellow"]
        rejected += [{"dataset": d["id"], **o} for o in obs if o["status"] == "red"]
        out = ROOT / "data/validated" / f"{d['id']}.csv"
        old = {(r["geo"], r["series"], r["period"]): r["value"] for r in read_csv(out)}
        for o in green:
            k = (o["geo"], o["series"], o["period"])
            if k in old and abs(float(old[k]) - o["value"]) > 1e-9:
                revisions.append({"dataset_id": d["id"], "geo": o["geo"], "series": o["series"], "period": o["period"],
                                  "old": old[k], "new": o["value"], "detected_at": o["verified_at"]})
        write_csv(out, green)
        periods = sorted({o["period"] for o in green})
        meta = {"id": d["id"], "title_pt": d["title_pt"], "source_id": d["source_id"],
                "source_code": manifest.get("used_code") or d["code"], "rows": len(green),
                "first_period": periods[0] if periods else None, "last_period": periods[-1] if periods else None,
                "publication_date": green[0]["publication_date"] if green else None,
                "retrieved_at": manifest["retrieved_at"], "snapshot": str(snap.relative_to(ROOT)),
                "yellow_rows": sum(o["status"] == "yellow" for o in obs), "red_rows": sum(o["status"] == "red" for o in obs)}
        (ROOT / "data/validated" / f"{d['id']}.meta.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
        summary.append({"dataset": d["id"], "state": "ok", "rows": len(green), "last_period": meta["last_period"]})
    (hist / "review_queue.json").write_text(json.dumps(review, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    (hist / "rejected.json").write_text(json.dumps(rejected, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    if revisions:
        p = hist / "revisions.csv"
        new = not p.exists()
        with p.open("a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(revisions[0].keys()))
            if new:
                w.writeheader()
            w.writerows(revisions)
    (hist / "last_run.json").write_text(json.dumps({"finished_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                                                    "datasets": summary, "review_rows": len(review),
                                                    "revisions": len(revisions)}, indent=1), encoding="utf-8")
    for s in summary:
        print(s)
    print(f"review queue: {len(review)} rows · revisions detected: {len(revisions)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
