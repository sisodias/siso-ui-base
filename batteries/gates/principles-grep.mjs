#!/usr/bin/env node
// Stage-1 gate for the universal principles — the rules that hold regardless of
// which tenant's DNA is in force.
//
// HOW THIS RELATES TO dna-grep.mjs
// dna-grep enforces ONE tenant's taste (Oracle's ink ladder, its weight ladder).
// This enforces what registry/principles says is true for any interface. They
// run together, and where they disagree THE DNA WINS — the principles say so
// themselves: "if a principle and a design-system rule conflict, the design
// system wins. Flag the conflict for review."
//
// So a DNA-governed value is never reported here as a failure. It is reported
// as `deferred`, naming the DNA rule that overrides it, and does not fail the
// run. That keeps the gate honest without letting it fight the tenant.
//
// Only mechanically checkable principles live here. Most of the 334 sections
// are judgment calls that belong to the visual judge and the human, not a grep.
//
//   node batteries/gates/principles-grep.mjs <file.html|css|tsx> [more...]
//   node batteries/gates/principles-grep.mjs --json <files...>
//
// Exit 0 = clean (or only deferrals). Exit 1 = real violations.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const TENANT = argv.includes('--tenant') ? argv[argv.indexOf('--tenant') + 1] : 'oracle'
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--tenant')

if (!files.length) {
  console.error('usage: principles-grep.mjs [--tenant x] [--json] <file> [files...]')
  process.exit(2)
}

// Read the tenant DNA so a principle can stand down where the DNA legislates.
const dnaPath = join(ROOT, 'tenants', TENANT, 'dna.md')
const dna = existsSync(dnaPath) ? readFileSync(dnaPath, 'utf8') : ''
const dnaSaysSmallType = /fractional scale|8\.5|9\.5|\b11\b.*tabs|\b13\b.*body/i.test(dna)

const RULES = [
  {
    id: 'badge-full-width',
    principle: 'Badges are never full width [ui-principles.md]',
    why: 'A badge hugs its label. If it spans a row it is an alert or banner, not a badge.',
    // Match the SELECTOR, not the whole line. Matching line text flagged
    // `.newsletter input { flex: 1; border-radius: var(--radius-pill) }` in
    // real client CSS — a full-width input that merely mentions "pill" in a
    // token name. `flex: 1` is also dropped: it is how a legitimate input
    // fills a row, and it says nothing about badges.
    test: (line, ctx) => {
      const sel = (ctx.selector || '').toLowerCase()
      if (!/\b(badge|chip|tag)\b/.test(sel)) return null
      if (/\b(input|textarea|select|button|field)\b/.test(sel)) return null
      const m = line.match(/width:\s*100%|display:\s*block\b|w-full/)
      return m ? `badge selector "${ctx.selector}" set to ${m[0]} — use an alert/banner instead` : null
    },
  },
  {
    id: 'invisible-input',
    principle: 'Inputs on matching backgrounds need visible contrast [ui-principles.md]',
    why: 'An input whose fill matches its parent surface is invisible — users cannot see where to type.',
    test: (line, ctx) => {
      if (!/input|textarea|select|search/i.test(ctx.selector || '')) return null
      const m = line.match(/background(?:-color)?:\s*(transparent|inherit|none)\b/i)
      return m ? `input background is ${m[1]} — give it contrast against the parent surface` : null
    },
  },
  {
    id: 'focus-removed',
    principle: 'Visible focus states are mandatory [accessibility.md]',
    why: 'Removing the focus ring without replacing it breaks keyboard navigation entirely.',
    test: (line, ctx, src) => {
      const m = line.match(/outline:\s*(none|0)\b/i)
      if (!m) return null
      // legitimate when a focus-visible style is defined somewhere in the file
      if (/:focus-visible/.test(src)) return null
      return 'outline removed with no :focus-visible replacement anywhere in the file'
    },
  },
  {
    id: 'tiny-type',
    principle: 'Minimum font sizes [typography-principles.md]',
    why: 'Body copy below the floor is unreadable on real displays.',
    // The Oracle DNA deliberately runs a 8.5-13 fractional scale. That is a
    // documented design-system decision, so this defers rather than fails.
    defersToDna: () => dnaSaysSmallType,
    test: line => {
      const m = line.match(/font-size:\s*(\d+(?:\.\d+)?)px/i)
      if (!m) return null
      const px = Number(m[1])
      return px < 12 ? `${px}px body type is below the 12px floor` : null
    },
  },
]

const results = []
for (const file of files) {
  let src
  try { src = readFileSync(file, 'utf8') } catch { console.error(`cannot read ${file}`); continue }
  const lines = src.split('\n')
  let selector = ''
  lines.forEach((line, i) => {
    const sel = line.match(/^\s*([.#\w][^{]*)\{/)
    if (sel) selector = sel[1].trim()
    for (const rule of RULES) {
      const flag = rule.test(line, { selector }, src)
      if (!flag) continue
      const deferred = rule.defersToDna?.() ?? false
      results.push({
        file, line: i + 1, rule: rule.id, principle: rule.principle,
        message: flag, status: deferred ? 'deferred' : 'violation',
        ...(deferred ? { deferredTo: `tenants/${TENANT}/dna.md legislates this — the DNA wins` } : {}),
      })
    }
  })
}

const violations = results.filter(r => r.status === 'violation')
const deferred = results.filter(r => r.status === 'deferred')

if (JSON_OUT) {
  console.log(JSON.stringify({ tenant: TENANT, files: files.length, violations, deferred, pass: !violations.length }, null, 2))
} else {
  if (!results.length) console.log(`principles gate: clean (${files.length} file(s), tenant ${TENANT})`)
  for (const v of violations) {
    console.log(`VIOLATION  ${v.file}:${v.line}  [${v.rule}]`)
    console.log(`           ${v.message}`)
    console.log(`           ${v.principle}`)
  }
  for (const d of deferred) {
    console.log(`deferred   ${d.file}:${d.line}  [${d.rule}]  ${d.message}`)
    console.log(`           ${d.deferredTo}`)
  }
  if (results.length) console.log(`\n${violations.length} violation(s), ${deferred.length} deferred to the DNA`)
}

process.exit(violations.length ? 1 : 0)
