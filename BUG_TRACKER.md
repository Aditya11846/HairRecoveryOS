# Bug Tracker

## RESOLVED
| ID | File | Bug | Fixed In |
|----|------|-----|----------|
| B001 | storage.js | AsyncStorage v3: multiGet removed — use getMany (returns Record, not tuple pairs) | v1.1.1 |
| B002 | storage.js | Streak counted any checkin, not protocol completion | v1.1.0 |
| B003 | Progress.jsx | Timeline dates incorrect vs case history | v1.1.0 |
| B004 | AskClaude.jsx | Email hardcoded in system prompt | v1.1.0 |
| B005 | AskClaude.jsx | Context stacked on every multi-turn message | v1.1.0 |
| B006 | Overview.jsx | insightsFetched ref never reset on new day | v1.1.0 |

## OPEN
| ID | File | Bug | Priority |
|----|------|-----|----------|
| B007 | storage.js | dutasteride not in toSupabaseRow — PENDING MIGRATION — SQL ready, awaiting confirmation: `ALTER TABLE checkins ADD COLUMN dutasteride boolean;` | HIGH |
| B008 | storage.js | fromSupabaseRow hardcodes dutasteride: null | HIGH |

## KNOWN GAPS (not bugs, planned features)
| ID | Description | Sprint |
|----|-------------|--------|
| G001 | No photo upload for monthly baseline photos | Sprint 2 |
| G002 | No bloodwork value logging (only reminder card) | Sprint 2 |
| G003 | No export / PDF report generation | Sprint 3 |
| G004 | Phase 1 sleep14 objective not auto-derived | Sprint 2 |
