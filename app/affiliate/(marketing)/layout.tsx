import type { ReactNode } from "react";
import { AffiliatePublicShell } from "@/app/affiliate/_components/AffiliatePublicShell";

export default function AffiliateMarketingLayout({ children }: { children: ReactNode }) {
  return <AffiliatePublicShell>{children}</AffiliatePublicShell>;
}
