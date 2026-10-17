"""Minimal JSON-stat 2.0 reader (format returned by the Eurostat Statistics API)."""
from __future__ import annotations

from itertools import product
from typing import Iterator


def dims(ds: dict) -> list[tuple[str, list[str], dict[str, str]]]:
    """Return [(dim_id, [codes in index order], {code: label})]."""
    out = []
    for dim_id in ds["id"]:
        cat = ds["dimension"][dim_id]["category"]
        index = cat.get("index")
        if isinstance(index, dict):
            codes = sorted(index, key=index.get)
        elif isinstance(index, list):
            codes = index
        else:  # single-category dimension without index
            codes = list(cat["label"].keys())
        out.append((dim_id, codes, cat.get("label", {})))
    return out


def rows(ds: dict) -> Iterator[dict]:
    """Yield one dict per non-missing cell: {dim: code, dim+'_label': label, 'value', 'flag'}."""
    d = dims(ds)
    values = ds.get("value", {})
    status = ds.get("status", {}) or {}
    is_list = isinstance(values, list)
    sizes = [len(codes) for _, codes, _ in d]
    for pos, combo in enumerate(product(*[range(s) for s in sizes])):
        v = values[pos] if is_list else values.get(str(pos))
        if v is None:
            continue
        r = {}
        for (dim_id, codes, labels), i in zip(d, combo):
            code = codes[i]
            r[dim_id] = code
            r[f"{dim_id}_label"] = labels.get(code, code)
        r["value"] = v
        flag = status[pos] if isinstance(status, list) else status.get(str(pos))
        r["flag"] = flag
        yield r


def catalog(ds: dict) -> dict:
    """Summary of available categories — written next to raw data to make debugging easy."""
    return {dim_id: {c: labels.get(c, c) for c in codes} for dim_id, codes, labels in dims(ds)}
