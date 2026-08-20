#!/usr/bin/env node
// The one entry point. Turns "build me a pricing section" into a single brief
// that pulls every layer together, so an agent runs ONE command instead of
// knowing thirteen.
//
// WHY THIS EXISTS
// The hub grew four independent tools — components, palettes, principles,
// tenant DNA. Each is useful alone, but an agent had to know all of them, in
// the right order, and join the results itself. That is not a system, it is a
// toolbox. This is the layer that makes them one thing.
//
// WHAT IT ASSEMBLES, in the order the principles themselves mandate:
//   1. DNA        the tenant's taste rules — the authority, always first
//   2. COMPONENTS real reference implementations, with local preview paths
//   3. PRINCIPLES the reasoning that applies to THIS component type
//   4. PALETTE    only when the tenant has no DNA (a starting point, not an override)
//
// The order is not arbitrary: ui-principles.md states it — design-system tokens
// ship first, principles refine a compliant design and never override a token.
//
//   node brief.mjs "pricing section"
//   node brief.mjs hero --tenant oracle --limit 4
//   node brief.mjs "testimonial card" --json      # for agents
//
// Output is deliberately compact — paths, not payloads. The agent opens the
// preview images and reads the one bundle it chooses.

import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const R = p => join(HERE, p)
const exists = p => stat(p).then(() => true, () => false)

const args = process.argv.slice(2)
const flag = (n, d) => args.includes(n) ? args[args.indexOf(n) + 1] : d
const JSON_OUT = args.includes('--json')
const TENANT = flag('--tenant', 'oracle')
const LIMIT = Number(flag('--limit', 4))
const query = args.filter((a, i) => !a.startsWith('--') && !['--tenant', '--limit'].includes(args[i - 1])).join(' ').trim()

if (!query) {
  console.error('usage: brief.mjs "<what you are building>" [--tenant x] [--limit n] [--json]')
  process.exit(1)
}

const node = process.execPath
const tryRun = async (script, argv) => {
  try { return (await run(node, [R(script), ...argv], { maxBuffer: 1e8 })).stdout } catch { return null }
}

