<!-- Generated from tenants/oracle/dna.md by opendesign/sync.mjs. Edit the tenant DNA, not this file. -->

<!-- opendesign: title="SISO Oracle" description="Dense, warm-neutral product UI with a restrained pink accent. Every value is deliberate and non-round — distilled from a production chat rail, not invented for a swatch page." -->

# Oracle cockpit DNA — the exact values, with the *why*

Distilled from the chat rail (`CockpitChatRail.tsx` + `stream-chat-v2-rail.css`), the one panel everyone agrees is perfect. These are not suggestions; they're the bar. Each rule has the reasoning so you apply it with judgment, not by rote.

> **The meta-rule:** every value should be *deliberate and non-round*. Roundness (16px, 700, #fff, 8px radius) is the signature of a default nobody chose. Off-round values (9.5px, 750, #f8f8f5, .05 alpha) read as hand-tuned because they were.

---

## Color

| Token | Value | Why |
|---|---|---|
| Panel bg | `#f8f8f5` | Warm off-white. Pure `#fff` is cold and screams "default canvas." A hair of warmth makes it feel like a designed surface. |
| Surfaces / active | `#fffef9` | Slightly warmer than the bg, so surfaces sit *above* the panel without a border. |
| Primary text | `#0f172a` | Slate, not black. `#000` on white is harsh, vibrates, looks unconsidered. |
| Accent (pink) | `#ff0069` | The brand pink. Used for the active-tab underline + the one floating action. **Restrained** — it's an accent, not a fill. |
| Accent warm | `#f72d73` | The jump-button / action pink (slightly warmer than `#ff0069`). |
| Badge text | `#c41458` | Deep rose for text *on* a whisper-pink badge. Two-tone badges (pink bg + darker pink text) read richer than single-color. |
| Green earn (live) | `#15803d` | Earnings value when live. |
| Muted-on-standby | `#756670` | Warm grey for de-emphasized / standby state. |

### The one-ink opacity ladder (the secret weapon)
Everything secondary is `rgba(15,23,42, α)` — **one ink, many alphas** — not a pile of named greys. This is *the* thing that makes it feel coherent:

| α | Use |
|---|---|
| `.05` | hairline dividers, faintest borders |
| `.06–.07` | panel bottom border, active-tab border |
| `.08` | subtle borders, scrollbar thumb |
| `.32` | muted labels / subtitles |
| `.35` | inactive tab text |
| `.42` | empty-state text |
| `.62` | secondary text (present but not urgent) |
| `1.0` | primary text |

Pink badges use the same idea: `rgba(255,0,105, .07)` whisper bg, `.09` slightly stronger. **Never** reach for a new grey hex — reach for another alpha on the ink.

## Pills — rare by design
The chat uses a pill for **exactly one thing**: a tiny count badge (14px tall, `999px`, whisper-pink bg + `#c41458` text, 8.5px / 900). **Everything else is bare text.**

Wrapping a number or label in a bordered/filled pill is the **#1 "AI-y" tell** and the thing Shaan rejects on sight (the top bar once pilled streak/%/$/STANDBY → instantly rejected). Before you add a pill, ask: *is this a count badge?* If not, make it bare text at the right weight + alpha. Token/coin chips are the one allowed exception (the gold coin chip is part of the brand).

## Typography

**Sizes (fractional scale):** `8.5` (badge counts) · `9.5` (labels/subtitles) · `11` (tabs / chrome) · `12` (empty-state, small numbers) · `13` (body). Note the `.5`s — they're intentional. Don't snap to 10/12/14/16.

**Weight ladder:** `650` (muted/subtitle) · `750` (UI chrome, tabs) · `850` (buttons) · `900` (counts/emphasis). **Never** 400/500/600/700/800 — the round weights are the default-font tell. 750 is "ultra-bold without being grotesque."

**Always:** `font-variant-numeric: tabular-nums` on anything numeric (timers, counts, tokens, %) so digits don't jitter as they change. `letter-spacing: .01em` on tabs, `.02em` on small-caps labels.

## Spacing & rhythm
- Base horizontal padding unit: **14px**. Tight rows: **8px**. Feed gaps: **6px** (or `1px` between dense chat rows — tight but not collapsed). Empty-state margin: **18px**.
- Dense-but-breathing. The chat fits a lot without feeling cramped because the gaps are small and *consistent*, and whitespace is spent on the few things that matter (the active row, the jump button).

## Dividers, scrollbars, edges
- **Hairlines, not borders/shadows:** section breaks are `1px` height at `rgba(15,23,42,.05)`. A shadow or a 1px solid border for a divider is heavier than needed.
- **Scrollbars:** `3px` wide, transparent track, `.08` thumb. Barely there. Never 6–8px chrome bars.
- **Radii:** `999px` for the (rare) pill/badge; `8px 8px 0 0` for tab tops; `18px` for the panel itself. Avoid the reflexive `border-radius:8px` on every box.

## Interaction (half of why it feels sleek — don't ship static)
- **Tab change:** active tab gets `z-index:1` + `margin-bottom:-1px` so it physically overlaps the panel below (looks connected, not floating), plus a `2px` accent-pink underline (`::after`), not a full border-box. This overlap is the move Shaan specifically loves.
- **Transitions:** `.12s ease` for hover/state (snappy, not sluggish). **Spring** `cubic-bezier(.22, 1, .36, 1)` for entrances and the jump button (playful overshoot).
- **Soft glow, not hard shadow:** floating actions use `0 12px 30px rgba(247,45,115,.2)` — big blur, low alpha = glow.
- **Scroll UX:** preserve scroll position when loading older rows; show a "jump to latest" only when unpinned (48px bottom threshold).
- **Contextual empty-states:** different copy by context ("Waiting for room messages." vs "Waiting for *new* room messages.") — never a generic "No data."

## Code craft (it shows in the output)
- Magic numbers → **named constants** (`STREAM_CHAT_PAGE_SIZE`, `BOTTOM_THRESHOLD`).
- Semantic HTML: `<article>` rows, `<section>` panels, `role="separator"` markers — not div soup.
- Full ARIA on interactive chrome (`role=tablist/tab`, `aria-selected`, `aria-controls`).
- Grammatical copy: singular/plural handled ("1 token" / "2 tokens").
- Info density via short codes where space is tight (2-letter platform badges: SC / C4 / CS).

---

### Quick self-audit (run in your head before the gate script)
1. Any `#fff` or `#000`? → replace with `#f8f8f5`/`#fffef9` and `#0f172a`.
2. Any weight that's a round hundred? → move onto the 650/750/850/900 ladder.
3. Any number wrapped in a bordered/filled pill that isn't a count badge or coin chip? → unwrap to bare text.
4. Any numeric value without `tabular-nums`? → add it.
5. Any new grey hex? → replace with an alpha on `rgba(15,23,42, …)`.
6. Does it move like the chat (tab overlap, spring entrance), or is it static? → add the motion.
7. Side-by-side with the chat rail — same app, or a different one bolted on?
