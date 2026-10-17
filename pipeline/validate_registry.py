"""Validate the source registry, breed registry, task queue and project status.

Usage: python pipeline/validate_registry.py [repo_root]
Exit code 0 = all checks pass; 1 = errors (printed).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REQUIRED_SOURCE_FIELDS = {
    "id", "name", "url", "categories", "access_method", "publication_frequency",
    "collection_frequency", "last_successful_check", "last_data_update",
    "usage_restrictions", "reliability", "collector", "status",
}
RELIABILITY = {"A", "B", "C", "D"}
BREED_STATUS = {"green", "yellow", "red"}
LIFECYCLE = ["IDEA", "RESEARCH", "READY", "IN PROGRESS", "TESTING", "REVIEW", "APPROVED", "COMPLETE"]


def check_sources(root: Path) -> list[str]:
    errors: list[str] = []
    data = yaml.safe_load((root / "data/registry/sources.yaml").read_text(encoding="utf-8"))
    seen: set[str] = set()
    for s in data.get("sources", []):
        sid = s.get("id", "?")
        missing = REQUIRED_SOURCE_FIELDS - s.keys()
        if missing:
            errors.append(f"source {sid}: missing fields {sorted(missing)}")
        if sid in seen:
            errors.append(f"source {sid}: duplicate id")
        seen.add(sid)
        if s.get("reliability") not in RELIABILITY:
            errors.append(f"source {sid}: invalid reliability {s.get('reliability')!r}")
        # A check date may only be set together with an actual collector.
        if s.get("last_successful_check") and not s.get("collector"):
            errors.append(f"source {sid}: has a check date but no collector")
    return errors


def check_breeds(root: Path) -> list[str]:
    errors: list[str] = []
    files = sorted((root / "data/registry/breeds").glob("*.yaml"))
    for f in files:
        b = yaml.safe_load(f.read_text(encoding="utf-8"))
        if b.get("slug") != f.stem:
            errors.append(f"breed {f.name}: slug does not match file name")
        if b.get("status") not in BREED_STATUS:
            errors.append(f"breed {f.name}: invalid status")
        if b.get("status") in {"yellow", "red"} and not b.get("status_reason"):
            errors.append(f"breed {f.name}: yellow/red without status_reason")
        for name, field in (b.get("fields") or {}).items():
            # No value without a source; no empty field without a reason.
            if field.get("value") is not None and not field.get("source_id"):
                errors.append(f"breed {f.name}: field {name} has a value but no source")
            if field.get("value") is None and not field.get("missing_reason"):
                errors.append(f"breed {f.name}: field {name} empty without missing_reason")
    return errors


def check_tasks(root: Path) -> list[str]:
    errors: list[str] = []
    data = json.loads((root / "pm/tasks.json").read_text(encoding="utf-8"))
    ids = {t["id"] for t in data["tasks"]}
    for t in data["tasks"]:
        if t.get("status") not in LIFECYCLE:
            errors.append(f"task {t['id']}: invalid status {t.get('status')!r}")
        if t.get("status") == "COMPLETE" and not t.get("evidence"):
            errors.append(f"task {t['id']}: COMPLETE without evidence")
        for dep in t.get("depends_on", []):
            if dep.startswith("T-") and dep not in ids:
                errors.append(f"task {t['id']}: unknown dependency {dep}")
    return errors


def check_status(root: Path) -> list[str]:
    errors: list[str] = []
    status = json.loads((root / "PROJECT_STATUS.json").read_text(encoding="utf-8"))
    for key in ("current_phase", "completed_deliverables", "active_tasks", "blocked_tasks",
                "data_collection", "validation_failures", "website_health", "recent_changes",
                "outstanding_decisions", "next_priorities"):
        if key not in status:
            errors.append(f"PROJECT_STATUS.json: missing {key}")
    if status.get("reviews", {}).get("chatgpt_reviews_completed", 0) > 0:
        done = list((root / "reviews/completed").glob("*.review.md"))
        if len(done) < status["reviews"]["chatgpt_reviews_completed"]:
            errors.append("PROJECT_STATUS.json claims ChatGPT reviews that have no file in reviews/completed")
    return errors


def main(root: Path) -> int:
    errors = check_sources(root) + check_breeds(root) + check_tasks(root) + check_status(root)
    for e in errors:
        print(f"ERROR {e}")
    print(f"{'FAIL' if errors else 'OK'}: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]))
