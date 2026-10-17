# DESIGN_DIRECTION.md
Version 0.1 · 2026-10-17 · Status: **PROPOSAL — first visual exploration pending**

## 1. Positioning
Not a food blog, not an agribusiness portal: **a field atlas with a data desk.** The tone of a serious research institution, the warmth of the landscapes these breeds come from — the lameiros of Barroso, the planalto mirandês, the montado alentejano. Credibility is the aesthetic: every number shows where it came from.

Working names (D-006): *Observatório do Bovino Português* for the observatory module; platform brand to be chosen by Rui. Candidates for discussion: **"Raça & Terra"**, **"Atlas do Bovino"**, **"Bovinae.pt"** (availability not checked; no domain purchased).

## 2. Visual principles
1. **Number first, then context, then source.** Stat cards read top-down: big value → one-line meaning → small footnote (source · period · verified date).
2. **Landscape, not butcher shop.** Imagery of animals in their territory; no raw-meat close-ups as primary imagery. Gastronomy appears in its own section.
3. **Calm density.** Generous whitespace at Level 1, denser tables at Level 3 — the page gets more technical as you scroll or click, never the other way.
4. **Honesty visible.** Missing data has a designed state ("Sem dados oficiais disponíveis — porquê?"), not an empty chart.

## 3. Colour (tokens, light & dark)
Derived from Portuguese rural materials — granite, cork, pasture, schist, clay — not from the national flag and not from meat red.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | #1E1B18 (granite) | #EDE8E1 | Text |
| `--paper` | #F7F4EE (unbleached linen) | #151311 | Background |
| `--surface` | #FFFFFF | #1F1C19 | Cards |
| `--muted` | #6B635A | #A39A8F | Footnotes, axes |
| `--accent` | #8C3B2A (barro / fired clay) | #D9785F | Links, highlights (used sparingly) |
| `--pasture` | #4F6B3A | #9DBA7E | Positive/“origin Portugal” in trade charts |
| `--schist` | #3E5466 | #8FAAC2 | “Spain” / partner series |
| `--cork` | #C8A97E | #B8996E | Map fills, secondary |

Data palette rules: PT vs ES always the same two hues site-wide (pasture vs schist); categorical palettes validated for colour-blind safety; status never conveyed by colour alone (icon + label).

## 4. Typography (open licences, self-hosted — no third-party font requests)
- **Display / big numbers:** *Fraunces* (variable serif, optical sizes) — character for headlines and hero statistics.
- **Text & UI:** *Public Sans* — neutral, highly legible, designed for public-sector information.
- **Data / tables / codes:** *IBM Plex Mono* with tabular figures.
- Number format follows pt-PT: `1 234,5` (thin space for thousands, comma decimal), units always shown (`cabeças`, `t`, `€/kg carcaça`).

## 5. Key components
- **Stat card** — value, unit, one-line explainer, footnote line, status badge (Verificado / Em revisão), "ver dados" link → Level 3.
- **Source footnote** — `Fonte: Eurostat (apro_mt_pheadm) · Referência: ago. 2026 · Publicado: 15 out. 2026 · Verificado: 16 out. 2026`.
- **Breed card** — illustration silhouette (commissioned/own, consistent line style) until licensed photos exist; region mini-map; 3 facts max.
- **Flow chart** — Sankey/arc for PT→ES live cattle by category; toggles head / € / tonnes.
- **Map** — municipality choropleth from official boundaries, no basemap by default; breed "solar" areas shown as hatched regions labelled *área aproximada* (never as precise points).
- **Revision marker** — small ⟲ on any value revised by the source, linking to the revision log.
- **Break-in-series marker** — vertical dashed line with label on charts crossing classification changes.

## 6. Homepage structure (progressive depth)
1. **Hero:** one sentence + one big verified number + map of Portugal with the 15 breed areas fading in.
2. **Portugal em números:** 4–6 stat cards (stock, slaughter, live exports to Spain, beef imports from Spain…) — only those with GREEN data at launch.
3. **Mapa:** breeds ↔ municipalities ↔ DOP areas, filterable.
4. **As 15 raças:** horizontal gallery → directory.
5. **Observatório Portugal–Espanha:** headline flow chart + "ler a investigação".
6. **Últimas alterações verificadas:** auto-generated feed from the pipeline (dataset, period, change).
7. **Investigação em destaque.**
8. **Restaurantes e gastronomia** (appears only when verified entries exist).
9. **Explorar todos os dados** → dataset catalogue.

## 7. Accessibility & performance targets
WCAG 2.2 AA; contrast ≥ 4.5:1 for text; every chart has a text summary and a data table fallback; keyboard-navigable maps; prefers-reduced-motion respected; JS budget < 150 KB on the homepage before interaction; first contentful paint < 1.5 s on mid-range mobile.

## 8. Next design step
Build a single static style-tile page (colours, type, stat card, footnote, badge, one chart, one map) for Rui's reaction before any page template — task T-0110.
