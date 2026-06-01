# /forge-variations <component> [N=4]

Forge N genuinely different self-contained HTML variations of <component>.

1. Read the tenant DNA: `$UIBASE_TENANT/dna.md` (the quality bar — follow it).
2. Pick a set id (kebab of the component, e.g. `goal-bar`). Make `$UIBASE_TENANT/variations/<set>/`.
3. Write `meta.json` in the set dir: `{ "name", "prompt", "slotId" }`.
4. Write N files `v<n>-<short-name>.html` — EACH standalone (inline <style>, no external deps, renders alone, centered ~420px for clean screenshots). Make them genuinely DIFFERENT approaches, not recolors.
5. Optionally per-file `v<n>-<name>.meta.json`: `{ "name", "notes", "parentId" }`.
6. Then run `/score-panel <set>` so the human sees ranked options, and `/show-me`.

Do NOT touch reviews/blessings — those are human-gated.
