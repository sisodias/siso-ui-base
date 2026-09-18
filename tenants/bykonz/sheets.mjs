#!/usr/bin/env node
// Build one contact sheet per surface so a HUMAN (and the model) can judge the
// shortlist by looking, not by reading names.
//
// Why this exists: text ranking put three bare empty <input> boxes in the
// contact-form top 6. Their descriptions said "input with validation"; their
// previews are a white rectangle. Shaan, 18 Sep: "you're not actually looking
// at the screenshots and seeing if it applies."
//
// Writes /tmp/byk-sheets/<surface>.png — a labelled 3-up grid of the shortlist.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const H = join(ROOT, 'registry', '21st', 'harvest')
const OUT = process.env.OUT || '/tmp/byk-sheets'
const sl = JSON.parse(await readFile(join(HERE, 'shortlist.json'), 'utf8'))
await mkdir(OUT, { recursive: true })

// Uses the Python/PIL already on this machine — no new dependency for a
// throwaway visual aid.
const PY = `
import json,sys,os
from PIL import Image, ImageDraw
rows=json.loads(sys.argv[1]); H=sys.argv[2]; out=sys.argv[3]
ims=[]
for r in rows:
    f=os.path.join(H,r['id'],'preview.webp')
    if not os.path.exists(f): continue
    im=Image.open(f).convert('RGB'); im.thumbnail((430,430))
    ims.append((r,im))
if not ims: sys.exit(0)
W=max(i.width for _,i in ims); Hh=max(i.height for _,i in ims)
cols=3; rowsn=(len(ims)+cols-1)//cols
LAB=34
sheet=Image.new('RGB',(cols*(W+12)+12, rowsn*(Hh+LAB+12)+12),(11,4,18))
d=ImageDraw.Draw(sheet)
for n,(r,im) in enumerate(ims):
    x=(n%cols)*(W+12)+12; y=(n//cols)*(Hh+LAB+12)+12
    sheet.paste(im,(x,y))
    pin='* ' if r.get('pinned') else ''
    d.text((x+2,y+Hh+4), f"{n+1}. {pin}{r['name'][:30]}", fill=(240,200,132))
    d.text((x+2,y+Hh+18), f"score {r['score']} | {','.join(r.get('why',[])[:2])[:46]}", fill=(158,145,175))
sheet.save(out)
print(out)
`
for (const [surf, rows] of Object.entries(sl)) {
  if (!rows?.length) continue
  const out = join(OUT, `${surf}.png`)
  try {
    await run('python3', ['-c', PY, JSON.stringify(rows), H, out])
    console.log(`${surf.padEnd(14)} ${rows.length} comps -> ${out}`)
  } catch (e) { console.log(`${surf.padEnd(14)} FAILED ${String(e).slice(0, 80)}`) }
}
