#!/usr/bin/env node

// D3: inventory the retrieved source locally. No network calls are made here.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARVEST = join(HERE, '..', '21st', 'harvest')
const SOURCE = join(HERE, 'source')
const CLASSIFICATION = join(HERE, '..', '21st', 'classification.json')
const INVENTORY_JSONL = join(HERE, 'source-inventory.jsonl')
const SUMMARY_JSON = join(HERE, 'source-inventory-summary.json')
const REPORT_MD = join(HERE, 'source-inventory.md')
const STATE_PATH = join(HERE, 'STATE.md')

const pct = value => value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`

function sortedEntries(object) {
  return Object.entries(object).sort(([a], [b]) => a.localeCompare(b))
}

function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/')
  return specifier.split('/')[0]
}

function packageFamily(specifier) {
  const name = packageName(specifier)
  if (name === 'motion' || name === 'framer-motion' || name === 'motion-dom') return 'motion'
  if (name.startsWith('@hugeicons/')) return 'hugeicons'
  if (name.startsWith('@radix-ui/')) return 'radix'
  if (name === 'lucide-react') return 'lucide'
  if (name === 'react' || name === 'react-dom') return 'react'
  if (name === 'next') return 'next'
  return name
}

function isLocalSpecifier(specifier) {
  return specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('~/') || specifier.startsWith('#/')
}

function siblingSlug(specifier) {
  const match = specifier.match(/^@\/components\/ui\/([^/]+)/)
  if (!match) return null
  return match[1].replace(/\.(?:tsx?|jsx?)$/, '')
}

function extractImports(source) {
  const specs = []
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specs.push(match[1])
  }
  return specs
}

function emptyStat() {
  return { imports: 0, files: new Set() }
}

function incrementStat(map, key, id, occurrences = 1) {
  if (!map.has(key)) map.set(key, emptyStat())
  const stat = map.get(key)
  stat.imports += occurrences
  stat.files.add(id)
}

function serialiseStats(map) {
  return Object.fromEntries([...map.entries()]
    .sort(([, a], [, b]) => b.files.size - a.files.size || b.imports - a.imports)
    .map(([name, stat]) => [name, { files: stat.files.size, imports: stat.imports }]))
}

async function loadHarvestRows() {
  const entries = (await readdir(HARVEST, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name.includes('__'))
  const rows = []
  for (const entry of entries) {
    const meta = JSON.parse(await readFile(join(HARVEST, entry.name, 'meta.json'), 'utf8'))
    rows.push({ id: meta.id || entry.name, author: meta.author, slug: meta.slug, upstreamUrl: meta.url })
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id))
}

async function loadSourceMeta() {
  const entries = (await readdir(SOURCE, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
  const rows = []
  for (const entry of entries) {
    const meta = JSON.parse(await readFile(join(SOURCE, entry.name, 'source-meta.json'), 'utf8'))
    rows.push(meta)
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id))
}

function groupSummary(rows, key) {
  const groups = new Map()
  for (const row of rows) {
    const value = row[key] || 'unknown'
    if (!groups.has(value)) groups.set(value, [])
    groups.get(value).push(row)
  }
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) => {
    const retrieved = group.filter(row => row.outcome === 'retrieved').length
    const siblingSources = group.filter(row => row.uiSiblingImports.length > 0).length
    return [name, {
      n: group.length,
      retrieved,
      retrievedRate: group.length ? retrieved / group.length : null,
      selfContained: group.length - siblingSources,
      siblingImportSources: siblingSources,
    }]
  }))
}

function markdown(summary) {
  const lines = [
    '# D3 source inventory',
    '',
    `Generated ${summary.generatedAt} from ${summary.retrieved} locally retrieved sources joined to ${summary.corpusTotal} harvest records. This pass is local-only; it issued no network requests.`,
    '',
    `**Headline:** ${summary.retrieved} source files are available (${pct(summary.retrieved / summary.corpusTotal)} of the corpus). Using the explicit definition “self-contained = no ` + '`@/components/ui/<other>`' + ` import”, ${summary.selfContained} are self-contained and ${summary.sourcesWithUiSiblingImports} import at least one UI sibling.`,
    '',
    '## Source shape',
    '',
    '| Measure | Count |',
    '|---|---:|',
    `| Retrieved source files | ${summary.retrieved} |`,
    `| Self-contained by UI-sibling definition | ${summary.selfContained} |`,
    `| Files importing ` + '`@/components/ui/<other>`' + ` | ${summary.sourcesWithUiSiblingImports} |`,
    `| Files with any local import (alias/relative) | ${summary.sourcesWithAnyLocalImport} |`,
    `| Unique UI sibling specifiers | ${summary.uniqueUiSiblingSpecifiers} |`,
    `| UI sibling import edges | ${summary.uiSiblingImportEdges} |`,
    '',
    '## One-hop sibling closure',
    '',
    'Resolution is local and conservative: same-author slug matches win; otherwise a unique slug match is used. No sibling network fetches were made.',
    '',
    '| Closure status | Edges |',
    '|---|---:|',
    ...Object.entries(summary.siblingClosure.statusCounts).map(([status, count]) => `| ${status} | ${count} |`),
    '',
    `Resolved retrieved sibling edges: ${summary.siblingClosure.resolvedRetrievedEdges}; unresolved/not-in-harvest edges: ${summary.siblingClosure.unresolvedEdges}.`,
    '',
    '## Package usage',
    '',
    '| Package | Source files | Import occurrences |',
    '|---|---:|---:|',
    ...Object.entries(summary.packageUsage).slice(0, 30).map(([name, stat]) => `| ${name} | ${stat.files} | ${stat.imports} |`),
    '',
    '### Package families',
    '',
    '| Family | Source files | Import occurrences |',
    '|---|---:|---:|',
    ...Object.entries(summary.packageFamilies).map(([name, stat]) => `| ${name} | ${stat.files} | ${stat.imports} |`),
    '',
    '## 75-tag family join',
    '',
    'Counts below join each retrieved source to the existing classification by upstream URL. Components are allowed to appear in multiple families.',
    '',
    '| Tag/family | Corpus members | Retrieved source | Source coverage | CDN 404-gated | Other unavailable |',
    '|---|---:|---:|---:|---:|---:|',
    ...Object.entries(summary.byFamily).map(([tag, stat]) => `| ${tag} | ${stat.corpusMembers} | ${stat.retrieved} | ${pct(stat.retrievedRate)} | ${stat.gated404} | ${stat.otherUnavailable} |`),
    '',
    '## Interpretation and limits',
    '',
    '- This inventory measures source that the harvester actually retrieved; it does not infer source from compiled bundles or demos.',
    '- “Self-contained” is intentionally narrow and structural: it only means no `@/components/ui/<other>` import. External packages and relative utility imports may still be present.',
    '- One-hop closure records whether a sibling slug maps to a locally retrieved/gated/unavailable component. It does not claim that a missing slug cannot exist outside this 7,949-record harvest.',
    '- Per-file details, exact imports, package names, tags, and sibling closure records are in `source-inventory.jsonl`; aggregate machine data is in `source-inventory-summary.json`.',
    '',
  ]
  return lines.join('\n')
}

async function main() {
  const harvestRows = await loadHarvestRows()
  const sourceMeta = await loadSourceMeta()
  const sourceById = new Map(sourceMeta.map(meta => [meta.id, meta]))
  const harvestById = new Map(harvestRows.map(row => [row.id, row]))
  const classification = JSON.parse(await readFile(CLASSIFICATION, 'utf8'))
  const taxonomy = [...new Set(classification.taxonomy || [])]
  const tagsByUrl = new Map(Object.entries(classification.componentToTags || {}).map(([url, tags]) => [url, [...new Set((tags || []).map(tag => tag.tag).filter(Boolean))]]))

  const packageUsage = new Map()
  const packageFamilies = new Map()
  const analyses = []
  const analysisById = new Map()
  for (const meta of sourceMeta.filter(row => row.outcome === 'retrieved')) {
    const body = await readFile(join(SOURCE, meta.id, 'code.tsx'), 'utf8')
    const imports = extractImports(body)
    const uniqueImports = [...new Set(imports)]
    const localImports = uniqueImports.filter(isLocalSpecifier)
    const uiSiblingImports = uniqueImports.filter(specifier => siblingSlug(specifier))
    const externalImports = imports.filter(specifier => !isLocalSpecifier(specifier) && !specifier.startsWith('node:') && !specifier.startsWith('http'))
    const packageOccurrences = new Map()
    for (const specifier of externalImports) {
      const name = packageName(specifier)
      packageOccurrences.set(name, (packageOccurrences.get(name) || 0) + 1)
    }
    for (const [name, occurrences] of packageOccurrences) {
      incrementStat(packageUsage, name, meta.id, occurrences)
      incrementStat(packageFamilies, packageFamily(name), meta.id, occurrences)
    }
    const harvest = harvestById.get(meta.id)
    const tags = tagsByUrl.get(harvest?.upstreamUrl) || []
    const analysis = {
      id: meta.id,
      author: meta.author,
      slug: meta.slug,
      upstreamUrl: meta.upstreamUrl,
      bytes: meta.bytes,
      sha256: meta.sha256,
      fetchedAt: meta.fetchedAt,
      versionedFilename: meta.versionedFilename,
      codeUrl: meta.codeUrl,
      selfContained: uiSiblingImports.length === 0,
      imports: uniqueImports,
      localImports,
      uiSiblingImports,
      uiSiblingSlugs: [...new Set(uiSiblingImports.map(siblingSlug))],
      externalImports: uniqueImports.filter(specifier => !isLocalSpecifier(specifier) && !specifier.startsWith('node:') && !specifier.startsWith('http')),
      packages: [...packageOccurrences.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, imports]) => ({ name, imports, family: packageFamily(name) })),
      tags,
      siblingClosure: [],
    }
    analyses.push(analysis)
    analysisById.set(meta.id, analysis)
  }

  const byAuthorSlug = new Map()
  const bySlug = new Map()
  for (const meta of sourceMeta) {
    const key = `${meta.author}\u0000${meta.slug}`
    byAuthorSlug.set(key, meta.id)
    if (!bySlug.has(meta.slug)) bySlug.set(meta.slug, [])
    bySlug.get(meta.slug).push(meta.id)
  }
  const closureStatusCounts = {}
  let uiSiblingImportEdges = 0
  let resolvedRetrievedEdges = 0
  let unresolvedEdges = 0
  const uniqueUiSiblingSpecifiers = new Set()
  for (const analysis of analyses) {
    for (const specifier of analysis.uiSiblingImports) {
      const slug = siblingSlug(specifier)
      const exactId = byAuthorSlug.get(`${analysis.author}\u0000${slug}`)
      const candidates = exactId ? [exactId] : (bySlug.get(slug) || []).sort()
      const candidateMeta = candidates.map(id => sourceById.get(id)).filter(Boolean)
      let status = 'not-in-harvest'
      if (candidateMeta.length === 1) status = candidateMeta[0].outcome
      else if (candidateMeta.length > 1) status = 'ambiguous-slug'
      if (status === 'retrieved') resolvedRetrievedEdges++
      else unresolvedEdges++
      uiSiblingImportEdges++
      uniqueUiSiblingSpecifiers.add(specifier)
      closureStatusCounts[status] = (closureStatusCounts[status] || 0) + 1
      analysis.siblingClosure.push({
        specifier,
        slug,
        candidates,
        status,
        childImports: candidateMeta.filter(meta => meta.outcome === 'retrieved').flatMap(meta => analysisById.get(meta.id)?.uiSiblingSlugs || []),
      })
    }
  }

  const familyNames = [...new Set([...taxonomy, ...Array.from(tagsByUrl.values()).flat(), 'untagged'])]
  const byFamily = Object.fromEntries(familyNames.map(tag => [tag, { corpusMembers: 0, retrieved: 0, gated404: 0, otherUnavailable: 0, retrievedRate: null }]))
  for (const row of harvestRows) {
    const source = sourceById.get(row.id)
    const tags = tagsByUrl.get(row.upstreamUrl) || []
    const families = tags.length ? tags : ['untagged']
    for (const tag of families) {
      const stat = byFamily[tag] || (byFamily[tag] = { corpusMembers: 0, retrieved: 0, gated404: 0, otherUnavailable: 0, retrievedRate: null })
      stat.corpusMembers++
      if (source?.outcome === 'retrieved') stat.retrieved++
      else if (source?.outcome === 'gated-404') stat.gated404++
      else stat.otherUnavailable++
    }
  }
  for (const stat of Object.values(byFamily)) stat.retrievedRate = stat.corpusMembers ? stat.retrieved / stat.corpusMembers : null

  const sourceWithAnyLocalImport = analyses.filter(analysis => analysis.localImports.length > 0).length
  const sourcesWithUiSiblingImports = analyses.filter(analysis => analysis.uiSiblingImports.length > 0).length
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    corpusTotal: harvestRows.length,
    retrieved: analyses.length,
    selfContained: analyses.filter(analysis => analysis.selfContained).length,
    sourcesWithUiSiblingImports,
    sourcesWithAnyLocalImport: sourceWithAnyLocalImport,
    uniqueUiSiblingSpecifiers: uniqueUiSiblingSpecifiers.size,
    uiSiblingImportEdges,
    sourceByOutcome: Object.fromEntries([...new Set(sourceMeta.map(meta => meta.outcome))].sort().map(outcome => [outcome, sourceMeta.filter(meta => meta.outcome === outcome).length])),
    packageUsage: serialiseStats(packageUsage),
    packageFamilies: serialiseStats(packageFamilies),
    siblingClosure: {
      statusCounts: Object.fromEntries(Object.entries(closureStatusCounts).sort(([a], [b]) => a.localeCompare(b))),
      resolvedRetrievedEdges,
      unresolvedEdges,
    },
    byFamily: Object.fromEntries(Object.entries(byFamily).sort(([a], [b]) => a.localeCompare(b))),
    byAuthorBand: groupSummary(analyses, 'authorBand'),
  }
  // Keep author-band data useful even though author rank is not part of source-meta.
  const authorCounts = new Map()
  for (const row of harvestRows) authorCounts.set(row.author, (authorCounts.get(row.author) || 0) + 1)
  const authorOrder = [...authorCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const authorRank = new Map(authorOrder.map(([author], index) => [author, index]))
  for (const analysis of analyses) {
    const rank = authorRank.get(analysis.author)
    analysis.authorRank = rank + 1
    analysis.authorBand = rank < 15 ? 'top15' : rank < 100 ? 'mid16-100' : 'tail101+'
  }
  summary.byAuthorBand = groupSummary(analyses, 'authorBand')

  const jsonl = analyses.sort((a, b) => a.id.localeCompare(b.id)).map(analysis => JSON.stringify(analysis)).join('\n') + '\n'
  await writeFile(INVENTORY_JSONL, jsonl)
  await writeFile(SUMMARY_JSON, JSON.stringify(summary, null, 2) + '\n')
  await writeFile(REPORT_MD, markdown(summary))
  await writeFile(STATE_PATH, `# 21st source harvest lane state\n\n` +
    `- stage: D3 complete — awaiting D4\n` +
    `- updated: ${new Date().toISOString()}\n` +
    `- corpus: ${summary.corpusTotal}\n` +
    `- d1 sample: 330 (complete)\n` +
    `- d2 processed with final metadata: ${summary.corpusTotal}/${summary.corpusTotal}\n` +
    `- d2 retrieved: ${summary.retrieved}\n` +
    `- d2 gated 404: ${summary.sourceByOutcome['gated-404'] || 0}\n` +
    `- d2 unavailable total: ${summary.corpusTotal - summary.retrieved}\n` +
    `- d3 retrieved inventory: ${summary.retrieved}\n` +
    `- d3 self-contained: ${summary.selfContained}\n` +
    `- d3 UI-sibling import sources: ${summary.sourcesWithUiSiblingImports}\n` +
    `- d3 package families: ${Object.keys(summary.packageFamilies).length}\n` +
    `- d3 family rows: ${Object.keys(summary.byFamily).length}\n` +
    `- resume point: D3 artifacts written\n` +
    `- d4 gated count: pending\n`)
  console.log(JSON.stringify({
    stage: 'D3 complete',
    retrieved: summary.retrieved,
    selfContained: summary.selfContained,
    sourcesWithUiSiblingImports: summary.sourcesWithUiSiblingImports,
    uiSiblingImportEdges,
    uniqueUiSiblingSpecifiers: uniqueUiSiblingSpecifiers.size,
    packageFamilies: Object.keys(summary.packageFamilies).length,
    familyRows: Object.keys(summary.byFamily).length,
    artifacts: [REPORT_MD, SUMMARY_JSON, INVENTORY_JSONL],
  }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error.stack || error)
    process.exitCode = 1
  })
}
