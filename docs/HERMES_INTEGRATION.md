# HERMES_INTEGRATION.md
Version 0.1 · 2026-10-17 · Status: **PROPOSAL — Hermes environment not yet inspected**

## 0. What is known, and what is not

The directive asks that the Hermes environment be inspected before an implementation is proposed. **Claude has no access to Hermes from this session**, so nothing about its capabilities is assumed. This document defines a **file-based contract** that works with any agent able to read and write files in a Git repository, plus two fallbacks. The final choice is decision **D-004** (Rui).

Questions Rui needs to answer (or let Claude inspect):
1. Where does Hermes run (local machine, a server, a hosted service)?
2. Can it read/write files in a Git repository, or open pull requests on GitHub?
3. Can it fetch web pages / download files itself?
4. Does it run on a schedule, or only when prompted?

## 1. Integration options

| Option | Requires | How it works | Recommended when |
|---|---|---|---|
| **A. Git pull requests** (preferred) | Hermes can commit to a branch / open PRs | Hermes picks a brief from `research/inbox/`, works in `research/in-progress/`, submits a PR moving it to `research/completed/` with findings. CI validates the PR. | Hermes has Git or GitHub access |
| **B. Shared folder** | Hermes can write to a synced folder (e.g. on Rui's computer) | Same folder structure; a small script (run by Rui's machine or Claude via the desktop bridge) commits Hermes' files to the repo. | Hermes is local-only |
| **C. Relay** | Nothing | Rui pastes the brief into Hermes and saves the output file into `research/inbox/`. | Interim, until A or B |

All three use **the same file formats**, so moving from C to A changes nothing in the pipeline.

## 2. Lifecycle of a research assignment

```
research/inbox/R-001.brief.yaml        ← created by Claude (or Rui / ChatGPT via a task)
        │ Hermes claims it (moves file, sets claimed_by + claimed_at)
research/in-progress/R-001.brief.yaml
        │ Hermes delivers
research/completed/R-001/              ← finding.yaml + evidence/ (PDFs, CSVs, page snapshots)
        │ validator + Claude review
        ├── accepted → data promoted to data/validated/ by the pipeline (never by Hermes)
        └── rejected → research/rejected/R-001/ with reasons
```

**Hard rule:** Hermes never writes into `data/validated/` or `data/registry/` directly. It proposes; the validator promotes. CI enforces this — a PR from Hermes touching those paths fails.

## 3. Research brief format (`*.brief.yaml`)

```yaml
id: R-001
title: Identify INE indicator codes for bovine statistics
requested_by: claude            # claude | rui | chatgpt (via task id)
linked_task: T-0012
priority: high                  # high | medium | low
question: >
  Which INE dissemination-database indicator codes contain (a) bovine stock,
  (b) bovine slaughter in heads and tonnes, (c) producer price index for cattle?
deliverable: >
  One entry per indicator: code, official title (pt), unit, geographic level,
  frequency, first/last reference period, metadata URL.
constraints:
  - Official sources only (INE site/API).
  - Do not estimate or fill missing values.
acceptance_criteria:
  - Each code resolves in the INE API metadata endpoint.
  - Every claim has an evidence URL and retrieval date.
due: 2026-10-31
claimed_by: null
claimed_at: null
```

## 4. Finding format (`research/completed/<id>/finding.yaml`)

```yaml
id: R-001
submitted_by: hermes
submitted_at: 2026-10-20T10:00:00Z
summary: Found 3 of 3 requested indicator families.
items:
  - claim: "Indicator 00XXXXX = Efetivo bovino (N.º) by NUTS II, annual"
    type: data_location          # fact | data_location | dataset | definition | change_alert
    value: null                  # numbers only when copied verbatim from the source
    unit: null
    reference_period: null
    sources:
      - url: https://www.ine.pt/...
        title: "..."
        publisher: INE
        retrieved_at: 2026-10-20T09:40:00Z
        evidence_file: evidence/ine_00XXXXX_metadata.json
        quote: "short exact quote supporting the claim (≤ 25 words)"
    confidence: high             # high | medium | low — Hermes' own assessment
missing:
  - "Producer price index for cattle exists only as national total, not by region."
conflicts: []                    # list any disagreement between sources
proposed_changes:                # optional: suggested edits to registry files, as patches
  - file: data/registry/sources.yaml
    note: add indicator codes under S01
```

Placeholders like `00XXXXX` above are illustrative only; real findings must contain real codes or `null`.

## 5. Validation of Hermes' findings

Automatic (CI, on every PR):
- `finding.yaml` validates against `schemas/research_finding.schema.json`.
- Every `item` has ≥1 source with URL + retrieval date; every `evidence_file` exists.
- Numbers present ⇒ `unit` and `reference_period` present.
- PR touches only `research/**`.

Then the item is classified:
- **GREEN** — `data_location`/`dataset` items pointing to class A sources: Claude can wire a collector directly.
- **YELLOW** — any `fact` used on the public site, any class B/D source, any conflict, any restaurant/producer claim → review queue (Claude, escalation to ChatGPT/Rui for interpretation).
- **RED** — missing source, unverifiable, or contradicts a class A source without explanation → `research/rejected/` with reasons.

## 6. Change detection (Hermes' monitoring role)

Hermes may be asked to watch sources that have no API (association sites, ministry pages, news). It reports with `type: change_alert`, including before/after snapshots. A change alert never updates a published figure by itself; it creates a task.

## 7. What Hermes is responsible for vs. the pipeline

| Responsibility | Hermes | Pipeline (GitHub Actions) |
|---|---|---|
| Finding new sources, codes, documents | ✅ | — |
| Reading PDFs/web pages for qualitative facts | ✅ | — |
| Recurring structured downloads (INE, Eurostat…) | — | ✅ (deterministic, unattended) |
| Validation and promotion to published data | — | ✅ |
| Monitoring unstructured sources for changes | ✅ | Source availability pings only |

This split keeps the site working when Hermes is offline (directive §13, §21.7).

## 8. First assignments queued
R-001 … R-008 from DATA_SOURCE_REGISTRY.md §5, written as briefs in `research/inbox/` once D-004 is decided (R-001 and R-007 are already drafted in the repository as examples).
