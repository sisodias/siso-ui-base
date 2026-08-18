#!/usr/bin/env node
// 21st.dev component board — local viewer. Zero deps, Node built-ins only.
// Previews are cached on disk, so this works offline and does not depend on the CDN.
//
// Run:  node registry/21st/serve.mjs           → http://127.0.0.1:8811/
// Env:  PORT (default 8811)
//
// Picks are written to picks.json so an agent can read your shortlist.
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8811)
const PICKS = join(HERE, 'picks.json')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  let p = decodeURIComponent(url.pathname)

  if (req.method === 'POST' && p === '/api/picks') {
    let body = ''
    for await (const c of req) body += c
    await writeFile(PICKS, body || '[]')
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end('{"ok":true}')
  }

  if (p === '/api/picks') {
    const data = existsSync(PICKS) ? await readFile(PICKS, 'utf8') : '[]'
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(data)
  }

  if (p === '/') p = '/board.html'
  // contain to this directory
  const safe = normalize(p).replace(/^(\.\.[/\\])+/, '')
  const file = join(HERE, safe)
  if (!file.startsWith(HERE) || !existsSync(file)) {
    res.writeHead(404); return res.end('not found')
  }
  const buf = await readFile(file)
  res.writeHead(200, {
    'content-type': MIME[extname(file)] || 'application/octet-stream',
    'cache-control': 'public, max-age=3600',
  })
  res.end(buf)
}).listen(PORT, '127.0.0.1', () => {
  console.log(`21st board → http://127.0.0.1:${PORT}/`)
  console.log(`picks saved to ${PICKS}`)
})
