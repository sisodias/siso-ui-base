# /score-panel [set]

Score variations 0-10 against the tenant DNA so the grid ranks them (slop never reaches the human).

0. **Run the deterministic gates first — they are free and catch what vision misses.**

   ```bash
   node batteries/gates/dna-grep.mjs        $UIBASE_TENANT/variations/<set>/*.html
   node batteries/gates/principles-grep.mjs $UIBASE_TENANT/variations/<set>/*.html --tenant <tenant>
   ```

   `dna-grep` enforces **this tenant's** taste; `principles-grep` enforces what
   holds for **any** interface (badges never full-width, inputs must be visible,
   focus rings never removed bare). Where the two disagree the principles gate
   reports `deferred`, not a violation — the DNA wins, and it names the DNA rule
   that overrides. Fix violations before spending vision-model calls on a
   variation that already fails a mechanical check.

1. Ensure the UI Box server is up (variations served at /api/html/...).
2. `node pipeline/shoot.mjs` — screenshot each variation (or adapt to the set's URLs).
3. `node pipeline/judge.mjs <ids...>` — Codex-vision scores warmth/playful/clarity/craft/coherence vs `rubric.mjs` (built from dna.md).
4. POST each verdict to the server so it persists + ranks:
   `POST /api/review {setId, id, scores:{overall,scores{...},worst,critique}, status:"reviewed"}`
Calibration: the tenant anchor (e.g. Oracle chat rail) must score ~9. If not, the rubric/judge drifted — fix before trusting scores.
