# D4 gated remainder

Audited 2026-08-29T08:19:20.819Z across all 7949 component records after D2 completion.

**Headline:** 2744 components remain unavailable/non-source (34.5% of the corpus). The exact CDN access-gated remainder is 1629 components (59.4% of unavailable records); the remaining 1115 are page soft-404 or parse/non-source outcomes.

## Final outcome counts

| Outcome | Count |
|---|---:|
| gated-404 | 1629 |
| page-soft404 | 185 |
| parse-failure | 930 |

## Gated path

- `API_KEY_21ST` present in this shell: **no**.
- Install-path test: **skipped-key-unset**. The sanctioned install path was not attempted because API_KEY_21ST is unset, per dispatch instructions.
- Sanctioned open path when Shaan supplies the key: `npx shadcn@latest add "https://21st.dev/r/<author>/<slug>?api_key=$API_KEY_21ST"`.
- No key was guessed, created, acquired, or exposed by this audit.

## Unavailable by version format

| Version format | Unavailable | CDN 404-gated |
|---|---:|---:|
| missing | 930 | 1 |
| timestamp-only | 171 | 78 |
| timestamp-uuid | 1643 | 1550 |

The complete exact sets are machine-readable in `d4-unavailable.jsonl` and `d4-gated-404.jsonl`; each row carries the upstream URL, install command, page/code statuses, versioned filename, and failure class.
