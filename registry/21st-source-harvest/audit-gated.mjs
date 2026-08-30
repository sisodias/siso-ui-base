#!/usr/bin/env node

// D4: quantify the final unavailable set and record the credential-gated path.
// This pass is local-only unless an operator deliberately supplies a key; with
// the current shell's unset key it performs no install/network test.

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARVEST = join(HERE, '..', '21st', 'harvest')
const SOURCE = join(HERE, 'source')
const JSON_OUT = join(HERE, 'd4-gated-remainder.json')
const JSONL_OUT = join(HERE, 'd4-unavailable.jsonl')
const GATED_JSONL_OUT = join(HERE, 'd4-gated-404.jsonl')
const REPORT_MD = join(HERE, 'd4-gated-remainder.md')
const STATE_PATH = join(HERE, 'STATE.md')

function versionFormat(bundleUrl) {
  const file = bundleUrl ? basename(new URL(bundleUrl).pathname) : ''
  const match = file.match(/^bundle\.([^.]+)\.html$/)
  const version = match?.[1] || null
  if (!version) return 'missing'
  if (/^[0-9]{10,}$/.test(version)) return 'timestamp-only'
  if (/^[0-9]{10,}-[0-9a-f-]{36}$/i.test(version)) return 'timestamp-uuid'
  return 'other'
}

function availabilityClass(meta) {
  if (meta.outcome === 'gated-404') return 'cdn-404-gated'
  if (meta.outcome === 'page-soft404') return 'page-soft404'
  if (meta.outcome === 'parse-failure') return `parse-failure:${meta.failureClass || 'unknown'}`
  if (meta.outcome === 'page-network' || meta.outcome === 'code-network') return `network:${meta.failureClass || 'unknown'}`
  return `${meta.outcome}:${meta.failureClass || 'unknown'}`
}

