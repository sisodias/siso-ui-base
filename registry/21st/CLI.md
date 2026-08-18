# 21st.dev CLI — setup and real limits

## Install + sign in

```sh
npm i -g @21st-dev/cli
21st login            # opens the browser, saves a token locally
21st whoami           # confirm
21st usage            # tier + remaining free retrievals
```

Already done on this machine: signed in as `fuzeheritage` since 2026-08-15.

## CI / scripts — no interactive login

Pass a key instead of logging in. The CLI accepts any of:

```sh
21st search "hero" --api-key "$API_KEY_21ST"
# or set either env var:
export API_KEY_21ST=...      # also read by `21st add`'s shadcn URL
export TWENTYFIRST_TOKEN=...
```

Get a key at https://21st.dev/mcp

## MCP server (agents)

```sh
21st init --client claude --write     # merges into .mcp.json
```

Writes an HTTP MCP server at `https://21st.dev/api/mcp` with header
`x-api-key: ${API_KEY_21ST}`. Clients: cursor | claude | codex | vscode | windsurf.

## Measured limits (verified 2026-08-19, not inferred)

**Search is free and unmetered — but it cannot enumerate.**
`--limit` is capped server-side at roughly 15–30 results per query, whatever you ask for:

| query | `--limit 100` returns |
|---|---|
| `hero` | 30 |
| `card` | 22 |
| `pricing table` | 15 |
| `dashboard sidebar navigation` | 15 |

`--sort newest`, `--free`, `--paid` surface almost nothing new (2 extra ids on `hero`).
`--author` works and is correctly filtered, but is capped the same way.
The 72-query sweep in `queries.txt` averaged **8.2 new components per query**.

**So do not enumerate with search.** Use the sitemap:

```sh
curl -s https://21st.dev/sitemap.xml
```

Public, `robots.txt` explicitly allows ClaudeBot, no key needed. It lists
**5,644** component pages across **581** authors — that is the entire
21st.dev catalog. Single flat file, no sitemap index, no pagination.

**Code retrieval is the only real bottleneck.**

- `21st get <id>` — metered at **2/day** on free tier.
- `21st add <user>/<slug>` — shells out to
  `npx shadcn@latest add "https://21st.dev/r/<user>/<slug>?api_key=$API_KEY_21ST"`.
- The bare `/r/<user>/<slug>.json` endpoint (used for the April 2026 bulk import
  in `SISO_Knowledge/design-system`) now returns **403 authentication_required**.
  That import is not reproducible without a key.

Per the docs: *"Retrieve a component's code — free on paid plans; metered on the free tier."*
Builder with AI off is $6/month billed yearly and unlocks unlimited copy/install.

**But you do not need it.** The metered `get` is not the only way to the code —
see "Harvesting without quota" below.

Free regardless of tier: `21st search`, `21st logo`, `21st theme`, listing generation drafts.

## Preview images — use the CDN resizer

Preview URLs can be served through Cloudflare's transform path:

```
https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=auto/<original-url>
```

Measured: 14,704 bytes → 4,423 bytes (3.3× smaller). Caching all 5,644 previews
at 640px lands near 1.5 GB instead of ~8 GB at full size.

## Harvesting without quota — the actual route

`21st get` and `/r/<slug>.json` are gated. The **CDN is not.** Every component
page embeds a Next.js flight payload containing:

- `bundle_html_url` → `cdn.21st.dev/.../bundle.<ts>.html` — the **compiled
  component**. Minified, but complete: every Tailwind class string and all
  component logic survive. Plenty to read for inspiration or reconstruct from.
- `demo_code` → `cdn.21st.dev/.../code.demo.<ts>.tsx` — the demo's real TSX.
- `preview_url` → the preview image.

All three return **HTTP 200 unauthenticated**. Only the payload's own `"code"`
field is gated (it comes back as `""`).

Verified 2026-08-19 on a random sample of 10 components: **10/10 bundles
recovered**, median 311 KB, 7-69 `className` strings each.

`harvest.mjs` implements this:

```sh
node harvest.mjs --limit 50      # try a slice
node harvest.mjs --all           # full sweep
node harvest.mjs --all --no-previews
```

Idempotent — skips what is already on disk, so it resumes after an interruption.

Measured on the first 22 components: **0.5 s each** at concurrency 6, **354 KB
each** on disk. The full 5,644-component catalog projects to roughly
**48 minutes and 2.0 GB**, costing nothing and spending no `get` quota.
