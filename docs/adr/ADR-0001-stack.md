# ADR-0001 — Core stack
Status: PROPOSED (awaiting Rui) · 2026-10-17

Decision: Astro (static site) + Python pipeline + CSV/JSON canonical data + SQLite build artefact,
scheduled by GitHub Actions, hosted as static files.

Context: €0 budget, must run without AI sessions, every statistic traceable, expandable to other
species/countries/languages.

Alternatives rejected: Next.js (server-oriented, heavier JS); hosted database such as Postgres
(recurring cost/complexity, not needed for read-only public data); scraping-first collection
(fragile, licence risk — official APIs first).

Consequences: no server-side features (search via static index; forms via third-party only if
approved). Data history kept by us, because Eurostat does not version past data.
