# DATA_SOURCE_REGISTRY.md
Version 0.1 · 2026-10-17 · Status: **initial registry — Phase 0**

Machine-readable twin: `data/registry/sources.yaml` (the YAML is authoritative for the pipeline; this file explains it).

## How to read this registry

**Verification of this document itself.** "Checked 2026-10-17" means Claude confirmed via web search that the source and the stated access method exist. It does **not** mean a collector has run successfully — Claude's workspace cannot reach these hosts (see architecture §3). `last_successful_check` and `last_data_update` stay `null` until a GitHub Actions run fills them.

**Reliability classes**
- **A — Official statistics, structured** (national statistics institutes, Eurostat). Auto-publish eligible (GREEN) after validation.
- **B — Official administrative / market reporting, semi-structured** (ministry PDFs, official catalogues). GREEN after parser tests; first ingestion of each new series is YELLOW.
- **C — Official but derived or secondary** (re-publishers of A/B, e.g. PORDATA). Used for cross-checks, not as primary source.
- **D — Non-official** (associations' websites, press, restaurants). Always YELLOW; requires corroboration.

**Collection vs publication vs reference period** are separate columns on purpose.

---

## 1. Core sources — Phase 1 collectors

### S01 · INE — Instituto Nacional de Estatística (Portugal)
| Field | Value |
|---|---|
| Official URL | https://www.ine.pt — API page: https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_api&INST=322751522 |
| Data categories | Cattle population (efetivo), slaughter, producer price indices, agricultural accounts |
| Access method | Free JSON REST API over the dissemination database; indicators addressed by 7-digit codes; a separate catalogue API returns indicator metadata. Per-request limit of 1,000,000 output rows. No key required. |
| Publication frequency | Varies per indicator (monthly slaughter; periodic livestock surveys; annual accounts) |
| Collection frequency | Weekly metadata check; download only when indicator's update date changes |
| Usage restrictions | Public, free; attribution required (licence terms to be recorded per indicator — Hermes task R-002) |
| Reliability | **A** |
| Collector | `pipeline/collectors/ine.py` (Phase 1) |
| Open item | Exact indicator codes for bovine stock, slaughter (heads/tonnes) and producer prices are **not yet identified** — Hermes task R-001. Codes will not be guessed. |

### S02 · Eurostat — dissemination API
| Field | Value |
|---|---|
| Official URL | https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction |
| Data categories | Livestock, slaughtering, meat production and trade in heads (all EU countries — gives PT and ES on one basis) |
| Access method | SDMX 2.1 and SDMX 3.0 REST APIs (XML, SDMX-CSV) and a JSON "Statistics API"; no key. Base: `https://ec.europa.eu/eurostat/api/dissemination` |
| Relevant datasets | `apro_mt_pheadm` (monthly: meat production and foreign trade in heads, incl. series for total exports of live animals and intra-EU exports); `apro_mt_pann` (annual slaughtering incl. live-animal exports in heads and tonnes); `apro_mt_lscatl` (bovine population) — dataset codes as observed in public mirrors; to be confirmed against the live dataflow list in the first collector run |
| Important caveat | Eurostat holds only the latest version of each dataset; past versions are not kept. **We must store our own raw snapshots** to show revisions. |
| Publication frequency | Monthly / annual per dataset |
| Collection frequency | Weekly |
| Usage restrictions | Eurostat reuse policy (free reuse with attribution) — record exact wording in R-002 |
| Reliability | **A** |

### S03 · Eurostat Comext — international trade in goods by CN8 product
| Field | Value |
|---|---|
| Official URL | Same API family; Comext data uses the `…/api/comext/dissemination` base |
| Why it matters | The only consistent, official, product-level source for **PT→ES live cattle by category** and **PT↔ES beef trade** in value (€) and quantity. Reporter-partner pairs give both "PT exports to ES" and the mirror "ES imports from PT" (mirror discrepancies are themselves a validation check). |
| Products | CN 0102 (live bovine; breeding vs other domestic by weight band; definitions changed 2012), CN 0201 (beef fresh/chilled), CN 0202 (beef frozen) |
| Publication frequency | Monthly (reference month lags publication) |
| Collection frequency | Weekly |
| Reliability | **A** |

### S04 · GPP / SIMA — Sistema de Informação de Mercados Agrícolas
| Field | Value |
|---|---|
| Official URL | GPP: https://www.gpp.pt (exact SIMA bulletin page URL to be confirmed by Hermes, R-003) |
| Data categories | Weekly cattle price quotations (€/kg carcass, €/head) by product (novilho/novilha 12–24 m, cruzado Charolês and Turina, vitelos, vacas), by region and market area, plus Bolsa de Bovino do Montijo sessions and INE price indices |
| Access method | **Weekly PDF newsletter ("Newsletter – Bovinos")** — no API found yet. Latest observed: week 40, 28 Sep–4 Oct 2026. Requires a PDF parser with fixture tests; layout changes break parsing → automatic YELLOW. |
| Publication frequency | Weekly |
| Collection frequency | Weekly (+1 day after expected publication) |
| Usage restrictions | **Unknown — must be confirmed before publishing values** (R-002). Until then: store and analyse internally, publish only with explicit attribution after licence check. |
| Reliability | **B** |

### S05 · MAPA — Ministerio de Agricultura, Pesca y Alimentación (Spain)
| Field | Value |
|---|---|
| Official URL | https://www.mapa.gob.es |
| Data categories | Spanish national average weekly prices (vacuno pesado live and carcass, Category A class R, etc.) — the Spanish counterpart for price comparison (research Q8) |
| Access method | Weekly "Informe Semanal de Coyuntura" / precios medios nacionales; format and possible open-data (CSV) endpoint to be confirmed (R-004) |
| Usage restrictions | ⚠️ **Conflicting signals found**: older bulletins (2005) state that reproduction is prohibited; later bulletins (2009–2010) allow reuse with citation. Current terms must be confirmed before any publication. Status YELLOW. |
| Reliability | **B** |

### S06 · Price comparability — European Commission market observatory
Weekly carcass prices for all member states on a harmonised grid (SEUROP classification) make PT–ES comparison methodologically cleaner than mixing GPP and MAPA bulletins. The Commission's agri-food data portal is the candidate; endpoint, format and terms **not yet verified** (R-005). Until verified, no price comparison is published.

---

## 2. Reference & registry sources

### S07 · DGAV — Direção-Geral de Alimentação e Veterinária / Catálogo Oficial de Raças Autóctones Portuguesas (with CAP)
- **Content**: official catalogue of 61 native breeds, of which **15 bovine**. Gives location, number of animals and breeders, history, aptitude, breed standard and production system per breed.
- **Access**: PDF/e-book (an archived copy of the DGAV PDF is available). Manual extraction by Hermes → breed YAML files → YELLOW until each field is checked against the page.
- **Frequency**: irregular (catalogue editions); census figures in it have a reference year that must be recorded.
- **Reliability**: **B**

### S08 · DGADR + EU eAmbrosia — certified products (DOP/IGP)
- **Content**: specifications ("cadernos de especificações") and geographic areas of protected beef names; eAmbrosia is the EU's official register.
- **Use**: certification entity, breed↔certification links, municipality lists for the map.
- **Reliability**: **A** (eAmbrosia) / **B** (DGADR pages).

### S09 · Breed associations (one per breed — 15 entries to be created)
- Herd-book holders and certification/management groups. Used for history, standards, contacts (contact **only** with Rui's approval).
- **Reliability**: **D** for claims, **B** where they publish official herd-book statistics.

### S10 · INIAV / Banco Português de Germoplasma Animal
- Conservation context for native breeds. **Reliability B**. Low priority.

---

## 3. Secondary & international sources

| ID | Source | Access | Use | Class |
|---|---|---|---|---|
| S11 | **FAOSTAT** (FAO) | Developer API portal + bulk downloads | Long historical series (1961→) of stocks, production, trade; World Beef Atlas (Phase 5) | A |
| S12 | **UN Comtrade** | Free preview endpoint without key (up to 500 records/call); free registered key gives larger queries; premium tiers exist | Extra-EU destinations and global comparison only — Eurostat Comext is primary for PT↔ES | A |
| S13 | **INE España** | Website / API (to verify, R-006) | Spanish livestock context | A |
| S14 | **Spanish foreign-trade statistics (DataComex)** | Web query tool (to verify, R-006) | Cross-check of ES imports from PT | A |
| S15 | **PORDATA** | Website | Re-publishes INE; cross-checks only | C |
| S16 | **DGT — CAOP** (official administrative boundaries) and **Eurostat GISCO** (NUTS) | Downloadable geodata | Maps (municipality / NUTS) | A |
| S17 | Agroportal and similar | News | Daily news monitoring; never a statistical source | D |

---

## 4. Official list of Portuguese bovine breeds (for breed registry)

The DGAV/CAP catalogue counts **15 native bovine breeds**. A published listing names them as:

Alentejana · Algarvia · Arouquesa · Barrosã · Brava de Lide · Cachena · Garvonesa · Jarmelista · Marinhoa · Maronesa · Mertolenga · Minhota · Mirandesa · Preta · Ramo Grande

The directive's initial list covers 10 of these; the five not yet mentioned are **Algarvia, Brava de Lide, Jarmelista, Preta and Ramo Grande**. The count (15) comes from the DGAV/CAP joint note; the names come from a secondary article. Status: **YELLOW** until Hermes confirms each name against the catalogue itself (R-007).

**Protected beef names found so far (to verify in eAmbrosia, R-008):** Carnalentejana, Carne Arouquesa, Carne Barrosã, Carne Cachena da Peneda, Carne da Charneca, Carne Marinhoa, Carne Maronesa, Carne Mertolenga, Carne Mirandesa (all DOP); Vitela de Lafões, Carne de Bovino Cruzado dos Lameiros do Barroso, Carne dos Açores (IGP); Carne Jarmelista (type to confirm). These come from academic sources from 2007–2011 and a promotion portal, so current registration status is unverified.

---

## 5. Research tasks generated by this registry (queued for Hermes)

| ID | Task |
|---|---|
| R-001 | Identify INE indicator codes for bovine stock, slaughter and producer prices; record update cadence |
| R-002 | Record licence/reuse terms for INE, Eurostat, GPP/SIMA, MAPA, FAOSTAT (exact wording + URL + date) |
| R-003 | Find the canonical GPP/SIMA bulletin URL and archive of past issues; any CSV/Excel alternative |
| R-004 | MAPA: current price bulletin format, open-data endpoint, current reuse terms |
| R-005 | European Commission beef price data: endpoint, format, terms, PT/ES coverage |
| R-006 | INE España and DataComex access methods |
| R-007 | Confirm the 15 bovine breed names, official spellings, herd-book associations |
| R-008 | Confirm current DOP/IGP beef registrations in eAmbrosia |

---

## Sources consulted for this document
- [INE — API (Base de Dados de Difusão)](https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_cont_inst&INST=322751522)
- [ineptr2 R package manual (INE API limits)](https://cran.r-project.org/web/packages/ineptr2/refman/ineptr2.html)
- [Eurostat — API introduction](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction)
- [Eurostat — SDMX 2.1 data query](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-detailed-guidelines/sdmx2-1/data-query)
- [DBnomics mirror of apro_mt_pheadm](https://db.nomics.world/Eurostat/apro_mt_pheadm) · [apro_mt_pann](https://db.nomics.world/Eurostat/apro_mt_pann?offset=20)
- [CN 0102 subheadings (Comext table view mirror)](https://now.allthatstats.com/sources/eutrade/122)
- [GPP/SIMA Newsletter Bovinos, week 40/2026 (via Agroportal)](https://www.agroportal.pt/wp-content/uploads/2026/10/bovinos_News40.pdf)
- [MAPA Informe Semanal de Coyuntura, July 2005](https://mapa.gob.es/ministerio/pags/Biblioteca/Revistas/pdf%5FISC%2FISC%5F2005%5F2%AAJulio%2Epdf) · [March 2010](https://mapa.gob.es/ministerio/pags/Biblioteca/Revistas/pdf%5FISC%2FISC%5F2010%5F5%AAMarzo%2Epdf)
- [Agroportal — 61 native breeds, 15 bovine (DGAV/CAP)](https://www.agroportal.pt/portugal-tem-61-racas-autoctones-e-ovinos-serra-da-estrela-estao-em-maior-numero/) · [Catalogue e-book](https://www.agroportal.pt/catalogo-das-racas-autoctones-disponivel-em-e-book) · [List of bovine breeds](https://bo.agroportal.pt/?p=755967)
- [IPB thesis on Carne Mirandesa DOP (list of beef DOP/IGP)](https://bibliotecadigital.ipb.pt/bitstreams/e695be85-2617-49b5-ac13-7916182c9eb7/download) · [EAAP 2011, Costa et al.](https://docs.eaap.org/2011/S53_Costa.pdf)
- [UN Comtrade rate-limit summary](https://raw.githubusercontent.com/api-evangelist/un-comtrade/refs/heads/main/rate-limits/rate-limits.yml) · [comtradr docs](https://ropensci.r-universe.dev/comtradr/doc/comtradr.Rmd)
- [FAO — FAOSTAT API developer portal announcement](https://www.fao.org/statistics/highlights-archive/highlights-detail/faostat-launches-a-new-api-developer-portal-to-make-data-access-easier/en)
