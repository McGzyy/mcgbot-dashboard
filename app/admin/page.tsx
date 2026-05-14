import Link from "next/link";
import { AdminOverviewStats } from "@/app/admin/_components/AdminOverviewStats";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

function OverviewCard({
  href,
  title,
  subtitle,
  hint,
  "data-tutorial": dataTutorial,
}: {
  href: string;
  title: string;
  subtitle: string;
  hint: string;
  "data-tutorial"?: string;
}) {
  return (
    <Link href={href} className="group block" data-tutorial={dataTutorial}>
      <div className={adminChrome.overviewRing}>
        <AdminPanel className="h-full p-6 transition group-hover:bg-zinc-900/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
            </div>
            <span className={`shrink-0 transition group-hover:translate-x-0.5 ${adminChrome.overviewArrow}`} aria-hidden>
              →
            </span>
          </div>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-600">{hint}</p>
        </AdminPanel>
      </div>
    </Link>
  );
}

export default function AdminOverviewPage() {
  return (
    <div className="space-y-10" data-tutorial="admin.overview">
      <div data-tutorial="admin.intro">
        <h2 className="text-lg font-semibold text-white">Overview</h2>
        <p className="mt-1 text-sm text-zinc-400">Jump into a section — left nav stays one click away.</p>
      </div>

      <AdminOverviewStats data-tutorial="admin.stats" />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          href="/admin/x-digests"
          title="X leaderboard digests"
          subtitle="Cron schedule (Pacific + UTC), OAuth status, and editable tweet templates for dashboard-posted digests."
          hint="Read env · Write Supabase"
        />
        <OverviewCard
          href="/admin/treasury"
          title="Treasury hub"
          subtitle="SOL treasuries, Stripe balance, membership mix, SOL invoice log, tips, and voucher pool."
          hint="Read · RPC + Stripe + Supabase"
          data-tutorial="admin.card.treasury"
        />
        <OverviewCard
          href="/admin/subscription-exempt"
          title="Subscription access"
          subtitle="Database bypass list and env-based exempt Discord IDs."
          hint="Writes · Supabase"
          data-tutorial="admin.card.subscription"
        />
        <OverviewCard
          href="/admin/bot"
          title="Bot controls"
          subtitle="Health check plus scanner on/off (same effect as !scanner in Discord)."
          hint="Bot API · HTTP"
          data-tutorial="admin.card.bot"
        />
        <OverviewCard
          href="/admin/copy-trade"
          title="Copy trade"
          subtitle="Custodial wallets, intent queue, recent failures, and pending copy-trade access requests."
          hint="Read · Supabase"
        />
        <OverviewCard
          href="/admin/call-visibility"
          title="Call visibility"
          subtitle="Hide or show a tracked mint on the public web (profiles & lists) — same as !hidecall; nothing deleted in Discord."
          hint="Bot API · tracked calls"
          data-tutorial="admin.card.call-visibility"
        />
        <OverviewCard
          href="/admin/site#stripe-test-checkout"
          title="Site & flags"
          subtitle="Deploy fingerprint, env checks, and live Supabase settings — including the optional $1 Stripe test checkout toggle."
          hint="Writes · Supabase"
          data-tutorial="admin.card.site"
        />
        <OverviewCard
          href="/admin/bugs"
          title="Bug reports"
          subtitle="Review user-submitted bugs, add notes, and close (sends bell notification)."
          hint="Workflow · Inbox ping"
          data-tutorial="admin.card.bugs"
        />
        <OverviewCard
          href="/admin/feature-requests"
          title="Feature requests"
          subtitle="Review user ideas, triage, and close (sends bell notification)."
          hint="Workflow · Inbox ping"
          data-tutorial="admin.card.features"
        />
        <OverviewCard
          href="/admin/fix-it-tickets"
          title="Fix-it tickets (beta)"
          subtitle="Temporary tester inbox for UI/UX notes, ideas, and preferences from the floating button."
          hint="Read · Supabase + Storage"
        />
        <OverviewCard
          href="/admin/voice-moderation-audit"
          title="Voice moderation audit"
          subtitle="Read-only table of successful LiveKit mute and kick actions (Discord actor + target)."
          hint="Read · Supabase"
          data-tutorial="admin.card.voiceAudit"
        />
        <OverviewCard
          href="/admin/vouchers"
          title="Vouchers"
          subtitle="Generate discount codes for SOL checkout (tester access, promos, limited-use drops)."
          hint="Writes · Supabase"
          data-tutorial="admin.card.vouchers"
        />
        <OverviewCard
          href="/admin/subscription-plans"
          title="Subscription plans"
          subtitle="Edit plan labels, durations, prices, and built-in discounts."
          hint="Writes · Supabase"
          data-tutorial="admin.card.subscriptionPlans"
        />
      </div>
    </div>
  );
}
