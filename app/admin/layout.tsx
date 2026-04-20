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
    <div className="space-y-8">
      <header className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Admin dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Controls for the McGBot Discord service and this web terminal. Sections will grow here —
          start with subscription access, then bot and app settings.
        </p>
      </header>
      <AdminDashboardShell>{children}</AdminDashboardShell>
    </div>
  );
}
