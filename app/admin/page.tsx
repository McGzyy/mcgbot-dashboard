import Link from "next/link";
import { AdminOverviewStats } from "@/app/admin/_components/AdminOverviewStats";
import { AdminPanel } from "@/app/admin/_components/adminUi";
import { adminChrome } from "@/lib/roleTierStyles";

function OverviewCard({
  href,
  title,
  subtitle,
  hint,
}: {
  href: string;
  title: string;
  subtitle: string;
  hint: string;
}) {
  return (
    <Link href={href} className="group block">
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
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold text-white">Overview</h2>
        <p className="mt-1 text-sm text-zinc-400">Jump into a section — left nav stays one click away.</p>
      </div>

      <AdminOverviewStats />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          href="/admin/subscription-exempt"
          title="Subscription access"
          subtitle="Database bypass list and env-based exempt Discord IDs."
          hint="Writes · Supabase"
        />
        <OverviewCard
          href="/admin/bot"
          title="Bot controls"
          subtitle="Health check plus scanner on/off (same effect as !scanner in Discord)."
          hint="Bot API · HTTP"
        />
        <OverviewCard
          href="/admin/site"
          title="Site & flags"
          subtitle="Deploy fingerprint, env checks, and live Supabase settings (maintenance, banner, paywall)."
          hint="Writes · Supabase"
        />
        <OverviewCard
          href="/admin/bugs"
          title="Bug reports"
          subtitle="Review user-submitted bugs, add notes, and close (sends bell notification)."
          hint="Workflow · Inbox ping"
        />
      </div>
    </div>
  );
}
