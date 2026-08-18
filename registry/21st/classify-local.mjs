#!/usr/bin/env node
// Tag the remaining components from their own metadata, offline.
//
// Two upstream sources are exhausted at this point and both are truncated:
//   classify.mjs      scrapes /community/components/s/<tag> — ground truth, but
//                     each tag page renders only ~190 members
//   classify-fill.mjs queries the semantic API — deeper, but it ranks by
//                     popularity, so it keeps returning the same well-known
//                     components and never reaches the long tail
//
// 3,306 components (41.6%) are left. We already hold their slug, name and
// description locally, and a component called "delete-button" is a button
// whatever the browse page chose to render. So match those strings against the
// same 75-tag vocabulary.
//
// Tagged source:"local" — the weakest of the three, and marked as such so a
// consumer can prefer page > api > local.
//
//   node classify-local.mjs
//   node classify-local.mjs --dry-run
//
// Rewrites classification.json in place, never overwriting stronger sources.

import { readdir, readFile, writeFile } from 'node:fs/promises'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve paths against this file, not the caller's cwd, so the script works
// from the repo root and from CI — not only from its own directory.
const HERE = dirname(fileURLToPath(import.meta.url))
const R = p => join(HERE, p)


const DRY = process.argv.includes('--dry-run')
const cls = JSON.parse(await readFile(R('classification.json'), 'utf8'))

// Aliases map real-world naming onto the official vocabulary. Kept explicit:
// a wrong alias silently mislabels hundreds of components, which is the exact
// failure mode of the old search-term "category" field.
const ALIAS = {
  accordion: ['accordion', 'collapse', 'disclosure'],
  'ai-chat': ['ai chat', 'chatbot', 'chat bot', 'assistant', 'llm', 'prompt box'],
  alert: ['alert', 'banner warning', 'callout'],
  announcement: ['announcement', 'changelog'],
  avatar: ['avatar', 'profile pic', 'user image'],
  background: ['background', 'backdrop', 'gradient bg', 'aurora', 'particles', 'mesh'],
  badge: ['badge', 'chip', 'pill', 'label'],
  border: ['border', 'outline', 'glow border'],
  button: ['button', 'btn', 'cta button'],
  calendar: ['calendar', 'datepicker', 'date picker', 'schedule'],
  card: ['card', 'tile'],
  carousel: ['carousel', 'slider show', 'swiper', 'slideshow'],
  checkbox: ['checkbox', 'check box'],
  clients: ['clients', 'logos', 'logo cloud', 'brands'],
  comparison: ['comparison', 'compare', 'before after', 'versus'],
  cta: ['cta', 'call to action'],
  cursor: ['cursor', 'pointer', 'mouse follow'],
  dashboard: ['dashboard', 'admin panel', 'analytics'],
  'data-visualization': ['chart', 'graph', 'plot', 'visualization', 'bar chart', 'line chart'],
  'date-picker': ['date picker', 'datepicker'],
  dock: ['dock', 'macos dock', 'taskbar'],
  dropdown: ['dropdown', 'drop down', 'combobox'],
  'empty-state': ['empty state', 'no results', 'placeholder state'],
  faq: ['faq', 'frequently asked', 'questions'],
  features: ['feature', 'features', 'bento'],
  'file-tree': ['file tree', 'directory tree', 'explorer'],
  footer: ['footer'],
  form: ['form', 'contact form', 'signup form', 'input group'],
  gallery: ['gallery', 'masonry', 'photo grid', 'lightbox'],
  globe: ['globe', 'world map', 'earth'],
  grid: ['grid', 'bento grid', 'layout grid'],
  hero: ['hero', 'landing header', 'above the fold'],
  hook: ['hook', 'use-', 'usehook'],
  icon: ['icon', 'iconset', 'icons'],
  image: ['image', 'picture', 'photo', 'img'],
  input: ['input', 'text field', 'textfield', 'search box'],
  link: ['link', 'anchor', 'hyperlink'],
  list: ['list', 'listview', 'item list'],
  map: ['map', 'maps', 'location'],
  marquee: ['marquee', 'ticker', 'scrolling text', 'infinite scroll text'],
  menu: ['menu', 'context menu', 'command menu'],
  modal: ['modal', 'dialog', 'popup', 'drawer', 'sheet'],
  'navigation-menu': ['navbar', 'navigation', 'nav menu', 'header nav', 'menu bar'],
  notification: ['notification', 'toast', 'snackbar'],
  number: ['number', 'counter', 'countup', 'ticker number'],
  onboarding: ['onboarding', 'walkthrough', 'tour', 'wizard'],
  pagination: ['pagination', 'paginate', 'page nav'],
  popover: ['popover', 'hovercard', 'hover card'],
  'pricing-section': ['pricing', 'plans', 'tiers', 'subscription'],
  profile: ['profile', 'user card', 'bio'],
  progress: ['progress', 'progressbar', 'loading bar'],
  'radio-group': ['radio', 'radio group'],
  'scroll-area': ['scroll', 'scrollbar', 'parallax', 'scroll reveal'],
  search: ['search', 'autocomplete', 'typeahead'],
  select: ['select', 'picker', 'multiselect'],
  sidebar: ['sidebar', 'side nav', 'drawer nav'],
  'sign-in': ['sign in', 'signin', 'login', 'log in'],
  'sign-up': ['sign up', 'signup', 'register', 'registration'],
  slider: ['slider', 'range'],
  spinner: ['spinner', 'loader', 'loading'],
  stat: ['stat', 'stats', 'metric', 'kpi'],
  steps: ['steps', 'stepper', 'timeline steps'],
  table: ['table', 'datagrid', 'data grid'],
  tabs: ['tabs', 'tab bar'],
  team: ['team', 'staff', 'people'],
  testimonials: ['testimonial', 'review', 'quote'],
  text: ['text', 'typography', 'heading', 'title effect', 'text effect'],
  textarea: ['textarea', 'text area'],
  timeline: ['timeline', 'history'],
  toast: ['toast', 'snackbar'],
  toggle: ['toggle', 'switch', 'theme switch', 'dark mode'],
  tooltip: ['tooltip', 'hint'],
  'upload-download': ['upload', 'download', 'dropzone', 'file input'],
  video: ['video', 'player', 'youtube', 'mp4'],
}

