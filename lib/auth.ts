import type { NextAuthOptions } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import DiscordProvider from "next-auth/providers/discord";
import { meetsModerationMinTier, resolveHelpTierAsync } from "@/lib/helpRole";
import { computeSubscriptionExempt } from "@/lib/subscriptionExemption";
import { getSubscriptionEnd } from "@/lib/subscription/subscriptionDb";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // Keep scopes minimal: `email` can cause extra consent friction and isn't required for dashboard access.
      authorization: { params: { scope: "identify" } },
      profile(profile) {
        const p = profile as {
          id: string;
          global_name?: string | null;
          username?: string | null;
          avatar?: string | null;
        };
        return {
          id: p.id,
          name: p.global_name || p.username,
          image: p.avatar
            ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png`
            : null,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 60 * 60 },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user }) {
      try {
        const supabaseUrl = process.env.SUPABASE_URL?.trim();
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!supabaseUrl || !serviceKey) {
          return true;
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // Ensure a `public.users` row exists (schema uses discord_id UNIQUE, no username column).
        const { error } = await supabase.from("users").upsert(
          { discord_id: user.id },
          { onConflict: "discord_id", ignoreDuplicates: true }
        );

        if (error) {
          console.error("Supabase upsert error (users):", error);
        }

        return true;
      } catch (err) {
        console.error("Auth error:", err);
        return true; // NEVER crash auth
      }
    },
    async jwt({ token, user, profile, trigger, session }) {
      if (user) {
        token.discord_id = user.id;
        if (user.name) token.name = user.name;
        if (user.image) token.picture = user.image;
      }
      if (profile && typeof profile === "object") {
        const p = profile as {
          id?: string;
          global_name?: string | null;
          username?: string | null;
        };
        if (typeof p.id === "string") token.discord_id = p.id;
        if (!token.name) {
          const display =
            (typeof p.global_name === "string" && p.global_name) ||
            (typeof p.username === "string" && p.username) ||
            "";
          if (display) token.name = display;
        }
      }

      const discordId = (token.discord_id as string | undefined)?.trim();
      const sessionObj = session && typeof session === "object" ? (session as { refreshSubscription?: boolean }) : null;
      const refreshSubscriptionFlag = Boolean(sessionObj?.refreshSubscription);
      const SUB_REFRESH_MS = 3 * 60 * 1000;
      const lastRefresh =
        typeof token.subscriptionRefreshAt === "number" ? token.subscriptionRefreshAt : 0;
      const subscriptionGateStale =
        Boolean(discordId) && Date.now() - lastRefresh > SUB_REFRESH_MS;
      const accessFieldsMissing =
        Boolean(discordId) &&
        (!("subscriptionActiveUntil" in token) ||
          !("subscriptionExempt" in token) ||
          typeof token.helpTier !== "string" ||
          typeof token.canModerate !== "boolean");

      const shouldRefreshAccess =
        Boolean(user) ||
        accessFieldsMissing ||
        (trigger === "update" && refreshSubscriptionFlag) ||
        subscriptionGateStale;

      if (discordId && shouldRefreshAccess) {
        const [end, exempt, helpTier] = await Promise.all([
          getSubscriptionEnd(discordId),
          computeSubscriptionExempt(discordId),
          resolveHelpTierAsync(discordId).catch((e) => {
            console.warn("[auth] resolveHelpTierAsync:", e);
            return "user" as const;
          }),
        ]);
        token.subscriptionActiveUntil = end;
        token.subscriptionExempt = exempt;
        token.helpTier = helpTier;
        token.canModerate = meetsModerationMinTier(helpTier);
        token.subscriptionRefreshAt = Date.now();
      }

      return token;
    },

    async session({ session, token }) {
      const id = (token.discord_id as string | undefined) ?? token.sub ?? "";
      session.user.id = id;
      if (typeof token.name === "string" && token.name) {
        session.user.name = token.name;
      }
      if (typeof token.picture === "string" && token.picture) {
        session.user.image = token.picture;
      }
      const end =
        typeof token.subscriptionActiveUntil === "string"
          ? token.subscriptionActiveUntil
          : null;
      const exempt = token.subscriptionExempt === true;
      session.user.subscriptionActiveUntil = end;
      session.user.subscriptionExempt = exempt;
      session.user.hasActiveSubscription =
        end != null && end.length > 0 && new Date(end).getTime() > Date.now();
      session.user.hasDashboardAccess =
        exempt || session.user.hasActiveSubscription;
      const tier = token.helpTier;
      session.user.helpTier =
        tier === "admin" || tier === "mod" || tier === "user" ? tier : "user";
      session.user.canModerate = token.canModerate === true;
      return session;
    },
  },
};
