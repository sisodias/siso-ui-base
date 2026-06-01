# /graduate

Port the blessed HTML to production React.

1. Read `$UIBASE_TENANT/winner.json` ({setId, id}). The blessed HTML is the SOURCE OF TRUTH.
2. Port it to a React component pixel-for-pixel: match layout/spacing/color/motion exactly; use the project's design tokens; no new abstractions (Simplicity First).
3. Verify at the surface: screenshot the React render and diff vs the blessed HTML (see `verifiable-frontend` / `verify-surface`). Only mark done when they match.
4. Record the graduation (the (html, score, blessed) triple is the moat's training fuel).
