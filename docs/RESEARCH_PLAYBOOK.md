# RESEARCH_PLAYBOOK.md — the daily research run

Run by a scheduled Claude task every day (and usable by Hermes). Goal: **one new, verified, interesting
piece of knowledge per day**, published only if it meets the bar below.

## Order of work (stop after one solid item, two at most)
1. **Inbox first.** Open GitHub Issues labelled `pesquisa` or `revisão`, then `research/inbox/*.brief.yaml`.
   Turn each into a task in `pm/tasks.json`; resolve one if it is small.
2. **What changed in the data?** Compare `data/validated/*.csv` with the previous commit. A new month or
   year, a record, or a notable change → a data discovery (numbers come only from validated CSVs).
3. **Breed profiles.** Pick the breed with the fewest verified fields (`data/registry/breeds/`).
   Preferred sources: DGAV breed leaflets ("Folheto DGAV Raça …"), DGAV/CAP catalogue, herd-book
   association sites, eAmbrosia/DGADR (DOP/IGP specifications), INIAV. Fill 1–4 fields.
4. **Photos (high priority while any breed lacks one).** Breeds without a photo: see `photo:` missing in
   `data/registry/breeds/`. Search Pexels, Unsplash and Flickr (CC BY / BY-SA / CC0 only; never Wikimedia).
   Label a photo with a breed ONLY if the author's title/description names the breed; otherwise caption the
   place. Add candidates to `assets/candidates.yaml`, review the thumbnails in `research/image-candidates/`,
   then publish via `assets/images.yaml` and set `photo` + `photo_kind` (raça | solar | paisagem).
5. **Observatory questions** (`apps/web/src/pages/observatorio/index.astro` list) — move one forward.

## Publication bar
| Kind | Published automatically (`status: verificado`) when… | Otherwise |
|---|---|---|
| Data discovery | every number is read from `data/validated/` (GREEN) and the text states the reference period | — |
| Fact from a document | source is official (Eurostat, INE, DGAV, DGADR, GPP, EU bodies, Diário da República, herd-book association for its own breed) and the claim is supported by a short exact quote you saw | `status: em revisão` → open a PR instead of pushing to main |
| Interpretation / causes / opinions | never automatic | PR for Rui/ChatGPT review |

Never present correlation as causation. Never invent supplier, producer or restaurant information.

## How to write
- Discovery file: `content/descobertas/YYYY-MM-DD-slug.md` (see existing files for front matter).
  pt-PT, short title with the finding, 2–4 short paragraphs, "what this shows / what it doesn't".
- Breed field: set `value` (pt-PT, 1–3 sentences), `source_id`, `source_url`, `verified_at` (today),
  remove `missing_reason`. Numbers keep their unit and reference year inside the text.
- Run `python pipeline/validate_registry.py && python -m pytest -q pipeline/tests` before committing.
- Commit message: `pesquisa: <assunto>`; push to `main` only for items meeting the bar, else a branch + PR.
- If nothing meets the bar today, publish nothing and record what was tried in the PR/issue — an
  honest empty day beats a weak discovery.

## Prioridades do fundador (2026-10-17, segunda ronda)

1. **Texto original, não resumos de fontes.** Cada raça e cada tema da carne deve ter texto próprio, escrito em pt-PT, com fonte no fim. Resumos de uma linha com link não chegam. Ver content/racas/ e content/carne/.
2. **Fotografia da raça** (não paisagem) em cada raça. Issue #6.
3. **Secção A Carne** ao nível de um restaurante de topo (referência: El Capricho): crua, maturação, cortes, cozedura, serviço. Estender com novos artigos (ex.: carne de cada raça, DOP/IGP, maturação em Portugal, conservação e congelação, harmonização). Issues #7, #8, #10.
4. **Ponte entre agentes:** Hermes pesquisa (issues `pesquisa`), ChatGPT revê (issues `revisão`, ficheiro em reviews/), Rui decide (`decisão`). Claude integra, valida e publica.
5. Nunca afirmar valor técnico sem fonte: se não foi lido, marcar «a confirmar».
