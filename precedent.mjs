#!/usr/bin/env node
// Recall past verdicts, so the loop learns instead of restarting.
//
// THE GAP THIS CLOSES
// The hub already RECORDS taste: every variation gets a 0-10 score, a worst
// axis, and a written critique saying why it lost; the human blesses a winner.
// tenants/oracle holds four scored variations, a blessed winner, and a critique
// explaining exactly which DNA rules the losers broke.
//
// Nothing read any of it. /forge-variations, brief.mjs and dna-grep all made
// zero reference to review-state.json or winner.json. So every forge began from
// nothing and could — and would — repeat a mistake already judged and rejected.
//
// That is the whole moat: the labelled (html, score, blessed) triples are the
// one asset here nobody else can clone. Recording them and never reading them
// is the same as not having them.
//
//   node precedent.mjs                      # everything judged so far
//   node precedent.mjs goal-bar             # one set, winner and losers
//   node precedent.mjs --lessons            # what the critiques keep saying
//   node precedent.mjs --json               # for brief.mjs and agents
//
// Reads every tenant. Exit 0 always — an empty corpus is a valid state, not an
// error, and a new project legitimately has no precedent.

import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const R = p => join(HERE, p)
const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const LESSONS = args.includes('--lessons')
const setFilter = args.find(a => !a.startsWith('--')) ?? null

const exists = async p => { try { await stat(p); return true } catch { return false } }

const tenants = await readdir(R('tenants')).catch(() => [])
const records = []

for (const tenant of tenants) {
  const statePath = R(join('tenants', tenant, 'review-state.json'))
  if (!await exists(statePath)) continue
  let state
  try { state = JSON.parse(await readFile(statePath, 'utf8')) } catch { continue }

  const blessed = state.blessed || {}
  for (const [key, review] of Object.entries(state.reviews || {})) {
    const [setId, id] = key.includes('/') ? key.split('/') : [null, key]
    const s = review.scores || {}
    records.push({
      tenant, setId, id,
      overall: s.overall ?? null,
      axes: s.scores ?? {},
      worst: s.worst ?? null,
      critique: s.critique ?? null,
      blessed: blessed[setId] === id,
      html: join('tenants', tenant, 'variations', setId ?? '', `${id}.html`),
    })
  }
}

const filtered = setFilter ? records.filter(r => r.setId === setFilter) : records

// What the critiques keep saying. A phrase that sank three variations is a rule
// the DNA failed to state clearly enough — that is the signal worth surfacing.
function lessons(rows) {
  const withCritique = rows.filter(r => r.critique && !r.blessed)
  const axisFails = {}
  for (const r of rows) if (r.worst) axisFails[r.worst] = (axisFails[r.worst] || 0) + 1
  return {
    weakestAxes: Object.entries(axisFails).sort((a, b) => b[1] - a[1]),
    rejections: withCritique.map(r => ({
      id: `${r.setId}/${r.id}`, overall: r.overall, worst: r.worst,
      why: r.critique.split(/(?<=\.)\s/)[0],   // first sentence carries the verdict
    })),
  }
}

const out = {
  tenants: tenants.length,
  judged: filtered.length,
  blessed: filtered.filter(r => r.blessed).length,
  sets: [...new Set(filtered.map(r => r.setId).filter(Boolean))],
  records: filtered.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)),
  lessons: lessons(filtered),
}

if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0) }

if (!filtered.length) {
  console.log('no precedent yet — nothing has been judged.')
  console.log('every forge starts from the DNA alone until a set is scored and blessed.')
  process.exit(0)
}

if (LESSONS) {
  console.log(`lessons from ${out.judged} judged variation(s)\n`)
  console.log('weakest axes (what keeps failing):')
  for (const [axis, n] of out.lessons.weakestAxes) console.log(`  ${String(n).padStart(3)}x  ${axis}`)
  console.log('\nrejected, and why:')
  for (const r of out.lessons.rejections) {
    console.log(`  ${r.id}  (${r.overall}, worst: ${r.worst})`)
    console.log(`     ${r.why}`)
  }
  process.exit(0)
}

console.log(`${out.judged} judged · ${out.blessed} blessed · sets: ${out.sets.join(', ') || '—'}\n`)
for (const r of out.records) {
  const mark = r.blessed ? 'BLESSED' : '       '
  console.log(`  ${mark} ${String(r.overall ?? '—').padStart(5)}  ${r.setId}/${r.id}   worst: ${r.worst ?? '—'}`)
  if (r.critique && !r.blessed) console.log(`          ${r.critique.split(/(?<=\.)\s/)[0]}`)
}
console.log(`\nthe blessed HTML is the reference to beat — read it before forging a new one.`)
