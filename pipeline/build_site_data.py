"""Turn validated CSVs into the small JSON files the website reads.

Only GREEN rows exist in data/validated, so nothing here can publish unverified values.
Headline statistics are computed only when the underlying periods are complete
(e.g. a 12-month total requires all 12 months) — otherwise the stat is omitted.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/public/data"
SOURCES_LABEL = {"S02": "Eurostat", "S03": "Eurostat — Comext"}


def load(dataset_id: str) -> tuple[list[dict], dict]:
    p = ROOT / "data/validated" / f"{dataset_id}.csv"
    m = ROOT / "data/validated" / f"{dataset_id}.meta.json"
    if not p.exists():
        return [], {}
    with p.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["value"] = float(r["value"])
    return rows, json.loads(m.read_text(encoding="utf-8")) if m.exists() else {}


def series(rows: list[dict], **filt) -> dict[str, float]:
    return {r["period"]: r["value"] for r in rows if all(r.get(k) == v for k, v in filt.items())}


def last_12_months(s: dict[str, float]) -> tuple[float, str, str] | None:
    months = sorted(k for k in s if len(k) == 7)
    if len(months) < 12:
        return None
    last = months[-12:]
    y0, m0 = map(int, last[0].split("-"))
    y1, m1 = map(int, last[-1].split("-"))
    if (y1 * 12 + m1) - (y0 * 12 + m0) != 11:   # gap in the series → don't compute
        return None
    return sum(s[k] for k in last), last[0], last[-1]


MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."]


def pm(period: str) -> str:
    """'2025-09' → 'set. 2025' (pt-PT)."""
    if len(period) == 7 and period[4] == "-":
        return f"{MESES[int(period[5:]) - 1]} {period[:4]}"
    return period


def span(a: str, b: str) -> str:
    return f"{pm(a)} – {pm(b)}"


def footnote(meta: dict, period: str) -> dict:
    return {"source": SOURCES_LABEL.get(meta.get("source_id"), meta.get("source_id")),
            "source_code": meta.get("source_code"), "dataset": meta.get("id"),
            "period": period, "published": meta.get("publication_date"),
            "verified": (meta.get("retrieved_at") or "")[:10]}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    reg = yaml.safe_load((ROOT / "data/registry/datasets.yaml").read_text(encoding="utf-8"))
    catalog, stats = [], []

    for d in reg["datasets"]:
        rows, meta = load(d["id"])
        if not rows:
            catalog.append({"id": d["id"], "title_pt": d["title_pt"], "state": "pending"})
            continue
        compact = [{k: r[k] for k in ("geo", "geo_label", "partner_geo", "flow", "product_code", "product_label",
                                      "series", "period", "value", "unit", "status_reason")} for r in rows]
        (OUT / f"{d['id']}.json").write_text(json.dumps({"meta": meta, "rows": compact}, ensure_ascii=False), encoding="utf-8")
        catalog.append({"id": d["id"], "title_pt": d["title_pt"], "state": "ok", **{k: meta.get(k) for k in
                        ("rows", "first_period", "last_period", "publication_date", "retrieved_at", "source_code")}})

    # ---- headline statistics (each one only if computable from complete data) ----
    pop, pmeta = load("bovine_population")
    pt = series(pop, geo="PT")
    if pt:
        y = max(pt)
        prev = pt.get(str(int(y) - 1))
        stats.append({"id": "pt_population", "label": "bovinos em Portugal", "value": pt[y], "unit": "cabeças",
                      "context": f"efetivo no inquérito de novembro–dezembro de {y}",
                      "change": (pt[y] - prev) / prev if prev else None, "change_ref": str(int(y) - 1) if prev else None,
                      "footnote": footnote(pmeta, f"nov.–dez. {y}")})
    trade, tm = load("trade_live_bovine_pt_es")
    eur = last_12_months(series(trade, product_code="0102", series="export/0102/VALUE_IN_EUROS"))
    if eur:
        prev = None
        s_all = series(trade, product_code="0102", series="export/0102/VALUE_IN_EUROS")
        months = sorted(s_all)
        i = months.index(eur[2])
        if i >= 23:
            prev = sum(s_all[m] for m in months[i - 23:i - 11])
        stats.append({"id": "pt_es_live_eur", "label": "em bovinos vivos vendidos por Portugal a Espanha", "value": eur[0], "unit": "€",
                      "context": f"{span(eur[1], eur[2])} (12 meses)", "change": (eur[0] - prev) / prev if prev else None,
                      "change_ref": "12 meses anteriores" if prev else None, "footnote": footnote(tm, span(eur[1], eur[2]))})
    # Head counts exist only at CN8 level; their sum is a LOWER BOUND (some codes are not detailed).
    heads: dict[str, float] = {}
    for r in trade:
        if r["series"].endswith("SUPPLEMENTARY_QUANTITY") and r["product_code"] != "0102":
            heads[r["period"]] = heads.get(r["period"], 0) + r["value"]
    t = last_12_months(heads)
    if t:
        stats.append({"id": "pt_es_live_heads", "label": "bovinos vivos atravessaram a fronteira para Espanha — pelo menos", "value": t[0],
                      "unit": "cabeças", "context": f"{span(t[1], t[2])} · soma das categorias detalhadas; o total real é superior",
                      "footnote": footnote(tm, span(t[1], t[2]))})
    beef, bm = load("trade_beef_pt_es")
    imp = {}
    for code in ("0201", "0202"):
        s = series(beef, product_code=code, series=f"import/{code}/QUANTITY_IN_100KG")
        for k, v in s.items():
            imp[k] = imp.get(k, 0) + v
    bi = last_12_months(imp)
    if bi:
        stats.append({"id": "pt_beef_imports_es", "label": "carne de bovino que Portugal compra a Espanha", "value": bi[0] / 1000,
                      "unit": "toneladas", "context": f"{span(bi[1], bi[2])} · fresca, refrigerada e congelada",
                      "footnote": footnote(bm, span(bi[1], bi[2]))})
    slm, slmm = load("bovine_slaughter_heads_monthly")
    t = last_12_months(series(slm, geo="PT"))
    if t:
        stats.append({"id": "pt_slaughter_heads", "label": "bovinos abatidos em matadouros portugueses", "value": t[0], "unit": "cabeças",
                      "context": f"{span(t[1], t[2])} (12 meses)", "footnote": footnote(slmm, span(t[1], t[2]))})
    sl, sm = load("bovine_slaughter_tonnes")
    s_pt = series(sl, geo="PT")
    if s_pt:
        y = max(s_pt)
        stats.append({"id": "pt_slaughter", "label": "de carne de bovino produzida em matadouros portugueses", "value": s_pt[y],
                      "unit": "toneladas", "context": f"peso de carcaça, {y}", "footnote": footnote(sm, y)})

    # ---- breeds for the map (only verified, sourced fields) ----
    import glob
    bl = []
    for f in sorted(glob.glob(str(ROOT / "data/registry/breeds/*.yaml"))):
        b = yaml.safe_load(open(f, encoding="utf-8"))
        if b.get("lat") is None:
            continue
        bl.append({k: b.get(k) for k in ("slug", "official_name", "solar", "lat", "lon", "herd", "photo", "photo_kind", "catalogue_page")})
    (OUT / "breeds.json").write_text(json.dumps(bl, ensure_ascii=False), encoding="utf-8")

    last_run = ROOT / "data/history/last_run.json"
    (OUT / "summary.json").write_text(json.dumps({
        "stats": stats, "catalog": catalog,
        "last_run": json.loads(last_run.read_text()) if last_run.exists() else None,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"site data: {len(stats)} headline stats, {sum(c['state'] == 'ok' for c in catalog)}/{len(catalog)} datasets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
