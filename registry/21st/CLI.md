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
**Builder with AI off is $6/month billed yearly ($8 quarterly) and unlocks unlimited
component copy and install.** At 2/day the remaining ~1,563 components take 781 days;
on Builder it is one scripted pass.

Free regardless of tier: `21st search`, `21st logo`, `21st theme`, listing generation drafts.

## Preview images — use the CDN resizer

Preview URLs can be served through Cloudflare's transform path:

```
https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=auto/<original-url>
```

Measured: 14,704 bytes → 4,423 bytes (3.3× smaller). Caching all 5,644 previews
at 640px lands near 1.5 GB instead of ~8 GB at full size.
