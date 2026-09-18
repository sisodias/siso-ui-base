#!/usr/bin/env node
// BykonzYard comp picker. Zero deps. PORT (default 8813).
// Left: the measured defect + the live screenshot. Right: bank candidates.
// Shaan picks; picks.json becomes the agent work order.
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const HARVEST = join(ROOT, 'registry', '21st', 'harvest')
const SOURCE = join(ROOT, 'registry', '21st-source-harvest', 'source')
const SHOTS = process.env.SHOTS || '/tmp/byk-mobile'
const PICKS = join(HERE, 'picks.json')
const SHORTLIST = join(HERE, 'shortlist.json')
const PORT = Number(process.env.PORT || 8813)
const MIME = { '.html':'text/html; charset=utf-8', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.tsx':'text/plain; charset=utf-8' }
const spec = JSON.parse(await readFile(join(HERE, 'surfaces.json'), 'utf8'))
const cls = JSON.parse(await readFile(join(ROOT, 'registry','21st','classification.json'), 'utf8'))
const cat = JSON.parse(await readFile(join(ROOT, 'registry','21st','catalog.json'), 'utf8'))
const byUrl = new Map(cat.map(c => [c.url, c]))
const idOf = u => { const m = /21st\.dev\/@([^/]+)\/components\/([^/?#]+)/.exec(u); return m ? `${m[1]}__${m[2]}` : null }
const send = (res, code, body, type='application/json') => { res.writeHead(code, {'content-type':type,'cache-control':'no-store'}); res.end(body) }
const serveFile = async (res, root, rel) => {
  const f = join(root, normalize(rel).replace(/^(\.\.[/\\])+/, ''))
  if (!f.startsWith(root) || !existsSync(f)) return send(res, 404, 'not found', 'text/plain')
  send(res, 200, await readFile(f), MIME[extname(f)] || 'application/octet-stream')
}
function candidates(s) {
  const seen = new Set(), out = []
  for (const tag of s.tags) for (const url of (cls.tagToComponents[tag] || [])) {
    const id = idOf(url); if (!id || seen.has(id)) continue
    if (!existsSync(join(HARVEST, id, 'preview.webp'))) continue
    seen.add(id)
    const m = byUrl.get(url) || {}
    out.push({ id, url, tag, name: m.name || id.split('__')[1].replace(/-/g,' '), author: id.split('__')[0],
      description: m.description || '', hasSource: existsSync(join(SOURCE, id, 'code.tsx')),
      hasBundle: existsSync(join(HARVEST, id, 'bundle.html')) })
  }
  // source-first: a comp we can actually read beats one we can only look at
  return out.sort((a,b) => (b.hasSource - a.hasSource) || (b.description.length - a.description.length))
}
createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`), p = decodeURIComponent(u.pathname)
  try {
    if (p === '/api/spec') return send(res, 200, JSON.stringify(spec))
    if (p === '/api/candidates') {
      const s = spec.surfaces.find(x => x.id === u.searchParams.get('surface'))
      if (!s) return send(res, 404, '[]')
      // Default: the ranked shortlist (6). 7,984 comps is not a choice a human
      // can make. ?all=1 opens the full tagged pool if the 6 all miss.
      if (u.searchParams.get('all') !== '1' && existsSync(SHORTLIST)) {
        const sl = JSON.parse(await readFile(SHORTLIST, 'utf8'))
        if (sl[s.id]?.length) return send(res, 200, JSON.stringify(sl[s.id].map(c => ({
          ...c, hasSource: existsSync(join(SOURCE, c.id, 'code.tsx')),
          hasBundle: existsSync(join(HARVEST, c.id, 'bundle.html')),
        }))))
      }
      return send(res, 200, JSON.stringify(candidates(s)))
    }
    if (p === '/api/picks') {
      if (req.method === 'POST') { let b=''; for await (const c of req) b+=c; JSON.parse(b); await writeFile(PICKS, b); return send(res,200,'{"ok":true}') }
      return send(res, 200, existsSync(PICKS) ? await readFile(PICKS,'utf8') : '{}')
    }
    if (p.startsWith('/shot/')) return serveFile(res, SHOTS, p.slice(6))
    if (p.startsWith('/harvest/')) return serveFile(res, HARVEST, p.slice(9))
    if (p.startsWith('/source/')) return serveFile(res, SOURCE, p.slice(8))
    if (p === '/' || p === '/index.html') return serveFile(res, HERE, 'board.html')
    return send(res, 404, 'not found', 'text/plain')
  } catch (e) { send(res, 500, JSON.stringify({ error: String(e) })) }
}).listen(PORT, '0.0.0.0', () => console.log(`bykonz picker → http://127.0.0.1:${PORT}/`))
