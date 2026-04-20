"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type MobileSidebarCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const MobileSidebarContext = createContext<MobileSidebarCtx | null>(null);

export function MobileSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);
  return <MobileSidebarContext.Provider value={value}>{children}</MobileSidebarContext.Provider>;
}

export function useMobileSidebar() {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) {
    throw new Error("useMobileSidebar must be used within MobileSidebarProvider");
  }
  return ctx;
}
