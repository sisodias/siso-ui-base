#!/usr/bin/env node

// D1: measure public source availability without retaining source content.
// The local registry is read-only input. All artifacts are written beside this file.

import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARVEST = join(HERE, '..', '21st', 'harvest')
const SAMPLE_PATH = join(HERE, 'd1-sample.json')
const RESULTS_PATH = join(HERE, 'd1-results.jsonl')
const REPORT_JSON = join(HERE, 'retrieval-rate-report.json')
const REPORT_MD = join(HERE, 'retrieval-rate-report.md')
const STATE_PATH = join(HERE, 'STATE.md')

const NODE_VERSION = process.versions.node
const USER_AGENT = 'Mozilla/5.0 (compatible; siso-ui-base source-availability study; +local)'
const REQUEST_INTERVAL_MS = Number(process.env.SISO_SOURCE_PROBE_INTERVAL_MS || 1100)
const MAX_ATTEMPTS = 4
const REQUEST_TIMEOUT_MS = 30000
const SEED = 'd1-source-rate-v1'
const CODE_ELIGIBLE_OUTCOMES = new Set(['retrieved', 'gated-404', 'code-http'])

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let nextRequestAt = 0
async function pace() {
  const wait = Math.max(0, nextRequestAt - Date.now())
  if (wait) await sleep(wait)
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get('retry-after'))
  const hinted = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0
  const exponential = 2000 * (2 ** attempt)
  return Math.min(60000, Math.max(hinted, exponential))
}

