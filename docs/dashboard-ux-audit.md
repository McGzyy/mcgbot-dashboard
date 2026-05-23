# Dashboard UX audit

Cross-cutting UX review for the McGBot home dashboard and related surfaces.  
**Status key:** `done` | `partial` | `deferred`

| Theme | Files | Status | Notes |
| --- | --- | --- | --- |
| **Motion - shared loading opacity (150-200ms)** | `lib/terminalListRow.ts`, `app/page.tsx` (trending, social, recent calls) | **done** | `terminalListRefreshOpacity()` + list `transition-opacity duration-200` on refetch |
| **Motion - height-stable skeletons (not text "Loading…")** | `components/terminal/TerminalListSkeleton.tsx`, `app/page.tsx` | **done** | Shared compact/social/recent-calls skeletons |
| **Motion - animate-pulse only on first load** | `app/page.tsx` (`SocialsFeedPanel`) | **done** | Poll refetch uses refresh bar + dim; skeleton + pulse only when `rows.length === 0` |
| **Density - unified list row height/padding** | `lib/terminalListRow.ts`, `components/terminal/TerminalListRow.tsx`, `app/page.tsx` | **partial** | Trending + recent calls wired; social keeps card layout (taller) |
| **Density - chips, borders, radii alignment** | `lib/terminalDesignTokens.ts`, `lib/terminalListRow.ts` | **partial** | Unified border `border-zinc-800/50 ring-1 ring-white/[0.03]` on list rows; chip pass deferred |
| **Empty/error - headline + guidance + CTA** | `app/components/dashboard/DashboardWidgetEmpty.tsx`, `app/page.tsx` | **partial** | Recent calls + opportunities use widget empty; social/trending inline copy; recent calls copy sharpened |
| **Focus/keyboard - chips, Full log, chart, docks** | `app/page.tsx`, layout shells | **deferred** | Trending rows are `<button>` (Enter works); focus-ring pass not done |
| **Social - category/title truncation narrow** | `app/page.tsx` (`SocialFeedPostRow`) | **partial** | Category chip has `truncate` + max-width; title line pass deferred |
| **Social - link preview hostname-only mobile** | `app/page.tsx` (`SocialFeedFirstLinkPreview`) | **deferred** | |
| **Social - hide zero metric columns** | `app/page.tsx` (`SocialFeedPostRow`) | **done** | Metrics render only when non-null |
| **Trending - in-panel refetch loading** | `components/terminal/TerminalPanelRefresh.tsx`, `app/page.tsx` (`TrendingPanel`) | **done** | Thin top progress bar + dimmed list |
| **Trending - row as button + keyboard Enter** | `components/terminal/TerminalListRow.tsx`, `app/page.tsx` | **done** | Native `<button>` row |
| **Recent calls - mobile 320px cluster** | `app/page.tsx` (home recent calls block) | **partial** | flex-wrap stacks actions under summary on narrow viewports |
| **Recent calls - placeholder avatar vs "-"** | `components/TokenCallThumb.tsx` | **deferred** | |
| **Recent calls - Full log ghost vs Chart primary** | `app/page.tsx` | **deferred** | |
| **Shell - scroll padding under save bar** | `lib/dashboardStickyChrome.ts`, layout | **deferred** | |
| **Shell - z-index comment map** | `lib/terminalDesignTokens.ts` (`terminalUi`) | **partial** | Modal/backdrop tiers documented in tokens; full map deferred |
| **TOTP - recovery code copy (10-char hex uppercase)** | TOTP settings routes/components | **deferred** | |
| **TOTP - admin reset confirm + Discord ID echo** | Admin TOTP reset UI | **deferred** | |
| **Elite - leading-snug dense lists** | `app/page.tsx`, glance cards | **deferred** | |
| **Elite - tabular-nums on numerics** | Various panels | **partial** | Recent calls + trending already use tabular-nums in places |
| **Elite - unified border language** | `lib/terminalListRow.ts` | **partial** | Applied to new list-row primitive |
| **Elite - user-facing microcopy (no "terminal"/"verified rows")** | `app/page.tsx`, empty states | **partial** | Home "logged" copy + activity empties; X verified badge unchanged |

## Shared primitives (this pass)

| Primitive | Path |
| --- | --- |
| List row tokens | `lib/terminalListRow.ts` |
| List row component | `components/terminal/TerminalListRow.tsx` |
| Skeleton rows | `components/terminal/TerminalListSkeleton.tsx` |
| Panel refetch bar | `components/terminal/TerminalPanelRefresh.tsx` (re-exports `DashboardRefreshBar`) |

## Manual verify

1. **Home @ 320px** - Recent calls row: thumb, summary, multiple, Chart, time not clipped.
2. **Trending** - Switch 5m/1h/24h: thin top bar + slight dim while refetching; skeleton only on first load.
3. **Social poll** - Wait ~45s (or tab change): no skeleton flash; refresh bar + opacity dim only.
