// Enumerate components from AUTHOR PROFILE pages — an independent surface to
// the sitemap, which we measured to be materially incomplete (it omitted ~25%
// of the components on the six largest authors' profiles).
import { writeFile } from 'node:fs/promises'
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; siso-ui-base harvester)' }
const CONC = Number(process.env.CONC || 8)

const xml = await (await fetch('https://21st.dev/sitemap.xml', { headers: UA })).text()
const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1])
const sitemapComps = locs.filter(u => u.includes('/components/') && u.split('/')[3]?.startsWith('@'))
const sitemapSet = new Set(sitemapComps)
const authors = [...new Set(sitemapComps.map(u => u.split('/')[3]))]
console.log(`sitemap: ${sitemapComps.length} components across ${authors.length} authors`)

const all = new Set(sitemapComps)
let done = 0, failed = 0
const queue = [...authors]
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) {
    const a = queue.shift()
    try {
      const html = await (await fetch(`https://21st.dev/${a}`, { headers: UA })).text()
      for (const m of html.matchAll(/\\?\/(@[\w.\-]+)\\?\/([\w\-]+)\\?\/([\w\-]+)/g)) {
        if (m[1] === a && m[2] === 'components') all.add(`https://21st.dev/${m[1]}/${m[2]}/${m[3]}`)
      }
    } catch { failed++ }
    if (++done % 50 === 0) console.log(`  ${done}/${authors.length} authors · union ${all.size}`)
  }
}))

const extra = [...all].filter(u => !sitemapSet.has(u))
console.log(`\nauthors swept: ${done} (${failed} failed)`)
console.log(`sitemap-only   : ${sitemapComps.length}`)
console.log(`profile-extra  : ${extra.length}`)
console.log(`UNION          : ${all.size}`)
await writeFile('urls-union.json', JSON.stringify({ union: [...all].sort(), extra: extra.sort() }, null, 2))
console.log('-> urls-union.json')
