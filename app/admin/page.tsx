import Link from "next/link";
import { AdminPanel } from "@/app/admin/_components/adminUi";

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
      <div className="rounded-2xl bg-gradient-to-br from-violet-500/25 via-violet-600/10 to-transparent p-[1px] transition group-hover:from-violet-400/35 group-hover:shadow-[0_0_32px_-8px_rgba(139,92,246,0.45)]">
        <AdminPanel className="h-full p-6 transition group-hover:bg-zinc-900/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
              <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
            </div>
            <span className="shrink-0 text-violet-300/80 transition group-hover:translate-x-0.5 group-hover:text-violet-200" aria-hidden>
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

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <OverviewCard
          href="/admin/subscription-exempt"
          title="Subscription access"
          subtitle="Database bypass list and env-based exempt Discord IDs."
          hint="Writes · Supabase"
        />
        <OverviewCard
          href="/admin/bot"
          title="Bot host"
          subtitle="Hit the internal health endpoint; extend with scanner and mod APIs."
          hint="Read-only · HTTP"
        />
        <OverviewCard
          href="/admin/site"
          title="Dashboard app"
          subtitle="Deployment fingerprint and integration flags for this Vercel project."
          hint="Read-only · Env"
        />
      </div>
    </div>
  );
}
