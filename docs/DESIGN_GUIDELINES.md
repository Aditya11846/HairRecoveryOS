---
name: design-guidelines
description: "HairRecoveryOS design system — established from Log screen refinement. Applies to all pages. Color law, component patterns, interaction rules, do/don't list."
metadata: 
  node_type: memory
  type: project
  originSessionId: 19e5b4b9-96f7-4641-b770-ae94d0a9bc88
---

# HairRecoveryOS Design Guidelines

The Log screen is the canonical reference. Every other page should feel like it belongs to the same system.

---

## Color Law (non-negotiable)

| Color | Hex | Use ONLY for |
|---|---|---|
| `warmA` gold | `#FFB020` | Growth, recovery, progress, active treatment, primary CTAs |
| `warmB` coral | `#FF6B4A` | Secondary warm signal, light warnings, topical accent |
| amber-orange | `#FF9030` | Treatment variants, mid-tier accents |
| copper | `#CF8020` | Monitoring/caution, deep warm, Dutasteride accent |
| cool blue | `#5B8DEF` | Discipline, neutral data (sleep, streaks) |
| green | `#30D158` | Logged/in-range/done states |
| red | `#FF453A` | Damage ONLY — misses, cigarettes lapse, heavy shedding |

**Never use red for anything neutral or ambiguous.** If something is merely being monitored, use copper. If it's a warning, use coral. Red = actual harm signal only.

---

## Palette Expansion Rule

When choosing a color for a new element, ask: does it fit in the gold-orange-copper family? If yes, pick the closest tone. The one exception is cool blue for discipline/neutral categories. Avoid introducing colors outside this palette without discussion.

---

## Typography

- Page title: `color.warmA`, large weight
- Date/eyebrow above title: `rgba(255,176,32,0.65)` — amber at 65% opacity
- Section headers: `type.eyebrow`, `color.dim`, ALL CAPS
- Row names: `color.txt` default, shift to accent color when active/taken
- Subtitles/dose lines: `color.dim`
- Disabled/hint text: `color.faint`

---

## Card Design

- Background: `color.card` (~`#1C1C1E`)
- Border: `StyleSheet.hairlineWidth`, `color.line` — subtle, not colored unless intentional
- `overflow: 'hidden'` on all cards that contain rows (clips content at border radius)
- **No card shadows/glows** — cards stay flat. Glows are reserved for focal point elements only (e.g. streak circle).
- Spacing between cards: `marginTop: 10`

---

## Icon Row Pattern (canonical: MedToggle)

Every row with a loggable item uses this structure:
```
[3px strip] [38×38 icon circle] [Name / Subtitle] [✕ Skip] [Log / ✓ Done]
```

- **Strip**: left edge accent, 3px wide, full row height. Low opacity in pending, full color when taken, red when skipped.
- **Icon wrap**: 38×38, `borderRadius: 10`, `borderWidth: hairline`. Tinted bg + border in accent color at low opacity pending, higher opacity taken.
- **Icon color**: 50% opacity pending → full accent taken → `color.red` skipped.
- **Name**: `color.txt` pending → full accent taken → `color.red` skipped.
- **Log button**: flat `color.dim` background pending → solid accent background + `#1A1000` dark text taken.
- **Skip button**: neutral → solid `color.red` background when active.

---

## Per-Item Color Identity

When multiple items of the same type exist (medications, custom protocols, icons), each gets its own accent from the palette family. The accent drives every visual element on that row consistently:

**Medication accents:**
- Oral Minoxidil → `#FFB020` gold
- Novegrow Topical → `#FF6B4A` coral
- Red Light Comb → `#FF9030` amber-orange
- Dutasteride → `#CF8020` copper

**Custom protocol icon accents:**
- Lightning → `#FFB020` · Pill → `#CF8020` · Droplet → `#FF6B4A` · Shield → `#5B8DEF`
- Sun → `#FF9030` · Moon → `#A78BFA` · Flask → `#30D158` · DNA → `#BF5AF2`
- Butterfly → `#FF9030` · Star → `#FFD60A`

---

## Opacity Formula for Accent Tinting

Use `ra(hex, alpha)` helper to compute rgba:
- Strip (pending): 0.30
- Icon bg (pending): 0.07 · Icon bg (taken): 0.16
- Icon border (pending): 0.22 · Icon border (taken): 0.38
- Icon color (pending): 0.50
- Row bg (taken): 0.05

---

## SVG Rules (critical)

- **Never** use `width="100%"` or `height="100%"` on SVG when inside an absolutely positioned container — it renders as a sliver.
- Always use **explicit pixel dimensions** for SVGs.
- For gradient-style fills on buttons/backgrounds: use **solid `backgroundColor`** instead of SVG `LinearGradient`. The gold sliver bug was caused by this pattern.
- SVG is fine for charts, rings, arcs, and icons with explicit sizes.

---

## Buttons & CTAs

- Primary CTA (save, add, done): solid `backgroundColor: color.warmA`, `color: '#1A1000'` text, `fontWeight: '700'`
- No SVG gradient buttons — all solid color
- Disabled state: `backgroundColor: color.card2` (dark neutral)
- Secondary/destructive: `color.red` background

---

## Glow Policy

- **Cards**: no glow — flat and clean.
- **Focal point elements only** (e.g. streak ring, hero numbers): `shadowColor`, `shadowOffset: {width:0,height:0}`, `shadowRadius`, iOS shadow only.
- Streak ring: gold glow when streak > 0 (`shadowRadius: 16, shadowOpacity: 0.55`), no glow at zero.

---

## Expandable Rows

- Long content: truncate with `numberOfLines={1}`, show chevron ⌄/⌃
- Subtitle shows expand hint ("tap to expand" / "tap to close")
- On tap: reveal full content in a panel below the row
- Smart name extraction: stop before "for ", "of ", "with ", ":" to extract the key term

---

## States Across the App

| State | Visual treatment |
|---|---|
| Active / taken | Full accent color, accent bg at 5%, accent Done button |
| Pending / unlogged | Low opacity accent (30-50%), dim text |
| Skipped / missed | `color.red` across strip, icon, name |
| In-range / good | `color.green` (done/checked contexts only) |
| Logged today | Accent on the log dot/marker |
| No data | `color.faint` or `color.dim`, never red |

**Why:** `red` earned through action (smoking, skipping, heavy shedding) is a strong negative signal. Showing it for "no data yet" would be alarming and wrong.
