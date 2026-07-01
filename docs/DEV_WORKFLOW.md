# HairRecoveryOS Dev Workflow

How visual/UI work on this app gets done with Claude Code, established after the
chat-relay approach (Claude.ai screenshot → written instructions → Claude Code)
repeatedly failed to reach fidelity. Root cause: two disconnected sessions with no
shared ground truth, and no verification against a real render.

---

## Visual redesign loop

Do design iteration **entirely inside Claude Code, in this repo** — not via a
separate Claude.ai chat relaying instructions.

1. Attach the reference image directly in the Claude Code session (its `Read`
   tool handles images natively) with an explicit statement of target scope.
2. Ground changes in existing tokens/patterns first: `docs/DESIGN_GUIDELINES.md`,
   `src/theme/tokens.js`, `src/utils/scale.js`, and established components
   (`GradientText`, `Card`).
3. Close the loop with a **real screenshot** of the actual render — see
   "Simulator commands" below — instead of trusting the code "should" match.
   Compare it directly against the target in the same conversation, adjust,
   re-screenshot, repeat.
4. For a redesign needing many iteration rounds, delegate the loop to a forked
   agent so it doesn't fill the main conversation with iteration noise.
5. When satisfied, update `docs/DESIGN_GUIDELINES.md` with anything new (a
   color, a spacing rule, a component pattern) so the next redesign starts
   from an accurate baseline.

## Simulator commands

```bash
# One-time / after a native change (new fonts, new native deps): full build
npx react-native run-ios --simulator="iPhone 17"

# If install fails with "Unable to lookup in current state: Shutdown",
# the simulator wasn't booted before install — boot it first:
xcrun simctl boot <device-udid>   # find udid: xcrun simctl list devices
open -a Simulator

# After the first full build, JS-only changes hot-reload automatically
# (Metro + Fast Refresh). To force a clean relaunch (e.g. after editing
# local storage — see below):
xcrun simctl terminate booted com.adityasingh.hairrecoveryos
xcrun simctl launch booted com.adityasingh.hairrecoveryos

# Screenshot the current render:
xcrun simctl io booted screenshot /path/to/out.png
```

To dismiss an on-screen system dialog (e.g. the notifications permission
prompt) programmatically, `cliclick` (`brew install cliclick`) can click at a
real macOS screen coordinate. The simulator window's screen position/size
comes from:

```bash
osascript -e 'tell application "System Events" to tell process "Simulator" to get {position, size} of window 1'
```

Map a point from the device screenshot (pixel space, e.g. 1206×2622 for
iPhone 17) into a screen click point: `screen_x = win_x + (px/screenshot_w) * win_w`,
same for y. Simple gestures (taps) work fine this way; drag/scroll gestures
have not reliably registered through this path — for those, prefer testing on
a real device or interacting manually.

## Testing all data states safely (`scripts/dev-spoof-checkin.sh`)

This app shares one Supabase backend across every simulator and physical
device signed into it — logging a check-in in the simulator would overwrite
your **real** device's data for today. To review the Overview screen's three
states (nothing / partially / fully logged) without that risk, use:

```bash
scripts/dev-spoof-checkin.sh backup    # save your real local state first
scripts/dev-spoof-checkin.sh nothing   # spoof "nothing logged"
scripts/dev-spoof-checkin.sh partial   # spoof "1 of 3 done"
scripts/dev-spoof-checkin.sh full      # spoof "all done"
scripts/dev-spoof-checkin.sh restore   # put your real state back
```

This only edits the simulator's local sandboxed AsyncStorage file directly —
it never calls `saveCheckin`/`pushToSupabase`, so nothing reaches the shared
backend. Always run `restore` when done.

## Commit convention

`type(scope): summary` (e.g. `fix(overview): ...`, `feat(redesign): ...`),
optionally with a bulleted body explaining each change. Match the existing
history (`git log --oneline`) rather than inventing a new format.

## Agents

Not needed for routine edits. Worth reaching for:
- A forked agent for a long screenshot-iterate loop, to keep that noise out
  of the main conversation.
- `/code-review` (or `/code-review ultra`) before merging a redesign branch
  into `main` — easy to introduce regressions on screens you're not looking at.
