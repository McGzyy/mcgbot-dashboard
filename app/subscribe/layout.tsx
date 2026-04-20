import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Subscribe",
  description: "Subscribe to McGBot Terminal for full access.",
  robots: { index: false, follow: false },
};

export default function SubscribeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
