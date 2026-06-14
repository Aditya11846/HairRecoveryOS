# Changelog

## [Unreleased]

## [1.2.0] - 2026-06-15
### Added
- Explore: pinned Q&A section (shedding reliability, isotretinoin, smoking impact)
- Explore: expandable cards with full study details and "why this matters for you"
- Explore: filter tabs (All / Studies / Trials / Reddit / Video)
- Explore: pull-to-refresh
- Explore: YouTube static references as additional source
- Explore: DermNet NZ as additional source (HTML parsed, graceful fallback)
- Explore: curated feed scoring algorithm (pre-filters before Claude analysis)
- Explore: cache age label ("Updated Xh ago")
- Explore: 8 curated items (was 5)
- Overview: protocol cards show evidence bars and mechanism icons
- Overview: "Powered by React Native · HairOS v1.0" footer
- Theme: glass/liquid surfaces (rgba backgrounds, border highlights, shadows)
- All screens: iOS 26-style visual refresh (glass cards, refined typography, borderRadius 16)
- AskClaude: FlatList onContentSizeChange + onLayout scroll callbacks added

## [1.1.1] - 2026-06-15
### Fixed
- Startup crash: AsyncStorage v3 removed `multiGet`; replaced all 5 usages with `getMany` which returns `Record<string, string | null>` directly (no `Object.fromEntries` needed)
- Added `.catch(() => {})` to unguarded `Promise.all` in Overview, Progress, CheckIn to prevent future unhandled rejections

## [1.1.0] - 2026-06-15
### Fixed
- AsyncStorage.getMany → multiGet across all 5 batch read functions
- Streak now requires oralMinoxidil AND topicalMinoxidil both true
- Context stacking in AskClaude multi-turn conversations
- insightsFetched ref now date-keyed (allows next-day refresh)
- Incorrect treatment timeline in Progress.jsx
- Email address removed from AskClaude system prompt

### Changed
- Research tab: added AI WEB SEARCH indicator with pulsing dot
- Explore tab: subtitle updated to "From real databases · AI ranked"
- Phase 1 streak30 objective auto-derives from actual streak data

### Added
- src/constants/config.js — centralized app constants
- src/constants/protocol.js — PROTOCOL_DETAILS extracted from Overview
- src/constants/timeline.js — TIMELINE + PHASE1_OBJECTIVES extracted from Progress
- src/utils/logger.js — environment-aware structured logging
- src/types/index.ts — core TypeScript interfaces
- src/components/common/SectionLabel.jsx — shared across all screens
- src/components/common/Badge.jsx — shared by Research and Explore
- src/components/cards/ResearchCard.jsx — unified card replacing duplicates
- src/components/sheets/AddToProtocolSheet.jsx — unified modal replacing duplicates

## [1.0.0] - 2026-06-14
### Added
- Initial release: CheckIn, Overview, Progress, Research, Explore, AskClaude
- AsyncStorage + Supabase dual-write sync
- AI insights with same-day caching
- 12-week contribution heatmap
- Custom protocol add-to-checkin flow
- Claude chat with live tracked data context
