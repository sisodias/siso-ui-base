#!/usr/bin/env node
// Bridge between UI Base tenants and OpenDesign design-system packages.
//
// A tenant's dna.md and an OpenDesign DESIGN.md are the same asset in two
// formats: the taste rules for one project. This keeps them one source of
// truth rather than two files that drift.
//
// The hub is the owner. A tenant dna.md is authored here, exported outward.
// An imported design system lands as a new tenant, ready for the UI Box loop.
//
//   node opendesign/sync.mjs export oracle        # tenant -> design-system pkg
//   node opendesign/sync.mjs import <dir>         # design-system pkg -> tenant
//   node opendesign/sync.mjs status               # what exists, what drifted
//
// Export is idempotent: re-running rewrites the package from current dna.md.

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const TENANTS = join(ROOT, 'tenants')
const PKGS = join(HERE, 'design-systems')

const [cmd, arg] = process.argv.slice(2)
const exists = p => stat(p).then(() => true, () => false)
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Title and description come from optional front-matter in the tenant dna.md:
//
//   <!-- opendesign: title="SISO Oracle" description="One good sentence." -->
//
// Deriving them from the first heading and blockquote instead produced
// "Oracle cockpit DNA" and a description that opened mid-sentence with "The
// meta-rule:" — accurate to the file, useless on a marketplace card. The
// heading/quote are the fallback, not the primary source.
function summarise(md, fallback) {
  const fm = md.match(/<!--\s*opendesign:\s*(.+?)\s*-->/s)?.[1] ?? ''
  const field = k => fm.match(new RegExp(`${k}="([^"]+)"`))?.[1]

  const title = field('title')
    || md.match(/^#\s+(.+)$/m)?.[1]?.replace(/\s*[—-].*$/, '').trim()
    || fallback

  let desc = field('description')
  if (!desc) {
    const quote = md.match(/^>\s*(.+)$/m)?.[1]?.trim()
    const para = md.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('<!--'))
    desc = (quote || para || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\*/g, '').trim()
  }
  if (desc.length > 240) desc = desc.slice(0, 237) + '...'
  return { title, description: desc || `Design system for ${fallback}.` }
}

function manifest(name, title, description) {
  return {
    $schema: 'https://open-design.ai/schemas/plugin.v1.json',
    specVersion: '1.0.0',
    name: `design-system-${name}`,
    title,
    version: '0.1.0',
    description,
    license: 'Apache-2.0',
    tags: ['design-system', 'design', 'themed-unique'],
    od: {
      kind: 'scenario',
      taskKind: 'new-generation',
      mode: 'design-system',
      scenario: 'design',
      surface: 'web',
      useCase: {
        query: {
          en: `Generate a {{artifactKind}} using the ${title} design system. Stay faithful to its palette, typography, spacing and motion rules as documented in DESIGN.md.`,
        },
      },
      inputs: [
        { name: 'artifactKind', label: 'Artifact kind', type: 'select', options: ['dashboard', 'app screen', 'landing page', 'data panel'], default: 'dashboard' },
        { name: 'brief', label: 'Brief', type: 'text', placeholder: 'What should this screen do?' },
      ],
      context: { designSystem: { ref: name, primary: true }, assets: ['./DESIGN.md'] },
      pipeline: { stages: [{ id: 'generate', atoms: ['file-write', 'live-artifact'] }] },
      capabilities: ['prompt:inject', 'fs:write'],
    },
  }
}

async function doExport(tenant) {
  const dna = join(TENANTS, tenant, 'dna.md')
  if (!await exists(dna)) throw new Error(`no dna.md for tenant "${tenant}"`)
  const md = await readFile(dna, 'utf8')
  const name = slug(`siso-${tenant}`)
  const { title, description } = summarise(md, tenant)
  const out = join(PKGS, name)
  await mkdir(out, { recursive: true })

  // DESIGN.md is the tenant DNA verbatim — it IS the taste spec. Only a
  // provenance line is added so an outside reader knows where it came from.
  const header = `<!-- Generated from tenants/${tenant}/dna.md by opendesign/sync.mjs. Edit the tenant DNA, not this file. -->\n\n`
  await writeFile(join(out, 'DESIGN.md'), header + md)
  await writeFile(join(out, 'open-design.json'), JSON.stringify(manifest(name, title, description), null, 2) + '\n')
  console.log(`exported tenants/${tenant}/dna.md -> opendesign/design-systems/${name}/`)
  console.log(`  title: ${title}`)
  return name
}

async function doImport(dir) {
  const design = join(dir, 'DESIGN.md')
  if (!await exists(design)) throw new Error(`no DESIGN.md in ${dir}`)
  const md = await readFile(design, 'utf8')
  const name = slug(basename(dir))
  const dest = join(TENANTS, name)
  if (await exists(join(dest, 'dna.md'))) throw new Error(`tenant "${name}" already exists — refusing to overwrite`)
  await mkdir(join(dest, 'variations'), { recursive: true })
  await writeFile(join(dest, 'dna.md'), md)
  console.log(`imported ${dir} -> tenants/${name}/dna.md`)
  console.log(`  run: UIBASE_TENANT=tenants/${name} node app/serve.mjs`)
  return name
}

async function status() {
  const tenants = (await readdir(TENANTS).catch(() => []))
  const pkgs = (await readdir(PKGS).catch(() => []))
  console.log('tenants:')
  for (const t of tenants) {
    const has = await exists(join(TENANTS, t, 'dna.md'))
    const exported = pkgs.includes(slug(`siso-${t}`))
    console.log(`  ${t.padEnd(18)} dna.md ${has ? 'yes' : 'NO '}  exported ${exported ? 'yes' : 'no'}`)
  }
  console.log('design-system packages:')
  for (const p of pkgs) {
    const okD = await exists(join(PKGS, p, 'DESIGN.md'))
    const okM = await exists(join(PKGS, p, 'open-design.json'))
    console.log(`  ${p.padEnd(18)} DESIGN.md ${okD ? 'yes' : 'NO '}  manifest ${okM ? 'yes' : 'NO '}`)
  }
}

try {
  if (cmd === 'export') await doExport(arg || 'oracle')
  else if (cmd === 'import') await doImport(arg)
  else if (cmd === 'status') await status()
  else { console.error('usage: sync.mjs export <tenant> | import <dir> | status'); process.exit(1) }
} catch (e) {
  console.error(`error: ${e.message}`)
  process.exit(1)
}
