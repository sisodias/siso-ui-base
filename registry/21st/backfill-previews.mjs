#!/usr/bin/env node
// Recover previews for harvested components that have none.
//
// harvest.mjs only looked for a CDN url keyed by `preview_url` in the flight
// payload. That misses two cases, both confirmed live:
//
//   1. Pages that reference the image ALREADY wrapped in the Cloudflare
//      resizer path (cdn-cgi/image/...), so the bare-key lookup never matched.
//   2. Components with no CDN image at all — but 21st renders a card for every
//      component at /api/og/component/<author>/<slug>, which always returns a
//      real PNG. That is a universal fallback.
//
// Tiers, in order: existing meta.previewUrl -> page CDN image -> og endpoint.
//
//   node backfill-previews.mjs            # all missing
//   node backfill-previews.mjs --dry-run
//
// Idempotent: only touches components with no preview file on disk.

import { readdir, readFile, writeFile, stat } from 'node:fs/promises'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve paths against this file, not the caller's cwd, so the script works
// from the repo root and from CI — not only from its own directory.
const HERE = dirname(fileURLToPath(import.meta.url))
const R = p => join(HERE, p)


const DRY = process.argv.includes('--dry-run')
const CONC = Number(process.env.CONC || 6)
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; siso-ui-base harvester)' }
const small = u => `https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=auto/${u}`

const has = p => stat(p).then(() => true, () => false)

async function buf(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const b = Buffer.from(await r.arrayBuffer())
      if (b.length < 200) throw new Error('too small')
      return b
    } catch (e) { if (i === tries - 1) return null }
  }
}

// Name by actual magic bytes — the URL extension routinely lies (a .png url
// serves WebP; some serve AVIF or animated GIF).
const ext = b =>
    (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') ? 'webp'
  : (b[0] === 0xFF && b[1] === 0xD8) ? 'jpg'
  : (b.slice(0, 3).toString() === 'GIF') ? 'gif'
  : (b.slice(4, 8).toString() === 'ftyp' && b.slice(8, 12).toString().startsWith('avif')) ? 'avif'
  : 'png'

// find components with no preview file
const todo = []
for (const d of (await readdir(R('harvest'))).filter(x => x.includes('__'))) {
  let m
  try { m = JSON.parse(await readFile(R(`harvest/${d}/meta.json`), 'utf8')) } catch { continue }
  let found = false
  for (const e of ['webp', 'png', 'jpg', 'gif', 'avif']) {
    if (await has(R(`harvest/${d}/preview.${e}`))) { found = true; break }
  }
  if (found) continue
  todo.push({ d, m })
}
console.log(`${todo.length} components without a preview${DRY ? ' (dry run)' : ''}`)
if (DRY) { todo.slice(0, 10).forEach(t => console.log('  ', t.d)); process.exit(0) }

const tally = { metaUrl: 0, pageCdn: 0, ogCard: 0, failed: 0 }
const q = [...todo]
await Promise.all(Array.from({ length: CONC }, async () => {
  while (q.length) {
    const { d, m } = q.shift()
    let b = null, via = null

    if (m.previewUrl) { b = await buf(small(m.previewUrl)); if (b) via = 'metaUrl' }

    if (!b) {
      try {
        const html = await (await fetch(m.url, { headers: UA })).text()
        const imgs = [...new Set([...html.matchAll(/https:\\?\/\\?\/cdn\.21st\.dev\\?\/[^"\\\s]+?\.(?:webp|png|jpe?g|avif)/g)].map(x => x[0].replace(/\\/g, '')))]
        if (imgs[0]) { b = await buf(imgs[0]); if (b) via = 'pageCdn' }
      } catch {}
    }

    if (!b) { b = await buf(`https://21st.dev/api/og/component/${m.author}/${m.slug}`); if (b) via = 'ogCard' }

    if (!b) { tally.failed++; continue }
    await writeFile(R(`harvest/${d}/preview.${ext(b)}`), b)
    const meta = JSON.parse(await readFile(R(`harvest/${d}/meta.json`), 'utf8'))
    meta.preview = `preview.${ext(b)}`
    meta.previewVia = via
    meta.harvested = [...new Set([...(meta.harvested || []), 'preview'])]
    await writeFile(R(`harvest/${d}/meta.json`), JSON.stringify(meta, null, 2))
    tally[via]++
  }
}))
console.log(`recovered: metaUrl ${tally.metaUrl} · pageCdn ${tally.pageCdn} · ogCard ${tally.ogCard} · failed ${tally.failed}`)
