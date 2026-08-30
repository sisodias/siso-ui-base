# ACTIONIST-COMPONENT-SOURCE — dispatch

Date: 2026-08-29. Role: long-running Luna on /goal. Coordinator: CENA (Shaan's brain session).

## The finding this lane exists to exploit

The 7,949-component 21st harvest at `/Users/shaansisodia/SISO_Workspace/siso-ui-base/registry/21st/harvest/`
contains **no component source**. Measured 2026-08-29: 2.62GB of `bundle.html` (compiled,
minified React — unusable for assembly), 0.17GB previews, 8.6MB of `demo.tsx` import stubs,
and real source for exactly 2 of 7,949 components (in `registry/21st/code/`).

**But source IS publicly retrievable for a large fraction.** Proven recipe (CENA verified
live, 2026-08-29):

1. Read the component's upstream URL from its `meta.json` (`url` field,
   e.g. `https://21st.dev/@0xUrvish/components/animated-collection`).
2. GET that page. Its Next.js payload always embeds a path of the form
   `r2://components-code-private/<author>/<slug>/code.<version>.tsx`.
3. GET `https://cdn.21st.dev/<author>/<slug>/code.<version>.tsx` — that exact versioned
   filename. Older components return **200 with clean, uncompiled TypeScript**
   (imports, interfaces, hooks, JSX). Newer ones return 404 (access-gated).

Sample rate: 9/20 (45%) retrieved on a random sample. Establishing the true rate at scale
is deliverable D1.

## Deliverables

### D1 — measure the real rate (do this first, report before bulk work)

Sample ≥300 components stratified across authors and harvest age. Report: retrieval rate,
whether the 200/404 split correlates with component age/author/version-timestamp format
(early evidence: older `larsen66`-style paths with `1773…` timestamps succeed; newer
UUID-suffixed paths 404). Emit `retrieval-rate-report.md` + machine JSON. Callback with the
number before starting D2.

### D2 — the harvester

Build `harvest-source.mjs` in this directory:
- Input: the existing harvest dirs (read-only) for URLs; output: source into
  `registry/21st-source-harvest/source/<component-id>/code.tsx` plus a per-component
  `source-meta.json` (retrieval method, upstream URL, versioned filename, fetch timestamp,
  http status, sha256).
- **Rate-limited and polite**: max ~1 request/second sustained, exponential backoff on
  429/5xx, resumable (skip already-fetched), and a `--limit` flag. Never parallelise beyond
  2 workers. This is a live commercial service; do not hammer it.
- Idempotent and restartable; log every failure class separately (404-gated vs network vs
  parse-failure) so the gated set is precisely known.
- Run it to completion across all 7,949 (expect a long tail of 404s — that is data, not
  failure).

### D3 — what the source unlocks

For the retrieved set, report: how many are self-contained vs import sibling files
(`@/components/ui/<other>` — those siblings may themselves be retrievable; follow one hop
and record the dependency closure), dependency/package usage frequency (motion/react,
hugeicons, radix, etc.), and per-family counts joined to the existing 75-tag classification.
Deliver `source-inventory.md` + JSONL.

### D4 — the gated remainder

Quantify exactly which components remain unavailable. Test whether the sanctioned
`installCommand` path (`npx shadcn@latest add "https://21st.dev/r/<author>/<slug>?api_key=$API_KEY_21ST"`)
resolves them **only if `API_KEY_21ST` is present in the environment** — Shaan says a key
exists but it is NOT currently set in this shell; if unset, do not guess, do not sign up,
do not attempt to obtain one. Record the gated count and note the key as the open path.

## Boundaries

- Write only under `registry/21st-source-harvest/`. `registry/21st/harvest/` and everything
  else under `registry/21st/` is **read-only**.
- No republishing: retrieved source stays local. Do not commit it to any repo, do not deploy
  it, do not include it in any public site or artifact.
- Rights posture: Shaan's standing rule is that licence is not a selection gate and rights
  are a solve-later problem; record provenance faithfully (upstream URL + retrieval method +
  timestamp per file) so any later rights decision has receipts. Do not editorialise about
  legality; just keep the provenance clean.
- Node: `/opt/homebrew/opt/node@24/bin/node` (default node on PATH is broken).

## Callbacks

One line to the CENA pane at: D1-rate-measured, D2-harvest-50-percent, D2-complete,
D4-gated-count. Keep `STATE.md` current with counts and the resume point.
