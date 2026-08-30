# CENA directive — skip what we already own

Date: 2026-08-29. From: CENA. Priority: apply before continuing D2.

## The finding

A **second, source-bearing 21st.dev store already exists on this laptop** and the harvest
lane did not know about it:

```
/Users/shaansisodia/SISO_Workspace/SISO_Knowledge/design-system/library/21st-dev/
```

- 3,508 component directories; **3,507 carry real non-demo `.tsx` source**
- 3,478 have a resolvable upstream identity (`registry-item.json.description` →
  `https://21st.dev/r/<author>/<slug>`)
- each directory also carries `classification.json` (industry/use-case axes) and
  `registry-item.json` with a `dependencies[]` array and a `_provenance` block

This was established in phase-8 lane 02 (`research/actionmodel-builder-research-2026-08-26/
phase-8/lanes/02-local-corpus-join/outputs/local-corpus-join-report.md`, §3) and CENA
re-verified it independently today by counting the directories on disk.

## What it means for this lane

Joining the legacy store against the 7,949-dir harvest corpus on upstream `author/slug`:

| Measure | Count |
|---|---|
| Harvest corpus dirs | 7,949 |
| **Already source-bearing in the legacy store** | **2,945** |
| Not in legacy — the real harvest target | 5,004 |
| Legacy-only (absent from the new corpus) | 533 |
| Union of distinct components | 8,482 |

(Phase-8 measured 2,942 / 8,515 by a slightly different key. The small delta is naming
normalisation, not a disagreement.)

Measured against the live run at index ~520: **37% of everything fetched so far was
already on disk.** We are paying request budget against a live commercial service to
re-acquire files we own.

## Directive

1. **Do not re-fetch any component present in the legacy store.** An index has been
   written for you at `legacy-source-index.jsonl` in this directory: one row per legacy
   component with `upstream_id` (lowercased `author/slug`), `legacy_dir`, `legacy_path`
   and `source_files[]`. Load it and skip on `upstream_id` match.
2. **Re-scope D2 to the 5,004 not-in-legacy components.** Keep the same polite policy
   (~1.1s interval, 1 worker, backoff, resumable). Report the revised denominator in
   STATE.md so the completion percentage means something.
3. **Do not delete, move, or modify the legacy store.** It is read-only to this lane.
   Phase-8's finding stands: the two stores are complementary, not redundant — the legacy
   store has source, the new corpus has bundles and previews, and 533 legacy components
   do not exist in the new corpus at all. Deduplicating by deleting either side destroys
   capability.
4. **Fold the legacy store into D3.** The source inventory and dependency-closure
   deliverable should cover the union (8,482), not just what this lane fetched. The
   legacy `registry-item.json.dependencies[]` gives you dependency data for 3,478
   components without any fetching at all, and `classification.json` carries the
   `best_for_industries` / `use_cases` axes the new corpus's 75-tag scheme lacks.
5. **Record the correction in STATE.md** — what the denominator was, what it is now, and
   why. Do not quietly re-baseline.

## Rights note

Unchanged and not this lane's call: retrieved source stays local, nothing is republished,
provenance stays clean per file. Shaan's standing rule is that licence is not a selection
gate and rights are solved later; keep receipts, do not editorialise.
