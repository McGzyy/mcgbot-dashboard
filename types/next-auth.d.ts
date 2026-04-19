import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      subscriptionActiveUntil: string | null;
      hasActiveSubscription: boolean;
      subscriptionExempt: boolean;
      hasDashboardAccess: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discord_id?: string;
    subscriptionActiveUntil?: string | null;
    subscriptionExempt?: boolean;
  }
}
