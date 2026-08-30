# D1 retrieval-rate report

Measured 2026-08-29T03:16:13.567Z against 7949 local component records using 330 deterministic probes.

**Headline:** 210/330 components returned a non-empty TypeScript source file (63.6% of the full sample). Among 296 live pages with a parseable code path, the CDN split was 210 HTTP 200 vs 86 HTTP 404 (70.9% retrievable; 29.1% gated).

## Method

- Input was every `meta.json` under `registry/21st/harvest/`; no registry input was modified.
- Sample size is 330: 20 in each of 12 cells formed by four bundle-version age quartiles × three author-rank bands, plus 30 forced timestamp-only, 30 timestamp+UUID, and 30 missing-version records. Selection is deterministic (`d1-source-rate-v1`) and round-robins authors inside each cell.
- Version-age quartiles use the numeric leading timestamp in `bundle.<version>.html`; 6926 records had a timestamp. Cut points: 2025-08-21T02:29:35.862Z, 2025-10-21T16:15:46.913Z, 2026-07-11T01:55:54.245Z. The local file mtimes are all one harvest day, so they were not used as age evidence.
- Each page request and each code request is serialized at a minimum 1.1-second start interval. HTTP 429/5xx and network errors use bounded exponential backoff.
- A page HTTP 200 containing the site’s `NEXT_HTTP_ERROR_FALLBACK;404`/noindex soft-404 marker is classified separately; it is not counted as a CDN 404 gate.

## Outcome counts

| Outcome | Count |
|---|---:|
| gated-404 | 86 |
| page-soft404 | 8 |
| parse-failure | 26 |
| retrieved | 210 |

## Stratified results

| Dimension | Stratum | n | Retrieved | Full-sample rate | Code-eligible rate | 404-gated |
|---|---|---:|---:|---:|---:|---:|
| age bucket | newer | 79 | 78 | 98.7% | 100.0% | 0 |
| age bucket | newest | 91 | 2 | 2.2% | 2.3% | 86 |
| age bucket | older | 62 | 59 | 95.2% | 100.0% | 0 |
| age bucket | oldest | 68 | 67 | 98.5% | 100.0% | 0 |
| age bucket | unknown | 30 | 4 | 13.3% | 100.0% | 0 |
| author band | mid16-100 | 95 | 64 | 67.4% | 73.6% | 23 |
| author band | tail101+ | 150 | 88 | 58.7% | 67.7% | 42 |
| author band | top15 | 85 | 58 | 68.2% | 73.4% | 21 |
| version format | missing | 30 | 4 | 13.3% | 100.0% | 0 |
| version format | timestamp-only | 213 | 206 | 96.7% | 99.0% | 2 |
| version format | timestamp-uuid | 87 | 0 | 0.0% | 0.0% | 84 |

## Interpretation

The 200/404 split is strongly age/format-shaped in this sample: timestamp-only records returned 99.0% among code-eligible probes, versus 0.0% for timestamp+UUID records. Age-bucket and author-band rates are descriptive; author is confounded with publication/version era and the sample is not powered to claim causality.
The D1 gate is complete: the measured overall retrieval rate is 63.6% of all sampled component records, with 86 precise CDN 404 gates and 8 page soft-404s excluded from the CDN split.

Machine-readable details, per-component results, hashes, and the exact sample are in `retrieval-rate-report.json`.
