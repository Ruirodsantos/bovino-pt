# PROJECT_ARCHITECTURE.md
Portuguese Beef Intelligence Platform — Technical Architecture
Version 0.1 · 2026-10-17 · Author: Claude (CTO) · Status: **PROPOSAL — awaiting Rui's approval**

---

## 1. Design principles (derived from the directive)

| Principle | Concrete consequence |
|---|---|
| Static-first, €0 | The public site is pre-built HTML/JSON. No server, no database at request time, no per-visitor cost. |
| Works when the AIs are offline | Collection runs on scheduled CI jobs (GitHub Actions), not inside Claude/Hermes/ChatGPT sessions. Agents improve the system; they are not the system. |
| Traceability over volume | Every number on the site is a row with source, unit, reference period, publication date, verification date and status. No row → no chart. |
| Git is the audit log | Raw downloads, validated datasets, registry files, tasks and reviews are all versioned files. Every change has a commit, an author and a diff. |
| Boring, portable technology | CSV + JSON + YAML as canonical formats; SQLite/DuckDB generated at build time; nothing proprietary that would lock the data in. |
| Expand without rebuilding | `species`, `country`, `language` are dimensions in the data model from day one, even though only `bovine`, `PT/ES`, `pt-PT` are populated. |

---

## 2. System overview

