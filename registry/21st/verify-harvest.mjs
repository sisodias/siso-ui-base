#!/usr/bin/env node
// Integrity gate for the harvested corpus. Exit 0 = pass, 1 = fail.
//
// Tolerates in-flight writes: harvest.mjs writes meta.json LAST, so a directory
// without one is a component being fetched right now, not a corrupt entry.
// Those are reported as `in-flight` and excluded from the failure count.
//
//   node verify-harvest.mjs
//   node verify-harvest.mjs --json   # machine-readable, for CI

import { readdir, readFile, stat } from 'node:fs/promises'

const JSON_OUT = process.argv.includes('--json')
const dirs = (await readdir('harvest')).filter(d => d.includes('__'))

const r = { total: dirs.length, valid: 0, inFlight: 0, badJson: 0, missingFields: 0, noBundle: 0, tinyBundle: 0, noPreview: 0, withUsage: 0, badJsonPaths: [], missingFieldPaths: [] }

for (const d of dirs) {
  const p = `harvest/${d}/meta.json`
  let raw
  try { raw = await readFile(p, 'utf8') } catch { r.inFlight++; continue }

  let m
  try { m = JSON.parse(raw) } catch { r.badJson++; r.badJsonPaths.push(p); continue }

  if (!m.url || !m.author || !m.slug || !m.id) { r.missingFields++; r.missingFieldPaths.push(p); continue }
  if (typeof m.usage_count === 'number') r.withUsage++

  try { if ((await stat(`harvest/${d}/bundle.html`)).size < 500) r.tinyBundle++ } catch { r.noBundle++ }
  try { await stat(`harvest/${d}/preview.webp`) } catch { r.noPreview++ }
  r.valid++
}

// noBundle/noPreview are expected: some components genuinely ship neither.
const failed = r.badJson + r.missingFields + r.tinyBundle

if (JSON_OUT) {
  console.log(JSON.stringify({ ...r, pass: failed === 0 }, null, 2))
} else {
  console.log(`corpus: ${r.total} dirs`)
  console.log(`  valid          ${r.valid}`)
  console.log(`  in-flight      ${r.inFlight}   (being written now — not a defect)`)
  console.log(`  with usage_count ${r.withUsage}`)
  console.log(`  no bundle      ${r.noBundle}   (component ships none)`)
  console.log(`  no preview     ${r.noPreview}   (component ships none)`)
  console.log(`  FAIL bad-json  ${r.badJson}`)
  console.log(`  FAIL missing-fields ${r.missingFields}`)
  console.log(`  FAIL tiny-bundle ${r.tinyBundle}`)
  for (const p of [...r.badJsonPaths, ...r.missingFieldPaths].slice(0, 10)) console.log(`     ${p}`)
  console.log(failed === 0 ? '\nPASS' : `\nFAIL (${failed} defective entries)`)
}
process.exit(failed === 0 ? 0 : 1)
