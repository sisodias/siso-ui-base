#!/usr/bin/env node
// oracle-ui gate — grep-able anti-pattern check against the chat-rail DNA.
// Usage: node .claude/skills/oracle-ui/scripts/check.mjs <file.css|file.tsx> [more...]
// Exit 0 = clean. Exit 1 = flags found (fix or justify each). Output is structured for agents + humans.
import { readFileSync } from 'node:fs'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: check.mjs <file> [files...]  (pass the .css/.tsx you changed)')
  process.exit(2)
}

// Each rule: id, why, and a per-line matcher returning a flag string or null.
// Matchers err toward signal over noise; false positives are justifiable in the report.
const ROUND_WEIGHTS = new Set(['100', '200', '300', '400', '500', '600', '700', '800'])
const FRACTIONAL_OK = new Set(['650', '750', '850', '900', '950'])

const RULES = [
  {
    id: 'pure-white-black',
    why: 'Never #fff/#000. Use #f8f8f5/#fffef9 bg + #0f172a text.',
    test: (line, ctx) => {
      const m = line.match(/#(?:fff|ffffff|000|000000)\b/i)
      if (!m) return null
      // legit: white TEXT on an accent-filled interactive control (button/jump/cta). The surface there IS the accent.
      const sel = (ctx.selector || '').toLowerCase()
      const isAction = /button|btn|jump|fab|cta|action|pill|toggle/.test(sel)
      if (isAction && /color:\s*#(?:fff|ffffff)\b/i.test(line)) return null
      return `pure ${m[0]} — swap for warm off-white / slate`
    },
  },
  {
    id: 'round-font-weight',
    why: 'Weights live on the 650/750/850/900 ladder, not round hundreds.',
    test: (line) => {
      const m = line.match(/font-weight:\s*(\d{3})\b/i)
      if (!m) return null
      const w = m[1]
      if (FRACTIONAL_OK.has(w)) return null
      if (ROUND_WEIGHTS.has(w)) return `font-weight:${w} — move onto 650/750/850/900`
      return null
    },
  },
  {
    id: 'round-font-size',
    why: 'Chrome type uses the fractional scale (8.5/9.5/11/12/13). Round sizes read as default.',
    test: (line) => {
      // flag common round chrome sizes; body/headings at 14-20 are fine and skipped.
      const m = line.match(/font-size:\s*(10|16)px\b/i)
      if (!m) return null
      return `font-size:${m[1]}px — consider the fractional scale (9.5 / 11 / 13 / 15)`
    },
  },
  {
    id: 'new-grey-hex',
    why: 'Secondary tones come from the one-ink alpha ladder rgba(15,23,42,α), not new grey hexes.',
    test: (line) => {
      // a 6-digit hex whose channels are near-equal (grey) and not our known tokens
      const known = /#(?:f8f8f5|fffef9|0f172a|ff0069|f72d73|c41458|15803d|756670)\b/i
      const m = line.match(/#([0-9a-f]{6})\b/gi)
      if (!m) return null
      for (const hex of m) {
        if (known.test(hex)) continue
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
        const spread = Math.max(r, g, b) - Math.min(r, g, b)
        if (spread <= 12) return `${hex} looks like an ad-hoc grey — use rgba(15,23,42,α) from the ladder`
      }
      return null
    },
  },
  {
    id: 'pill-on-non-badge',
    why: 'Pills (999px + bg/border) are only for count badges + coin chips. Everything else = bare text.',
    test: (line, ctx) => {
      // heuristic: 999px/full radius on something that isn't a legit round element.
      if (!/border-radius:\s*(?:999px|9999px|50%)/i.test(line)) return null
      const sel = (ctx.selector || '').toLowerCase()
      // legit round things: count badges, coin chips, dots/avatars/orbs, AND interactive round controls
      // (buttons, the jump-to-latest, scrollbar thumbs, toggles, fabs). Pills are only wrong on STATIC data.
      if (/badge|chip|coin|count|pill|dot|avatar|orb|button|btn|jump|fab|toggle|scrollbar|thumb|tab\b|action|cta|icon/.test(sel)) return null
      return `999px radius on "${ctx.selector || '?'}" — if this wraps a number/label, unwrap to bare text`
    },
  },
  {
    id: 'reflex-radius-8',
    why: 'border-radius:8px on everything is the default tell. Panels=18, tab-tops=8 8 0 0, badges=999.',
    test: (line, ctx) => {
      const m = line.match(/border-radius:\s*8px\b\s*;?\s*$/i)
      if (!m) return null
      const sel = (ctx.selector || '').toLowerCase()
      if (/tab/.test(sel)) return null // tab tops legitimately use 8px-ish
      return `border-radius:8px on "${ctx.selector || '?'}" — is this deliberate, or a reflex?`
    },
  },
  {
    id: 'chunky-scrollbar',
    why: 'Scrollbars are 3px, barely-there. Never 6-8px chrome bars.',
    test: (line) => {
      const m = line.match(/::-webkit-scrollbar[^{]*\{[^}]*width:\s*(\d+)px/i) || line.match(/scrollbar[^:]*:\s*.*width:\s*(\d+)px/i)
      if (!m) return null
      if (Number(m[1]) > 4) return `scrollbar width:${m[1]}px — chat uses 3px`
      return null
    },
  },
  {
    id: 'shadow-as-divider',
    why: 'Section breaks are 1px hairlines (rgba(15,23,42,.05)), not shadows/heavy borders.',
    test: (line, ctx) => {
      const sel = (ctx.selector || '').toLowerCase()
      if (!/divider|sep|hair|rule|hr\b/.test(sel)) return null
      if (/box-shadow|border:\s*[2-9]/.test(line)) return `"${ctx.selector}" uses shadow/thick border for a divider — use a 1px hairline`
      return null
    },
  },
]

// numeric-content / tabular-nums heuristic (file-level, TSX/JSX): warn if numbers are rendered but tabular-nums never appears.
function tabularNumsCheck(name, src) {
  if (!/\.(tsx|jsx|css)$/.test(name)) return []
  const looksNumeric = /\{[^}]*(count|amount|tokens?|percent|timer|earned|viewers?|total)\b[^}]*\}/i.test(src)
    || /tabular/i.test(src)
  const hasTabular = /tabular-nums/.test(src)
  if (looksNumeric && !hasTabular) {
    return [{ rule: 'missing-tabular-nums', line: 0, flag: 'renders numbers but no `tabular-nums` anywhere — digits will jitter as they change' }]
  }
  return []
}

let total = 0
const report = []

for (const file of files) {
  let src
  try { src = readFileSync(file, 'utf8') } catch (e) { console.error(`skip ${file}: ${e.message}`); continue }
  const lines = src.split('\n')
  let selector = ''
  const fileFlags = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // track the current CSS selector for context (last line ending in `{`)
    const selMatch = line.match(/^([^{}]+)\{\s*$/)
    if (selMatch) selector = selMatch[1].trim()
    const ctx = { selector }
    for (const rule of RULES) {
      const flag = rule.test(line, ctx)
      if (flag) { fileFlags.push({ rule: rule.id, line: i + 1, flag }); total++ }
    }
  }
  for (const f of tabularNumsCheck(file, src)) { fileFlags.push(f); total++ }
  if (fileFlags.length) report.push({ file, flags: fileFlags })
}

// human output
if (!total) {
  console.log('✅ oracle-ui gate: clean. (' + files.length + ' file(s)) — still do the live side-by-side vs the chat rail.')
  process.exit(0)
}
console.log(`🟡 oracle-ui gate: ${total} flag(s). Fix each, or justify in your report.\n`)
for (const { file, flags } of report) {
  console.log(`  ${file}`)
  for (const f of flags) console.log(`    ${f.line ? 'L' + f.line : '—'}  [${f.rule}] ${f.flag}`)
  console.log('')
}
console.log('Reference: .claude/skills/oracle-ui/reference/dna.md  (the why for each rule)')
// machine-readable tail
console.log('\n__ORACLE_UI_GATE_JSON__ ' + JSON.stringify({ total, report }))
process.exit(1)