```
             ┌──────────────── RESEARCH LAYER (agents, intermittent) ─────────────────┐
             │  Hermes: research briefs → findings (files)                             │
             │  ChatGPT: reviews → instructions (files)                                │
             │  Claude: code, validation rules, task queue                             │
             └───────────────┬─────────────────────────────────────────────────────────┘
                             │ pull requests / files in /research and /reviews
                             ▼
┌──────────────────────── DATA LAYER (GitHub Actions, scheduled, unattended) ───────────────────────┐
│ SOURCE REGISTRY ─► COLLECT ─► RAW (immutable, hashed) ─► VALIDATE ─► NORMALIZE ─► VALIDATED STORE │
│  sources.yaml      collectors/   data/raw/<src>/<date>/    rules       mappings    data/validated/ │
│                                                 │                                                  │
│                                                 └─► status: GREEN → publish queue                  │
│                                                             YELLOW → review issue                  │
│                                                             RED → rejected log                     │
└─────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                              ▼
┌──────────────────────── PRESENTATION LAYER (static build) ────────────────────────┐
│ Astro build ─► HTML pages + per-dataset JSON + downloadable CSV ─► Cloudflare Pages │
│ ECharts (charts) · Leaflet + local GeoJSON (maps) · pt-PT default, en/es ready      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology choices

| Layer | Choice | Why this, not the alternative |
|---|---|---|
| Frontend framework | **Astro** | Ships zero JS by default and hydrates only interactive "islands" (charts, maps). Built-in i18n routing. Content collections fit breed profiles. Next.js is heavier and pushes toward server rendering we don't need. |
| Charts | **Apache ECharts** (tree-shaken, loaded per island) | Strong time series, maps, Sankey (for trade flows), accessible aria descriptions, Apache-2.0. |
| Maps | **Leaflet** + **self-hosted GeoJSON** (CAOP municipalities from DGT; NUTS from Eurostat GISCO) | Choropleths and breed regions don't need a basemap. Avoids depending on OpenStreetMap's volunteer tile servers, whose usage policy discourages heavy production use. A basemap can be added later via self-hosted PMTiles if needed. |
| Pipeline language | **Python 3.12** | Best ecosystem for SDMX/CSV/PDF parsing (pandas, pdfplumber, requests). |
| Validation | **JSON Schema** (structure) + Python rule functions (consistency/plausibility) + **pytest** | Schemas are language-neutral, so Hermes and the site can reuse them. |
| Canonical data | **CSV (tidy, one observation per row) + `.meta.json` sidecar** | Diffable in git, readable by humans, ChatGPT and Hermes. |
| Query/build store | **SQLite** generated in CI from the CSVs (`data/build/bovino.sqlite`), optional DuckDB for analysis | Portable single file; also offered as a download for Level 3 users. Never the source of truth. |
| Scheduling | **GitHub Actions** cron workflows | Free for public repositories on standard runners; private repos have a monthly minutes quota (see COST_ANALYSIS). |
| Hosting | **Cloudflare Pages** (free plan) — alternative GitHub Pages | Free plan allows 500 builds/month, 20,000 files and 25 MiB per file — ample for a static data site. |
| Alerts | GitHub Issues opened automatically by failing workflows (+ GitHub's own email notifications) | €0, observable, threaded, linkable from WEEKLY_REVIEW. |

**Environment finding (Phase 0, item 1):** Claude's cloud workspace has an outbound allowlist — package registries work, but `ine.pt` and `ec.europa.eu` are unreachable from it. This confirms the design: **collectors must run in GitHub Actions** (or on Rui's machine), never inside a Claude session. Claude writes and tests collectors against recorded fixture files.

---

## 4. Repository layout (monorepo)

```
bovino-pt/
├── apps/web/                    Astro site (pt-PT default; /en/, /es/ prepared)
├── pipeline/
│   ├── collectors/              one module per source (ine.py, eurostat.py, sima.py …)
│   ├── normalizers/             code lists: CN8 products, NUTS/CAOP geo, units, breeds
│   ├── validators/              schema + rule checks; assigns GREEN/YELLOW/RED
│   └── tests/                   pytest, fixture files recorded from real responses
├── data/
│   ├── registry/
│   │   ├── sources.yaml         SOURCE REGISTRY (machine form of DATA_SOURCE_REGISTRY.md)
│   │   ├── datasets.yaml        dataset definitions (source, query, unit, frequency, owner)
│   │   ├── breeds/<slug>.yaml   one structured profile per breed
│   │   └── codelists/           CN8 bovine codes, geo codes, units
│   ├── raw/<source>/<YYYY-MM-DD>/   untouched downloads + manifest.json (URL, sha256, retrieved_at)
│   ├── validated/<dataset>.csv  + <dataset>.meta.json
│   ├── history/                 revision log (old value → new value, when, why)
│   └── build/                   generated (sqlite, site JSON) — not committed
├── research/{inbox,in-progress,completed,rejected}/   Hermes interface
├── reviews/{pending,completed,instructions,decisions}/ ChatGPT interface
├── pm/tasks.json                task queue (lifecycle IDEA→COMPLETE)
├── schemas/                     JSON Schemas shared by pipeline, site, agents
├── docs/                        these documents + docs/adr/ (decision records)
├── PROJECT_STATUS.json          generated status (machine-readable)
└── WEEKLY_REVIEW.md             generated weekly report
```

---

## 5. Data model

### 5.1 Observation (the atomic unit — every chart is built from these)

| Field | Example | Notes |
|---|---|---|
| `dataset_id` | `trade_live_bovine_pt_es` | Points to datasets.yaml |
| `species` | `bovine` | Future: other species without schema change |
| `geo` / `partner_geo` | `PT` / `ES` | ISO 3166 / NUTS / CAOP codes |
| `flow` | `export` | export · import · production · stock · price |
| `product_code` | `01029020` | CN8 where applicable (see §5.3) |
| `period` / `period_type` | `2026-08` / `month` | **Reference period** — what the number describes |
| `value` / `unit` / `unit_multiplier` | `1234` / `head` / `1` | Controlled unit vocabulary |
| `source_id` / `source_url` | `eurostat_comext` / … | Points to sources.yaml |
| `publication_date` | `2026-10-15` | When the source published it (null if unknown) |
| `retrieved_at` | `2026-10-16T03:00Z` | When we collected it |
| `verified_at` | `2026-10-16T03:02Z` | When validation last passed |
| `status` | `green` | green · yellow · red |
| `status_reason` | `revision>10% vs previous` | Mandatory for yellow/red |
| `revision_of` | hash of prior value | Eurostat overwrites data in place, so we keep our own history |

The three dates (reference / publication / retrieval) are separate fields by construction, so "August data published in October" can never be labelled October.

### 5.2 Entities
- **Breed** (`data/registry/breeds/*.yaml`): fields required by directive §4; every field is `{value, source_id, verified_at}` or explicitly `null` with `missing_reason`. Rendered as "Informação não disponível" — never filled in.
- **Certification** (DOP/IGP): name, type, registry ID in eAmbrosia, linked breeds, geographic area (municipality codes), certifying body.
- **Organization** (breed associations, certifiers, producer groups): public information only.
- **Restaurant** (Phase 4): `claim_type` ∈ {restaurant_claim, documentary_evidence, supplier_confirmed}, evidence URL + archive snapshot, `observed_at`, `expires_at` (claims decay; an old menu is not current evidence).
- **Producer** (Phase 4): location stored at **municipality precision** unless the producer publicly lists an address and consents; precision field (`municipality|parish|exact`) is mandatory.

### 5.3 Codes that matter for the Portugal–Spain observatory
Live cattle (CN 0102) and beef (CN 0201 fresh/chilled, 0202 frozen) are separate product families and are never summed. Within CN 0102 the Combined Nomenclature separates pure-bred breeding animals (01029020) from other domestic cattle by weight bands (e.g. 01022910 ≤80 kg … 01022999 >300 kg), and code definitions changed in 2012 — the normalizer maps old/new codes explicitly and the site shows a break-in-series marker. Animal-origin labelling for beef (born / reared / slaughtered) is a separate research topic, not inferred from trade codes.

---

## 6. Pipeline: collection → publication

1. **Schedule** (GitHub Actions cron, per source cadence in sources.yaml).
2. **Check**: HEAD/metadata request; if the source's own "last updated" hasn't changed, stop (saves minutes, respects rate limits).
3. **Collect**: download to `data/raw/<source>/<date>/` with `manifest.json` (URL, params, HTTP status, sha256, robots/terms check reference).
4. **Validate**:
   - *Schema*: types, required fields, unit and code in controlled lists.
   - *Consistency*: e.g. intra-EU + extra-EU = total where both exist; monthly sums vs annual within tolerance.
   - *Plausibility*: change vs previous period beyond a dataset-specific threshold → YELLOW.
   - *Revision*: same reference period, different value vs our history → log; large revisions → YELLOW.
   - *Freshness*: no new publication past expected date → stale flag (not an error).
5. **Normalize** to the observation schema; write `data/validated/*.csv` + meta.
6. **Gate**: GREEN rows go into the build; YELLOW opens/updates a GitHub Issue labelled `review-queue`; RED is logged in `data/history/rejected.log` and never built.
7. **Commit** via a bot pull request (auto-merged only if every row is GREEN and tests pass).
8. **Build & deploy** the site; regenerate PROJECT_STATUS.json.

Agents (Hermes) **never write to `data/validated/`**. They submit to `research/inbox/`; only the validator promotes data.

---

## 7. Presentation architecture (progressive depth)

| Level | Implementation |
|---|---|
| 1 Discover | Pre-rendered stat cards and static SVG sparklines — readable with JS disabled; each card carries source + period in a footnote line. |
| 2 Explore | ECharts/Leaflet islands loaded on scroll (`client:visible`). |
| 3 Investigate | Per-dataset page: table, methodology, source links, CSV/JSON/SQLite download, revision log. |
| 4 Advanced | Reserved routes (`/pro/`); not built. Data API = the same static JSON files, so a future paid tier needs no rebuild. |

URL scheme: `/pt/racas/mirandesa/`, `/pt/observatorio/comercio-portugal-espanha/`, `/pt/dados/<dataset-id>/`; `en` and `es` mirrors added only when content exists (no machine-translated stub pages). `hreflang`, canonical URLs, sitemap and Schema.org `Dataset` markup generated at build.

---

## 8. Security & control
- No credentials in the repo. Free API keys (e.g. UN Comtrade, if adopted) live in GitHub Actions encrypted secrets.
- Branch protection on `main`; agents and bots work via pull requests.
- Actions that require Rui's approval (directive §17) are enforced by process: they need a `decision` file in `reviews/decisions/` signed off by Rui before a task can move to READY.
- Collectors identify themselves with a descriptive User-Agent and contact address, honour robots.txt, and throttle.

---

## 9. Architectural decisions requiring approval
Recorded as ADRs in `docs/adr/`. Open: ADR-0001 stack (Astro/Python/CSV), ADR-0002 hosting (Cloudflare Pages vs GitHub Pages), ADR-0003 public vs private repository, ADR-0004 data licence (proposal: code MIT, our derived data CC BY 4.0, third-party data under source terms).

## 10. Technical risks
See DEVELOPMENT_ROADMAP.md §6.
