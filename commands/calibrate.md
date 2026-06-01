# /calibrate

Prove the judge still agrees with the human.

1. Score the tenant's calibration anchor (a known-perfect panel — Oracle's is the chat rail, expected ~9.2).
2. If it scores ~9 → judge is calibrated, trust the rest. If it drifted low/high → the model or rubric changed; re-align `rubric.mjs` against `dna.md` before trusting any scores.
This is the regression test for taste itself.
