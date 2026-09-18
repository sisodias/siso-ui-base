# BykonzYard comp swap — agent brief

You are replacing one surface. One surface per agent, one commit per surface.

## The rule that matters

**Rob the comp. Do not hand-roll CSS.**

Shaan, 18 Sep: *"you should be robbing comps, not doing the bullshit you're
doing... if you robbed a comp out the box you wouldn't have that issue."*

The failure this brief exists to prevent: a previous pass "fixed" these
surfaces by editing padding and font-size on the existing hand-rolled markup.
That is not the job. The job is to take a component that already works, adapt
its structure, and delete the hand-rolled CSS it replaces.

If your diff is mostly `font-size:` and `padding:` changes to existing rules,
you have done the wrong thing. Start over.

## Your inputs

- `surfaces.json` — your surface: the client quote, the MEASURED defect, and
  the acceptance criteria. All three are binding.
- `picks.json` / the exported work order — the comps Shaan chose by looking at
  previews. Use one of those. Do not substitute your own pick.
- Source on disk: `registry/21st-source-harvest/source/<id>/code.tsx`.
  Read it. It is real TSX, not a screenshot.

## How to do it

1. Read the donor `code.tsx` and the current component named in `file`.
2. Take the donor's **structure** — element hierarchy, how image/title/meta
   relate, how it handles overflow. Adapt to our tokens (see below).
3. Delete the hand-rolled CSS the donor's structure replaces. Leave the file
   smaller than you found it, or say why not.
4. Wire our real data. Never introduce placeholder copy or fake content.
5. Verify (below). Commit with the measurement in the message.

## Tokens — adapt, never paste

Our palette is on `:root` in `src/site/site.css`: `--plum`, `--plum-deep`,
`--plum-raised`, `--gold`, `--gold-bright`, `--lilac`, `--text`, `--muted`,
`--line`. Fonts: `--font-display` (Anton), `--font-heading` (Fredoka),
`--font-body` (Work Sans), `--font-mono` (Space Mono).

A donor arriving with Tailwind classes or its own colours must be converted to
these. A pasted comp in someone else's palette is a failed swap.

## Hard budget — every surface, measured at 390x844

| Rule | Value |
|---|---|
| Card height | <= 45vh (380px) |
| Title | <= 2 lines |
| Font size | >= 10px for any text over 12 chars |
| Tap target | >= 32px on any interactive element |
| Horizontal scroll | 0 |
| Console errors | 0 |

Plus your surface's own `accept` line in `surfaces.json`.

## Verify — in a real browser, not camofox

Camofox is blocked by YouTube and geo-blocked here; it reported a working
embed as "unavailable" and returned byte-identical screenshots after a click.
Use headless Chromium from `react-preview/`:

```js
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', e => console.log('ERR', String(e).slice(0,100)));
await p.goto('http://127.0.0.1:5173/<your-route>', { waitUntil: 'networkidle' });
// measure YOUR surface: card height, title lines, image share, tap targets
```

Report the before and after numbers in the commit message. "Looks better" is
not a result.

## Traps in this repo

1. `rm -rf dist` before every `npm run build` — it exits 0 on a stale bundle.
2. `content/pages/*.json` is a **strict** Zod schema. An unknown key blanks
   every page at runtime. Change `src/core/content-schema.ts` in the same commit.
3. Routes are `/bykonz-about`, not `/about`. A wrong path returns **200 with a
   blank page**, not a 404.
4. 4 tests in `phase2.test.tsx` and 4 in `home-music.test.ts` already fail on
   `client-customiser`. Confirm with `git stash` before blaming your change.
5. Branch is `client-customiser`. Never push to `main`.
6. Deploy previews go to `bykonzyard-variants`. The project named `bykonzyard`
   is the LIVE client site on bykonz.co.uk — do not deploy there.

## Real assets — use these, not stock

- 167 real event photos: https://bykonz-photos.pages.dev (`full/`, `thumb/`)
- 21 curated shots: `react-preview/public/assets/gallery/`
- 54 beach/section backgrounds: `react-preview/public/assets/bg/`
- **Do not use** `public/assets/generated/**` for anything with people in it.
  All 90 images there are empty AI backdrops — no people, no logo. Shaan has
  called this out.

## Done means

- Acceptance criteria met, with numbers.
- Hand-rolled CSS for that surface deleted, not added to.
- `rm -rf dist && npm run build` exits 0.
- One commit, message carries before/after measurements.
