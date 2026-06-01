// SISO UI Base — Stage 3 rubric, built directly from .claude/skills/oracle-ui/reference/dna.md
// + .uihub/specs/BRAND-AND-PERSONALITY.html. This is what the visual judge grades against —
// the SAME bar UI-LEAD judges by eye. Keep aligned with dna.md when it changes.

export const AXES = [
  {
    id: 'warmth',
    label: 'Warmth (not cold/default)',
    weight: 1.0,
    anchor: `Warm off-whites (#f8f8f5 panel, #fffef9 surfaces) NOT pure #fff. Slate text #0f172a NOT #000.
A surface that reads as a *designed* warm surface, not a default white canvas. Pink accent is RESTRAINED
(an underline / one floating action), never a fill. 10 = the chat rail's warmth. 1 = cold #fff/#000 default.`,
  },
  {
    id: 'playful',
    label: 'Playful & alive (not static/operator)',
    weight: 1.0,
    anchor: `Feels like a hype-friend, not a control panel. Motion implied (tab overlap, spring entrance, soft pink glow
0 12px 30px rgba(247,45,115,.2) on the one action). Performer-facing, child-being-cheered-on energy — NOT
dashboard density or operator jargon. 10 = inviting and energetic. 1 = a flat enterprise dashboard.`,
  },
  {
    id: 'clarity',
    label: 'Clarity (dense-but-breathing)',
    weight: 1.0,
    anchor: `Fits a lot without feeling cramped: small CONSISTENT gaps (6px feed, 14px pad), whitespace spent on the
few things that matter (active row, the one action). One clear focal point. Tabular-aligned numbers.
10 = scannable in a glance under stream pressure. 1 = cluttered or sparse-and-empty.`,
  },
  {
    id: 'craft',
    label: 'Craft (deliberate, non-round, coherent)',
    weight: 1.2,
    anchor: `Every value looks hand-tuned: off-round (9.5px, 750 weight, .05 alpha) not default-round (16px, 700, 8px radius).
ONE-INK opacity ladder rgba(15,23,42,α) for all secondary tones — never a pile of named greys. Bare text, NOT
pills (pills only for count badges + the gold coin chip; a number in a bordered pill is the #1 AI-y tell).
Hairline dividers not shadows. 3px scrollbars. 10 = indistinguishable from the chat rail's craft. 1 = obvious AI defaults.`,
  },
  {
    id: 'coherence',
    label: 'Same-app coherence with the chat rail',
    weight: 1.3,
    anchor: `Side-by-side with the chat rail, does this look like the SAME app — same warmth, same ink ladder, same weights,
same restraint — or a different component bolted on? This is the ultimate test. 10 = unmistakably the same family.
1 = a foreign widget pasted in.`,
  },
]

// The judge prompt. Returns strict JSON. {scores:{axis:0-10}, overall:0-10, worst:"axis", critique:"...", fixes:["..."]}
export function buildJudgePrompt(panelName) {
  const axisBlock = AXES.map((a) => `- ${a.id} — ${a.label} (weight ${a.weight}):\n    ${a.anchor.replace(/\n\s*/g, ' ')}`).join('\n')
  return `You are the taste judge for the Oracle Streaming cockpit — a cam-model PERFORMER cockpit (warm, playful, glossy-candy on white-clean), NOT a fintech dashboard. You grade a rendered UI panel screenshot against the cockpit's exact design DNA, the same bar a senior designer holds by eye.

The CALIBRATION ANCHOR is the chat rail, which scores ~9 on every axis — it is the panel everyone agrees is perfect. Grade everything relative to it. Be honest and discriminating: most panels are NOT a 9. A generic AI-default look should score 3-5. Reserve 8-10 for genuine chat-rail-level craft.

Panel under review: "${panelName}".

Score each axis 0-10 (integers or .5):
${axisBlock}

Return ONLY this JSON, nothing else:
{"panel":"${panelName}","scores":{"warmth":N,"playful":N,"clarity":N,"craft":N,"coherence":N},"worst":"<axis id>","critique":"<2 sentences: the single biggest gap vs the chat rail>","fixes":["<concrete fix tied to a DNA rule>","<fix 2>"]}`
}

export function weightedOverall(scores) {
  let num = 0, den = 0
  for (const a of AXES) {
    const v = scores?.[a.id]
    if (typeof v === 'number') { num += v * a.weight; den += a.weight }
  }
  return den ? +(num / den).toFixed(2) : null
}
