#!/usr/bin/env node
// Ingest the awesome-design-skills registry (MIT) into the hub.
//
// WHY GITHUB AND NOT typeui.sh
// The site sits behind a Vercel JS challenge — every fetch returns HTTP 429 with
// a "Security Checkpoint" body, so it is not scrapable and there is no reason to
// try: the skills themselves are open source under MIT at
// bergside/awesome-design-skills. Take them from the source, not the shop window.
//
// WHAT THESE ACTUALLY ARE — read before trusting them
// 67 skills, each a SKILL.md + DESIGN.md, plus a marketing preview PNG. They are
// TEMPLATE-GENERATED, not authored: every one lists all nine font weights
// (100-900), the shared Mission/Workflow/QA scaffolding is identical across all
// of them, and `retro` ships #3B82F6 — default Tailwind blue. What genuinely
// varies is the palette, the font pairing and the style adjectives.
//
// So this ingests them as REFERENCE STARTING POINTS, never as finished taste.
// Each lands with `quality: "template-generated"` so nothing downstream mistakes
// one for a hand-tuned DNA like tenants/oracle.
//
//   node registry/skills/ingest.mjs            # all 67 + previews
//   node registry/skills/ingest.mjs --no-images
//   node registry/skills/ingest.mjs --dry-run
//
// Idempotent: skips any skill already holding a meta.json.

import { mkdir, writeFile, readFile, stat, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'catalog')
const REPO = 'bergside/awesome-design-skills'
const RAW = `https://raw.githubusercontent.com/${REPO}/main`

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const IMAGES = !args.includes('--no-images')
const CONC = Number(process.env.CONC || 6)
const exists = p => stat(p).then(() => true, () => false)

async function gh(path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    headers: { 'user-agent': 'siso-ui-base', accept: 'application/vnd.github+json' },
  })
  if (!r.ok) throw new Error(`GitHub ${r.status} for ${path}`)
  return r.json()
}

async function raw(path, bin = false) {
  const r = await fetch(`${RAW}/${path}`, { headers: { 'user-agent': 'siso-ui-base' } })
  if (!r.ok) return null
  return bin ? Buffer.from(await r.arrayBuffer()) : r.text()
}

// Pull the fields that actually differ between skills. The prose scaffolding is
// identical everywhere, so indexing it would be noise.
function extract(md) {
  const one = re => md.match(re)?.[1]?.trim() ?? null
  const tokens = {}
  const tokenLine = one(/Tokens:\s*(.+)/)
  if (tokenLine) {
    for (const m of tokenLine.matchAll(/([a-z]+)=(#[0-9A-Fa-f]{3,8})/g)) tokens[m[1]] = m[2]
  }
  const fonts = {}
  const fontLine = one(/Fonts:\s*([^|]+)/)
  if (fontLine) {
    for (const m of fontLine.matchAll(/([a-z]+)=([^,|]+)/g)) fonts[m[1]] = m[2].trim()
  }
  return {
    description: one(/^description:\s*(.+)$/m),
    visualStyle: (one(/Visual style:\s*([^|\n]+)/) || '').split(',').map(s => s.trim()).filter(Boolean),
    typographyScale: one(/Typography scale:\s*([^|]+)/),
    spacing: one(/Spacing scale:\s*([^|\n]+)/),
    accessibility: one(/## Accessibility\n(.+)/),
    tone: one(/## Writing Tone\n(.+)/),
    tokens, fonts,
  }
}

const dirs = (await gh('skills')).filter(e => e.type === 'dir').map(e => e.name)
console.log(`${dirs.length} skills in ${REPO}${DRY ? ' (dry run)' : ''}`)
if (DRY) { console.log('  ' + dirs.join(' · ')); process.exit(0) }

await mkdir(OUT, { recursive: true })
let done = 0, skipped = 0, failed = 0, withImg = 0
const q = [...dirs]

await Promise.all(Array.from({ length: CONC }, async () => {
  while (q.length) {
    const name = q.shift()
    const dir = join(OUT, name)
    if (await exists(join(dir, 'meta.json'))) { skipped++; continue }
    try {
      const skill = await raw(`skills/${name}/SKILL.md`)
      if (!skill) throw new Error('no SKILL.md')
      const design = await raw(`skills/${name}/DESIGN.md`)
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'SKILL.md'), skill)
      if (design) await writeFile(join(dir, 'DESIGN.md'), design)

      const meta = {
        name, source: REPO, license: 'MIT', upstream: `https://www.typeui.sh/design-skills`,
        // These are template-generated, not authored taste. Anything consuming
        // this catalogue must treat them as starting points.
        quality: 'template-generated',
        ...extract(skill),
        files: ['SKILL.md', design ? 'DESIGN.md' : null].filter(Boolean),
      }

      if (IMAGES) {
        const png = await raw(`registry-examples/${name}-marketing.png`, true)
        if (png && png.length > 1000 && png[0] === 0x89 && png[1] === 0x50) {
          await writeFile(join(dir, 'preview.png'), png)
          meta.preview = 'preview.png'
          meta.files.push('preview.png')
          withImg++
        }
      }

      await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2))
      done++
    } catch (e) {
      failed++
      console.error(`  fail ${name}: ${String(e).slice(0, 70)}`)
    }
  }
}))

// one rolled-up index so a consumer never has to walk 67 folders
const index = []
for (const d of (await readdir(OUT)).sort()) {
  try { index.push(JSON.parse(await readFile(join(OUT, d, 'meta.json'), 'utf8'))) } catch {}
}
await writeFile(join(HERE, 'index.json'), JSON.stringify({
  source: REPO, license: 'MIT', count: index.length,
  note: 'Template-generated design skills. Reference starting points, not authored taste.',
  skills: index,
}, null, 2))

console.log(`new ${done} · skipped ${skipped} · failed ${failed} · previews ${withImg}`)
console.log(`-> ${OUT} and index.json (${index.length} skills)`)
