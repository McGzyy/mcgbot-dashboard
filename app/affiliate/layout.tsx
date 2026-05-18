import type { ReactNode } from "react";

/** Route groups apply their own chrome: `(partner)` dark shell, `admin` light ops shell. */
export default function AffiliateRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
