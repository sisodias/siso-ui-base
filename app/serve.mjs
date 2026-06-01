#!/usr/bin/env node
// SISO UI Base — the viewer server (the "UI Box"). Zero dependencies, Node built-ins only.
// Filesystem-as-state: scans a tenant's variations dir, serves a manifest + the raw HTML,
// accepts reviews/bless writes. No DB, no build step, no framework. Run: node app/serve.mjs
//
// Env:
//   UIBASE_TENANT   path to tenant dir (default: ../tenants/oracle)
//   UIBASE_PORT     default 8810
//   UIBASE_VARS     variations dir (default: <tenant>/variations)
import { createServer } from 'node:http'
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises'
import { existsSync, watch } from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TENANT = resolve(process.env.UIBASE_TENANT || join(HERE, '..', 'tenants', 'oracle'))
const VARS = resolve(process.env.UIBASE_VARS || join(TENANT, 'variations'))
const STATE = join(TENANT, 'review-state.json') // reviews + blessings live here
const PORT = Number(process.env.UIBASE_PORT || 8810)
const HTML = join(HERE, 'index.html')

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'no-store' })
  res.end(body)
}
async function readJSON(p, fallback) { try { return JSON.parse(await readFile(p, 'utf8')) } catch { return fallback } }

// A "set" = a subfolder of VARS. A "variation" = an .html file in it. meta.json (optional) per set + per file.
async function buildManifest() {
  const state = await readJSON(STATE, { reviews: {}, blessed: {} })
  const out = { tenant: basename(TENANT), varsDir: VARS, sets: [] }
  if (!existsSync(VARS)) return out
  const entries = await readdir(VARS, { withFileTypes: true })
  // top-level loose .html files form an implicit "ungrouped" set
  const loose = entries.filter((e) => e.isFile() && e.name.endsWith('.html'))
  const dirs = entries.filter((e) => e.isDirectory())
  async function setFrom(setId, dir, files) {
    const meta = await readJSON(join(dir, 'meta.json'), {})
    const variations = []
    for (const f of files) {
      const id = basename(f, '.html')
      const fileMeta = await readJSON(join(dir, id + '.meta.json'), {})
      const st = await stat(join(dir, f)).catch(() => null)
      const rel = join(setId === '_ungrouped' ? '' : setId, f)
      variations.push({
        id, setId, file: rel, name: fileMeta.name || id,
        agentNotes: fileMeta.notes || meta.agentNotes?.[id] || '',
        scores: state.reviews[`${setId}/${id}`]?.scores || fileMeta.scores || null,
        status: state.blessed[setId] === id ? 'blessed' : (state.reviews[`${setId}/${id}`]?.status || 'pending'),
        parentId: fileMeta.parentId || null,
        mtime: st ? st.mtimeMs : 0,
      })
    }
    variations.sort((a, b) => (b.scores?.overall || 0) - (a.scores?.overall || 0) || b.mtime - a.mtime)
    return { id: setId, name: meta.name || setId, prompt: meta.prompt || '', slotId: meta.slotId || null,
      blessed: state.blessed[setId] || null, variations }
  }
  for (const d of dirs) {
    const dir = join(VARS, d.name)
    const files = (await readdir(dir)).filter((f) => f.endsWith('.html'))
    if (files.length) out.sets.push(await setFrom(d.name, dir, files))
  }
  if (loose.length) out.sets.push(await setFrom('_ungrouped', VARS, loose.map((e) => e.name)))
  out.sets.sort((a, b) => b.variations[0]?.mtime - a.variations[0]?.mtime)
  return out
}

// --- SSE: notify the browser when variations change (folder watch) ---
const sseClients = new Set()
function broadcast(ev) { for (const res of sseClients) res.write(`data: ${JSON.stringify(ev)}\n\n`) }
if (existsSync(VARS)) {
  try { watch(VARS, { recursive: true }, (_e, f) => broadcast({ type: 'change', file: f })) } catch {}
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = decodeURIComponent(url.pathname)

  if (path === '/api/manifest') return send(res, 200, JSON.stringify(await buildManifest()))

  if (path === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'access-control-allow-origin': '*' })
    res.write('data: {"type":"hello"}\n\n')
    sseClients.add(res); req.on('close', () => sseClients.delete(res)); return
  }

  // raw variation HTML (served for the iframe srcdoc fetch)
  if (path.startsWith('/api/html/')) {
    const rel = path.slice('/api/html/'.length)
    const full = resolve(VARS, rel)
    if (!full.startsWith(VARS) || !existsSync(full)) return send(res, 404, 'not found', 'text/plain')
    return send(res, 200, await readFile(full), MIME['.html'])
  }

  // POST a review (score/status) or a bless
  if (req.method === 'POST' && (path === '/api/review' || path === '/api/bless' || path === '/api/feedback')) {
    let raw = ''; req.on('data', (c) => { raw += c; if (raw.length > 2_000_000) req.destroy() })
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}')
        const state = await readJSON(STATE, { reviews: {}, blessed: {}, feedback: [] })
        state.reviews ||= {}; state.blessed ||= {}; state.feedback ||= []
        if (path === '/api/review' && body.setId && body.id) {
          state.reviews[`${body.setId}/${body.id}`] = { scores: body.scores ?? null, status: body.status || 'reviewed', at: body.at || null }
        } else if (path === '/api/bless' && body.setId && body.id) {
          state.blessed[body.setId] = body.id
          // write the winner file the agent reads next run
          await writeFile(join(TENANT, 'winner.json'), JSON.stringify({ setId: body.setId, id: body.id, at: body.at || null }, null, 2))
        } else if (path === '/api/feedback') {
          state.feedback.unshift({ setId: body.setId, id: body.id || null, text: body.text || '', signals: body.signals || {}, at: body.at || null })
          // also drop a feedback file the agent can pick up
          await writeFile(join(TENANT, 'feedback-latest.json'), JSON.stringify(state.feedback[0], null, 2))
        }
        await writeFile(STATE, JSON.stringify(state, null, 2))
        broadcast({ type: 'state' })
        return send(res, 200, JSON.stringify({ ok: true }))
      } catch (e) { return send(res, 400, JSON.stringify({ ok: false, error: String(e.message || e) })) }
    })
    return
  }

  if (path === '/' || path === '/index.html') {
    if (!existsSync(HTML)) return send(res, 500, 'index.html missing', 'text/plain')
    return send(res, 200, await readFile(HTML), MIME['.html'])
  }
  return send(res, 404, 'not found', 'text/plain')
})

await mkdir(VARS, { recursive: true }).catch(() => {})
server.listen(PORT, '127.0.0.1', () => {
  console.log(`SISO UI Base — UI Box → http://127.0.0.1:${PORT}/`)
  console.log(`  tenant:     ${TENANT}`)
  console.log(`  variations: ${VARS}`)
})
