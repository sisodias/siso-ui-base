# 21st.dev component board

A locally-cached, browsable catalog of 21st.dev components. Built once, reusable
across every project — the previews live on disk, so this works offline and does
not break when a CDN link rots.

## View it

```sh
node registry/21st/serve.mjs      # → http://127.0.0.1:8811/
PORT=9100 node registry/21st/serve.mjs
```

Category chips, live search across name/description/author, hover for motion
video, click an image to zoom. Click **Pick** to shortlist; picks persist to
`picks.json` immediately, so an agent can read your shortlist without you
copying anything.

## What's here

| File | What it is |
|---|---|
| `catalog.json` | 587 components — id, name, description, author, category, preview, video, install command, url |
| `previews/` | 587 cached preview images (243 MB), named `<id>.<ext>` |
| `raw.jsonl` | Undeduped search output, one row per hit, with the query's category |
| `queries.txt` | The 72 queries that produced the sweep — rerun or extend these |
| `board.html` | The generated viewer |
| `serve.mjs` | Zero-dependency local server |
| `picks.json` | Your current shortlist (ids), written by the board |

## Refreshing / extending

`queries.txt` is `category|query` per line. Add lines, then re-run the sweep:

```sh
while IFS='|' read -r cat q; do
  21st search "$q" --type c --limit 20 --json \
    | python3 -c "import sys,json;[print(json.dumps({**x,'category':'$cat'})) for x in json.load(sys.stdin)]" \
    >> raw.jsonl
done < queries.txt
```

Then dedupe into `catalog.json`, cache new previews into `previews/`, and
regenerate `board.html`.

## Quota — important

`21st search` and `21st logo` are **free and unmetered**. The whole 72-query
sweep cost nothing.

`21st get <id>` (retrieving actual component code) is **metered — 2/day on the
free tier**. Check with `21st usage`. So: browse and shortlist freely, and spend
`get` calls only on components you're definitely adopting. For everything else,
use the preview as a design reference and build in the host repo's own idiom.

Other useful endpoints Codex never touched: `21st generate <prompt>` (project-aware
UI sketches with variants), `21st logo <query>` (free brand SVGs, no login).

## code/ — adopted components

Retrieved source for components we've spent `get` quota on. Each folder has
`component.tsx`, `demo.tsx`, and `meta.json` (install command, deps, preview).
Saved permanently so a metered pull is never repeated.

| id | name | npm deps | registry deps |
|---|---|---|---|
| 19077 | Editorial Image Hero | `@radix-ui/react-slot`, `class-variance-authority` | `components/ui/button.tsx` |

## Ranking — `score.mjs` + `profiles/`

The board is sorted by a score, not by search order:

```
score = need × (0.55 × fit + 0.45 × completeness)
```

- **need** — how badly *this project* wants that slot filled (from the profile).
  A perfect pricing table scores near zero if the project has no pricing page.
- **fit** — cost to land it in *this repo*, measured not guessed. Penalties for
  Tailwind-v4-only syntax, shadcn when it isn't installed, WebGL/GSAP deps,
  wrong vertical (SaaS/crypto/dashboard), style clashes.
- **completeness** — whole section or fragment? A "footer" that is only an email
  input scores low; one with columns + social + legal + brand scores high.

**`trueType` beats `category`.** Category came from the search query, so it lies —
7 of 21 "footers" were newsletter forms or a testimonial. `score.mjs` reclassifies
from the component's own description and shows the correction as a flag.

Bands: **Use it** ≥0.75 · **Strong** ≥0.5 · **Maybe** ≥0.3 · **Skip** below.

### New project

Copy `profiles/mygumm.json`, edit `need`/`penalties`/`bonuses` for that repo —
**measure the stack first** (`tailwind` version, is shadcn installed, which
animation lib) — then:

```sh
node score.mjs profiles/<project>.json   # writes ranked.json
```

Regenerate the board from `ranked.json` to see it applied.
