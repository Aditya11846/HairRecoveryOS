# HairRecoveryOS — Logging Feature Bug Report

**Audit scope:** Log screen (`CheckIn.jsx`), storage layer (`storage.js`), sync flow, custom protocols, notifications.  
**Passes completed:** 7  
**Total bugs found and fixed:** 27  
**All fixes deployed to device and committed on branch:** `redesign/visual-system-v1`

---

## Root Cause Summary

Three dominant root causes accounted for most bugs:

1. **UTC timezone bug** — `toISOString()` returns UTC. For UTC+5:30 users between midnight–05:30 AM local time, every date key was one day in the past. Fixed globally with `localDateStr()` helper using `getFullYear/getMonth/getDate` (local time).
2. **Missing error guards on async paths** — fire-and-forget calls without `.catch()`, state guards without `try/finally`, and modal callbacks without cancellation checks.
3. **Supabase calls without timeouts** — several calls were raw Supabase queries with no timeout, causing hangs on slow or offline connections.

---

## Bug List

### Pass 1 — Initial audit

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `storage.js` | `getTodayKey()` used `toISOString()` (UTC) — date key was wrong for UTC+5:30 users before 05:30 AM | Replaced with `localDateStr()` helper using `getFullYear/getMonth/getDate` |
| 2 | `storage.js` | `getStreakCount` built keys using UTC dates — read wrong entries for 5.5h window daily | Applied `localDateStr()` to all key generation |
| 3 | `storage.js` | `getRecentCheckins` used UTC dates — 7-day view showed wrong days | Applied `localDateStr()` |
| 4 | `storage.js` | `getLast30Days` used UTC dates — 30-day chart misaligned | Applied `localDateStr()` |
| 5 | `storage.js` | `getLastNDays` used UTC dates — heatmap misaligned | Applied `localDateStr()` |
| 6 | `App.tsx` | `syncPendingCheckins` only called on cold launch — offline logs never synced when wifi reconnected mid-session | Added `AppState.addEventListener('change')` to re-call sync every time app returns to foreground |
| 7 | `storage.js` | `toSupabaseRow` omitted `customValues` entirely — custom protocol logs never backed up to Supabase | Added `custom_values` field with `Object.keys().length > 0` guard |
| 8 | `storage.js` | `addCustomProtocol` Supabase insert sent only `name/source`, lost `icon/dose/frequency` — restored protocol appeared with wrong icon and no dosage | Added all local fields to insert payload |

---

### Pass 2 — Deep storage audit

| # | File | Bug | Fix |
|---|------|-----|-----|
| 9 | `storage.js` | `syncPendingCheckins` had no timeout on batch upsert — hung indefinitely on slow connection | Wrapped with `withTimeout(10000)` |
| 10 | `storage.js` | `syncPendingCheckins` no resilience if `custom_values` column missing in Supabase — entire batch failed silently | Added retry without `custom_values` if first upsert errors |
| 11 | `storage.js` | `getCustomProtocols` had no timeout on cold install Supabase fallback — hung on first launch offline | Wrapped with `withTimeout(6000)` |
| 12 | `storage.js` | `fromSupabaseRow` defaulted stress to `?? 5` (Extreme) when null — any Supabase-restored entry pre-selected "Extreme stress" | Changed to `?? null` (unselected, which `StressRow` handles correctly) |
| 13 | `storage.js` | `getStreakCount` returned 0 every morning before today's log — loop started at `i=0`, found no entry, immediately broke | Added today-done check; if today not fully logged, start loop at `i=1` to preserve prior streak |
| 14 | `ai.js` | Insights cache key used `toISOString()` (UTC) — insights re-fetched every morning before 05:30 | Replaced with local date string |
| 15 | `screens/Bloodwork.jsx` | "Today" and "Yesterday" quick-entry buttons used `toISOString()` — entered data under wrong date for UTC+5:30 | Added `localDs()` helper |
| 16 | `screens/Progress.jsx` | `buildCells` used `toISOString()` in heatmap cell date generation | Replaced with explicit local year/month/day |

---

### Pass 3 — Log screen interaction audit

| # | File | Bug | Fix |
|---|------|-----|-----|
| 17 | `screens/CheckIn.jsx` | `handleViewGuide` showed infinite spinner on cache miss — `getProtocolGuide` returned null, spinner never resolved | Added AI fetch fallback (`fetchProtocolGuide`) and error state (`{ _error: true }`) for no-API-key case |
| 18 | `screens/CheckIn.jsx` | `handleViewGuide` re-opened modal after user dismissed — 30–60s `fetchProtocolGuide` resolved after close, calling `setViewingGuide` again | Used functional updater: only sets guide if `cur?.name === name` (i.e. modal still open for same protocol) |
| 19 | `screens/CheckIn.jsx` | `handleSave` had no double-tap guard — concurrent saves caused duplicate Supabase pushes and overlapping animations | Added `isSaving` ref: early return if already saving |
| 20 | `screens/Research.jsx` | `addCustomProtocol` called with positional strings `(item.title, item.source)` instead of object — `name` was `undefined`, protocol silently not added | Fixed call to `{ name: item.title, source: item.source }` |
| 21 | `services/pubmed.js` | Both `fetch()` calls had no timeout — PubMed results could hang indefinitely | Replaced with `fetchWithTimeout(..., 15000)` |
| 22 | `services/openalex.js` | `fetch()` had no timeout | Replaced with `fetchWithTimeout(..., 15000)` |
| 23 | `services/clinicaltrials.js` | `fetch()` had no timeout | Replaced with `fetchWithTimeout(..., 15000)` |

