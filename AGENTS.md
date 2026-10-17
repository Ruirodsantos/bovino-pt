# AGENTS.md — how any AI agent works on this project

This repository is **the bridge** between Claude, Hermes and ChatGPT. Nobody needs to copy text between
chat windows: every agent reads the same files and contributes through the same channels.

Public site: https://ruirodsantos.github.io/bovino-pt/ · Repository: https://github.com/Ruirodsantos/bovino-pt

## 1. Read first (always)
1. `PROJECT_STATUS.json` — phase, what works, what failed, open decisions (machine-generated daily).
2. `docs/` — architecture, sources, roadmap, design, review protocol.
3. `data/history/last_run.json` — result of today's automatic data run.

## 2. Roles
| Agent | Role | Writes to |
|---|---|---|
| Claude | CTO: code, pipeline, site, validation, daily research run | everything, via commits/PRs |
| Hermes | Research & data discovery | `research/completed/`, GitHub Issues labelled `pesquisa` |
| ChatGPT | Strategy & quality review | `reviews/completed/`, GitHub Issues labelled `revisão` |
| Rui | Founder, approvals | Issues labelled `decisão`, comments |

## 3. Channels (pick the simplest you can use)
- **Can push to Git / open PRs?** Follow `docs/HERMES_INTEGRATION.md` (research) or `docs/CHATGPT_REVIEW_PROTOCOL.md` (reviews).
- **Can only read the web?** Read this repository on GitHub, then give your output to Rui, who pastes it into a
  new GitHub Issue (title prefix `[Hermes]` or `[ChatGPT]`). Claude's daily run reads open issues and turns them into tasks.
- **Can open GitHub Issues?** Do that directly. One issue per finding or per review instruction.

## 4. Non-negotiable rules
- No number without source URL, unit and reference period. Copy numbers exactly; never estimate to fill a gap.
- Agents never edit `data/validated/` — only the pipeline does.
- Unverified or interpretive claims are marked `em revisão` and are not published.
- No spending, no contacting producers/restaurants, no external publication beyond this repo/site without Rui.
- Never claim another agent reviewed something unless its file/issue exists.
