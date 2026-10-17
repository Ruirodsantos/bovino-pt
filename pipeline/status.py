"""Refresh the machine-generated parts of PROJECT_STATUS.json from pipeline outputs and tasks."""
import datetime as dt, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "PROJECT_STATUS.json"
s = json.loads(p.read_text(encoding="utf-8"))
tasks = json.loads((ROOT / "pm/tasks.json").read_text(encoding="utf-8"))["tasks"]
last = ROOT / "data/history/last_run.json"
run = json.loads(last.read_text()) if last.exists() else None
s["generated_at"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
s["generated_by"] = "pipeline/status.py (GitHub Actions)"
s["active_tasks"] = [t["id"] for t in tasks if t["status"] in ("IN PROGRESS", "TESTING", "REVIEW")]
if run:
    ok = [d for d in run["datasets"] if d["state"] == "ok"]
    s["data_collection"] = {
        "last_run": run["finished_at"],
        "datasets_ok": len(ok), "datasets_total": len(run["datasets"]),
        "datasets": run["datasets"],
        "review_queue_rows": run["review_rows"], "revisions_detected": run["revisions"],
    }
    s["validation_failures"] = [d for d in run["datasets"] if d["state"] in ("failed", "no_data")]
s["website_health"] = {"deployed": True, "url": "https://theaipulsehub.com/bovino-pt/"}
p.write_text(json.dumps(s, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("PROJECT_STATUS.json atualizado")
