# Dashboard page pass (second review)

Pass date: 2026-05-23. Scope: subscriber-facing routes from `docs/dashboard-ux-audit.md` priority list.

| Page | Status | Changes |
| --- | --- | --- |
| `/` logged-out (`UnauthedLanding`) | **ok** | Discord CTA + membership link already have focus rings; teaser layout readable at 320px |
| `/` subscriber (recent calls, trending, social, activity) | **tweaked** | Recent calls: flex-wrap stack, Chart full-width under multiple on `max-sm`, placeholder thumb glyph, focus rings on Chart / Full log / activity tabs; copy uses “logged” not “verified” |
| `/membership` | **ok** | Plan compare `order-3` + billing `order-5` keeps plan-first on mobile (post a98ba71/76aa9b8); no layout rebuild |
| `/outside-calls` | **tweaked** | Structured empty state; unified card borders + refresh focus ring |
| `/user/[id]` | **tweaked** | Caller intelligence empty copy: “logged calls” |
| `/performance` | **ok** | `ChartEmptyState` already has headline, body, CTA |
| `/calls` | **tweaked** | Empty state drops “verified call” jargon |
| `/leaderboard` | **tweaked** | Hero copy: “logged calls” |
| `/watchlist` | **ok** | Headline + guidance empty block present |
| `/settings` | **tweaked** | TOTP disable hint + recovery placeholder (10-char hex); global scroll-padding for docks |
| `/help` | **ok** | FAQ cards already use focus-visible rings |

## Cross-cutting (this pass)

| Item | Status |
| --- | --- |
| `html` scroll-padding-bottom (docks / safe area) | **done** — `app/globals.css` + `lib/dashboardStickyChrome.ts` export |
| `DashboardWidgetEmpty` focus rings | **done** |
| `TokenCallThumb` fallback glyph | **done** — `◇` when no symbol letters |
| Border language on touched cards | **partial** — recent calls, outside-calls rows |

## Deferred (later pass)

1. Social link preview hostname-only on narrow viewports  
2. Trending / social empty states → shared `DashboardWidgetEmpty`  
3. Full log vs Chart visual hierarchy (ghost primary swap)  
4. Admin TOTP reset confirm + Discord ID echo  
5. Chip density / global focus pass on untouched panels  
