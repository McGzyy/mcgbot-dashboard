import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { isDashboardAdminUser } from "@/lib/adminGate";

export default async function AffiliateAdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) redirect("/");
  if (!(await isDashboardAdminUser(session, id))) redirect("/");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">{children}</div>
    </div>
  );
}
