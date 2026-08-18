#!/usr/bin/env node
// Harvest the NON-component product types: themes, templates, shaders, ascii,
// gradients, library.
//
// These are a different shape to components. Their pages are client-rendered:
// there is no bundle_html_url, no demo_code, and no cdn preview in the server
// HTML. What IS server-rendered is the OpenGraph card — title, description and
// an og:image — so that is what we cache, giving the board a real thumbnail and
// searchable text per item.
//
//   node harvest-extras.mjs            # all kinds
//   node harvest-extras.mjs --kind themes
//   node harvest-extras.mjs --no-images
//
// Idempotent: skips anything already holding a meta.json.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'extras')
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; siso-ui-base harvester)' }
const args = process.argv.slice(2)
const ONLY = args.includes('--kind') ? args[args.indexOf('--kind') + 1] : null
const IMAGES = !args.includes('--no-images')
const CONC = Number(process.env.CONC || 6)

const exists = p => access(p).then(() => true, () => false)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function get(url, bin = false, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA })
      if (r.status === 429) { await sleep(2000 * (i + 1)); continue }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return bin ? Buffer.from(await r.arrayBuffer()) : await r.text()
    } catch (e) { if (i === tries - 1) throw e; await sleep(600 * (i + 1)) }
  }
}

const attr = (h, re) => h.match(re)?.[1] ?? null
const decode = s => s ? s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : null

async function one(kind, url) {
  const parts = url.replace('https://21st.dev/', '').split('/')
  const slug = parts[parts.length - 1]
  const owner = parts[0].startsWith('@') ? parts[0].replace('@', '') : 'community'
  const id = `${owner}__${slug}`.slice(0, 180)
  const dir = join(OUT, kind, id)
  if (await exists(join(dir, 'meta.json'))) return 'skip'

  const html = await get(url)
  if (html.includes('NEXT_HTTP_ERROR_FALLBACK;404') || html.includes('content="noindex"')) return 'dead'

  await mkdir(dir, { recursive: true })
  const ogImage = attr(html, /property="og:image" content="([^"]+)"/)
  const meta = {
    id, kind, owner, slug, url,
    title: decode(attr(html, /property="og:title" content="([^"]+)"/) || attr(html, /<title>([^<]+)<\/title>/)),
    description: decode(attr(html, /property="og:description" content="([^"]+)"/) || attr(html, /name="description" content="([^"]+)"/)),
    ogImage,
  }

  if (IMAGES && ogImage) {
    try {
      const abs = ogImage.startsWith('http') ? ogImage : `https://21st.dev${ogImage}`
      const buf = await get(abs, true)
      // The .png URL often serves WebP — name the file by actual content.
      const ext = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP' ? 'webp'
        : buf[0] === 0xFF && buf[1] === 0xD8 ? 'jpg'
        : buf.slice(0, 3).toString() === 'GIF' ? 'gif'
        : buf.slice(4, 8).toString() === 'ftyp' && buf.slice(8, 12).toString().startsWith('avif') ? 'avif'
        : 'png'
      await writeFile(join(dir, `preview.${ext}`), buf)
      meta.preview = `preview.${ext}`
      meta.harvested = ['preview']
    } catch { meta.harvested = [] }
  } else meta.harvested = []

  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2))
  return 'new'
}

const all = JSON.parse(await readFile(join(HERE, 'non-component-urls.json'), 'utf8'))
const kinds = ONLY ? [ONLY] : Object.keys(all)
for (const kind of kinds) {
  const urls = (all[kind] || []).filter(u => u.split('/').filter(Boolean).length >= 4) // skip browse pages
  if (!urls.length) { console.log(`${kind}: no item urls`); continue }
  let n = 0, dead = 0, skip = 0, fail = 0
  const q = [...urls]
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (q.length) {
      const u = q.shift()
      try {
        const r = await one(kind, u)
        if (r === 'new') n++; else if (r === 'dead') dead++; else skip++
      } catch { fail++ }
    }
  }))
  console.log(`${kind.padEnd(10)} ${String(urls.length).padStart(4)} urls -> new ${n} · skip ${skip} · dead ${dead} · fail ${fail}`)
}
console.log(`-> ${OUT}`)
