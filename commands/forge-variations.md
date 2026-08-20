# /forge-variations <component> [N=4]

Forge N genuinely different HTML variations of <component> — IN THE REAL APP FRAME, AT REAL SIZE.

> **Why this rule exists (Shaan, 2026-06-03):** floating ~420px component cards "don't understand the sizing, spacing, or context of how it fits into the app we've already built." A variation reviewed out of context is useless — you can't judge a panel you can't see in its slot. So variations render INSIDE the real cockpit frame, at the slot's true dimensions, with the rest of the cockpit shown around it.

0. **Get the brief first — do not invent from nothing.**

   ```bash
   node brief.mjs "<component>" --tenant <tenant> --json
   ```

   One command returns the DNA (the authority), real reference components with
   local preview paths, and the design principles that apply to this component
   type. **Open the preview images.** Forging N variations without looking at
   what already exists is how you get four recolors of the same idea — the
   corpus is 7,949 real components precisely so the variations start from
   evidence.

   The brief also carries **PRECEDENT** — what this project already judged.
   If a past variation was rejected for "AI-default pill stacking", do not ship
   another pill stack. The blessed HTML is the bar to beat; read it first.

   Take *approaches* from the references, never markup. They are compiled
   bundles from a different design system; the DNA is what governs here.

1. Read the tenant DNA: `$UIBASE_TENANT/dna.md` (the quality bar — follow it).
   Where a principle from the brief disagrees with the DNA, **the DNA wins** —
   say so rather than silently following either.
2. Read the **cockpit frame shell**: `$UIBASE_TENANT/_frame/cockpit-frame.html`. COPY its structure + CSS. Real measured dimensions: cockpit **1408×868**, chat rail **400px** wide, stage **~978px**, camera box bottom-left under chat. Regions: topbar · left[chat over camera-box] · stage · bottom[upnext+assistant].
3. Pick a set id (kebab of the component). Make `$UIBASE_TENANT/variations/<set>/` + `meta.json` (`{ "name", "prompt", "slotId", "inbox": true }`).
4. Write N files `v<n>-<short-name>.html` — EACH a FULL cockpit frame copy where:
   - the component under review sits LIT in its REAL slot at REAL size (single-component review → give that region `is-live`, ghost the rest; whole-mode review → un-ghost all, replace the stage's inner content).
   - genuinely DIFFERENT approaches, not recolors. Anchor each variation to a
     distinct reference from step 0 so "different" means structurally different,
     not a palette swap.
   - NEVER a centered 420px island. The reviewer must see it in the app.
5. Screenshot each to a sibling `<name>.png` at 1320×820 @2x (the review tile needs the PNG).
6. Run `/score-panel <set>` and `/show-me` so the human reviews in context, in the UI Base.

Do NOT touch reviews/blessings — those are human-gated.
