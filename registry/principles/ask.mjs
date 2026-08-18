#!/usr/bin/env node
// Query the design-principles layer without loading 271KB into context.
//
// These six files hold 334 sections. Reading even one whole (ui-principles.md
// is 96KB) would blow an agent's budget for no benefit — almost always the
// answer is one section. So: search headings and body, return the matching
// SECTION only.
//
//   node registry/principles/ask.mjs "nested radius"
//   node registry/principles/ask.mjs contrast --file accessibility
//   node registry/principles/ask.mjs --list              # every section heading
//   node registry/principles/ask.mjs "focus" --json
//
// Ranking: a heading hit outranks a body hit, then more body hits wins.

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (n, d) => args.includes(n) ? args[args.indexOf(n) + 1] : d
const JSON_OUT = args.includes('--json')
const LIST = args.includes('--list')
const FILE = flag('--file', null)
const LIMIT = Number(flag('--limit', 4))
const query = args.filter((a, i) => !a.startsWith('--') && !['--file', '--limit'].includes(args[i - 1])).join(' ').trim()

const idx = JSON.parse(await readFile(join(HERE, 'index.json'), 'utf8'))

// Split a document into {heading, body} at every ## / ### boundary.
async function sections(file) {
  const md = await readFile(join(HERE, 'catalog', file), 'utf8')
  const out = []
  const lines = md.split('\n')
  let cur = null
  for (const line of lines) {
    const h = line.match(/^(##+)\s+(.+)$/)
    if (h) {
      if (cur) out.push(cur)
      cur = { heading: h[2].trim(), level: h[1].length, body: [] }
    } else if (cur) cur.body.push(line)
  }
  if (cur) out.push(cur)
  return out.map(s => ({ ...s, body: s.body.join('\n').trim() }))
}

if (LIST) {
  for (const f of idx.files) {
    console.log(`\n${f.file}  (${f.sectionCount} sections, ${Math.round(f.bytes / 1024)}KB)`)
    for (const s of f.sections) console.log(`   ${s}`)
  }
  process.exit(0)
}

if (!query) {
  console.log(`${idx.files.length} files · ${idx.files.reduce((s, f) => s + f.sectionCount, 0)} sections · ${Math.round(idx.totalBytes / 1024)}KB`)
  for (const f of idx.files) console.log(`  ${String(f.sectionCount).padStart(4)}  ${f.file}`)
  console.log(`\nusage: ask.mjs "<query>" [--file <name>] [--limit n] [--json] | --list`)
  process.exit(1)
}

// Match on ALL terms independently rather than the literal phrase. Searching
// the exact string missed "Nested border radius must be calculated" for the
// query "nested radius" — the words are there, the phrase is not.
const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const count = (text, t) => (text.match(new RegExp(esc(t), 'g')) || []).length

const hits = []
for (const f of idx.files) {
  if (FILE && !f.file.includes(FILE)) continue
  for (const s of await sections(f.file)) {
    const head = s.heading.toLowerCase()
    const body = s.body.toLowerCase()
    // every term must appear somewhere in the section, else it is not a match
    if (!terms.every(t => head.includes(t) || body.includes(t))) continue
    const inHeading = terms.filter(t => head.includes(t)).length
    const bodyHits = terms.reduce((n, t) => n + count(body, t), 0)
    // all terms in the heading is the strongest signal; partial heading next
    const exact = head.includes(query.toLowerCase()) ? 5000 : 0
    hits.push({
      file: f.file, heading: s.heading, level: s.level, body: s.body,
      score: exact + inHeading * 1000 + bodyHits,
    })
  }
}
hits.sort((a, b) => b.score - a.score)
const out = hits.slice(0, LIMIT)

if (JSON_OUT) {
  console.log(JSON.stringify({ query, matched: hits.length, returned: out.length, results: out }, null, 2))
} else if (!out.length) {
  console.log(`no section matches "${query}"`)
} else {
  console.log(`${hits.length} sections match "${query}" — top ${out.length}\n`)
  for (const h of out) {
    console.log(`${'─'.repeat(70)}\n${h.heading}   [${h.file}]\n`)
    console.log(h.body.length > 1800 ? h.body.slice(0, 1800) + '\n  … (truncated — open the file for the rest)' : h.body)
    console.log()
  }
}
