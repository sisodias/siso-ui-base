// SISO UI Base — Stage 0: screenshot cockpit panels from the live app on :5599.
// Reuses Playwright (already installed). Writes PNGs to pipeline/_shots/<panel>.png.
// Usage: node shoot.mjs [url]   (default http://127.0.0.1:5599/)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '_shots')
mkdirSync(OUT, { recursive: true })
const URL = process.argv[2] || 'http://127.0.0.1:5599/'

// panel -> CSS selector. chat is the CALIBRATION ANCHOR (should score highest).
const PANELS = [
  { id: 'chat-rail', sel: '.chat-rail, .stream-cockpit__chat', anchor: true },
  { id: 'stage', sel: '.cockpit-v3-stage, .video-stage, .stage' },
  { id: 'work-dock', sel: '.stream-cockpit__work-dock, .stream-cockpit__work-panel' },
  { id: 'status-rail', sel: '.one-page-cockpit__status-rail, .cockpit-panel' },
  { id: 'streamer-panel', sel: '.stream-cockpit__streamer-panel, .stream-cockpit__streamer-dock' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
const out = []
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(1800) // let panels mount/animate in
  // full page first (fallback + overview)
  await page.screenshot({ path: join(OUT, 'full.png') })
  out.push({ id: 'full', ok: true })
  for (const p of PANELS) {
    try {
      const el = page.locator(p.sel).first()
      await el.waitFor({ state: 'visible', timeout: 4000 })
      const box = await el.boundingBox()
      if (!box || box.width < 40 || box.height < 40) { out.push({ id: p.id, ok: false, reason: 'too small / not laid out' }); continue }
      await el.screenshot({ path: join(OUT, p.id + '.png') })
      out.push({ id: p.id, ok: true, anchor: !!p.anchor, w: Math.round(box.width), h: Math.round(box.height) })
    } catch (e) {
      out.push({ id: p.id, ok: false, reason: String(e.message || e).split('\n')[0] })
    }
  }
} finally {
  await browser.close()
}
console.log('__SHOTS_JSON__ ' + JSON.stringify({ url: URL, dir: OUT, shots: out }))
for (const s of out) console.log(`  ${s.ok ? '📸' : '⚠️ '} ${s.id}${s.anchor ? '  (ANCHOR)' : ''}${s.reason ? '  — ' + s.reason : s.w ? `  ${s.w}×${s.h}` : ''}`)
