---
name: ui-base
description: Build UI with an agent fleet + a human in the loop. Agents forge self-contained HTML variations into a tenant folder; a human reviews them in the UI Box (a live local viewer) and reacts in plain words; agents iterate; winners graduate to production React. Use whenever building or refining a UI component/page with variation+review, or when the user says "show me variations", "build me N options", "open the UI box", "score/bless this design".
---

# SISO UI Base

The drop-in, **agent-neutral** (Claude or Codex) loop for human-in-the-loop UI building.

**The loop:** forge → show → react → iterate → graduate.
The human stays on **taste**; the agent does **production**. HTML is the agent's clay (fast, isolated, no build); React is where blessed designs land.

## How the pieces fit (read this once)

Five layers, each answering a different question, joined by the loop:

```
  registry/21st       WHAT EXISTS      7,949 components + previews
  registry/principles WHY IT WORKS     334 sections — universal rules
  registry/skills     WHERE TO START   49 palettes (only when there is no DNA)
  tenants/<x>/dna.md  WHAT IS RIGHT    this project's taste — THE AUTHORITY
  ─────────────────────────────────────────────────────────────────────
  brief.mjs           assembles all four into one brief
  /forge-variations   builds from that brief
  gates + judge       check the result against DNA *and* principles
  human               blesses; /graduate ports it to React
```

**Precedence, everywhere:** the DNA wins. Principles decide only what the DNA
leaves unsaid. Palettes are a starting point for a project that has no DNA yet,
never an override for one that does. If a principle and the DNA disagree, say so
— do not silently follow either.

The full loop, in commands:

```bash
node brief.mjs "pricing section"                    # 1. gather context
/forge-variations pricing-section 4                 # 2. build from it
node batteries/gates/dna-grep.mjs <files>           # 3a. tenant taste
node batteries/gates/principles-grep.mjs <files>    # 3b. universal rules
/score-panel pricing-section                        # 4. vision judge ranks
/show-me                                            # 5. human reacts/blesses
/graduate                                           # 6. blessed HTML -> React
```

## Check it works first

```bash
node doctor.mjs
```

Reports every layer, what data is present, and what is degraded — with the
command to fix each. Exit 1 if something required is broken.

Known degradation: **`/score-panel` needs Playwright** (`npm install`). Without
it the brief -> forge -> gate path still works; only the visual judge is
unavailable.

## Start here: one command

```bash
node brief.mjs "pricing section"          # everything you need, assembled
node brief.mjs hero --tenant oracle --json
```

This is the front door. It joins all four layers in the order the principles
mandate and hands back one brief:

| | |
|---|---|
| **AUTHORITY** | the tenant `dna.md` — everything else defers to it |
| **COMPONENTS** | real reference implementations + local preview paths |
| **PRINCIPLES** | the sections that apply to *this* component type |
| **PALETTE** | only when the tenant has no DNA yet |
| **SELF-AUDIT** | the DNA's own checklist, to verify against at the end |

**Precedence is absolute: where the principles and the DNA disagree, the DNA
wins** — say so rather than silently following either. The principles state this
rule themselves.

The individual tools below still exist for when you need one directly, but
`brief.mjs` is what an agent should reach for first.

## How to use it (the spine)

1. **Forge** — when asked for variations of a component, write N self-contained `.html` files into the tenant's variations dir:
   `<tenant>/variations/<set>/v<n>-<name>.html` (+ optional `meta.json` for the set, `<file>.meta.json` for per-variation notes/parentId). Each file is standalone (inline `<style>`, no deps, renders alone). Follow the tenant DNA (`<tenant>/dna.md`).
2. **Show** — run the UI Box so the human can see them live:
   `UIBASE_TENANT=<tenant-dir> node app/serve.mjs` → open `http://127.0.0.1:8810/`. It auto-discovers the folder, hot-refreshes on change, shows a scaled-iframe grid ranked by score.
3. **Score** (optional, before the human looks) — screenshot each variation and run the visual judge so the grid shows 0-10 per the DNA rubric: `node pipeline/shoot.mjs` then `node pipeline/judge.mjs`. Slop never reaches the human; they see ranked options.
4. **React** — the human types plain feedback in the UI Box ("2nd one but warmer, kill the pill") or blesses one. Feedback lands in `<tenant>/feedback-latest.json`; the blessed winner in `<tenant>/winner.json`.
5. **Iterate** — read `feedback-latest.json`, produce a v2 into the same set (set `parentId` in its `.meta.json`). The UI Box shows v1→v2 with score deltas.
6. **Graduate** — when blessed (`winner.json`), port the blessed HTML to a real React component **pixel-for-pixel**, using tenant tokens, then screenshot-diff vs the HTML to verify (see `verifiable-frontend`).

## Sub-commands

