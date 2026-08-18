#!/usr/bin/env node
// Query the design-skill catalogue as a palette + type-pairing reference.
//
// The skills' prose is boilerplate — identical Mission/Workflow/QA scaffolding
// in all 67. What genuinely varies, and what is therefore worth querying, is
// the palette (49 distinct primaries) and the font pairing (38 distinct), each
// with a rendered preview PNG showing how it looks applied.
//
// So this is the "which colours go together" layer: pick a direction visually,
// take its tokens, then write real taste rules yourself.
//
//   node registry/skills/palette.mjs                  # every skill, one line each
//   node registry/skills/palette.mjs --style glass    # filter on style adjectives
//   node registry/skills/palette.mjs --near '#ff0069' # nearest palettes to a hex
//   node registry/skills/palette.mjs --font Inter
//   node registry/skills/palette.mjs --json
//
// Preview paths are repo-relative so an agent can open the image directly.

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (n, d) => args.includes(n) ? args[args.indexOf(n) + 1] : d
const JSON_OUT = args.includes('--json')
const STYLE = flag('--style', null)
const NEAR = flag('--near', null)
const FONT = flag('--font', null)

const idx = JSON.parse(await readFile(join(HERE, 'index.json'), 'utf8'))

const hex2rgb = h => {
  const s = h.replace('#', '')
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16))
}
// Weighted euclidean in RGB — good enough to rank "which of these is closest",
// which is all this needs to do. Not a perceptual metric.
const dist = (a, b) => {
  const [r1, g1, b1] = hex2rgb(a), [r2, g2, b2] = hex2rgb(b)
  const rm = (r1 + r2) / 2
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
}

let rows = idx.skills.map(s => ({
  name: s.name,
  primary: s.tokens?.primary ?? null,
  tokens: s.tokens ?? {},
  font: s.fonts?.primary ?? null,
  fonts: s.fonts ?? {},
  style: s.visualStyle ?? [],
  description: s.description ?? '',
  preview: s.preview ? join('registry/skills/catalog', s.name, s.preview) : null,
  skill: join('registry/skills/catalog', s.name, 'SKILL.md'),
  quality: s.quality,
}))

if (STYLE) {
  const q = STYLE.toLowerCase()
  rows = rows.filter(r => r.style.some(s => s.toLowerCase().includes(q)) || r.name.includes(q))
}
if (FONT) {
  const q = FONT.toLowerCase()
  rows = rows.filter(r => Object.values(r.fonts).some(f => f.toLowerCase().includes(q)))
}
if (NEAR) {
  const target = NEAR.startsWith('#') ? NEAR : `#${NEAR}`
  rows = rows.filter(r => r.primary)
    .map(r => ({ ...r, distance: Math.round(dist(target, r.primary)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12)
}

if (JSON_OUT) {
  console.log(JSON.stringify({ count: rows.length, note: idx.note, results: rows }, null, 2))
} else {
  console.log(`${rows.length} skills${NEAR ? ` nearest ${NEAR}` : ''}${STYLE ? ` matching "${STYLE}"` : ''}${FONT ? ` using "${FONT}"` : ''}\n`)
  for (const r of rows) {
    const d = r.distance != null ? `Δ${String(r.distance).padStart(4)}  ` : ''
    console.log(`${d}${(r.primary || '       ').padEnd(8)} ${r.name.padEnd(16)} ${(r.font || '').padEnd(22)} ${r.style.slice(0, 3).join(', ')}`)
    if (r.preview) console.log(`         ${r.preview}`)
  }
  console.log(`\n${idx.note}`)
}
