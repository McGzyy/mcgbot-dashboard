import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Maintenance",
  robots: { index: false, follow: false },
};

export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
