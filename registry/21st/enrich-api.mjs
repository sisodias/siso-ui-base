#!/usr/bin/env node
// Enrich the harvested corpus with authenticated /api/search metadata.
//
// The key does NOT unlock source: /r/<author>/<slug> is metered at 2/day on the
// free plan (403 retrieval_limit_reached). What it does give, free and at
// ~1M requests, is per-component metadata the public page does not expose:
//
//   usage_count  — real popularity (how many times it was installed)
//   demo_id      — stable id
//   video_url    — preview video where one exists
//
// Note /api/search is a SEMANTIC search with a relevance cutoff, not an
// enumerator: `total` is unstable across queries and an empty query is
// rejected. So we drive it from queries.txt and merge by component URL.
//
//   API_KEY_21ST=... node enrich-api.mjs
//
// Idempotent: re-running refreshes usage_count in place.

import { readFile, writeFile, readdir } from 'node:fs/promises'

const KEY = process.env.API_KEY_21ST
if (!KEY) { console.error('API_KEY_21ST not set (source: .env.21st)'); process.exit(1) }

const H = { 'user-agent': 'siso-ui-base', 'content-type': 'application/json', 'x-api-key': KEY }
const PER_PAGE = 100

async function search(q, page) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://21st.dev/api/search', {
        method: 'POST', headers: H, body: JSON.stringify({ search: q, page, per_page: PER_PAGE }),
      })
      if (r.status === 429) { await new Promise(s => setTimeout(s, 2000 * (i + 1))); continue }
      return await r.json()
    } catch (e) { if (i === 2) throw e }
  }
}

// queries.txt is `category|query` — send only the query half.
const queries = [...new Set((await readFile('queries.txt', 'utf8'))
  .split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  .map(s => (s.includes('|') ? s.slice(s.indexOf('|') + 1) : s).trim())
  .filter(Boolean))]
console.log(`driving ${queries.length} queries at per_page=${PER_PAGE}`)

const byUrl = new Map()
let requests = 0, remaining = null
for (const q of queries) {
  for (let page = 1; page <= 3; page++) {
    const j = await search(q, page)
    requests++
    remaining = j?.metadata?.requests_remaining ?? remaining
    const rows = j?.results || []
    for (const r of rows) {
      const cd = r.component_data || {}, u = r.component_user_data || {}
      const author = u.username
      if (!author || !cd.component_slug) continue
      const url = `https://21st.dev/@${author}/components/${cd.component_slug}`
      const prev = byUrl.get(url)
      // keep the highest usage_count seen (same component can surface per-demo)
      if (!prev || (r.usage_count ?? 0) > (prev.usage_count ?? 0)) {
        byUrl.set(url, { usage_count: r.usage_count ?? 0, demo_id: r.demo_id ?? null, video_url: r.video_url ?? null, description: cd.description ?? null })
      }
    }
    if (rows.length < PER_PAGE) break
  }
  process.stdout.write(`\r  ${byUrl.size} components · ${requests} requests`)
}
console.log(`\nunique components with API metadata: ${byUrl.size} (requests_remaining ${remaining})`)

await writeFile('api-metadata.json', JSON.stringify(Object.fromEntries(byUrl), null, 2))

// merge into harvested meta.json where present
let merged = 0
for (const d of await readdir('harvest')) {
  if (!d.includes('__')) continue
  const p = `harvest/${d}/meta.json`
  try {
    const m = JSON.parse(await readFile(p, 'utf8'))
    const hit = byUrl.get(m.url)
    if (!hit) continue
    await writeFile(p, JSON.stringify({ ...m, ...hit }, null, 2))
    merged++
  } catch {}
}
console.log(`merged into ${merged} harvested meta.json files -> api-metadata.json`)
