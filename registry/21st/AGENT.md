# Using the 21st corpus (for agents)

7,949 components + 1,514 themes/templates/shaders/etc, cached locally with a
preview image for every one. This file is the contract for using them.

## The one rule

**Never grep `harvest/`, never read `catalog.json` or `classification.json` into
context.** They are hundreds of thousands of tokens. Use `find.mjs`, which
returns a handful of ranked candidates.

```bash
node registry/21st/find.mjs pricing-section --limit 6 --json
```

## How components are classified

21st has no category field — not on the page, not in the authenticated API.
What it has is **75 official tags**, each with a browse page listing its
members. That listing is the taxonomy. `node find.mjs --tags` prints all 75
with counts.

Tags come from three sources, and every tag records which:

| source | meaning | count |
|---|---|---|
| `page` | scraped from 21st's own tag page — **ground truth** | 4,033 |
| `api` | inferred from the semantic search — plausible, not authoritative | 713 |
| `local` | matched from slug/name/description offline — weakest | 2,636 |

91.6% of components carry at least one tag. **Components are multi-tag** —
47.4% have two or more, so this is a faceted index, not a folder tree. A card
that is also a testimonial is genuinely both.

Ranking is confidence-first, damped by tag spread, with installs breaking ties.
A component carrying 27 tags is weak evidence for any one of them.

## The workflow

1. **Find candidates** — `find.mjs <tag>` and read the results. Each carries a
   `preview` path.
2. **Look at the previews.** They are real images on disk. This is the step
   that matters — do not pick from descriptions alone.
3. **Read the bundle** for the one you want: `harvest/<id>/bundle.html`. It is
   the compiled component — minified, but every Tailwind class and all logic
   is intact. `demo.tsx` alongside it is the demo's real TSX source.
4. **Adapt, don't paste.** The bundle is reference. Rebuild it against this
   project's DNA (`tenants/<x>/dna.md`), then run it through the UI Box loop.

## What you cannot get

**Component source is not available.** `/r/<author>/<slug>` is metered at 2/day
on the free plan and `component_data.code` is empty even authenticated. The
`bundle.html` is the real implementation and is what you should read. The
`install` command in each result works only if the user has a paid key.

## Query recipes

```bash
node find.mjs --tags                          # the 75-tag vocabulary + counts
node find.mjs hero --limit 5                  # by tag
node find.mjs card --tag testimonials         # intersect two tags
node find.mjs "glassmorphism"                 # free text over name + description
node find.mjs pricing-section --json          # machine-readable
```

Free text searches slug, name and description, so it finds things the taxonomy
misses — visual styles ("glassmorphism", "brutalist"), tech ("three.js",
"gsap"), and domain words ("saas", "fintech").

## Refreshing

```bash
node harvest.mjs --all          # components (idempotent, resumes)
node harvest-extras.mjs         # themes/templates/shaders/ascii/gradients
node classify.mjs               # rescrape the 75 tag pages
API_KEY_21ST=... node classify-fill.mjs   # deepen via semantic API
node classify-local.mjs         # tag the long tail offline
node backfill-previews.mjs      # recover any missing previews
node verify-harvest.mjs         # integrity gate, exit 0/1
```

`.env.21st` holds the API key and is gitignored. The key adds `usage_count`
and metadata; it does not unlock source.
