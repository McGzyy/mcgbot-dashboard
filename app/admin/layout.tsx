import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminDashboardShell } from "@/app/admin/_components/AdminDashboardShell";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync } from "@/lib/helpRole";
import { terminalChrome } from "@/lib/terminalDesignTokens";

export const metadata: Metadata = {
  title: "Admin",
  description: "McGBot control plane — bot settings, app flags, and subscription tools.",
  robots: { index: false, follow: false },
};

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
    <div className="relative space-y-10 pb-16">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(rgba(82,82,91,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(82,82,91,0.14)_1px,transparent_1px)] [background-size:32px_32px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-6 -top-6 h-48 w-48 rounded-full bg-red-600/15 blur-3xl"
        aria-hidden
      />
      <header className={`relative ${terminalChrome.headerRule} pb-8`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-red-300/80">Control plane</p>
        <h1 className="mt-2 bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Admin dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          High-trust surface for Discord + web operations: bot controls (scanner, health), dashboard app flags in
          Supabase (maintenance, paywall copy, announcements), and subscription bypass. Prefer changing settings here
          instead of hunting Discord commands.
        </p>
      </header>
      <AdminDashboardShell>{children}</AdminDashboardShell>
    </div>
  );
}
