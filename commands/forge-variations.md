# /forge-variations <component> [N=4]

Forge N genuinely different HTML variations of <component> — IN THE REAL APP FRAME, AT REAL SIZE.

> **Why this rule exists (Shaan, 2026-06-03):** floating ~420px component cards "don't understand the sizing, spacing, or context of how it fits into the app we've already built." A variation reviewed out of context is useless — you can't judge a panel you can't see in its slot. So variations render INSIDE the real cockpit frame, at the slot's true dimensions, with the rest of the cockpit shown around it.

1. Read the tenant DNA: `$UIBASE_TENANT/dna.md` (the quality bar — follow it).
2. Read the **cockpit frame shell**: `$UIBASE_TENANT/_frame/cockpit-frame.html`. COPY its structure + CSS. Real measured dimensions: cockpit **1408×868**, chat rail **400px** wide, stage **~978px**, camera box bottom-left under chat. Regions: topbar · left[chat over camera-box] · stage · bottom[upnext+assistant].
3. Pick a set id (kebab of the component). Make `$UIBASE_TENANT/variations/<set>/` + `meta.json` (`{ "name", "prompt", "slotId", "inbox": true }`).
4. Write N files `v<n>-<short-name>.html` — EACH a FULL cockpit frame copy where:
   - the component under review sits LIT in its REAL slot at REAL size (single-component review → give that region `is-live`, ghost the rest; whole-mode review → un-ghost all, replace the stage's inner content).
   - genuinely DIFFERENT approaches, not recolors.
   - NEVER a centered 420px island. The reviewer must see it in the app.
5. Screenshot each to a sibling `<name>.png` at 1320×820 @2x (the review tile needs the PNG).
6. Run `/score-panel <set>` and `/show-me` so the human reviews in context, in the UI Base.

Do NOT touch reviews/blessings — those are human-gated.
