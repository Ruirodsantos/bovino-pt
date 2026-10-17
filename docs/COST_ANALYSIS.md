# COST_ANALYSIS.md
Version 0.1 · 2026-10-17 · Budget: **€0** · Status: proposal

## 1. Summary
The proposed architecture runs at **€0/month** at MVP scale. The only cost Rui will probably *choose* to incur is a domain name (optional — the site works on a free `*.pages.dev` subdomain). Nothing is purchased or activated without approval.

## 2. Component-by-component

| Component | Service | Cost | Free-tier limits relevant to us | If exceeded / alternative |
|---|---|---|---|---|
| Code & data repository | GitHub | €0 | Large raw files must stay under GitHub's per-file limits → raw snapshots are compressed; big bulk files kept outside git if ever needed | GitLab / Codeberg |
| Scheduled pipeline | GitHub Actions | €0 | **Public repo:** standard runners free. **Private repo:** monthly included minutes on the Free plan (figure to confirm on GitHub's billing page before choosing private). Our estimate: ~10 jobs/week × ~3 min ≈ 130–200 min/month | Make repo public (recommended, ADR-0003) or run collectors on Rui's computer |
| Hosting | Cloudflare Pages (Free) | €0 | 500 builds/month per account, 1 concurrent build, 20-min build timeout, 20,000 files per site, 25 MiB per file | GitHub Pages (also free); Netlify/Vercel free tiers have commercial-use or credit restrictions — not recommended |
| Domain | Registrar of choice | ~€10–25/year (**estimate, not checked**) | — | Free `*.pages.dev` subdomain — **requires Rui's approval to buy** |
| Charts / maps / fonts | ECharts, Leaflet, Fraunces, Public Sans, IBM Plex | €0 | Open-source licences; attribution files | — |
| Basemap tiles | None by default | €0 | Avoids OpenStreetMap tile-policy limits | Self-hosted PMTiles if a basemap is ever needed |
| Geodata | DGT CAOP, Eurostat GISCO | €0 | Attribution | — |
| Statistics | INE, Eurostat, FAOSTAT | €0 | INE: 1M rows per request | — |
| Trade data (global) | UN Comtrade | €0 | Preview without key ≤500 records/call; free registered key for larger queries; paid premium tiers exist | Not needed for PT↔ES (Eurostat Comext covers it) |
| Alerts | GitHub Issues + email notifications | €0 | — | — |
| Analytics | None at launch | €0 | — | Privacy-friendly, cookieless option (e.g. Cloudflare Web Analytics) — needs decision; avoids a cookie banner |
| AI | Claude, Hermes, ChatGPT | €0 marginal | Existing subscriptions; **no API calls at runtime, no per-visitor inference** | — |

## 3. Scale headroom
A static site with a few hundred pages and a few thousand data files fits comfortably inside the free plans above. The binding constraint is builds per month: with daily data checks but builds only when validated data changes, expected builds are ~30–60/month, far below 500.

## 4. Costs that might appear later (all require approval)
- Domain + professional email.
- Licensed photography or commissioned illustration of the 15 breeds (high value for the visual identity).
- Paid data only if a free official source cannot answer a research question (none identified so far).
- Legal review before publishing the Portugal–Spain investigation (recommended for reputational safety, not technically required).
