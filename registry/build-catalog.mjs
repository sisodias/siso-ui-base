#!/usr/bin/env node
// Generate docs/CATALOG.html from registry/repos.json — keep the human card view
// in sync with the manifest (run after editing repos.json). No deps.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const r = JSON.parse(readFileSync(join(here, 'repos.json'), 'utf8'))

const FAM = r.families
const order = ['A-taste-gate', 'B-visual-judge', 'C-registry', 'D-flow-dashboard', 'E-forge-mcp']
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const stars = (n) => (n == null ? '—' : n >= 1000 ? '~' + (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : '~' + n)

const flags = (x) => {
  const f = []
  if (x.keystone) f.push('<span class="f key">★ keystone</span>')
  if (x.weekendStart) f.push('<span class="f now">weekend MVP</span>')
  if (x.longTermRanker) f.push('<span class="f rsr">long-term ranker</span>')
  if (x.researchOnly) f.push('<span class="f rsr">research</span>')
  if (x.deferred) f.push('<span class="f lat">deferred</span>')
  if (x.skillInstalled) f.push('<span class="f key">skill installed</span>')
  if (x.archived) f.push('<span class="f lat">archived</span>')
  return f.join(' ')
}

const card = (x) => `
    <div class="card">
      <div class="top"><a href="${esc(x.url)}" target="_blank">${esc(x.name)}</a><span class="star">${stars(x.stars)}★</span></div>
      <div class="flags">${flags(x)}</div>
      <p class="what">${esc(x.what)}</p>
      <p class="mech"><b>How:</b> ${esc(x.mechanism)}</p>
      <p class="steal"><b>Steal:</b> ${esc(x.steal)}</p>
    </div>`

const sections = order.map((fam) => {
  const repos = r.repos.filter((x) => x.family === fam)
  if (!repos.length) return ''
  return `
  <h2>${esc(fam)} — ${esc(FAM[fam])} <span class="count">${repos.length}</span></h2>
  <div class="grid">${repos.map(card).join('')}</div>`
}).join('\n')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SISO UI Base — Repo Catalog</title>
<style>
  :root{--pink:#ff0069;--gold:#f5c842;--ink:#0f172a;--soft:#756670;--line:rgba(15,23,42,.10);--warm:#fffef9}
  *{box-sizing:border-box}
  body{font:14px/1.55 -apple-system,system-ui,sans-serif;color:var(--ink);background:var(--warm);margin:0;padding:32px;max-width:1180px;margin:0 auto}
  h1{font-size:24px;margin:0 0 4px}
  .sub{color:var(--soft);margin:0 0 8px}
  h2{font-size:16px;margin:30px 0 8px;display:flex;align-items:center;gap:8px}
  .count{background:var(--ink);color:#fff;border-radius:999px;font-size:11px;padding:1px 8px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
  .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px 15px}
  .top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
  .top a{font-weight:800;color:var(--ink);text-decoration:none;border-bottom:1px dotted var(--line)}
  .star{color:var(--gold);font-weight:800;white-space:nowrap;font-size:13px}
  .flags{margin:4px 0 6px;display:flex;flex-wrap:wrap;gap:4px}
  .f{border-radius:999px;font-size:10.5px;font-weight:700;padding:1px 8px}
  .f.key{background:#fff3cd;color:#7a5b00}.f.now{background:var(--pink);color:#fff}
  .f.lat{background:#eef;color:#3b3b88}.f.rsr{background:#f3e8ff;color:#6b21a8}
  .what{margin:4px 0;font-size:13px}
  .mech,.steal{margin:5px 0;font-size:12px;color:#334}
  .steal b{color:var(--pink)}.mech b{color:var(--soft)}
</style></head><body>
<h1>SISO UI Base — Repo Catalog</h1>
<p class="sub">${r.repos.length} prior-art repos for the domain-tuned forge→rank→vote loop. Generated from <code>registry/repos.json</code> · ${esc(r.generatedAt)} · clone all via <code>./clone.sh</code></p>
${sections}
<p class="sub" style="margin-top:26px">Architecture + why-we-win: <a href="ARCHITECTURE.html">ARCHITECTURE.html</a></p>
</body></html>`

writeFileSync(join(here, '..', 'docs', 'CATALOG.html'), html)
console.log('CATALOG.html generated ·', r.repos.length, 'repos')
