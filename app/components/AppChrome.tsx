"use client";

import { MainShell } from "@/app/components/MainShell";
import { Sidebar } from "@/app/components/Sidebar";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const bareLayout = pathname.startsWith("/subscribe") || pathname.startsWith("/auth");

  if (bareLayout) {
    return <div className="flex min-h-screen flex-col">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MainShell>{children}</MainShell>
    </div>
  );
}
