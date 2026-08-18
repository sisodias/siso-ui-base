#!/usr/bin/env node
// Bulk 21st.dev catalog sweep. Search returns ~15-19 per call regardless of --limit,
// so coverage comes from FANNING the axes: query x sort x price x type.
// Every distinct slice surfaces different ids. Loops until N rounds add nothing new.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const run = promisify(execFile)

const QUERIES = readFileSync(new URL('./queries.txt', import.meta.url), 'utf8')
  .split('\n').filter(Boolean).map((l) => { const i = l.indexOf('|'); return [l.slice(0, i), l.slice(i + 1)] })
const SORTS = ['', 'popular', 'newest', 'downloads']
const PRICE = ['', '--free', '--paid']
const CONC = 6

const out = new Map()
const seedFile = new URL('./catalog.json', import.meta.url)
if (existsSync(seedFile)) for (const c of JSON.parse(readFileSync(seedFile))) out.set(c.id, c)
const before = out.size
console.log(`seeded with ${before} known components`)

const search = async (q, sort, price, cat) => {
  const a = ['search', q, '--type', 'c', '--limit', '100', '--json']
  if (sort) a.push('--sort', sort)
  if (price) a.push(price)
  try {
    const { stdout } = await run('21st', a, { timeout: 60000, maxBuffer: 8 << 20 })
    let n = 0
    for (const x of JSON.parse(stdout)) {
      if (!out.has(x.id)) { out.set(x.id, { ...x, category: cat }); n++ }
    }
    return n
  } catch { return 0 }
}

const jobs = []
for (const [cat, q] of QUERIES) for (const s of SORTS) for (const p of PRICE) jobs.push([q, s, p, cat])
console.log(`${jobs.length} slices (${QUERIES.length} queries x ${SORTS.length} sorts x ${PRICE.length} price)`)

let done = 0, added = 0
for (let i = 0; i < jobs.length; i += CONC) {
  const batch = jobs.slice(i, i + CONC)
  const res = await Promise.all(batch.map((j) => search(...j)))
  added += res.reduce((a, b) => a + b, 0); done += batch.length
  if (done % 60 === 0 || done === jobs.length)
    console.log(`  ${done}/${jobs.length} slices · ${out.size} unique (+${out.size - before})`)
}
writeFileSync(seedFile, JSON.stringify([...out.values()], null, 1))
console.log(`\ndone: ${before} -> ${out.size} (+${out.size - before} new)`)
