// SISO UI Base — Stage 3 visual judge (the weekend MVP).
// Feeds each panel screenshot + the dna.md-aligned rubric to Codex vision (codex exec -i),
// which writes a strict-JSON verdict to a file. Parses, weights, ranks. The chat rail is the
// calibration anchor — it should score highest.
//
// Usage: node judge.mjs [panel...]   (default: all PNGs in _shots/ except full.png)
//   node judge.mjs chat-rail stage
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'
import { AXES, buildJudgePrompt, weightedOverall } from './rubric.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(here, '_shots')
const TMP = join(here, '_verdicts')
import { mkdirSync } from 'node:fs'
mkdirSync(TMP, { recursive: true })

let panels = process.argv.slice(2)
if (!panels.length) {
  panels = readdirSync(SHOTS).filter((f) => f.endsWith('.png') && f !== 'full.png').map((f) => basename(f, '.png'))
}

function judgePanel(id) {
  const img = join(SHOTS, id + '.png')
  if (!existsSync(img)) return { panel: id, error: 'no screenshot' }
  const outFile = join(TMP, id + '.json')
  if (existsSync(outFile)) rmSync(outFile)
  const rubric = buildJudgePrompt(id)
  // Tell codex to WRITE the json to a known path so we extract it cleanly (it narrates otherwise).
  const prompt = `${rubric}\n\nWrite ONLY that JSON object to the file ${outFile} (overwrite). Do not print anything else.`
  try {
    execFileSync('codex', ['exec', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox', prompt, '-i', img],
      { cwd: here, timeout: 180000, stdio: ['ignore', 'ignore', 'ignore'] })
  } catch (e) {
    // codex sometimes exits non-zero after writing; fall through to read the file
  }
  if (!existsSync(outFile)) return { panel: id, error: 'judge wrote no verdict' }
  let raw = readFileSync(outFile, 'utf8').trim()
  // tolerate code fences / stray text — grab the first {...} block
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return { panel: id, error: 'unparseable verdict', raw: raw.slice(0, 200) }
  let v
  try { v = JSON.parse(m[0]) } catch (e) { return { panel: id, error: 'bad json: ' + e.message, raw: m[0].slice(0, 200) } }
  v.overall = weightedOverall(v.scores)
  return v
}

const results = []
for (const id of panels) {
  process.stderr.write(`  judging ${id} … `)
  const r = judgePanel(id)
  results.push(r)
  process.stderr.write(r.error ? `error: ${r.error}\n` : `overall ${r.overall}\n`)
}

// rank
const ok = results.filter((r) => !r.error).sort((a, b) => b.overall - a.overall)
const errs = results.filter((r) => r.error)

console.log('\n  SISO UI Base — Stage 3 visual scores (rubric = dna.md)\n  ' + '─'.repeat(60))
const axisIds = AXES.map((a) => a.id)
console.log('  ' + 'panel'.padEnd(16) + axisIds.map((a) => a.slice(0, 5).padStart(6)).join('') + '   overall')
for (const r of ok) {
  const row = axisIds.map((a) => String(r.scores?.[a] ?? '·').padStart(6)).join('')
  const anchor = r.panel === 'chat-rail' ? '  ⚓' : ''
  console.log('  ' + r.panel.padEnd(16) + row + '   ' + String(r.overall).padStart(5) + anchor)
}
for (const e of errs) console.log('  ' + e.panel.padEnd(16) + '  ⚠️  ' + e.error)
console.log('  ' + '─'.repeat(60))

// calibration check: anchor should be top (or near it)
const anchor = ok.find((r) => r.panel === 'chat-rail')
if (anchor) {
  const rank = ok.indexOf(anchor) + 1
  console.log(`  ⚓ chat-rail (anchor) ranked #${rank} of ${ok.length} at ${anchor.overall}. ${rank === 1 ? 'CALIBRATED ✅' : 'expected #1 — recalibrate rubric/prompt.'}`)
}
console.log('')
for (const r of ok) {
  console.log(`  ▸ ${r.panel} (${r.overall}) — worst: ${r.worst}`)
  if (r.critique) console.log(`      ${r.critique}`)
  for (const f of (r.fixes || [])) console.log(`      · ${f}`)
}

writeFileSync(join(here, 'scores.json'), JSON.stringify({ at: 'unstamped', results }, null, 2))
console.log('\n  full verdicts → pipeline/scores.json')
console.log('__JUDGE_JSON__ ' + JSON.stringify({ ranked: ok.map((r) => ({ panel: r.panel, overall: r.overall })), errors: errs.length }))