function hash(value) {
  let h = 2166136261
  for (const char of value) {
    h ^= char.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function versionInfo(bundleUrl) {
  const file = bundleUrl ? basename(new URL(bundleUrl).pathname) : ''
  const match = file.match(/^bundle\.([^.]+)\.html$/)
  const version = match?.[1] || null
  const timestampMatch = version?.match(/^[0-9]{10,}/)
  const timestampToken = timestampMatch?.[0] || null
  let format = 'missing'
  if (version) {
    if (/^[0-9]{10,}$/.test(version)) format = 'timestamp-only'
    else if (/^[0-9]{10,}-[0-9a-f-]{36}$/i.test(version)) format = 'timestamp-uuid'
    else format = 'other'
  }
  const timestampMs = timestampToken ? Number(timestampToken) : null
  return {
    version,
    format,
    timestampToken,
    timestampMs: Number.isFinite(timestampMs) ? timestampMs : null,
  }
}

function pageIsSoft404(status, html) {
  return status === 404 || /NEXT_HTTP_ERROR_FALLBACK;404/i.test(html) ||
    /<meta[^>]+name=["']robots["'][^>]+content=["']noindex["']/i.test(html)
}

function extractCodeReference(html) {
  const normalized = html
    .replaceAll('\\/', '/')
    .replaceAll('\\u002f', '/')
    .replaceAll('\\u002F', '/')
  const refs = [...normalized.matchAll(/r2:\/\/components-code-private\/[^"\\\s]+\/code\.[^"\\\s]+\.tsx/g)]
    .map(match => match[0])
  return [...new Set(refs)][0] || null
}

function codeUrlFromReference(reference) {
  if (!reference?.startsWith('r2://components-code-private/')) return null
  const path = reference.slice('r2://components-code-private/'.length)
  const parts = path.split('/')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !/^code\.[^/]+\.tsx$/.test(parts[2])) return null
  return `https://cdn.21st.dev/${parts.map(encodeURIComponent).join('/')}`
}

async function request(url) {
  let lastError = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await pace()
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html, text/plain;q=0.9, */*;q=0.1' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`)
        if (attempt + 1 < MAX_ATTEMPTS) await sleep(retryDelay(response, attempt))
        continue
      }
      return { response, body: await response.text(), attempts: attempt + 1 }
    } catch (error) {
      lastError = error
      if (attempt + 1 < MAX_ATTEMPTS) await sleep(2000 * (2 ** attempt))
    }
  }
  return { error: lastError, attempts: MAX_ATTEMPTS }
}

async function loadRows() {
  const entries = (await readdir(HARVEST, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name.includes('__'))
  const rows = []
  for (const entry of entries) {
    const meta = JSON.parse(await readFile(join(HARVEST, entry.name, 'meta.json'), 'utf8'))
    const version = versionInfo(meta.bundleUrl)
    rows.push({
      id: meta.id || entry.name,
      author: meta.author,
      slug: meta.slug,
      upstreamUrl: meta.url,
      bundleUrl: meta.bundleUrl || null,
      ...version,
    })
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id))
}

function addAgeBuckets(rows) {
  const known = rows.filter(row => row.timestampMs).sort((a, b) => a.timestampMs - b.timestampMs)
  const cutValues = [0.25, 0.5, 0.75].map(q => known[Math.floor((known.length - 1) * q)].timestampMs)
  const cuts = cutValues.map(value => new Date(value).toISOString())
  for (const row of rows) {
    if (!row.timestampMs) row.ageBucket = 'unknown'
    else if (row.timestampMs <= cutValues[0]) row.ageBucket = 'oldest'
    else if (row.timestampMs <= cutValues[1]) row.ageBucket = 'older'
    else if (row.timestampMs <= cutValues[2]) row.ageBucket = 'newer'
    else row.ageBucket = 'newest'
  }
  return { rows, knownCount: known.length, cutValues, cuts }
}

function addAuthorBands(rows) {
  const counts = new Map()
  for (const row of rows) counts.set(row.author, (counts.get(row.author) || 0) + 1)
  const authors = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const ranks = new Map(authors.map(([author], index) => [author, index]))
  for (const row of rows) {
    const rank = ranks.get(row.author)
    row.authorRank = rank + 1
    row.authorBand = rank < 15 ? 'top15' : rank < 100 ? 'mid16-100' : 'tail101+'
  }
  return { authors, counts }
}

function selectSample(rows) {
  const selected = new Set()
  const picks = []

  function pick(filter, count, stratum) {
    const candidates = rows
      .filter(row => !selected.has(row.id) && filter(row))
      .sort((a, b) => hash(`${a.id}:${SEED}:${stratum}`) - hash(`${b.id}:${SEED}:${stratum}`))
    const byAuthor = new Map()
    for (const row of candidates) {
      if (!byAuthor.has(row.author)) byAuthor.set(row.author, [])
      byAuthor.get(row.author).push(row)
    }
    const authors = [...byAuthor.keys()].sort((a, b) => hash(`${a}:${SEED}:${stratum}`) - hash(`${b}:${SEED}:${stratum}`))
    let round = 0
    while (picks.filter(row => row.sampleStratum === stratum).length < count && round < candidates.length * 2 + 1) {
      const author = authors[round % authors.length]
      const row = byAuthor.get(author)?.shift()
      if (row) {
        selected.add(row.id)
        picks.push({ ...row, sampleStratum: stratum })
      }
      round++
    }
    if (picks.filter(row => row.sampleStratum === stratum).length < count) {
      throw new Error(`Unable to fill D1 stratum ${stratum}`)
    }
  }

  for (const age of ['oldest', 'older', 'newer', 'newest']) {
    for (const band of ['top15', 'mid16-100', 'tail101+']) {
      pick(row => row.ageBucket === age && row.authorBand === band, 20, `${age}/${band}`)
    }
  }
  pick(row => row.format === 'timestamp-only', 30, 'format/timestamp-only')
  pick(row => row.format === 'timestamp-uuid', 30, 'format/timestamp-uuid')
  pick(row => row.format === 'missing', 30, 'format/missing')
  return picks.map((row, index) => ({ ...row, sampleIndex: index }))
}

async function writeState(state) {
  const rows = state.results || []
  const counts = Object.fromEntries([...new Set(rows.map(row => row.outcome))].map(outcome => [outcome, rows.filter(row => row.outcome === outcome).length]))
  const last = rows.at(-1)
  await writeFile(STATE_PATH, `# 21st source harvest lane state\n\n` +
    `- stage: ${state.stage}\n` +
    `- updated: ${new Date().toISOString()}\n` +
    `- corpus: ${state.corpusTotal ?? 7949}\n` +
    `- d1 sample: ${state.sampleTotal ?? 330}\n` +
    `- d1 probed: ${rows.length}\n` +
    `- d1 counts: ${JSON.stringify(counts)}\n` +
    `- resume point: ${last ? `D1 sampleIndex ${last.sampleIndex + 1} (${last.id})` : 'D1 sampleIndex 0'}\n` +
    `- d2 retrieved: ${state.d2Retrieved ?? 0}\n` +
    `- d2 gated: ${state.d2Gated ?? 0}\n` +
    `- d2 network/parse failures: ${state.d2Failures ?? 0}\n` +
    `- d3 status: ${state.d3Status ?? 'pending'}\n` +
    `- d4 gated count: ${state.d4Gated ?? 'pending'}\n`)
}

function outcomeForPage(status, html) {
  if (status === 404 || pageIsSoft404(status, html)) return 'page-soft404'
  if (status < 200 || status >= 300) return 'page-http'
  return null
}

async function probe(row) {
  const fetchedAt = new Date().toISOString()
  const page = await request(row.upstreamUrl)
  const result = {
    ...row,
    fetchedAt,
    pageStatus: page.response?.status ?? null,
    pageAttempts: page.attempts,
    codeReference: null,
    codeUrl: null,
    codeStatus: null,
    codeAttempts: null,
    codeBytes: null,
    codeSha256: null,
    outcome: null,
    failureClass: null,
  }
  if (page.error) {
    result.outcome = 'page-network'
    result.failureClass = page.error.name === 'TimeoutError' ? 'timeout' : 'network'
    result.error = String(page.error)
    return result
  }
  const pageOutcome = outcomeForPage(page.response.status, page.body)
  if (pageOutcome) {
    result.outcome = pageOutcome
    result.failureClass = pageOutcome === 'page-soft404' ? 'soft-404' : 'http'
    return result
  }
  result.codeReference = extractCodeReference(page.body)
  result.codeUrl = codeUrlFromReference(result.codeReference)
  if (!result.codeUrl) {
    result.outcome = 'parse-failure'
    result.failureClass = 'missing-code-reference'
    return result
  }
  const code = await request(result.codeUrl)
  result.codeStatus = code.response?.status ?? null
  result.codeAttempts = code.attempts
  if (code.error) {
    result.outcome = 'code-network'
    result.failureClass = code.error.name === 'TimeoutError' ? 'timeout' : 'network'
    result.error = String(code.error)
    return result
  }
  if (code.response.status === 404) {
    result.outcome = 'gated-404'
    result.failureClass = 'access-gated'
    return result
  }
  if (code.response.status < 200 || code.response.status >= 300) {
    result.outcome = 'code-http'
    result.failureClass = 'http'
    return result
  }
  result.codeBytes = Buffer.byteLength(code.body)
  result.codeSha256 = createHash('sha256').update(code.body).digest('hex')
  if (!result.codeBytes) {
    result.outcome = 'parse-failure'
    result.failureClass = 'empty-source'
  } else {
    result.outcome = 'retrieved'
    result.failureClass = null
  }
  return result
}

function summarize(rows, key) {
  const groups = new Map()
  for (const row of rows) {
    const value = row[key] ?? 'unknown'
    if (!groups.has(value)) groups.set(value, [])
    groups.get(value).push(row)
  }
  return Object.fromEntries([...groups].sort(([a], [b]) => a.localeCompare(b)).map(([value, group]) => {
    const retrieved = group.filter(row => row.outcome === 'retrieved').length
    const codeEligible = group.filter(row => CODE_ELIGIBLE_OUTCOMES.has(row.outcome)).length
    const gated = group.filter(row => row.outcome === 'gated-404').length
    return [value, {
      n: group.length,
      retrieved,
      retrievalRate: group.length ? retrieved / group.length : null,
      codeEligible,
      retrievalRateAmongCodeEligible: codeEligible ? retrieved / codeEligible : null,
      gated404: gated,
      gatedRateAmongCodeEligible: codeEligible ? gated / codeEligible : null,
      outcomes: Object.fromEntries([...new Set(group.map(row => row.outcome))].sort().map(outcome => [outcome, group.filter(row => row.outcome === outcome).length])),
    }]
  }))
}

function outcomeCounts(rows) {
  return Object.fromEntries([...new Set(rows.map(row => row.outcome))].sort().map(outcome => [outcome, rows.filter(row => row.outcome === outcome).length]))
}

function pct(value) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`
}

function markdown(report) {
  const overall = report.overall
  const lines = [
    '# D1 retrieval-rate report',
    '',
    `Measured ${report.measuredAt} against ${report.corpus.total} local component records using ${report.sample.n} deterministic probes.`,
    '',
    `**Headline:** ${overall.retrieved}/${overall.n} components returned a non-empty TypeScript source file (${pct(overall.retrievalRate)} of the full sample). Among ${overall.codeEligible} live pages with a parseable code path, the CDN split was ${overall.retrieved} HTTP 200 vs ${overall.gated404} HTTP 404 (${pct(overall.retrievalRateAmongCodeEligible)} retrievable; ${pct(overall.gatedRateAmongCodeEligible)} gated).`,
    '',
    '## Method',
    '',
    '- Input was every `meta.json` under `registry/21st/harvest/`; no registry input was modified.',
    '- Sample size is 330: 20 in each of 12 cells formed by four bundle-version age quartiles × three author-rank bands, plus 30 forced timestamp-only, 30 timestamp+UUID, and 30 missing-version records. Selection is deterministic (`d1-source-rate-v1`) and round-robins authors inside each cell.',
    `- Version-age quartiles use the numeric leading timestamp in ` + '`bundle.<version>.html`' + `; ${report.sample.knownVersionCount} records had a timestamp. Cut points: ${report.sample.ageCutPoints.join(', ')}. The local file mtimes are all one harvest day, so they were not used as age evidence.`,
    '- Each page request and each code request is serialized at a minimum 1.1-second start interval. HTTP 429/5xx and network errors use bounded exponential backoff.',
    '- A page HTTP 200 containing the site’s `NEXT_HTTP_ERROR_FALLBACK;404`/noindex soft-404 marker is classified separately; it is not counted as a CDN 404 gate.',
    '',
    '## Outcome counts',
    '',
    '| Outcome | Count |',
    '|---|---:|',
    ...Object.entries(report.overall.outcomes).map(([outcome, count]) => `| ${outcome} | ${count} |`),
    '',
    '## Stratified results',
    '',
    '| Dimension | Stratum | n | Retrieved | Full-sample rate | Code-eligible rate | 404-gated |',
    '|---|---|---:|---:|---:|---:|---:|',
  ]
  for (const [dimension, groups] of [['age bucket', report.byAge], ['author band', report.byAuthorBand], ['version format', report.byFormat]]) {
    for (const [name, value] of Object.entries(groups)) {
      lines.push(`| ${dimension} | ${name} | ${value.n} | ${value.retrieved} | ${pct(value.retrievalRate)} | ${pct(value.retrievalRateAmongCodeEligible)} | ${value.gated404} |`)
    }
  }
  lines.push(
    '',
    '## Interpretation',
    '',
    `The 200/404 split is strongly age/format-shaped in this sample: timestamp-only records returned ${pct(report.byFormat['timestamp-only']?.retrievalRateAmongCodeEligible)} among code-eligible probes, versus ${pct(report.byFormat['timestamp-uuid']?.retrievalRateAmongCodeEligible)} for timestamp+UUID records. Age-bucket and author-band rates are descriptive; author is confounded with publication/version era and the sample is not powered to claim causality.`,
    `The D1 gate is complete: the measured overall retrieval rate is ${pct(overall.retrievalRate)} of all sampled component records, with ${overall.gated404} precise CDN 404 gates and ${overall.outcomes['page-soft404'] || 0} page soft-404s excluded from the CDN split.`,
    '',
    'Machine-readable details, per-component results, hashes, and the exact sample are in `retrieval-rate-report.json`.',
    '',
  )
  return lines.join('\n')
}

async function main() {
  await mkdir(HERE, { recursive: true })
  const loaded = await loadRows()
  const ageInfo = addAgeBuckets(loaded)
  const authorInfo = addAuthorBands(ageInfo.rows)
  const sample = selectSample(ageInfo.rows)
  await writeFile(SAMPLE_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    seed: SEED,
    corpusTotal: loaded.length,
    knownVersionCount: ageInfo.knownCount,
    ageCutPoints: ageInfo.cuts,
    authorCount: authorInfo.authors.length,
    sample,
  }, null, 2) + '\n')
  await writeFile(RESULTS_PATH, '')
  await writeState({ stage: 'D1 running', corpusTotal: loaded.length, sampleTotal: sample.length, results: [] })

  console.log(`D1 sample: ${sample.length}/${loaded.length} · ${REQUEST_INTERVAL_MS}ms request interval · Node ${NODE_VERSION}`)
  const results = []
  for (let i = 0; i < sample.length; i++) {
    const result = await probe(sample[i])
    results.push(result)
    await appendFile(RESULTS_PATH, JSON.stringify(result) + '\n')
    await writeState({ stage: 'D1 running', corpusTotal: loaded.length, sampleTotal: sample.length, results })
    if ((i + 1) % 10 === 0 || i + 1 === sample.length) {
      console.log(`${i + 1}/${sample.length} · ${result.outcome} · ${JSON.stringify(outcomeCounts(results))}`)
    }
  }

  const report = {
    measuredAt: new Date().toISOString(),
    node: NODE_VERSION,
    requestPolicy: { intervalMs: REQUEST_INTERVAL_MS, maxAttempts: MAX_ATTEMPTS, timeoutMs: REQUEST_TIMEOUT_MS, workers: 1 },
    corpus: { total: loaded.length, authors: authorInfo.authors.length },
    sample: {
      n: results.length,
      seed: SEED,
      knownVersionCount: ageInfo.knownCount,
      ageCutPoints: ageInfo.cuts,
      authorBands: { top15: 15, 'mid16-100': 85, 'tail101+': authorInfo.authors.length - 100 },
      strata: Object.fromEntries([...new Set(sample.map(row => row.sampleStratum))].map(stratum => [stratum, sample.filter(row => row.sampleStratum === stratum).length])),
      uniqueAuthors: new Set(sample.map(row => row.author)).size,
    },
    overall: {
      n: results.length,
      retrieved: results.filter(row => row.outcome === 'retrieved').length,
      retrievalRate: results.filter(row => row.outcome === 'retrieved').length / results.length,
      codeEligible: results.filter(row => CODE_ELIGIBLE_OUTCOMES.has(row.outcome)).length,
      retrieved200: results.filter(row => row.outcome === 'retrieved').length,
      gated404: results.filter(row => row.outcome === 'gated-404').length,
      retrievalRateAmongCodeEligible: null,
      gatedRateAmongCodeEligible: null,
      outcomes: outcomeCounts(results),
    },
    byAge: summarize(results, 'ageBucket'),
    byAuthorBand: summarize(results, 'authorBand'),
    byFormat: summarize(results, 'format'),
    bySampleStratum: summarize(results, 'sampleStratum'),
    results,
  }
  report.overall.retrievalRateAmongCodeEligible = report.overall.codeEligible ? report.overall.retrieved / report.overall.codeEligible : null
  report.overall.gatedRateAmongCodeEligible = report.overall.codeEligible ? report.overall.gated404 / report.overall.codeEligible : null
  await writeFile(REPORT_JSON, JSON.stringify(report, null, 2) + '\n')
  await writeFile(REPORT_MD, markdown(report))
  await writeState({ stage: 'D1 complete — awaiting callback before D2', corpusTotal: loaded.length, sampleTotal: sample.length, results })
  console.log(`D1 complete: ${report.overall.retrieved}/${report.overall.n} retrieved (${pct(report.overall.retrievalRate)}) · ${report.overall.gated404} CDN 404-gated`)
  console.log(`artifacts: ${REPORT_MD}, ${REPORT_JSON}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.stack || error)
    process.exitCode = 1
  })
}