---

### Pass 4 — Error guard audit

| # | File | Bug | Fix |
|---|------|-----|-----|
| 24 | `screens/CheckIn.jsx` | `isSaving` guard leaked on `saveCheckin` error — `finally` block was missing, so an AsyncStorage write failure permanently disabled the save button for the session | Wrapped `await saveCheckin(...)` in `try/finally { isSaving.current = false }` |
| 25 | `storage.js` | `pushToSupabase` false retry — checked `local.customValues` (truthy even for `{}`), so any Supabase error when customValues was empty fired an identical retry call | Added `Object.keys(local.customValues).length > 0` guard |
| 26 | `storage.js` | `syncPendingCheckins` same false retry — `unsynced.some(c => c.customValues)` matched every entry since `fromSupabaseRow` always sets `customValues: {}` | Added same length guard |
| 27 | `storage.js` | `addCustomProtocol` Supabase insert had no timeout — was the only Supabase call in the file without one; showed spinner for 60s+ on slow connection | Wrapped with `withTimeout(8000)` |

---

### Pass 5 — State management audit

| # | File | Bug | Fix |
|---|------|-----|-----|
| 28 | `screens/CheckIn.jsx` | `handleDelete` left orphaned keys in `customValues` state — deleted protocol's logged value (e.g. `{ 'local_123': true }`) persisted in every subsequent save and accumulated over time | Added `setCustomValues(v => { delete next[id]; return next; })` in `handleDelete` |
| 29 | `screens/CheckIn.jsx` | Midnight crossover: `useEffect` re-ran when `today` key changed but only set form on `existing` — if no entry for new date, form stayed showing yesterday's filled data; next save wrote yesterday's values to today's key | Added `else` branch: `setForm(DEFAULT); setCustomValues({}); setHadPrior(false)` |
| 30 | `storage.js` | `removeCustomProtocol` only deleted locally — Supabase still had `active: true`; fresh install re-fetched deleted protocol from Supabase and showed it on log screen | Added fire-and-forget `update({ active: false })` for non-local IDs after local delete |

---

### Pass 6 — Async rejection audit

| # | File | Bug | Fix |
|---|------|-----|-----|
| 31 | `screens/CheckIn.jsx` | `getStreakCount().then(setStreak)` in `useFocusEffect` had no `.catch()` — corrupted AsyncStorage JSON would throw from `JSON.parse`, producing an unhandled rejection that froze the streak display | Added `.catch(() => {})` |
| 32 | `screens/CheckIn.jsx` | Same missing `.catch()` on `getStreakCount().then(setStreak)` after `handleSave` — post-save streak refresh had same silent failure path | Added `.catch(() => {})` |
| 33 | `screens/CheckIn.jsx` | `handleDelete` had no `try/catch` around `removeCustomProtocol` — an `AsyncStorage.setItem` failure would propagate out of the event handler, leaving the protocol visually stuck (delete appeared to do nothing) | Wrapped in `try/catch { return; }` so `setCustomValues` and `refreshProtocols` only run on confirmed success |

---

### Pass 7 — Final sweep

| # | File | Bug | Fix |
|---|------|-----|-----|
| 34 | `screens/CheckIn.jsx` | `appendTag` read `form.notes` from outer closure — two rapid tag taps both captured the same stale `cur`, so the second overwrote the first and the first tag was silently lost | Moved computation inside `setForm` functional updater so `cur` always reads from latest `f.notes` |

---

## Files Modified

| File | Bugs fixed |
|------|-----------|
| `src/utils/storage.js` | 1–7, 9–13, 25–27, 30 |
| `src/screens/CheckIn.jsx` | 17–19, 24, 28–29, 31–34 |
| `src/screens/Progress.jsx` | 16 |
| `src/screens/Bloodwork.jsx` | 15 |
| `src/screens/Research.jsx` | 20 |
| `src/services/ai.js` | 14 |
| `src/services/pubmed.js` | 21 |
| `src/services/openalex.js` | 22 |
| `src/services/clinicaltrials.js` | 23 |
| `App.tsx` | 6 |

---

## Commits

```
fe20216  fix(logging): fix appendTag stale closure losing rapid tag taps
544435a  fix(logging): guard handleDelete against removeCustomProtocol failure
a14491d  fix(logging): add missing .catch() to getStreakCount calls in CheckIn
3758fa9  fix(logging): 3 more bugs — orphaned customValues, midnight reset, Supabase delete sync
d7595c0  fix(logging): 20 bugs across log screen, storage, and sync
0199ce0  fix(storage): 4 logging bugs — timezone, offline sync, protocol fields, customValues backup
```
