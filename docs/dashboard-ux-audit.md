# Dashboard UX audit

Cross-cutting UX review for the McGBot home dashboard and related surfaces.  
**Status key:** `done` | `partial` | `deferred`

| Theme | Files | Status | Notes |
| --- | --- | --- | --- |
| **Motion - shared loading opacity (150-200ms)** | `lib/terminalListRow.ts`, `app/page.tsx` (trending, social, recent calls) | **done** | `terminalListRefreshOpacity()` + list `transition-opacity duration-200` on refetch |
| **Motion - height-stable skeletons (not text "Loading…")** | `components/terminal/TerminalListSkeleton.tsx`, `app/page.tsx` | **done** | Shared compact/social/recent-calls/activity skeletons |
| **Motion - activity poll refetch (no skeleton flash)** | `app/page.tsx` (`ActivityFeedPanel`) | **done** | `TerminalActivitySkeleton` first load only; `terminalListRefreshOpacity` on poll |
| **Motion - animate-pulse only on first load** | `app/page.tsx` (`SocialsFeedPanel`) | **done** | Poll refetch uses refresh bar + dim; skeleton + pulse only when `rows.length === 0` |
| **Density - unified list row height/padding** | `lib/terminalListRow.ts`, `components/terminal/TerminalListRow.tsx`, `app/page.tsx`, `app/calls/page.tsx`, `app/watchlist/page.tsx` | **partial** | Trending + recent calls + watchlist rows; activity/calls refetch opacity; social keeps card layout (taller) |
| **Density - chips, borders, radii alignment** | `lib/terminalDesignTokens.ts`, `lib/terminalListRow.ts` | **partial** | Unified border `border-zinc-800/50 ring-1 ring-white/[0.03]` on list rows; chip pass deferred |
| **Empty/error - headline + guidance + CTA** | `app/components/dashboard/DashboardWidgetEmpty.tsx`, `app/page.tsx` | **done** | Recent calls, trending, social use `DashboardWidgetEmpty` |
| **Focus/keyboard - chips, Full log, chart, docks** | `app/page.tsx`, `app/calls/page.tsx`, `app/watchlist/page.tsx` | **partial** | Trending/opportunity/activity tabs + calls window chips + watchlist scope tabs; docks deferred |
| **Social - category/title truncation narrow** | `app/page.tsx`, `lib/socialFeedCategories.ts` | **done** | Short category labels on `max-sm`; full label in `title` |
| **Social - link preview hostname-only mobile** | `app/page.tsx` (`SocialFeedFirstLinkPreview`) | **done** | Path hidden below `sm`; full URL in `title` |
| **Social - hide zero metric columns** | `app/page.tsx` (`SocialFeedPostRow`) | **done** | Metrics render only when non-null |
| **Trending - in-panel refetch loading** | `components/terminal/TerminalPanelRefresh.tsx`, `app/page.tsx` (`TrendingPanel`) | **done** | Thin top progress bar + dimmed list |
| **Trending - row as button + keyboard Enter** | `components/terminal/TerminalListRow.tsx`, `app/page.tsx` | **done** | Native `<button>` row |
| **Recent calls - mobile 320px cluster** | `app/page.tsx` (home recent calls block) | **done** | flex-wrap; Chart full-width under multiple on max-sm |
| **Recent calls - placeholder avatar vs "-"** | `components/TokenCallThumb.tsx` | **done** | `◇` glyph when symbol has no letters |
| **Recent calls - Full log ghost vs Chart primary** | `app/page.tsx` | **done** | Ghost Full log link; Chart primary emerald; Chart first on mobile row |
| **Shell - scroll padding under save bar** | `lib/dashboardStickyChrome.ts`, `app/globals.css` | **done** | `scroll-padding-bottom` on `html` + exported token |
| **Shell - z-index comment map** | `lib/terminalDesignTokens.ts` (`terminalUi`) | **partial** | Modal/backdrop tiers documented in tokens; full map deferred |
| **TOTP - recovery code copy (10-char hex uppercase)** | `app/settings/page.tsx` | **partial** | Disable-2FA hint + placeholder; enroll flow unchanged |
| **TOTP - admin reset confirm + Discord ID echo** | Admin TOTP reset UI | **deferred** | |
| **Elite - leading-snug dense lists** | `app/page.tsx`, glance cards | **deferred** | |
| **Elite - tabular-nums on numerics** | Various panels | **partial** | Recent calls + trending + outside calls + performance stats |
| **Elite - unified border language** | `lib/terminalListRow.ts` | **partial** | List rows, outside calls tape, performance distribution chart |
| **Elite - user-facing microcopy (no "terminal"/"verified rows")** | `app/page.tsx`, empty states | **partial** | Home "logged" copy + activity empties; X verified badge unchanged |

## Shared primitives (this pass)

| Primitive | Path |
| --- | --- |
| List row tokens | `lib/terminalListRow.ts` |
| List row component | `components/terminal/TerminalListRow.tsx` |
| Skeleton rows | `components/terminal/TerminalListSkeleton.tsx` (`TerminalActivitySkeleton`, `TerminalRecentCallsSkeleton`, …) |
| Panel refetch bar | `components/terminal/TerminalPanelRefresh.tsx` (re-exports `DashboardRefreshBar`) |

## Manual verify

1. **Home @ 320px** - Recent calls row: thumb, summary, multiple, Chart, time not clipped.
2. **Trending** - Switch 5m/1h/24h: thin top bar + slight dim while refetching; skeleton only on first load.
3. **Social poll** - Wait ~45s (or tab change): no skeleton flash; refresh bar + opacity dim only.
