import type { DefaultSession } from "next-auth";
import type { HelpTier } from "@/lib/helpRole";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      subscriptionActiveUntil: string | null;
      hasActiveSubscription: boolean;
      subscriptionExempt: boolean;
      hasDashboardAccess: boolean;
      /** Discord staff tier; refreshed with subscription gate (JWT). */
      helpTier: HelpTier;
      /** Whether moderation UI/APIs are allowed for this user. */
      canModerate: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discord_id?: string;
    subscriptionActiveUntil?: string | null;
    subscriptionExempt?: boolean;
    /** ms since epoch — throttles recomputing subscription/exempt in jwt callback */
    subscriptionRefreshAt?: number;
    helpTier?: HelpTier;
    canModerate?: boolean;
  }
}
