#!/usr/bin/env node
// Rank catalog components against a target project's real constraints.
// Fit = how well it lands in THIS repo. Need = how badly the project wants it.
// Usage: node score.mjs [profile.json] > ranked.json
import { readFileSync, writeFileSync } from 'node:fs'

const catalog = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url)))
const profile = JSON.parse(readFileSync(process.argv[2] || new URL('./profiles/mygumm.json', import.meta.url)))

const txt = (c) => `${c.name} ${c.description || ''}`.toLowerCase()

// --- 1. TRUE TYPE: what the component actually IS, from its own words ---
// Category came from the search query, so it lies. Descriptions don't.
const TYPE = [
  ['newsletter', /newsletter|subscribe|email (input|capture|signup)|mailing list/],
  ['testimonial', /testimonial|review|social proof/],
  ['footer', /footer/],
  ['hero', /\bhero\b|landing (page )?(header|section)/],
  ['nav', /navbar|navigation (bar|menu|header)|header with|menu drawer|hamburger/],
  ['product', /product (card|grid|detail|page)|add to cart|shopping cart|checkout|price/],
  ['gallery', /gallery|carousel|slider|lightbox|masonry/],
  ['faq', /faq|accordion/],
  ['pricing', /pricing|plan|tier/],
  ['stats', /statistic|counter|metric|number/],
  ['feature', /feature|bento|benefit|grid section/],
  ['cta', /call to action|\bcta\b/],
  ['team', /team member|about us|staff/],
  ['marquee', /marquee|infinite scroll|logo (cloud|band)|ticker/],
]
const trueType = (c) => (TYPE.find(([, re]) => re.test(txt(c))) || ['other'])[0]

// --- 2. COMPLETENESS: is it a whole section or a fragment? ---
// Your footer complaint: several "footers" were just an email box.
const completeness = (c) => {
  const t = txt(c), ty = trueType(c)
  let s = 0.5
  const parts = (profile.completeness[ty] || []).filter((p) => new RegExp(p, 'i').test(t)).length
  const want = (profile.completeness[ty] || []).length
  if (want) s = parts / want
  if (/\bonly\b|simple|minimal|basic|compact/.test(t)) s -= 0.15
  if (/complete|full|comprehensive|versatile|multi-column/.test(t)) s += 0.2
  return Math.max(0, Math.min(1, s))
}

// --- 3. FIT: cost to land it in this exact repo ---
const fit = (c) => {
  const t = txt(c)
  let s = 1
  for (const [pat, pen, _why] of profile.penalties)
    if (new RegExp(pat, 'i').test(t)) s -= pen
  for (const [pat, bon] of profile.bonuses)
    if (new RegExp(pat, 'i').test(t)) s += bon
  return Math.max(0, Math.min(1, s))
}
const fitWhy = (c) => {
  const t = txt(c), out = []
  for (const [pat, pen, why] of profile.penalties)
    if (new RegExp(pat, 'i').test(t)) out.push(`−${pen} ${why}`)
  return out
}

// --- 4. NEED: how much this project wants this slot filled ---
const need = (c) => profile.need[trueType(c)] ?? 0.25

const scored = catalog.map((c) => {
  const ty = trueType(c), F = fit(c), C = completeness(c), N = need(c)
  // need is the multiplier: a perfect component for a slot we don't have is still noise
  const score = +(N * (0.55 * F + 0.45 * C)).toFixed(4)
  return { ...c, trueType: ty, fit: +F.toFixed(2), completeness: +C.toFixed(2), need: N, score,
           flags: [...fitWhy(c), ...(ty !== c.category ? [`miscategorised: searched as ${c.category}, actually ${ty}`] : [])] }
})
scored.sort((a, b) => b.score - a.score)
writeFileSync(new URL('./ranked.json', import.meta.url), JSON.stringify(scored, null, 1))

const byType = {}
for (const c of scored) (byType[c.trueType] ||= []).push(c)
console.log(`ranked ${scored.length} components\n`)
for (const [t, list] of Object.entries(byType).sort((a, b) => b[1][0].score - a[1][0].score)) {
  console.log(`${t.toUpperCase()} (${list.length})  need=${list[0].need}`)
  for (const c of list.slice(0, 3))
    console.log(`   ${c.score.toFixed(3)}  #${String(c.id).padEnd(6)} ${c.name.slice(0, 40).padEnd(42)} fit=${c.fit} cmpl=${c.completeness}`)
  console.log()
}