for (const t of cls.taxonomy) if (!ALIAS[t]) ALIAS[t] = [t.replace(/-/g, ' ')]

const tagged = cls.componentToTags
let scanned = 0, newlyTagged = 0, tagsAdded = 0
const preview = []

for (const d of (await readdir(R('harvest'))).filter(x => x.includes('__'))) {
  let m
  try { m = JSON.parse(await readFile(R(`harvest/${d}/meta.json`), 'utf8')) } catch { continue }
  scanned++
  const existing = tagged[m.url]
  if (existing && existing.length) continue

  // The slug/name say what a component IS. The description often says where it
  // can be USED ("...for hero sections, cards, and retro backgrounds"), which
  // matched 4 unrelated tags onto a component called `test`. So identity comes
  // from slug+name; the description only contributes when the slug yielded
  // nothing, and then only its single best hit.
  const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text => {
    const hay = text.toLowerCase().replace(/[-_]/g, ' ')
    return Object.entries(ALIAS)
      .filter(([, words]) => words.some(w => new RegExp(`\\b${esc(w)}`).test(hay)))
      .map(([tag]) => tag)
  }

  let hits = match(`${m.slug} ${m.name || ''}`)
  if (!hits.length && m.description) {
    // fall back to the description, but take only the longest alias match —
    // one weak signal, not a scattergun.
    const d = m.description.toLowerCase().replace(/[-_]/g, ' ')
    let best = null, bestLen = 0
    for (const [tag, words] of Object.entries(ALIAS)) {
      for (const w of words) {
        if (w.length > bestLen && new RegExp(`\\b${esc(w)}`).test(d)) { best = tag; bestLen = w.length }
      }
    }
    if (best) hits = [best]
  }
  if (!hits.length) continue
  tagged[m.url] = hits.map(tag => ({ tag, source: 'local' }))
  newlyTagged++; tagsAdded += hits.length
  if (preview.length < 8) preview.push(`${m.slug} -> ${hits.join(', ')}`)
}

console.log(`scanned ${scanned} · newly tagged ${newlyTagged} · tags added ${tagsAdded}`)
preview.forEach(p => console.log('  ', p))
if (DRY) { console.log('\n(dry run — nothing written)'); process.exit(0) }

const tagCounts = {}
for (const list of Object.values(tagged)) for (const { tag } of list) tagCounts[tag] = (tagCounts[tag] || 0) + 1
const bySource = { page: 0, api: 0, local: 0 }
for (const list of Object.values(tagged)) {
  const s = list.some(x => x.source === 'page') ? 'page' : list.some(x => x.source === 'api') ? 'api' : 'local'
  bySource[s]++
}

cls.componentToTags = tagged
cls.tagCounts = Object.fromEntries(Object.entries(tagCounts).sort((a, b) => b[1] - a[1]))
cls.stats = { ...cls.stats, taggedTotal: Object.keys(tagged).length, bySource }
await writeFile(R('classification.json'), JSON.stringify(cls, null, 2))
console.log(`\ntagged total ${cls.stats.taggedTotal} · page ${bySource.page} · api ${bySource.api} · local ${bySource.local}`)
console.log('-> classification.json')
