import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      subscriptionActiveUntil: string | null;
      subscriptionExempt: boolean;
      hasActiveSubscription: boolean;
      hasDashboardAccess: boolean;
      helpTier: "admin" | "mod" | "user";
      canModerate: boolean;
      trustedPro: boolean;
      accountCreatedAt?: string | null;
      copyTradeAccessState: "pending" | "approved" | "denied" | "none";
      productTier: "basic" | "pro";
      hasProFeatures: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discord_id?: string;
    subscriptionActiveUntil?: string | null;
    subscriptionExempt?: boolean;
    helpTier?: "admin" | "mod" | "user";
    canModerate?: boolean;
    productTier?: "basic" | "pro";
  }
}
