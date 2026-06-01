# /score-panel [set]

Score variations 0-10 against the tenant DNA so the grid ranks them (slop never reaches the human).

1. Ensure the UI Box server is up (variations served at /api/html/...).
2. `node pipeline/shoot.mjs` — screenshot each variation (or adapt to the set's URLs).
3. `node pipeline/judge.mjs <ids...>` — Codex-vision scores warmth/playful/clarity/craft/coherence vs `rubric.mjs` (built from dna.md).
4. POST each verdict to the server so it persists + ranks:
   `POST /api/review {setId, id, scores:{overall,scores{...},worst,critique}, status:"reviewed"}`
Calibration: the tenant anchor (e.g. Oracle chat rail) must score ~9. If not, the rubric/judge drifted — fix before trusting scores.
