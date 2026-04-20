import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminDashboardShell } from "@/app/admin/_components/AdminDashboardShell";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync } from "@/lib/helpRole";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    redirect("/");
  }
  if ((await resolveHelpTierAsync(id)) !== "admin") {
    redirect("/");
  }

  return (
    <div className="relative space-y-10">
      <div
        className="pointer-events-none absolute -left-6 -top-6 h-48 w-48 rounded-full bg-violet-600/15 blur-3xl"
        aria-hidden
      />
      <header className="relative border-b border-white/[0.06] pb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300/80">Control plane</p>
        <h1 className="mt-2 bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Admin dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          High-trust surface for Discord + web operations. Subscription bypass is live; bot health and
          host flags are read-only for now — we&apos;ll add writes as each subsystem gets an admin API.
        </p>
      </header>
      <AdminDashboardShell>{children}</AdminDashboardShell>
    </div>
  );
}
