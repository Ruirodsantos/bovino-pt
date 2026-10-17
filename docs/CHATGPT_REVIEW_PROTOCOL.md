# CHATGPT_REVIEW_PROTOCOL.md
Version 0.1 · 2026-10-17 · Status: **PROPOSAL**

## 1. Purpose
Let ChatGPT (Strategy & Quality Director) review the project from the repository's own evidence — without Rui having to explain context each time — and turn its instructions into traceable tasks. Strategic changes still require Rui's approval.

## 2. Ground rules
1. **A review exists only if its file exists** in `reviews/completed/`. No report, status file or commit message may say "ChatGPT reviewed X" otherwise.
2. ChatGPT reviews **evidence, not claims**: live URLs, datasets, test results, screenshots — the review packet links to them.
3. Instructions are proposals until triaged. Claude may implement *tactical* instructions (bugs, copy, UX, data quality) directly; *strategic* ones (scope, brand, monetisation, sources policy, spending) go to Rui.
4. Disagreement is recorded, not hidden: if Claude declines or modifies an instruction, the reason goes in the task.

## 3. Access method (decision D-005)
| Option | How ChatGPT reads the project | Notes |
|---|---|---|
| **A. Repository access** | ChatGPT reads the GitHub repository directly (if Rui's ChatGPT plan offers a GitHub connection) | Least manual work; repo must be reachable by that connection |
| **B. Review packet upload** (default) | Claude generates one self-contained `REVIEW_PACKET.md`; Rui uploads/pastes it into ChatGPT together with `reviews/instructions/REVIEW_PROMPT.md`, and saves the answer as a file | Works with any plan; ~2 minutes of Rui's time per review |
| **C. Public site + packet** | Once deployed, the packet links to live pages | Combine with A or B |

Option B is assumed until Rui confirms otherwise.

## 4. Flow

```
Claude ── generates ──► reviews/pending/RV-2026-W43/REVIEW_PACKET.md
                          (scope, questions, evidence links, PROJECT_STATUS.json excerpt)
Rui ──── delivers packet to ChatGPT (A: automatic / B: upload)
ChatGPT ─ answers in the required format (§6)
Rui ──── saves answer as reviews/completed/RV-2026-W43.review.md   (or ChatGPT commits it, option A)
Claude ── triages each instruction ──► pm/tasks.json  (source: RV-2026-W43#I-3)
           strategic items ───────────► reviews/decisions/D-0xx.md  (await Rui)
Next packet reports what happened to every previous instruction.
```

## 5. Cadence and triggers
- **Weekly** light review (bundled with WEEKLY_REVIEW.md).
- **Gate reviews** at the end of each roadmap phase (mandatory before the next phase starts).
- **Ad hoc**: before publishing the first Observatory investigation; any methodology change; any yellow item older than 14 days.

## 6. Required answer format (given to ChatGPT in REVIEW_PROMPT.md)

```markdown
---
review_id: RV-2026-W43
reviewer: chatgpt
review_date: YYYY-MM-DD
scope: [methodology, ux, data-quality, strategy]
evidence_examined: [list of URLs/files actually opened]
---
## Verdict
pass | pass-with-changes | fail — one paragraph.

## Instructions
| id | type | priority | instruction | rationale | acceptance criterion |
|----|------|----------|-------------|-----------|----------------------|
| I-1 | tactical | high | ... | ... | ... |
| I-2 | strategic | medium | ... | ... | ... |

## Questions for Rui
- ...
```

`type` ∈ {tactical, strategic}. `evidence_examined` must list what was actually opened — it is the honesty check for the review itself.

## 7. Turning instructions into tasks
Each instruction becomes one entry in `pm/tasks.json`:
```json
{ "id": "T-0031", "title": "...", "source": "RV-2026-W43#I-1",
  "agent": "claude", "priority": "high", "status": "READY",
  "acceptance_criteria": ["copied from the instruction"],
  "evidence": [], "review_result": null }
```
Strategic instructions get `status: "IDEA"` and a linked decision file `reviews/decisions/D-0xx.md` with options, recommendation and an empty `approved_by:` field that only Rui fills in.

## 8. Closing the loop
Every review packet contains a table: previous instruction → task → status → evidence link (or reason it was declined). An instruction is closed only when its task reaches COMPLETE with inspectable evidence, or when Rui records a decision to drop it.
