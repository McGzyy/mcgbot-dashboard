"use client";

import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

export function MainShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      <TopBar />
      <div className="flex-1 overflow-x-hidden p-6">{children}</div>
    </div>
  );
}