// ---- 1. DNA: the tenant's taste rules, and the authority over everything else
const dnaPath = join('tenants', TENANT, 'dna.md')
const hasDna = await exists(R(dnaPath))
let dna = null
if (hasDna) {
  const md = await readFile(R(dnaPath), 'utf8')
  // the self-audit is the highest-value slice — it is the checklist form of the
  // whole document, and it is what an agent should verify against at the end
  const audit = md.match(/#{2,3}[^\n]*(?:self-audit|checklist)[^\n]*\n([\s\S]+?)(?=\n#{1,3}\s|$)/i)?.[1]?.trim()
  dna = {
    path: dnaPath,
    bytes: md.length,
    rules: (md.match(/^[-*|]/gm) || []).length,
    selfAudit: audit ? audit.split('\n').filter(l => l.trim()).slice(0, 10) : null,
  }
}

// ---- 2. COMPONENTS: real reference, ranked.
// Try the whole phrase first, then fall back to single words. A brief is
// written the way a person speaks ("glassmorphism dashboard"), and the corpus
// indexes single tags — the full phrase returned 0 results while both of its
// words match hundreds.
const searchComponents = async () => {
  const attempts = [query, ...query.split(/\s+/).filter(w => w.length > 2).reverse()]
  for (const attempt of attempts) {
    const raw = await tryRun('registry/21st/find.mjs', [attempt, '--limit', String(LIMIT), '--json'])
    if (!raw) continue
    try {
      const rows = JSON.parse(raw).results || []
      if (rows.length) return { matchedOn: attempt, rows }
    } catch {}
  }
  return { matchedOn: null, rows: [] }
}
const { matchedOn: componentQuery, rows: compRows } = await searchComponents()
const components = compRows.map(r => ({
  id: r.id, author: r.author, slug: r.slug, installs: r.installs,
  tags: r.tags, preview: r.preview, bundle: r.bundle,
}))

// ---- 3. PRINCIPLES: the reasoning that applies to what is being built.
// Query by the component's own tags, not the raw phrase — the tags are the
// vocabulary the principles are written in ("card", "hero", "form"), whereas a
// user's phrasing ("testimonial card thing") often is not.
const tagPool = [...new Set(components.flatMap(c => c.tags || []))]
const principleQueries = [...new Set([query, ...tagPool.slice(0, 3)])]
const principles = []
for (const q of principleQueries) {
  const raw = await tryRun('registry/principles/ask.mjs', [q, '--limit', '2', '--json'])
  if (!raw) continue
  try {
    for (const r of JSON.parse(raw).results || []) {
      if (principles.some(p => p.heading === r.heading)) continue
      principles.push({ heading: r.heading, file: r.file, matchedOn: q, excerpt: r.body.slice(0, 240).replace(/\n+/g, ' ') })
    }
  } catch {}
}

// ---- 3b. PRECEDENT: what this project already judged.
// The strongest signal available, and it was going unread. A critique saying a
// past variation lost to "AI-default pill stacking" is worth more than any
// generic principle, because a human already ruled on it for THIS product.
let precedent = null
const precRaw = await tryRun('precedent.mjs', ['--json'])
if (precRaw) {
  try {
    const p = JSON.parse(precRaw)
    const mine = p.records.filter(r => r.tenant === TENANT)
    if (mine.length) {
      precedent = {
        judged: mine.length,
        blessed: mine.filter(r => r.blessed).map(r => ({ id: `${r.setId}/${r.id}`, html: r.html, overall: r.overall })),
        weakestAxes: p.lessons.weakestAxes.slice(0, 3),
        rejections: p.lessons.rejections.slice(0, 4),
      }
    }
  } catch {}
}

// ---- 4. PALETTE: only when there is no DNA. With a DNA the palette is already
// decided, and offering alternatives would invite an agent to contradict it.
let palette = null
if (!hasDna) {
  const raw = await tryRun('registry/skills/palette.mjs', ['--style', query.split(' ')[0], '--json'])
  if (raw) {
    try {
      palette = (JSON.parse(raw).results || []).slice(0, 3)
        .map(r => ({ name: r.name, primary: r.primary, font: r.font, preview: r.preview }))
    } catch {}
  }
}

// NOT DOING numeric conflict detection. It was tried and it is unreliable in
// both directions: the Oracle DNA literally contains the string "16px" (in the
// meta-rule listing round values to AVOID), and its real type scale is unitless
// — `13` for body, not `13px`. So px-matching both false-positives and
// false-negatives on the one case it was written for.
//
// The precedence does not need detecting anyway, because it is absolute and
// the principles state it themselves: "if a principle and a design-system rule
// conflict, the design system wins. Flag the conflict for review." The brief
// says so once, in the workflow, and that is enough.

const brief = {
  building: query,
  tenant: TENANT,
  authority: hasDna ? dnaPath : 'NO DNA — pick a palette direction first, then write one',
  dna,
  components: components.slice(0, LIMIT),
  componentQuery,
  precedent,
  principles: principles.slice(0, 6),
  palette,
  workflow: [
    hasDna ? `1. Read ${dnaPath} — it is the authority; every value below defers to it.`
           : `1. No tenant DNA. Choose a palette direction below, then author tenants/${TENANT}/dna.md.`,
    '2. OPEN THE PREVIEW IMAGES of the candidate components. Do not choose from descriptions.',
    '3. Read the bundle of the one you pick — it is compiled but complete.',
    '4. Rebuild it against the DNA. Adapt, never paste.',
    ...(precedent ? ['4b. Read the blessed HTML — it is the bar. Do not repeat a rejection listed below.'] : []),
    '5. Principles below decide what the DNA leaves unsaid. Where they disagree with the DNA, THE DNA WINS — say so rather than silently following either.',
    hasDna ? '6. Run the DNA self-audit before you finish.' : '6. Write the self-audit into the new DNA.',
  ],
}

if (JSON_OUT) { console.log(JSON.stringify(brief, null, 2)); process.exit(0) }

const line = '─'.repeat(72)
console.log(`\n${line}\nBRIEF: ${query}    tenant: ${TENANT}\n${line}`)
console.log(`\nAUTHORITY  ${brief.authority}`)
if (dna) console.log(`           ${dna.rules} rules, ${Math.round(dna.bytes / 1024)}KB`)

console.log(`\nCOMPONENTS (${components.length})${componentQuery && componentQuery !== query ? ` — matched on "${componentQuery}"` : ''} — open the previews, do not pick from text`)
for (const c of brief.components) {
  console.log(`  ${c.installs != null ? String(c.installs).padStart(6) : '     ·'}  ${c.author}/${c.slug}`)
  console.log(`          ${c.preview}`)
}
if (!components.length) console.log('  (none matched — try a broader term or a tag from find.mjs --tags)')

console.log(`\nPRINCIPLES (${brief.principles.length}) — what the DNA leaves unsaid`)
for (const p of brief.principles) {
  console.log(`  ${p.heading}  [${p.file}]`)
  console.log(`     ${p.excerpt}…`)
}

if (precedent) {
  console.log(`\nPRECEDENT — this project has already judged ${precedent.judged} variation(s)`)
  for (const b of precedent.blessed) console.log(`  BLESSED ${b.overall}  ${b.html}`)
  if (precedent.weakestAxes.length) {
    console.log(`  keeps failing on: ${precedent.weakestAxes.map(([a, n]) => `${a} (${n}x)`).join(', ')}`)
  }
  for (const r of precedent.rejections) console.log(`  rejected ${r.id}: ${r.why}`)
}

if (palette?.length) {
  console.log(`\nPALETTE — no DNA yet, so pick a direction`)
  for (const p of palette) console.log(`  ${p.primary}  ${p.name.padEnd(16)} ${p.font}`)
}

console.log(`\nWORKFLOW`)
for (const w of brief.workflow) console.log(`  ${w}`)
if (dna?.selfAudit) {
  console.log(`\nSELF-AUDIT (from ${dnaPath})`)
  for (const a of dna.selfAudit) console.log(`  ${a}`)
}
console.log()
