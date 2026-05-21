# Vercel cost guide (McGBot dashboard)

This doc maps your invoice lines to this repo and lists **safe** caps that do not break production.

## Your bill at a glance (~$47 after credits)

| Line | Share | Scales with users? | Scales with dev/build? |
|------|-------|--------------------|-------------------------|
| **Observability events** | **~62%** | Yes (every request logs/traces) | **Yes** (previews, deploys, debugging) |
| **Fluid CPU + memory** | ~22% | Yes | Somewhat |
| **Function invocations** | ~11% | **Yes** | Yes (previews, crons, testing) |
| **Fast origin transfer** | ~4% | Yes | Low |
| **Build CPU** | **&lt;1%** | No | **Yes** (but cheap on your invoice) |

**Takeaway:** You are not paying mainly to “build.” You pay for **traffic + telemetry + crons staying on 24/7**.

---

## Scheduled work (fixed monthly baseline)

From `vercel.json` (production crons only):

| Cron | Schedule | ~Runs/month | Notes |
|------|----------|-------------|--------|
| `reconcile-subscriptions` | Every **30 min** (was 10) | ~1,440 | Solana RPC when pending SOL invoices exist |
| `referral-credit-settle` | Hourly :30 | ~720 | DB settlement |
| `subscription-exempt-expiry` | Hourly :05 | ~720 | Role/expiry sweep |
| `affiliate-commission-approve` | Hourly :15 | ~720 | Affiliate ops |
| `affiliate-milestones` | Daily 06:00 UTC | ~30 | Milestone checks |

**~3,600** Vercel cron HTTP invocations/month before any user opens the site.

Other routes under `app/api/cron/*` (e.g. `copy-trade-process-queue`, `x-leaderboard-digest`, `scan-payments`) are **not** in `vercel.json`. They only run if something external calls them with `CRON_SECRET` (e.g. bot VPS). Confirm you are not pinging them every minute from elsewhere.

---

## What drives invocation volume (~11.9M on your invoice)

1. **Every browser/API hit** — middleware runs on almost all paths (`matcher` in `middleware.ts`), then the route handler runs again.
2. **256 API routes** — dashboard polling, affiliate portal, Stripe webhooks, internal bot hooks.
3. **Preview deployments** — each preview URL can receive traffic and emit logs like production.
4. **Crons** — fixed schedule above.
5. **Heavy cron: `reconcile-subscriptions`** — for each pending SOL invoice, up to **100 Solana signatures × `getTransaction`** per treasury per run. Keep interval ≥30m unless you rely on SOL pay heavily.

Middleware **does** call Supabase/Discord live (`liveDashboardAccessForDiscordId`) when the JWT is stale or guild/subscription flags disagree. That is correct for UX but costs CPU per navigation for affected users—not the main 11M number unless traffic is huge.

---

## Observability ($41.75) — highest leverage

Roughly **3 observability events per function invocation** on your invoice. Sources include:

- Runtime `console.log` / `console.warn` / `console.error` (many routes)
- Vercel **request logs**, **traces**, and **metrics** per invocation
- **Preview** and **Production** both emitting telemetry

### Safe caps (Vercel dashboard — no code change)

1. **Settings → Billing → Spend Management**  
   Set a monthly **spend limit** and email alerts (e.g. 80% / 100%). Hard cap stops new usage; use alerts first so you are not surprised.

2. **Observability** (or **Monitoring**)  
   - Filter logs by **Production** only when investigating.  
   - Check top routes by **invocation count** and **log volume** (last 7 days).  
   - Disable or reduce **preview** log retention if offered on your plan.

3. **Project → Settings → Deployment Protection**  
   Require auth on **Preview** deployments so random crawlers do not hit preview URLs.

4. **Team → Observability** (product name may vary)  
   Review whether **extended retention** or **high-cardinality** features are enabled; turn off what you do not use.

### Safe code habits (when you touch logging)

- Log **one summary line** per cron success; keep `console.error` for failures only.
- Avoid logging full Stripe/Solana payloads in production.
- Do not add `console.log` in middleware hot paths.

---

## Fluid compute & invocations

- **Fluid** bills **active CPU time** and **provisioned memory** while functions run. Long crons (Solana reconcile) and slow Supabase/Discord calls increase this.
- **Invocations** are counted per middleware + route execution (and crons).

### Safe caps (Vercel / project settings)

- **Functions → Fluid Compute**: keep defaults unless you need longer runs; set **`maxDuration`** on heavy routes (see `reconcile-subscriptions` route).
- Avoid increasing **concurrency** limits without reason.
- Use **Production** only for real users; do not share preview links publicly.

### Env knobs (already in this app)

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Required for crons; blocks anonymous cron spam |
| `RECONCILE_SUBSCRIPTIONS_CRON_ENABLED` | Set `0` to disable SOL reconcile cron body (Stripe-only billing) |
| `COPY_TRADE_EXECUTION_ENABLED` | When not `true`, copy-trade cron exits immediately |

---

## Recommended monthly baseline (after tuning)

| Scenario | Rough expectation |
|----------|-------------------|
| Solo dev, low preview traffic, observability trimmed | **$25–45** (similar to today) |
| Observability left wide open + heavy preview use | **$50–80+** |
| Real users (low hundreds DAU) + same tuning | **+$10–30** compute/transfer (observability depends on log volume) |
| Real users (thousands DAU) | Revisit caching, rate limits, CDN; observability may need sampling |

---

## Investigation checklist (use Vercel plugin or dashboard)

Authenticate the **Vercel** MCP plugin in Cursor (`mcp_auth`), then:

1. **Usage** → last 30 days → sort by **Observability**, **Fluid**, **Invocations**.
2. **Logs** → Production → group by **route** → find top 10 paths by count.
3. **Crons** → confirm only the five paths in `vercel.json` fire on schedule.
4. **Deployments** → count preview deploys last month (build + preview traffic).

Compare top log routes to:

- `/api/cron/reconcile-subscriptions`
- `/api/subscription/stripe/webhook`
- `/api/auth/*` (session)
- High-traffic dashboard APIs under `/api/me/*`, `/api/affiliate/*`

---

## Changes made in-repo (safe defaults)

- **`reconcile-subscriptions` cron**: `*/10` → **`*/30`** (fewer Solana RPC sweeps).
- **`RECONCILE_SUBSCRIPTIONS_CRON_ENABLED`**: optional kill-switch without removing the route.
- **`maxDuration`** on reconcile cron to avoid runaway Fluid CPU.

Stripe webhooks remain the primary path for card subscriptions; SOL reconcile is a **backup** for pending invoices.

---

## When *not* to cap

Do **not** disable:

- `CRON_SECRET` or cron auth headers
- Stripe webhook route
- Production observability **alerts** (only reduce noise/volume)
- Middleware guild/subscription checks without testing paywall regressions
