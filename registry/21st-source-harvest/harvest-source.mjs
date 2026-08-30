#!/usr/bin/env node

// D2: retrieve the public, versioned TypeScript source exposed by each
// component page. The registry/21st harvest is read-only input.

import { createHash } from 'node:crypto'
import { access, appendFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARVEST = join(HERE, '..', '21st', 'harvest')
const SOURCE = join(HERE, 'source')
const STATE_PATH = join(HERE, 'STATE.md')
const FAILURE_LOG = join(HERE, 'source-failures.jsonl')
const SUMMARY_JSON = join(HERE, 'source-summary.json')
const SUMMARY_MD = join(HERE, 'source-summary.md')
const HALF_MARKER = join(HERE, 'D2-harvest-50-percent.json')
const COMPLETE_MARKER = join(HERE, 'D2-complete.json')

const USER_AGENT = 'Mozilla/5.0 (compatible; siso-ui-base source harvester; +local)'
// Hard floor: this process must never sustain faster than approximately one
// request/second, even when an operator supplies a smaller env value.
const REQUEST_INTERVAL_MS = Math.max(1000, Number(process.env.SISO_SOURCE_HARVEST_INTERVAL_MS || 1100))
const MAX_ATTEMPTS = 4
const REQUEST_TIMEOUT_MS = 30000
const WORKERS = Math.min(2, Math.max(1, Number(process.env.SISO_SOURCE_HARVEST_WORKERS || 1)))
const RETRYABLE_OUTCOMES = new Set(['page-network', 'code-network'])
const PERMANENT_OUTCOMES = new Set(['retrieved', 'gated-404', 'page-soft404', 'page-http', 'code-http', 'parse-failure'])

const args = process.argv.slice(2)
const limitIndex = args.indexOf('--limit')
const LIMIT = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Infinity
if (limitIndex >= 0 && (!Number.isInteger(LIMIT) || LIMIT < 0)) throw new Error('--limit must be a non-negative integer')
if (args.includes('--help')) {
  console.log('Usage: node harvest-source.mjs [--limit N]')
  console.log('Env: SISO_SOURCE_HARVEST_INTERVAL_MS (floor 1000), SISO_SOURCE_HARVEST_WORKERS (max 2)')
  process.exit(0)
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const exists = path => access(path).then(() => true, () => false)

let nextRequestAt = 0
async function pace() {
  const wait = Math.max(0, nextRequestAt - Date.now())
  if (wait) await sleep(wait)
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get('retry-after'))
  const hinted = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0
  return Math.min(60000, Math.max(hinted, 2000 * (2 ** attempt)))
}

function versionInfo(bundleUrl) {
  const file = bundleUrl ? basename(new URL(bundleUrl).pathname) : ''
  const match = file.match(/^bundle\.([^.]+)\.html$/)
  const version = match?.[1] || null
  return {
    version,
    timestampToken: version?.match(/^[0-9]{10,}/)?.[0] || null,
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

function parseCodeReference(reference) {
  const match = reference?.match(/^r2:\/\/components-code-private\/([^/]+)\/([^/]+)\/(code\.[^/]+\.tsx)$/)
  if (!match) return null
  const [, author, slug, versionedFilename] = match
  return {
    author,
    slug,
    versionedFilename,
    codeUrl: `https://cdn.21st.dev/${author}/${slug}/${versionedFilename}`,
  }
}

async function request(url) {
  let lastError = null
  let lastStatus = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await pace()
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html, text/plain;q=0.9, */*;q=0.1' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      lastStatus = response.status
      const body = await response.text()
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`)
        if (attempt + 1 < MAX_ATTEMPTS) await sleep(retryDelay(response, attempt))
        continue
      }
      return { status: response.status, body, attempts: attempt + 1, contentType: response.headers.get('content-type') }
    } catch (error) {
      lastError = error
      if (attempt + 1 < MAX_ATTEMPTS) await sleep(2000 * (2 ** attempt))
    }
  }
  return { status: lastStatus, attempts: MAX_ATTEMPTS, error: lastError }
}

async function loadRows() {
  const entries = (await readdir(HARVEST, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name.includes('__'))
  const rows = []
  for (const entry of entries) {
    const meta = JSON.parse(await readFile(join(HARVEST, entry.name, 'meta.json'), 'utf8'))
    rows.push({
      id: meta.id || entry.name,
      author: meta.author,
      slug: meta.slug,
      upstreamUrl: meta.url,
      installCommand: meta.installCommand || null,
      ...versionInfo(meta.bundleUrl),
    })
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id))
}

function baseResult(row, fetchedAt) {
  return {
    id: row.id,
    author: row.author,
    slug: row.slug,
    retrievalMethod: 'GET component page -> parse r2 code reference -> GET versioned public CDN TSX',
    upstreamUrl: row.upstreamUrl,
    fetchedAt,
    completedAt: null,
    versionedFilename: null,
    codeReference: null,
    codeUrl: null,
    httpStatus: { page: null, code: null },
    attempts: { page: null, code: null },
    contentType: null,
    bytes: null,
    sha256: null,
    outcome: null,
    failureClass: null,
    error: null,
  }
}

async function probe(row) {
  const fetchedAt = new Date().toISOString()
  const result = baseResult(row, fetchedAt)
  const page = await request(row.upstreamUrl)
  result.httpStatus.page = page.status
  result.attempts.page = page.attempts
  if (page.error) {
    result.outcome = 'page-network'
    result.failureClass = page.error.name === 'TimeoutError' ? 'timeout' : 'network'
    result.error = String(page.error)
    result.completedAt = new Date().toISOString()
    return { result, body: null }
  }
  if (pageIsSoft404(page.status, page.body)) {
    result.outcome = 'page-soft404'
    result.failureClass = 'soft-404'
    result.completedAt = new Date().toISOString()
    return { result, body: null }
  }
  if (page.status < 200 || page.status >= 300) {
    result.outcome = 'page-http'
    result.failureClass = 'http'
    result.completedAt = new Date().toISOString()
    return { result, body: null }
  }

  result.codeReference = extractCodeReference(page.body)
  const reference = parseCodeReference(result.codeReference)
  if (!reference) {
    result.outcome = 'parse-failure'
    result.failureClass = 'missing-code-reference'
    result.completedAt = new Date().toISOString()
    return { result, body: null }
  }
  result.versionedFilename = reference.versionedFilename
  result.codeUrl = reference.codeUrl

  const code = await request(result.codeUrl)
  result.httpStatus.code = code.status
  result.attempts.code = code.attempts
  result.contentType = code.contentType || null
  if (code.error) {
    result.outcome = 'code-network'
    result.failureClass = code.error.name === 'TimeoutError' ? 'timeout' : 'network'
    result.error = String(code.error)
    result.completedAt = new Date().toISOString()
    return { result, body: null }
  }
  if (code.status === 404) {
    result.outcome = 'gated-404'
    result.failureClass = 'access-gated'
    result.completedAt = new Date().toISOString()
    return { result, body: null }
  }
  if (code.status < 200 || code.status >= 300) {
    result.outcome = 'code-http'
    result.failureClass = 'http'
    result.completedAt = new Date().toISOString()
    return { result, body: null }
  }
  if (!code.body?.length) {
    result.outcome = 'parse-failure'
    result.failureClass = 'empty-source'
    result.completedAt = new Date().toISOString()
    return { result, body: null }
  }
  result.bytes = Buffer.byteLength(code.body)
  result.sha256 = createHash('sha256').update(code.body).digest('hex')
  result.outcome = 'retrieved'
  result.completedAt = new Date().toISOString()
  return { result, body: code.body }
}

async function atomicWrite(path, content) {
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, content)
  await rename(temp, path)
}

async function persist(result, body) {
  const dir = join(SOURCE, result.id)
  await mkdir(dir, { recursive: true })
  if (result.outcome === 'retrieved' && body != null) {
    await atomicWrite(join(dir, 'code.tsx'), body)
  }
  if (result.outcome !== 'retrieved') {
    const codePath = join(dir, 'code.tsx')
    let staleBody = null
    try {
      staleBody = await readFile(codePath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (staleBody) {
      const quarantineDir = join(HERE, 'quarantine', 'stale-code', result.id)
      let quarantineName = 'code.tsx'
      if (await exists(join(quarantineDir, quarantineName))) quarantineName = `code.${Date.now()}.${process.pid}.tsx`
      const quarantinePath = join(quarantineDir, quarantineName)
      await mkdir(quarantineDir, { recursive: true })
      await rename(codePath, quarantinePath)
      result.orphanedCode = {
        path: `quarantine/stale-code/${result.id}/${quarantineName}`,
        bytes: staleBody.length,
        sha256: createHash('sha256').update(staleBody).digest('hex'),
        verdict: 'orphaned-code-recoverable',
        evidence: `Read and preserved code.tsx before moving it because final outcome is ${result.outcome}/${result.failureClass || 'none'}.`,
      }
    }
  }
  await atomicWrite(join(dir, 'source-meta.json'), JSON.stringify(result, null, 2) + '\n')
  if (result.outcome !== 'retrieved') {
    await appendFile(FAILURE_LOG, JSON.stringify({
      id: result.id,
      author: result.author,
      slug: result.slug,
      outcome: result.outcome,
      failureClass: result.failureClass,
      httpStatus: result.httpStatus,
      versionedFilename: result.versionedFilename,
      upstreamUrl: result.upstreamUrl,
      codeUrl: result.codeUrl,
      completedAt: result.completedAt,
      error: result.error,
    }) + '\n')
  }
}

async function readExisting(row) {
  const path = join(SOURCE, row.id, 'source-meta.json')
  try {
    const meta = JSON.parse(await readFile(path, 'utf8'))
    const codePresent = await exists(join(SOURCE, row.id, 'code.tsx'))
    const retryableParse = meta.outcome === 'parse-failure' && meta.failureClass === 'code-reference-mismatch'
    const permanent = PERMANENT_OUTCOMES.has(meta.outcome) && !retryableParse && (meta.outcome !== 'retrieved' || codePresent)
    return { meta, permanent }
  } catch {
    return { meta: null, permanent: false }
  }
}

function outcomeCounts(rows) {
  const counts = {}
  for (const row of rows) counts[row.outcome] = (counts[row.outcome] || 0) + 1
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

function rates(rows) {
  const retrieved = rows.filter(row => row.outcome === 'retrieved').length
  const gated = rows.filter(row => row.outcome === 'gated-404').length
  return {
    n: rows.length,
    retrieved,
    gated404: gated,
    unavailable: rows.length - retrieved,
    retrievalRate: rows.length ? retrieved / rows.length : null,
    outcomeCounts: outcomeCounts(rows),
  }
}

async function writeState({ stage, rows, total, resumeIndex, resumeId, startedAt, note = '' }) {
  const summary = rates([...rows.values()])
  const next = resumeId ? `${resumeIndex} (${resumeId})` : `${resumeIndex}`
  await writeFile(STATE_PATH, `# 21st source harvest lane state\n\n` +
    `- stage: ${stage}\n` +
    `- updated: ${new Date().toISOString()}\n` +
    `- started: ${startedAt}\n` +
    `- corpus: ${total}\n` +
    `- d1 sample: 330 (complete)\n` +
    `- d2 processed with final metadata: ${summary.n}/${total}\n` +
    `- d2 retrieved: ${summary.retrieved}\n` +
    `- d2 gated 404: ${summary.gated404}\n` +
    `- d2 unavailable total: ${summary.unavailable}\n` +
    `- d2 outcome counts: ${JSON.stringify(summary.outcomeCounts)}\n` +
    `- d2 request policy: ${REQUEST_INTERVAL_MS}ms global start interval, ${WORKERS} worker(s), ${MAX_ATTEMPTS} attempts\n` +
    `- resume point: input index ${next}\n` +
    `- note: ${note || 'none'}\n` +
    `- d3 status: ${stage.startsWith('D2 complete') ? 'pending' : 'pending'}\n` +
    `- d4 gated count: pending\n`)
}

async function writeSummary(rows, total, completedAt) {
  const summary = {
    completedAt,
    corpusTotal: total,
    requestPolicy: { intervalMs: REQUEST_INTERVAL_MS, workers: WORKERS, maxAttempts: MAX_ATTEMPTS, timeoutMs: REQUEST_TIMEOUT_MS },
    ...rates(rows),
  }
  await writeFile(SUMMARY_JSON, JSON.stringify(summary, null, 2) + '\n')
  const lines = [
    '# D2 source harvest summary',
    '',
    `Completed ${completedAt} across ${total} local component records.`,
    '',
    `- Retrieved: ${summary.retrieved} (${(summary.retrievalRate * 100).toFixed(1)}%)`,
    `- CDN 404-gated: ${summary.gated404}`,
    `- Unavailable/non-source outcomes: ${summary.unavailable}`,
    `- Request policy: ${REQUEST_INTERVAL_MS}ms global start interval, ${WORKERS} worker(s), exponential backoff on 429/5xx/network`,
    '',
    'Per-component provenance is under `source/<component-id>/source-meta.json`; failure attempts are in `source-failures.jsonl`.',
    '',
  ]
  await writeFile(SUMMARY_MD, lines.join('\n'))
  return summary
}

async function main() {
  await mkdir(SOURCE, { recursive: true })
  const startedAt = new Date().toISOString()
  const rows = await loadRows()
  const finalById = new Map()
  const pending = []
  for (const row of rows) {
    const existing = await readExisting(row)
    if (existing.meta) finalById.set(row.id, existing.meta)
    if (!existing.permanent) pending.push(row)
  }
  const work = pending.slice(0, LIMIT === Infinity ? pending.length : LIMIT)
  const firstInputIndex = rows.findIndex(row => row.id === work[0]?.id)
  console.log(`D2 corpus: ${rows.length} · existing final metadata: ${finalById.size} · pending: ${pending.length} · this run: ${work.length} · workers: ${WORKERS} · interval: ${REQUEST_INTERVAL_MS}ms`)
  await writeState({ stage: work.length ? 'D2 running' : 'D2 complete — awaiting D3', rows: finalById, total: rows.length, resumeIndex: firstInputIndex >= 0 ? firstInputIndex : rows.length, resumeId: work[0]?.id, startedAt, note: work.length ? 'processing pending components' : 'all components already have final metadata' })

  let cursor = 0
  let lastPrinted = -1
  let halfMarked = await exists(HALF_MARKER)
  const persistOne = async (row, inputIndex) => {
    const { result, body } = await probe(row)
    await persist(result, body)
    finalById.set(row.id, result)
    const processed = finalById.size
    await writeState({ stage: processed >= rows.length ? 'D2 complete — awaiting D3' : 'D2 running', rows: finalById, total: rows.length, resumeIndex: inputIndex + 1, resumeId: rows[inputIndex + 1]?.id, startedAt, note: result.outcome })
    // Long runs can retain transient fetch/serialization buffers longer than
    // the request cadence. When the operator exposes GC, collect at a bounded
    // cadence without making it a requirement for normal execution.
    if (global.gc && processed % 100 === 0) global.gc()
    if (!halfMarked && processed >= Math.ceil(rows.length / 2)) {
      halfMarked = true
      await writeFile(HALF_MARKER, JSON.stringify({
        markedAt: new Date().toISOString(),
        processed,
        total: rows.length,
        ...rates([...finalById.values()]),
        resumeIndex: inputIndex + 1,
        resumeId: rows[inputIndex + 1]?.id || null,
      }, null, 2) + '\n')
      console.log(`MILESTONE D2-harvest-50-percent ${processed}/${rows.length}`)
    }
    if (processed !== lastPrinted && (processed % 25 === 0 || processed === rows.length)) {
      lastPrinted = processed
      const summary = rates([...finalById.values()])
      console.log(`${processed}/${rows.length} · last ${row.id} · ${result.outcome} · retrieved ${summary.retrieved} · gated ${summary.gated404} · unavailable ${summary.unavailable}`)
    }
  }
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= work.length) return
      const row = work[index]
      const inputIndex = rows.findIndex(candidate => candidate.id === row.id)
      await persistOne(row, inputIndex)
    }
  }
  await Promise.all(Array.from({ length: Math.min(WORKERS, Math.max(1, work.length)) }, worker))

  const finished = finalById.size >= rows.length && rows.every(row => finalById.has(row.id))
  if (!finished) {
    await writeState({ stage: 'D2 in progress — resumable', rows: finalById, total: rows.length, resumeIndex: rows.findIndex(row => !finalById.has(row.id)), resumeId: rows.find(row => !finalById.has(row.id))?.id, startedAt, note: `${rows.length - finalById.size} components remain; rerun without --limit` })
    console.log(`D2 partial: ${finalById.size}/${rows.length} final metadata; rerun to resume`)
    return
  }
  const completedAt = new Date().toISOString()
  const summary = await writeSummary([...finalById.values()], rows.length, completedAt)
  await writeFile(COMPLETE_MARKER, JSON.stringify({ completedAt, ...summary }, null, 2) + '\n')
  await writeState({ stage: 'D2 complete — awaiting D3', rows: finalById, total: rows.length, resumeIndex: rows.length, resumeId: null, startedAt, note: 'all components have final source metadata' })
  console.log(`D2 complete: ${summary.retrieved}/${rows.length} retrieved (${(summary.retrievalRate * 100).toFixed(1)}%) · ${summary.gated404} CDN 404-gated · ${summary.unavailable} unavailable/non-source`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.stack || error)
    process.exitCode = 1
  })
}