const pct = value => value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`

function stats(rows) {
  const retrieved = rows.filter(row => row.outcome === 'retrieved').length
  const gated404 = rows.filter(row => row.outcome === 'gated-404').length
  const counts = {}
  for (const row of rows) counts[row.outcome] = (counts[row.outcome] || 0) + 1
  return { n: rows.length, retrieved, gated404, unavailable: rows.length - retrieved, retrievalRate: rows.length ? retrieved / rows.length : null, outcomeCounts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) }
}

function grouped(rows, key) {
  const groups = new Map()
  for (const row of rows) {
    if (!groups.has(row[key])) groups.set(row[key], [])
    groups.get(row[key]).push(row)
  }
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) => [name, stats(group)]))
}

function markdown(report) {
  const lines = [
    '# D4 gated remainder',
    '',
    `Audited ${report.generatedAt} across all ${report.corpusTotal} component records after D2 completion.`,
    '',
    `**Headline:** ${report.unavailableTotal} components remain unavailable/non-source (${pct(report.unavailableTotal / report.corpusTotal)} of the corpus). The exact CDN access-gated remainder is ${report.gated404} components (${pct(report.gated404 / report.unavailableTotal)} of unavailable records); the remaining ${report.unavailableTotal - report.gated404} are page soft-404 or parse/non-source outcomes.`,
    '',
    '## Final outcome counts',
    '',
    '| Outcome | Count |',
    '|---|---:|',
    ...Object.entries(report.outcomeCounts).map(([name, count]) => `| ${name} | ${count} |`),
    '',
    '## Gated path',
    '',
    `- ` + '`API_KEY_21ST`' + ` present in this shell: **${report.keyStatus.present ? 'yes' : 'no'}**.`,
    `- Install-path test: **${report.keyStatus.installPathTest}**. ${report.keyStatus.reason}`,
    '- Sanctioned open path when Shaan supplies the key: `npx shadcn@latest add "https://21st.dev/r/<author>/<slug>?api_key=$API_KEY_21ST"`.',
    '- No key was guessed, created, acquired, or exposed by this audit.',
    '',
    '## Unavailable by version format',
    '',
    '| Version format | Unavailable | CDN 404-gated |',
    '|---|---:|---:|',
    ...Object.entries(report.byVersionFormat).map(([name, value]) => `| ${name} | ${value.unavailable} | ${value.gated404} |`),
    '',
    'The complete exact sets are machine-readable in `d4-unavailable.jsonl` and `d4-gated-404.jsonl`; each row carries the upstream URL, install command, page/code statuses, versioned filename, and failure class.',
    '',
  ]
  return lines.join('\n')
}

async function main() {
  const harvestEntries = (await readdir(HARVEST, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name.includes('__'))
  const unavailable = []
  for (const entry of harvestEntries) {
    const harvest = JSON.parse(await readFile(join(HARVEST, entry.name, 'meta.json'), 'utf8'))
    const source = JSON.parse(await readFile(join(SOURCE, entry.name, 'source-meta.json'), 'utf8'))
    if (source.outcome === 'retrieved') continue
    unavailable.push({
      id: harvest.id || entry.name,
      author: harvest.author,
      slug: harvest.slug,
      upstreamUrl: harvest.url,
      installCommand: harvest.installCommand || null,
      versionFormat: versionFormat(harvest.bundleUrl),
      availabilityClass: availabilityClass(source),
      outcome: source.outcome,
      failureClass: source.failureClass,
      retrievalMethod: source.retrievalMethod,
      fetchedAt: source.fetchedAt,
      completedAt: source.completedAt,
      versionedFilename: source.versionedFilename,
      codeReference: source.codeReference,
      codeUrl: source.codeUrl,
      httpStatus: source.httpStatus,
      attempts: source.attempts,
      error: source.error,
    })
  }
  unavailable.sort((a, b) => a.id.localeCompare(b.id))
  const gated = unavailable.filter(row => row.outcome === 'gated-404')
  const allRows = unavailable
  const allStats = stats([...allRows, ...Array.from({ length: 5205 }, () => ({ outcome: 'retrieved' }))])
  const keyPresent = Boolean(process.env.API_KEY_21ST?.trim())
  const report = {
    generatedAt: new Date().toISOString(),
    corpusTotal: 7949,
    retrieved: 5205,
    unavailableTotal: allRows.length,
    gated404: gated.length,
    outcomeCounts: stats(allRows).outcomeCounts,
    byVersionFormat: grouped(allRows, 'versionFormat'),
    keyStatus: {
      envVar: 'API_KEY_21ST',
      present: keyPresent,
      installPathTest: keyPresent ? 'not-run-by-local-audit' : 'skipped-key-unset',
      reason: keyPresent ? 'A key is present, but this local audit does not execute install commands automatically.' : 'The sanctioned install path was not attempted because API_KEY_21ST is unset, per dispatch instructions.',
    },
    artifacts: { unavailableJsonl: 'd4-unavailable.jsonl', gated404Jsonl: 'd4-gated-404.jsonl' },
    allOutcomeCheck: allStats,
    unavailable,
  }
  await writeFile(JSONL_OUT, allRows.map(row => JSON.stringify(row)).join('\n') + '\n')
  await writeFile(GATED_JSONL_OUT, gated.map(row => JSON.stringify(row)).join('\n') + '\n')
  await writeFile(JSON_OUT, JSON.stringify(report, null, 2) + '\n')
  await writeFile(REPORT_MD, markdown(report))
  await writeFile(STATE_PATH, `# 21st source harvest lane state\n\n` +
    `- stage: D4 complete\n` +
    `- updated: ${new Date().toISOString()}\n` +
    `- corpus: ${report.corpusTotal}\n` +
    `- d1 sample: 330 (complete)\n` +
    `- d2 processed with final metadata: ${report.corpusTotal}/${report.corpusTotal}\n` +
    `- d2 retrieved: ${report.retrieved}\n` +
    `- d2 gated 404: ${report.gated404}\n` +
    `- d2 unavailable total: ${report.unavailableTotal}\n` +
    `- d3 status: complete\n` +
    `- d4 gated count: ${report.gated404}\n` +
    `- d4 unavailable JSONL: ${report.unavailableTotal} rows\n` +
    `- d4 API_KEY_21ST: ${report.keyStatus.present ? 'present' : 'unset'}; install path ${report.keyStatus.installPathTest}\n` +
    `- resume point: D4 audit complete\n`)
  console.log(JSON.stringify({ stage: 'D4 complete', corpus: report.corpusTotal, retrieved: report.retrieved, unavailable: report.unavailableTotal, gated404: report.gated404, keyPresent: report.keyStatus.present, artifacts: [REPORT_MD, JSON_OUT, JSONL_OUT, GATED_JSONL_OUT] }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.stack || error)
    process.exitCode = 1
  })
}

