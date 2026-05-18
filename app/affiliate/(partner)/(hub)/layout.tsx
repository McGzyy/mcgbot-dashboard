import type { ReactNode } from "react";
import { AffiliatePartnerHubNav } from "@/app/affiliate/(partner)/_components/AffiliatePartnerHubNav";

export default function AffiliatePartnerHubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AffiliatePartnerHubNav />
      {children}
    </div>
  );
}
