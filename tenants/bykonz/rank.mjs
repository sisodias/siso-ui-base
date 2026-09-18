#!/usr/bin/env node
// Rank bank candidates per BykonzYard surface.
//
// v1 of this ranked on name + description and produced junk: it put date
// PICKERS under "event card" and an image uploader under "chat", and its top
// chat pick (bundui__scroll-area6) has ZERO responsive breakpoints in its
// source — the name said "chat conversation panel", the code says it will not
// adapt to a phone. Shaan, 18 Sep: "you're just going off names not actually
// what the code is... none of these comps are for mobile."
//
// So v2 reads the DONOR SOURCE. Text still picks the category, but whether a
// comp can survive 390px is decided by what its code actually does.
// Measured over a 400-file sample of the 5,211 comps with source:
//   39% carry sm:/md:/lg: breakpoints   6% use aspect-ratio
//    5% clamp their text               14% hard-code a >=100px width
// Those ratios are why these signals discriminate at all.
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const H = join(ROOT, 'registry', '21st', 'harvest')
const S = join(ROOT, 'registry', '21st-source-harvest', 'source')
const cls = JSON.parse(await readFile(join(ROOT, 'registry', '21st', 'classification.json'), 'utf8'))
const spec = JSON.parse(await readFile(join(HERE, 'surfaces.json'), 'utf8'))
const allHarvest = readdirSync(H).filter(d => !d.startsWith('.'))
const idOf = u => { const m = /21st\.dev\/@([^/]+)\/components\/([^/?#]+)/.exec(u); return m ? `${m[1]}__${m[2]}` : null }

// What each surface must BE (category) and must NOT be. Text-matched.
const RUBRIC = {
  'video-card':   { want:[/video/i,/thumbnail/i,/player/i,/media card/i,/youtube/i,/watch/i], avoid:[/dashboard/i,/chart/i,/admin/i,/table/i,/pricing/i,/invoice/i] },
  'gallery-card': { want:[/galler/i,/photo/i,/image (grid|card|collection)/i,/masonry/i,/lightbox/i,/album/i], avoid:[/dashboard/i,/chart/i,/pricing/i,/table/i,/invoice/i] },
  'event-card':   { want:[/event/i,/countdown/i,/ticket/i,/venue/i,/concert/i,/gig/i,/lineup/i,/promo(tional)? (card|banner)/i], avoid:[/dashboard/i,/chart/i,/admin/i,/picker/i,/scheduler/i,/scheduling/i,/date.?range/i,/time slot/i,/calendar view/i] },
  'ai-chat':      { want:[/chat/i,/conversation/i,/message (list|thread|bubble)/i,/assistant/i,/chatbot/i], avoid:[/dashboard/i,/chart/i,/pricing/i,/galler/i,/table/i,/upload/i,/crop/i,/heatmap/i] },
  'contact-form': { want:[/contact/i,/\bform\b/i,/phone input/i,/country/i,/input/i,/field/i,/validation/i], avoid:[/dashboard/i,/chart/i,/galler/i,/video/i,/carousel/i] },
  'store-card':   { want:[/product/i,/shop/i,/store/i,/e.?commerce/i,/reward/i,/redeem/i,/merch/i], avoid:[/dashboard/i,/chart/i,/admin/i,/table/i,/invoice/i] },
  'earn-step':    { want:[/step/i,/timeline/i,/onboard/i,/progress/i,/how it works/i,/stepper/i,/wizard/i], avoid:[/dashboard/i,/chart/i,/galler/i,/video/i,/pricing/i] },
  'product-page': { want:[/product/i,/shop/i,/store/i,/e.?commerce/i,/merch/i,/apparel/i,/clothing/i,/catalog/i], avoid:[/dashboard/i,/chart/i,/admin/i,/table/i,/invoice/i,/analytics/i] },
  'mission-card': { want:[/feature/i,/bento/i,/value/i,/benefit/i,/highlight/i,/service/i,/about/i], avoid:[/dashboard/i,/chart/i,/admin/i,/table/i,/invoice/i] },
}

const meta = id => { const f = join(H, id, 'meta.json'); if (!existsSync(f)) return null; try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }
const source = id => { const f = join(S, id, 'code.tsx'); if (!existsSync(f)) return null; try { return readFileSync(f, 'utf8') } catch { return null } }

/* Read the donor's code and report what it will actually do on a phone.
   Every flag here is a thing that decides whether a swap lands or fails. */
function codeSignals(src) {
  const bp = (src.match(/\b(sm|md|lg|xl|2xl):/g) || []).length
  return {
    responsive: bp,                                            // adapts at all?
    mobileFirst: /\b(flex-col|grid-cols-1)\b/.test(src),        // stacks by default
    aspect:      /aspect-(video|square|\[|ratio)|aspectRatio/.test(src),
    clamps:      /line-clamp|truncate|text-ellipsis/.test(src), // title cannot run to 6 lines
    objectFit:   /object-(cover|contain)/.test(src),            // images crop, not squash
    // Only a fixed WIDTH >= 390px actually breaks the phone. A fixed HEIGHT
    // (h-[320px]) is a one-line tweak, so it is not disqualifying.
    fixedWide:   (src.match(/\bw-\[\s*(\d{3,})px\]|width:\s*['"]?(\d{3,})px/g) || [])
                   .some(m => Number((m.match(/(\d{3,})/) || [])[1]) >= 390),
    fixedTall:   /\bh-\[\s*\d{3,}px\]|height:\s*['"]?\d{3,}px/.test(src),
    hoverOnly:   /group-hover|hover:/.test(src) && !/onClick|onTouch|useState/.test(src),
    lines:       src.split('\n').length,
    deps:        (src.match(/^import .* from ['"]([^'"]+)/gm) || []).length,
  }
}

function score(m, src, r) {
  const t = `${m.name || ''} ${m.description || ''}`
  let s = 0; const why = []

  // 1. Is it the right KIND of thing? (text)
  let cat = 0
  for (const re of r.want)  if (re.test(t)) cat += 10
  for (const re of r.avoid) if (re.test(t)) cat -= 16
  // Hard gate. A comp that is not the right KIND of thing cannot be rescued by
  // being responsive: a well-built changelog is still not a chat window.
  if (cat <= 0) return { s: -999, why: ['off-category'], signals: codeSignals(src) }
  s += cat

  // 2. Will it survive a phone? (code — this is the part v1 skipped)
  const c = codeSignals(src)
  if (c.responsive >= 6) { s += 16; why.push('responsive×' + c.responsive) }
  else if (c.responsive >= 2) { s += 9; why.push('responsive×' + c.responsive) }
  else { s -= 14; why.push('NO breakpoints') }

  if (c.mobileFirst) { s += 6; why.push('stacks') }
  if (c.aspect)      { s += 7; why.push('aspect-ratio') }
  if (c.clamps)      { s += 7; why.push('clamps text') }
  if (c.objectFit)   { s += 5; why.push('object-fit') }
  if (c.fixedWide)   { s -= 18; why.push('FIXED width >=390px') }
  if (c.fixedTall)   { s -= 3;  why.push('fixed height') }
  if (c.hoverOnly)   { s -= 8; why.push('hover-only') }

  // 3. Is it adaptable in an afternoon?
  if (c.lines > 700) { s -= 8; why.push('huge ' + c.lines + 'L') }
  else if (c.lines >= 60 && c.lines <= 400) s += 4
  if (c.deps > 12) { s -= 5; why.push(c.deps + ' imports') }

  return { s, why: why.slice(0, 6), signals: c }
}

// Shaan picked these by LOOKING at the previews. His eye outranks the scorer,
// so they are always in the shortlist regardless of what the code signals say.
let PINNED = {}
try {
  const pj = JSON.parse(readFileSync(join(HERE, 'picks.json'), 'utf8'))
  for (const [k, v] of Object.entries(pj)) {
    if (v?.v !== 'yes') continue
    const [surf, id] = k.split('|')
    ;(PINNED[surf] ||= new Set()).add(id)
  }
} catch {}

const out = {}
for (const surf of spec.surfaces) {
  const r = RUBRIC[surf.id]; if (!r) continue
  const tagged = new Set()
  for (const tag of surf.tags) for (const url of (cls.tagToComponents[tag] || [])) { const i = idOf(url); if (i) tagged.add(i) }
  // The tag index is incomplete — ravikatiyar162__event-card carries only the
  // 'card' tag, so a tags-only pool hid the one literal event card in the bank.
  const pool = new Set(tagged)
  for (const id of allHarvest) {
    const m = meta(id); if (!m) continue
    if (r.want.some(re => re.test(`${m.name || ''} ${m.description || ''}`))) pool.add(id)
  }
  const rows = []
  for (const id of pool) {
    if (!existsSync(join(H, id, 'preview.webp'))) continue
    const src = source(id); if (!src) continue       // no code = cannot adapt it
    const m = meta(id); if (!m) continue
    const { s, why, signals } = score(m, src, r)
    rows.push({ id, url: m.url || '', tag: tagged.has(id) ? surf.tags[0] : 'name-match',
      name: m.name || id.split('__')[1], author: m.author || id.split('__')[0],
      description: m.description || '', score: s, why, signals })
  }
  rows.sort((a, b) => b.score - a.score)
  const pin = PINNED[surf.id] || new Set()
  for (const row of rows) if (pin.has(row.id)) { row.pinned = true; row.why.unshift('PICKED BY SHAAN') }
  const top = [...rows.filter(r => r.pinned), ...rows.filter(r => !r.pinned)].slice(0, 6)
  out[surf.id] = top
  console.log(`${surf.id.padEnd(14)} pool ${String(rows.length).padStart(4)}  top6 ${top.map(x => x.score).join(',').padEnd(26)} responsive: ${top.filter(x => x.signals.responsive >= 2).length}/6`)
}
await writeFile(join(HERE, 'shortlist.json'), JSON.stringify(out, null, 1))
console.log('\nwrote shortlist.json')
