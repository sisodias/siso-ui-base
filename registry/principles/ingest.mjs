#!/usr/bin/env node
// Ingest the design-principles layer from bergside/typeui (MIT).
//
// WHY THIS IS A SEPARATE REPO FROM registry/skills
// bergside/typeui is the CLI; bergside/awesome-design-skills is the registry it
// pulls from — typeui's own REGISTRY.md states the CLI reads
// `awesome-design-skills/main/skills/index.json`. So registry/skills ingesting
// from awesome-design-skills was the right source for the 67 style skills.
//
// But the CLI repo carries something the registry does NOT: skills/fundamentals,
// ~280KB of universal design principles that exist nowhere in the 67.
//
// AND THESE ARE A DIFFERENT CLASS OF THING. The 67 style skills are
// template-generated — identical scaffolding, all nine font weights, Tailwind
// defaults. The fundamentals are genuinely written: they carry formulas
// (nested radius: innerRadius + distance = outerRadius), a mandatory
// application order, and explicit reasoning for each rule. They are the
// "why" layer that the style skills lack.
//
//   node registry/principles/ingest.mjs
//   node registry/principles/ingest.mjs --dry-run
//
// Idempotent: re-running refetches and overwrites, which is what you want for
// upstream docs that get edited in place.

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'catalog')
const REPO = 'bergside/typeui'
const RAW = `https://raw.githubusercontent.com/${REPO}/main`
const SRC = 'skills/fundamentals'

const DRY = process.argv.includes('--dry-run')

async function gh(path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    headers: { 'user-agent': 'siso-ui-base', accept: 'application/vnd.github+json' },
  })
  if (!r.ok) throw new Error(`GitHub ${r.status} for ${path}`)
  return r.json()
}

const files = (await gh(SRC)).filter(e => e.type === 'file' && e.name.endsWith('.md'))
console.log(`${files.length} principle files in ${REPO}/${SRC}${DRY ? ' (dry run)' : ''}`)
for (const f of files) console.log(`  ${String(Math.round(f.size / 1024)).padStart(4)}KB  ${f.name}`)
if (DRY) process.exit(0)

await mkdir(OUT, { recursive: true })

// Pull the headings so the index says what each file actually covers — these
// documents are far too large to read into an agent's context whole.
//
// Note the headings ARE numbered (`1.2 Vertical rhythm`). An earlier version
// filtered those out as noise and reported typography-principles.md as having
// 1 section when it has 47 — the numbering is the outline, not clutter.
function outline(md) {
  return [...md.matchAll(/^##+\s+(.+)$/gm)]
    .map(m => m[1].trim())
    .filter(h => h && !/^0\./.test(h))   // drop only the "0. How agents must use this" preamble
}
function summary(md) {
  const q = md.match(/^>\s*([\s\S]+?)\n\n/m)?.[1]
  return q ? q.replace(/\n>?\s*/g, ' ').replace(/\*\*/g, '').replace(/`/g, '').trim().slice(0, 400) : null
}

const index = []
for (const f of files) {
  const r = await fetch(`${RAW}/${SRC}/${f.name}`, { headers: { 'user-agent': 'siso-ui-base' } })
  if (!r.ok) { console.error(`  fail ${f.name}: HTTP ${r.status}`); continue }
  const md = await r.text()
  await writeFile(join(OUT, f.name), md)
  const heads = outline(md)
  index.push({
    file: f.name,
    path: join('registry/principles/catalog', f.name),
    bytes: md.length,
    lines: md.split('\n').length,
    summary: summary(md),
    sections: heads,
    sectionCount: heads.length,
  })
  console.log(`  ${f.name} — ${heads.length} sections, ${Math.round(md.length / 1024)}KB`)
}

await writeFile(join(HERE, 'index.json'), JSON.stringify({
  source: REPO, path: SRC, license: 'MIT',
  note: 'Universal design principles — the reasoning layer. Authored, not template-generated (contrast registry/skills). Files are large; query sections rather than reading whole.',
  totalBytes: index.reduce((s, f) => s + f.bytes, 0),
  files: index,
}, null, 2))

console.log(`\n${index.length} files, ${Math.round(index.reduce((s, f) => s + f.bytes, 0) / 1024)}KB total`)
console.log('-> registry/principles/catalog and index.json')
