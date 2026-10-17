"""Pipeline tests on a SYNTHETIC JSON-stat fixture (test-only numbers — never published)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
import jsonstat  # noqa: E402
import process  # noqa: E402

FIXTURE = {
    "version": "2.0", "class": "dataset", "updated": "2026-10-01T23:00:00+0200",
    "id": ["freq", "animals", "month", "unit", "geo", "time"], "size": [1, 2, 1, 1, 2, 3],
    "dimension": {
        "freq": {"category": {"index": {"A": 0}, "label": {"A": "Annual"}}},
        "animals": {"category": {"index": {"A2000": 0, "A2010": 1},
                                 "label": {"A2000": "Live bovine animals", "A2010": "Bovine animals, less than 1 year"}}},
        "month": {"category": {"index": {"M12": 0}, "label": {"M12": "December"}}},
        "unit": {"category": {"index": {"THS_HD": 0}, "label": {"THS_HD": "Thousand heads"}}},
        "geo": {"category": {"index": {"ES": 0, "PT": 1}, "label": {"ES": "Spain", "PT": "Portugal"}}},
        "time": {"category": {"index": {"2022": 0, "2023": 1, "2024": 2}, "label": {}}},
    },
    # position = ((animals*2 + geo) * 3 + time); index 4 (A2000, PT, 2023) missing on purpose
    "value": {"0": 100.0, "1": 101.0, "2": 102.0, "3": 10.0, "5": 20.0, "6": 1.0, "7": 1.0},
    "status": {"5": "p"},
}

DATASET = {"id": "t_pop", "title_pt": "t", "source_id": "S02", "api": "eurostat", "code": "apro_mt_lscatl",
           "select": {"animals": ["~live bovine animals"], "month": ["M12"]},
           "flow": "stock", "unit": "head", "multiplier": 1000, "period_type": "year", "max_change": 0.15}


def test_jsonstat_rows_skip_missing_and_map_positions():
    rows = list(jsonstat.rows(FIXTURE))
    assert len(rows) == 7
    pt = [r for r in rows if r["geo"] == "PT" and r["animals"] == "A2000"]
    assert [(r["time"], r["value"]) for r in pt] == [("2022", 10.0), ("2024", 20.0)]
    assert pt[1]["flag"] == "p"


def _process(tmp_path, fixture=FIXTURE):
    snap = tmp_path / "snap"
    snap.mkdir()
    (snap / "response_00.json").write_text(json.dumps(fixture))
    (snap / "manifest.json").write_text(json.dumps({"retrieved_at": "2026-10-17T03:00:00+00:00", "used_code": "x",
        "requests": [{"url": "https://example.invalid", "file": "response_00.json", "source_updated": fixture["updated"]}]}))
    obs, _ = process.observations(DATASET, snap)
    process.classify(DATASET, obs)
    return obs


def test_selectors_multiplier_and_dates(tmp_path):
    obs = _process(tmp_path)
    assert {o["geo"] for o in obs} == {"PT", "ES"}
    es = sorted((o for o in obs if o["geo"] == "ES"), key=lambda o: o["period"])
    assert [o["value"] for o in es] == [100000.0, 101000.0, 102000.0]
    assert es[0]["publication_date"] == "2026-10-01"          # publication ≠ reference period
    assert es[0]["period"] == "2022" and es[0]["period_type"] == "year"


def test_large_jump_goes_to_review(tmp_path):
    obs = _process(tmp_path)
    pt = sorted((o for o in obs if o["geo"] == "PT"), key=lambda o: o["period"])
    assert pt[0]["status"] == "green"
    assert pt[1]["status"] == "yellow" and "exceeds" in pt[1]["status_reason"]  # 10k → 20k = +100 %


def test_monthly_period_normalisation():
    assert process.norm_period("2026M08") == ("2026-08", "month")
    assert process.norm_period("2026-08") == ("2026-08", "month")
    assert process.norm_period("2026") == ("2026", "year")


def test_duplicate_periods_in_a_series_are_rejected():
    obs = [{"geo": "PT", "series": "stock", "period": "2024", "period_type": "year", "value": 1.0, "unit": "head"},
           {"geo": "PT", "series": "stock", "period": "2024", "period_type": "year", "value": 2.0, "unit": "head"}]
    process.classify({"max_change": 1}, obs)
    assert {o["status"] for o in obs} == {"red"}


def test_sum_check_report_mode_keeps_rows_green():
    obs = [{"geo": "PT", "period": "2024-01", "series": "export/0102/VALUE_IN_EUROS", "flow": "export", "product_code": "0102", "value": 100.0, "status": "green"},
           {"geo": "PT", "period": "2024-01", "series": "export/01022999/VALUE_IN_EUROS", "flow": "export", "product_code": "01022999", "value": 80.0, "status": "green"}]
    d = {"sum_check": {"total": "0102", "mode": "report"}}
    process.sum_check(d, obs)
    assert all(o["status"] == "green" for o in obs)
    assert d["_coverage"]["VALUE_IN_EUROS"]["2024"] == 0.8
