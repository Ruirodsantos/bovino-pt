import json
import shutil
import sys
from pathlib import Path

import jsonschema
import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
import validate_registry as vr  # noqa: E402


def test_repository_registry_is_valid():
    assert vr.main(ROOT) == 0


def test_fifteen_bovine_breeds_registered():
    assert len(list((ROOT / "data/registry/breeds").glob("*.yaml"))) == 15


@pytest.fixture
def tmp_repo(tmp_path):
    for p in ("data", "pm", "reviews", "PROJECT_STATUS.json"):
        src = ROOT / p
        (shutil.copytree if src.is_dir() else shutil.copy)(src, tmp_path / p)
    return tmp_path


def test_breed_value_without_source_is_rejected(tmp_repo):
    f = tmp_repo / "data/registry/breeds/mirandesa.yaml"
    b = yaml.safe_load(f.read_text(encoding="utf-8"))
    b["fields"]["population"]["value"] = 12345  # invented number, no source
    f.write_text(yaml.safe_dump(b, allow_unicode=True), encoding="utf-8")
    assert vr.main(tmp_repo) == 1


def test_complete_task_without_evidence_is_rejected(tmp_repo):
    f = tmp_repo / "pm/tasks.json"
    d = json.loads(f.read_text())
    d["tasks"][0]["status"], d["tasks"][0]["evidence"] = "COMPLETE", []
    f.write_text(json.dumps(d))
    assert vr.main(tmp_repo) == 1


def test_claimed_chatgpt_review_without_file_is_rejected(tmp_repo):
    f = tmp_repo / "PROJECT_STATUS.json"
    d = json.loads(f.read_text())
    d["reviews"]["chatgpt_reviews_completed"] = 1
    f.write_text(json.dumps(d))
    assert vr.main(tmp_repo) == 1


def _observation(**over):
    o = {"dataset_id": "trade_live_bovine_pt_es", "species": "bovine", "geo": "PT", "partner_geo": "ES",
         "flow": "export", "product_code": "0102", "period": "2026-08", "period_type": "month",
         "value": 1.0, "unit": "head", "source_id": "S03",
         "source_url": "https://ec.europa.eu/eurostat", "retrieved_at": "2026-10-16T03:00:00Z",
         "status": "green", "status_reason": None}
    o.update(over)
    return o


def test_observation_schema():
    schema = json.loads((ROOT / "schemas/observation.schema.json").read_text())
    jsonschema.validate(_observation(), schema)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(_observation(status="yellow", status_reason=None), schema)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(_observation(unit="bananas"), schema)
