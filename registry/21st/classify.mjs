#!/usr/bin/env node
// Build the classification index for the harvested corpus.
//
// WHERE THE TAXONOMY COMES FROM
// 21st does not expose a category field — not on the component page, not in the
// authenticated /api/search result. What it does have is 75 official tags,
// each with a browse page at /community/components/s/<tag> listing that tag's
// members. That listing IS the classification, straight from 21st.
//
// This is deliberately NOT the old approach. catalog.json's `category` was
// just the search term used to find the component, which is why ranked.json
// carries 114+ "miscategorised: searched as ui, actually other" flags. A tag
// page is ground truth; a search query is a guess.
//
// Components are multi-tag: 47.4% carry more than one, so this writes a FACETED
// index (component -> [tags], tag -> [components]) rather than forcing each
// component into one folder.
//
//   node classify.mjs
//   node classify.mjs --tags hero,pricing-section   # refresh a subset
//
// Output: classification.json

import { readdir, readFile, writeFile } from 'node:fs/promises'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve paths against this file, not the caller's cwd, so the script works
// from the repo root and from CI — not only from its own directory.
const HERE = dirname(fileURLToPath(import.meta.url))
const R = p => join(HERE, p)


const UA = { 'user-agent': 'Mozilla/5.0 (compatible; siso-ui-base harvester)' }
const CONC = Number(process.env.CONC || 6)
const args = process.argv.slice(2)
const ONLY = args.includes('--tags') ? args[args.indexOf('--tags') + 1].split(',') : null

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA })
      if (r.status === 429) { await new Promise(s => setTimeout(s, 2000 * (i + 1))); continue }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.text()
    } catch (e) { if (i === tries - 1) throw e }
  }
}

// discover the official tag list from the components index
const index = await get('https://21st.dev/community/components')
const tags = ONLY || [...new Set([...index.matchAll(/\\?\/community\\?\/components\\?\/s\\?\/([\w\-]+)/g)].map(m => m[1]))].sort()
console.log(`${tags.length} official tags`)

const tagToComponents = {}
let done = 0
const q = [...tags]
await Promise.all(Array.from({ length: CONC }, async () => {
  while (q.length) {
    const t = q.shift()
    try {
      const html = await get(`https://21st.dev/community/components/s/${t}`)
      const members = [...new Set([...html.matchAll(/\\?\/(@[\w.\-]+)\\?\/components\\?\/([\w\-]+)/g)]
        .map(m => `https://21st.dev/${m[1]}/components/${m[2]}`))]
      tagToComponents[t] = members
    } catch (e) {
      tagToComponents[t] = []
      console.error(`  fail ${t}: ${String(e).slice(0, 60)}`)
    }
    if (++done % 15 === 0) console.log(`  ${done}/${tags.length} tags`)
  }
}))

// invert: component url -> tags
const componentToTags = {}
for (const [tag, urls] of Object.entries(tagToComponents)) {
  for (const u of urls) (componentToTags[u] ||= []).push(tag)
}

// join against what we actually harvested, and carry usage_count through so
// the index can rank as well as filter
const harvested = {}
for (const d of (await readdir(R('harvest'))).filter(x => x.includes('__'))) {
  try {
    const m = JSON.parse(await readFile(R(`harvest/${d}/meta.json`), 'utf8'))
    harvested[m.url] = { id: m.id, name: m.name, description: m.description, usage_count: m.usage_count ?? null, preview: m.preview ?? 'preview.webp' }
  } catch {}
}

const tagged = Object.keys(componentToTags).filter(u => harvested[u])
const untagged = Object.keys(harvested).filter(u => !componentToTags[u])
const multi = tagged.filter(u => componentToTags[u].length > 1)

const out = {
  generated: 'run classify.mjs to refresh',
  taxonomy: tags,
  stats: {
    tags: tags.length,
    harvested: Object.keys(harvested).length,
    tagged: tagged.length,
    untagged: untagged.length,
    multiTag: multi.length,
  },
  tagCounts: Object.fromEntries(Object.entries(tagToComponents)
    .map(([t, u]) => [t, u.filter(x => harvested[x]).length]).sort((a, b) => b[1] - a[1])),
  componentToTags,
  tagToComponents,
}
await writeFile(R('classification.json'), JSON.stringify(out, null, 2))

console.log(`\nharvested   ${out.stats.harvested}`)
console.log(`tagged      ${out.stats.tagged}`)
console.log(`untagged    ${out.stats.untagged}`)
console.log(`multi-tag   ${out.stats.multiTag}`)
console.log('-> classification.json')
