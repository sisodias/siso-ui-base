#!/usr/bin/env node
// Check the hub is actually usable, and say plainly what is not.
//
// WHY THIS EXISTS
// An audit found pipeline/shoot.mjs importing playwright with no package.json
// anywhere in the repo, while the README advertised "zero deps". The scoring
// stage had been broken the whole time and nothing said so — you would only
// find out mid-loop, after forging variations, when /score-panel died.
//
// So: one command, run it before you trust the loop.
//
//   node doctor.mjs          human-readable, exit 0/1
//   node doctor.mjs --json   machine-readable, for CI
//
// Exit 1 only when something REQUIRED is broken. Optional gaps (the visual
// judge) are reported as degraded, not failure — the forge/brief/gate path
// works without them.

import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const R = p => join(HERE, p)
const JSON_OUT = process.argv.includes('--json')

const checks = []
const add = (name, status, detail, fix) => checks.push({ name, status, detail, ...(fix ? { fix } : {}) })
const exists = async p => { try { await stat(R(p)); return true } catch { return false } }

// ---- core: the paths that must work
for (const [name, file] of [
  ['brief (front door)', 'brief.mjs'],
  ['corpus query', 'registry/21st/find.mjs'],
  ['principles query', 'registry/principles/ask.mjs'],
  ['palette query', 'registry/skills/palette.mjs'],
  ['UI Box server', 'app/serve.mjs'],
  ['DNA gate', 'batteries/gates/dna-grep.mjs'],
  ['principles gate', 'batteries/gates/principles-grep.mjs'],
]) {
  add(name, await exists(file) ? 'ok' : 'FAIL', file, 'file is missing from the repo')
}

// ---- data: present, or a documented regeneration step
const data = [
  ['component corpus', 'registry/21st/harvest', 'node registry/21st/harvest.mjs --all'],
  ['classification', 'registry/21st/classification.json', 'node registry/21st/classify.mjs'],
  // Check the CATALOG dirs, not just the index. index.json is committed but the
  // source files are gitignored, so a fresh clone has an index describing files
  // that are not there — ask.mjs and palette previews both need the catalog.
  ['principles', 'registry/principles/catalog', 'node registry/principles/ingest.mjs'],
  ['palettes', 'registry/skills/catalog', 'node registry/skills/ingest.mjs'],
]
for (const [name, path, fix] of data) {
  if (!await exists(path)) { add(name, 'MISSING', path, fix); continue }
  let detail = path
  try {
    const s = await stat(R(path))
    if (s.isDirectory()) {
      const entries = await readdir(R(path))
      const n = entries.filter(d => d.includes('__')).length || entries.length
      detail = `${n} entries`
    }
    else {
      const j = JSON.parse(await readFile(R(path), 'utf8'))
      detail = j.count ? `${j.count} entries` : j.taxonomy ? `${j.taxonomy.length} tags, ${Object.keys(j.componentToTags || {}).length} classified` : `${Math.round(s.size / 1024)}KB`
    }
  } catch {}
  add(name, 'ok', detail)
}

// ---- tenants: at least one DNA, else there is no authority to build against
const tenants = (await readdir(R('tenants')).catch(() => []))
const withDna = []
for (const t of tenants) if (await exists(join('tenants', t, 'dna.md'))) withDna.push(t)
add('tenant DNA', withDna.length ? 'ok' : 'FAIL',
  withDna.length ? withDna.join(', ') : 'no tenant has a dna.md',
  'import one: node opendesign/sync.mjs import <design-system-dir>')

// ---- optional: the visual judge. Degraded, not fatal.
let hasPlaywright = true
try { await import('playwright') } catch { hasPlaywright = false }
add('screenshotter (playwright)', hasPlaywright ? 'ok' : 'degraded',
  hasPlaywright ? 'installed' : 'not installed — pipeline/shoot.mjs cannot run, so /score-panel is unavailable',
  hasPlaywright ? undefined : 'npm install')

let hasCodex = true
try { await run('command', ['-v', 'codex'], { shell: '/bin/bash' }) } catch { hasCodex = false }
add('vision judge (codex CLI)', hasCodex ? 'ok' : 'degraded',
  hasCodex ? 'on PATH' : 'not on PATH — pipeline/judge.mjs cannot score',
  hasCodex ? undefined : 'install the codex CLI')

// ---- live smoke: does the front door actually answer?
try {
  const { stdout } = await run(process.execPath, [R('brief.mjs'), 'hero', '--limit', '1', '--json'], { maxBuffer: 1e8 })
  const j = JSON.parse(stdout)
  const ok = j.components?.length > 0
  add('brief smoke test', ok ? 'ok' : 'FAIL',
    ok ? `returned ${j.components.length} component(s), ${j.principles?.length ?? 0} principle(s)` : 'returned no components',
    ok ? undefined : 'corpus or classification may be empty — see the fixes above')
} catch (e) {
  add('brief smoke test', 'FAIL', String(e.message).slice(0, 90), 'brief.mjs threw')
}

const failed = checks.filter(c => c.status === 'FAIL' || c.status === 'MISSING')
const degraded = checks.filter(c => c.status === 'degraded')

if (JSON_OUT) {
  console.log(JSON.stringify({ pass: !failed.length, failed: failed.length, degraded: degraded.length, checks }, null, 2))
} else {
  for (const c of checks) {
    const mark = c.status === 'ok' ? ' ok ' : c.status === 'degraded' ? 'warn' : 'FAIL'
    console.log(`  [${mark}] ${c.name.padEnd(28)} ${c.detail}`)
    if (c.fix && c.status !== 'ok') console.log(`         fix: ${c.fix}`)
  }
  console.log()
  if (!failed.length && !degraded.length) console.log('all good.')
  else if (!failed.length) console.log(`usable, ${degraded.length} degraded — the forge/brief/gate path works; scoring does not.`)
  else console.log(`${failed.length} broken, ${degraded.length} degraded.`)
}

process.exit(failed.length ? 1 : 0)
