---
name: siso-ui-base
description: Use this plugin when the user wants to build UI and would benefit from real reference components — searching a local, classified catalogue of 7,949 cached 21st.dev components (plus 1,514 themes, templates, shaders and gradients) by tag or free text, each with a preview image and compiled bundle on disk. Use it before writing UI from scratch, when the user asks for variations to choose between, or when they want to see what a pattern looks like in practice.
---

# SISO UI Base — a local component corpus

Most design systems tell an agent *how* things should look. This one shows it
**9,463 real artifacts** that already exist, so a build starts from evidence
rather than from a blank file.

## What is on disk

| | Count |
|---|---|
| Components (preview + compiled bundle + demo source) | 7,949 |
| Themes, templates, shaders, ascii, gradients, library | 1,514 |
| Preview images | **100% coverage** |
| Classified against 21st's 75-tag taxonomy | 91.6% |

## The one rule

**Never grep the corpus and never read the catalogue into context.** The index
files are hundreds of thousands of tokens. Query it instead:

```bash
node registry/21st/find.mjs pricing-section --limit 6 --json
```

That returns a handful of ranked candidates, each with a local `preview` path.

## How components are classified

21st exposes no category field. What it has is **75 official tags**, each with a
browse page listing its members — that listing is the taxonomy. Tags carry their
provenance so stronger evidence can be preferred:

- `page` — scraped from 21st's own tag page (**ground truth**)
- `api` — inferred from semantic search (plausible)
- `local` — matched offline from slug and name (weakest)

47.4% of components carry two or more tags, so the index is **faceted, not a
folder tree**. Ranking is confidence-first, damped by tag spread, with real
install counts breaking ties.

## Workflow

1. **Query** — `find.mjs <tag>` or free text. Free text catches what the
   taxonomy misses: `"glassmorphism"`, `"three.js"`, `"gsap"`, `"brutalist"`.
2. **Look at the previews.** They are real images on disk. This is the step that
   matters — never pick from descriptions alone.
3. **Read the bundle** — `harvest/<id>/bundle.html` is the compiled component:
   minified, but every Tailwind class and all logic intact. `demo.tsx` beside it
   is the demo's real TSX.
4. **Adapt, never paste.** The bundle is *reference*. Rebuild it against the
   active design system (`DESIGN.md` or a tenant `dna.md`), then verify.

## Recipes

```bash
node registry/21st/find.mjs --tags                    # the 75-tag vocabulary
node registry/21st/find.mjs hero --limit 5            # by tag
node registry/21st/find.mjs card --tag testimonials   # intersect two tags
node registry/21st/find.mjs "glassmorphism"           # free text
node registry/21st/find.mjs pricing-section --json    # machine-readable
```

## Limits worth knowing

**Component source is not obtainable.** 21st's `/r/` registry endpoint is
metered at 2/day on the free plan and `component_data.code` is empty even with a
key. `bundle.html` is the real implementation and is what to read. The `install`
command in each result only works for a user with a paid key.

Pair this with a design system that carries actual taste rules. The corpus
supplies *what exists*; the design system decides *what is right*.
