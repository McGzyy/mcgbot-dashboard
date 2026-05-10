import type { DefaultSession } from "next-auth";
import type { CopyTradeAccessState } from "@/lib/copyTrade/copyTradeAccess";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      /** Discord snowflake (same as JWT `sub`). */
      id: string;
      helpTier?: "admin" | "mod" | "user";
      subscriptionActiveUntil?: string | null;
      subscriptionExempt?: boolean;
      hasActiveSubscription?: boolean;
      hasDashboardAccess?: boolean;
      canModerate?: boolean;
      trustedPro?: boolean;
      accountCreatedAt?: string | null;
      copyTradeAccessState?: CopyTradeAccessState;
    };
  }
}
