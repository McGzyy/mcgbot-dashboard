import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  applicationName: "McGBot Affiliate",
  title: {
    default: "Affiliate program",
    template: "%s · McGBot Affiliate",
  },
  description: "McGBot affiliate portal — separate from the member terminal.",
  robots: { index: false, follow: false },
};

/** Affiliate portal routes — chrome is provided by `(partner)` / `admin`, not AppChrome sidebar. */
export default function AffiliateRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
