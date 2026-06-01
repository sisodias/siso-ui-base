# /iterate

Produce the next variation from human feedback.

1. Read `$UIBASE_TENANT/feedback-latest.json` ({setId, id, text, signals}).
2. Read the referenced variation's HTML; apply the feedback as a focused change (keep what scored well, fix what was called out).
3. Write `v<next>-<name>.html` into the SAME set, with a `.meta.json` setting `parentId` to the variation you iterated from.
4. Re-score (`/score-panel`). The UI Box shows v(parent) → v(new) with score deltas.
