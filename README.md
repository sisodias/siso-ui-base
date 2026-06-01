# SISO UI Base

Drop-in, **agent-neutral** package (Claude *or* Codex) that turns a coding-agent fleet into an elite human-in-the-loop UI builder. Agents build UI as self-contained HTML → human reviews + reacts in voice/chat → agents iterate → winners graduate to React components. Taste-grader, libraries, and domain frameworks ship inside.

**Read `CANONICAL.html` first** — it's the single source of truth (what it is, the home, the harvest manifest, what's left to build).

## Status
v1 in build. Proven so far: the **visual judge** (`pipeline/`) scores cockpit panels 0-10 against the Oracle taste DNA — calibrated, chat-rail anchor = 9.24, discriminates worse panels down to 4.9.

## Layout
- `CANONICAL.html` — source of truth + harvest manifest
- `framework/` — the loop, primitives, contracts (universal core)
- `batteries/` — judge / gates / libraries / frameworks (hot-swappable)
- `app/` — the React viewer (in build)
- `commands/` — /forge-variations /show-me /iterate /graduate ...
- `tenants/oracle/` — tenant zero (the DNA)
- `pipeline/` — the working visual-judge MVP (rubric/shoot/judge)
- `registry/` — 25-repo prior-art catalog (`./clone.sh` to vendor)

## Home
Own repo at `~/SISO_Workspace/siso-ui-base/`. Migrates onto `SISO_Agent_Base`'s skill-shelf (fanning out to `.claude`/`.codex`) once that repo's reramp settles.