| Command | Does |
|---|---|
| `/forge-variations <component> [N]` | Forge N self-contained HTML variations into the set folder, following tenant DNA |
| `/show-me` | Boot the UI Box and give the human the URL |
| `/score-panel [set]` | Screenshot + judge a set; write 0-10 scores into review-state so the grid ranks them |
| `/iterate` | Read `feedback-latest.json`, produce the next variation in the set with `parentId` set |
| `/graduate` | Read `winner.json`, port blessed HTML → React pixel-for-pixel, screenshot-diff verify |
| `/calibrate` | Re-score the tenant's anchor (e.g. Oracle chat rail) — must stay ~9; catches judge drift |
| `/add-library <source>` | Register a component library battery the forge can pull from |

## Tenant config (what a project supplies to adopt)

A tenant dir holds: `dna.md` (the design rules / rubric source), `variations/` (where agents write), and is the home for the generated `review-state.json` / `winner.json` / `feedback-latest.json`. Oracle Streaming = the worked example tenant (`tenants/oracle/`). To adopt in a new project: point `UIBASE_TENANT` at that project's tenant dir (e.g. `<project>/.uihub`), drop in a `dna.md`, go.

## The component corpus (use it before forging from scratch)

`registry/21st/` holds **7,949 real components** — preview image, compiled bundle
and demo source each — plus 1,514 themes/templates/shaders/gradients. 91.6% are
classified against 21st's 75-tag taxonomy. Start a forge from evidence, not a
blank file.

**Never grep `harvest/` and never read the catalogue into context** — it is
hundreds of thousands of tokens. Query it instead:

```bash
node registry/21st/find.mjs pricing-section --limit 6 --json
node registry/21st/find.mjs card --tag testimonials
node registry/21st/find.mjs "glassmorphism"        # free text beats the taxonomy
```

Look at the returned `preview` images, read `bundle.html` for the one you want,
then **adapt it to the tenant DNA** — never paste. Full contract:
`registry/21st/AGENT.md`.

## Design principles (`registry/principles/`)

The **reasoning layer** — 334 sections across 271KB from `bergside/typeui`
(MIT), covering hierarchy, spacing rhythm, typography, colour logic, depth,
interaction, responsive thinking and accessibility.

Unlike the style skills these are genuinely authored: they carry formulas, a
mandatory application order, and the *why* behind each rule. They say what holds
when the design system is silent.

**Never read these files whole** — `ui-principles.md` alone is 96KB. Query the
section you need:

```bash
node registry/principles/ask.mjs "nested radius"
node registry/principles/ask.mjs contrast --file accessibility
node registry/principles/ask.mjs --list          # all 334 section headings
```

Their own stated order: design-system tokens first, then spacing, then UI
principles, then typography. Principles **enhance** a compliant design; they
never override a tenant DNA token. On conflict, the DNA wins.

## Palette & type reference (`registry/skills/`)

67 design skills from `bergside/awesome-design-skills` (MIT), each with a
rendered preview PNG. **Read this honestly:** they are template-generated — all
67 share identical Mission/Workflow/QA prose and list all nine font weights, and
`retro` ships default Tailwind blue. They are not authored taste.

What IS real signal: **49 distinct palettes and 38 font pairings**, each shown
applied in a preview image. Use it to pick a visual direction, then write the
actual rules yourself.

```bash
node registry/skills/palette.mjs --near '#ff0069'   # nearest palettes to a hex
node registry/skills/palette.mjs --style glass      # by style adjective
node registry/skills/palette.mjs --font Inter       # by typeface
node registry/skills/palette.mjs --json             # machine-readable
```

Every result carries a `preview` path — open the image before choosing. A tenant
`dna.md` is the destination; these are the starting point, never the output.

## OpenDesign interop (`opendesign/`)

A tenant's `dna.md` and an OpenDesign `DESIGN.md` are the same asset in two
formats. The hub owns the source:

```bash
node opendesign/sync.mjs status               # tenants vs exported packages
node opendesign/sync.mjs export <tenant>      # dna.md -> design-system package
node opendesign/sync.mjs import <pkg-dir>     # design system -> new tenant
```

Import lands a third-party design system as a tenant, ready for the normal
forge -> score -> bless loop. Export publishes SISO taste outward. Edit the
tenant DNA, never the generated `DESIGN.md`.

## Batteries (swappable, in `batteries/`)

- **judge** — visual scorer (Codex-vision today; `pipeline/{rubric,shoot,judge}.mjs`). Swap the model behind the same rubric.
- **gates/dna-grep.mjs** — deterministic source-rule gate (emits machine-readable JSON). Stage-1 before the visual judge.
- **libraries / frameworks** — component sources + domain knowledge injected into forge prompts.

## Principles

- **Filesystem-as-state.** Variations, reviews, blessings all live as files. No DB, no build step. The UI Box is one zero-dep Node server + one served HTML (React via CDN).
- **Reuse, don't rebuild.** See `CANONICAL.html` harvest manifest.
- **Verify at the surface.** A design is "done" when the rendered artifact is observed (screenshot/score), not when the code looks right.

Full spec + architecture: `CANONICAL.html`. Prior-art catalog: `registry/repos.json` (`./clone.sh` to vendor).
