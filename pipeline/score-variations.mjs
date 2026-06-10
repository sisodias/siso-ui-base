// score-variations.mjs — adapter to score standalone variation HTML files
// for each of the 6 sets (goalbar, upnext, focus, chat-composer, recap, video-fit)
// Uses the same Playwright screenshot + Codex vision judge pipeline as judge.mjs.
// Merges results into review-state.json under keys "<set>/<stem>" preserving existing entries.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'
// Use oracle-streaming's playwright (it has the browsers installed)
const pwModule = await import('/Users/shaansisodia/SISO_Workspace/SISO_Agency/apps/oracle-streaming/node_modules/playwright/index.mjs')
const chromium = pwModule.chromium || pwModule.default?.chromium
import { buildJudgePrompt, weightedOverall } from './rubric.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SHOTS_DIR = join(here, '_shots', 'variations')
const VERDICTS_DIR = join(here, '_verdicts', 'variations')
mkdirSync(SHOTS_DIR, { recursive: true })
mkdirSync(VERDICTS_DIR, { recursive: true })

const VARIATIONS_ROOT = '/Users/shaansisodia/SISO_Workspace/SISO_Agency/apps/oracle-streaming/.uihub/ui-base-tenant/variations'
const REVIEW_STATE_PATH = '/Users/shaansisodia/SISO_Workspace/SISO_Agency/apps/oracle-streaming/.uihub/ui-base-tenant/review-state.json'

const SETS = ['goalbar', 'upnext', 'focus', 'chat-composer', 'recap', 'video-fit']

// Read existing review-state
let reviewState = { reviews: {}, blessed: {}, feedback: [] }
if (existsSync(REVIEW_STATE_PATH)) {
  try {
    reviewState = JSON.parse(readFileSync(REVIEW_STATE_PATH, 'utf8'))
  } catch (e) {
    console.error('Failed to parse review-state.json:', e.message)
  }
}

// Screenshot a file:// URL with Playwright and save to outPath
async function screenshot(htmlPath, outPath) {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 })
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: outPath, fullPage: true })
  } finally {
    await browser.close()
  }
}

// Run Codex vision judge on a PNG, return parsed verdict
function judgeImage(stem, imgPath) {
  const outFile = join(VERDICTS_DIR, stem.replace(/\//g, '_') + '.json')
  if (existsSync(outFile)) rmSync(outFile)
  const rubric = buildJudgePrompt(stem)
  const prompt = `${rubric}\n\nWrite ONLY that JSON object to the file ${outFile} (overwrite). Do not print anything else.`
  try {
    execFileSync('codex', [
      'exec',
      '--skip-git-repo-check',
      '--dangerously-bypass-approvals-and-sandbox',
      prompt,
      '-i', imgPath
    ], {
      cwd: here,
      timeout: 180000,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
    })
  } catch (e) {
    // codex may exit non-zero after writing; fall through to read
  }
  if (!existsSync(outFile)) return { error: 'judge wrote no verdict' }
  let raw = readFileSync(outFile, 'utf8').trim()
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return { error: 'unparseable verdict', raw: raw.slice(0, 200) }
  let v
  try { v = JSON.parse(m[0]) } catch (e) { return { error: 'bad json: ' + e.message, raw: m[0].slice(0, 200) } }
  v.overall = weightedOverall(v.scores)
  return v
}

// Process each set
let totalScored = 0
const perSetCounts = {}
const failures = []

for (const set of SETS) {
  const setDir = join(VARIATIONS_ROOT, set)
  if (!existsSync(setDir)) {
    console.error(`Set dir missing: ${setDir}`)
    perSetCounts[set] = 0
    continue
  }

  // Find HTML files
  const htmlFiles = readdirSync(setDir).filter(f => f.endsWith('.html'))

  perSetCounts[set] = 0

  for (const htmlFile of htmlFiles) {
    const stem = basename(htmlFile, '.html')
    const key = `${set}/${stem}`
    const htmlPath = join(setDir, htmlFile)
    const shotPath = join(SHOTS_DIR, `${set}_${stem}.png`)

    process.stderr.write(`  [${key}] screenshotting … `)
    try {
      await screenshot(htmlPath, shotPath)
    } catch (e) {
      process.stderr.write(`FAILED screenshot: ${e.message}\n`)
      failures.push({ key, error: `screenshot: ${e.message}` })
      continue
    }
    process.stderr.write(`ok. judging … `)

    const verdict = judgeImage(key, shotPath)
    if (verdict.error) {
      process.stderr.write(`FAILED judge: ${verdict.error}\n`)
      failures.push({ key, error: `judge: ${verdict.error}` })
      continue
    }

    // Write into review-state immediately
    reviewState.reviews[key] = {
      scores: {
        overall: verdict.overall,
        scores: verdict.scores,
        worst: verdict.worst,
        critique: verdict.critique
      },
      status: 'reviewed',
      at: new Date().toISOString()
    }
    writeFileSync(REVIEW_STATE_PATH, JSON.stringify(reviewState, null, 2))

    process.stderr.write(`overall ${verdict.overall}\n`)
    totalScored++
    perSetCounts[set]++
  }
}

// Summary
console.log('\n=== SCORING COMPLETE ===')
console.log(`Total scored: ${totalScored}`)
for (const [set, count] of Object.entries(perSetCounts)) {
  console.log(`  ${set}: ${count}`)
}
if (failures.length) {
  console.log(`\nFailures (${failures.length}):`)
  for (const f of failures) console.log(`  ${f.key}: ${f.error}`)
}
const totalKeys = Object.keys(reviewState.reviews).length
console.log(`\nreview-state.json total keys: ${totalKeys}`)
console.log('Sets with entries:', [...new Set(Object.keys(reviewState.reviews).map(k => k.split('/')[0]))].join(', '))
