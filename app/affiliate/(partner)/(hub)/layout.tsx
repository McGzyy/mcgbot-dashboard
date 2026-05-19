import type { ReactNode } from "react";
import { AffiliatePartnerHubNav } from "@/app/affiliate/(partner)/_components/AffiliatePartnerHubNav";

export default function AffiliatePartnerHubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-violet-50/40 via-zinc-50/50 to-white">
      <AffiliatePartnerHubNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}
