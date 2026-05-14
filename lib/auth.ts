import type { NextAuthOptions } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import DiscordProvider from "next-auth/providers/discord";
import { meetsModerationMinTier, resolveHelpTierAsync } from "@/lib/helpRole";
import { computeSubscriptionExempt } from "@/lib/subscriptionExemption";
import { getSubscriptionEnd } from "@/lib/subscription/subscriptionDb";
import { discordTrustedProRoleId } from "@/lib/discordHonorRoleIds";
import { getDiscordGuildMemberRoleIds } from "@/lib/discordGuildMember";
import { isDiscordGuildMember } from "@/lib/discordGuildMember";
import { discordVerificationGateFromRoleIds } from "@/lib/discordVerificationGate";
import { getSessionInvalidationEpochCached } from "@/lib/sessionInvalidationEpoch";
import { syncGuildMembershipToUsers } from "@/lib/guildMembershipSync";

/** Discord CDN avatar; custom avatar or default embed sprite from snowflake. */
function discordAvatarUrlFromDiscordProfile(p: {
  id: string;
  avatar?: string | null;
}): string {
  const id = (p.id ?? "").trim();
  if (!id) return "https://cdn.discordapp.com/embed/avatars/0.png";
  if (p.avatar) {
    const ext = String(p.avatar).startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${id}/${p.avatar}.${ext}?size=128`;
  }
  try {
    const n = BigInt(id);
    const idx = Number((n >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

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
          image: discordAvatarUrlFromDiscordProfile(p),
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
        // Do not reject OAuth here when the user is not in the guild: NextAuth maps that to
        // `AccessDenied` and looks like a Discord cancel. Guild membership is enforced in the
        // JWT callback + middleware (redirect to /membership, APIs 401) so rejoining members can
        // complete Discord login and then refresh after the bot sees them in the server.

        const supabaseUrl = process.env.SUPABASE_URL?.trim();
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!supabaseUrl || !serviceKey) {
          return true;
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // Ensure a `public.users` row exists (schema uses discord_id UNIQUE, no username column).
        const displayName =
          typeof user.name === "string" && user.name.trim() ? user.name.trim() : null;
        const avatarUrl =
          typeof user.image === "string" && user.image.trim()
            ? user.image.trim().slice(0, 800)
            : discordAvatarUrlFromDiscordProfile({ id: user.id, avatar: null });

        const trustedProRoleId = discordTrustedProRoleId();
        let trustedPro: boolean | null = null;
        try {
          const roles = await getDiscordGuildMemberRoleIds(user.id);
          if (roles) {
            trustedPro = roles.includes(trustedProRoleId);
          }
        } catch {
          trustedPro = null;
        }

        const { error } = await supabase.from("users").upsert(
          {
            discord_id: user.id,
            discord_display_name: displayName,
            discord_avatar_url: avatarUrl,
            ...(trustedPro == null
              ? {}
              : {
                  trusted_pro: trustedPro,
                  trusted_pro_granted_at: trustedPro ? new Date().toISOString() : null,
                }),
          },
          { onConflict: "discord_id" }
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
      const epochNow = await getSessionInvalidationEpochCached();

      if (user) {
        (token as { sessionInvalidationEpoch?: number }).sessionInvalidationEpoch = epochNow;
        token.discord_id = user.id;
        if (user.name) token.name = user.name;
        if (user.image) token.picture = user.image;
      } else {
        const tokEp = (token as { sessionInvalidationEpoch?: unknown }).sessionInvalidationEpoch;
        const bound =
          typeof tokEp === "number" && Number.isFinite(tokEp)
            ? Math.floor(tokEp)
            : null;
        if (bound !== null && bound < epochNow) {
          return { ...token, exp: Math.floor(Date.now() / 1000) - 120 };
        }
        if (bound === null) {
          (token as { sessionInvalidationEpoch?: number }).sessionInvalidationEpoch = epochNow;
        }
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

      const fromSub =
        typeof token.sub === "string" && /^[1-9]\d{9,21}$/.test(token.sub.trim())
          ? token.sub.trim()
          : "";
      const fromExplicit = (token.discord_id as string | undefined)?.trim() ?? "";
      if (!fromExplicit && fromSub) {
        token.discord_id = fromSub;
      }
      const discordId = (fromExplicit || fromSub).trim();
      const sessionObj =
        session && typeof session === "object"
          ? (session as {
              refreshSubscription?: boolean;
              refreshGuildGate?: boolean;
              /** Forces subscription + Discord guild gate refresh (e.g. after join or transient API errors). */
              refreshAccess?: boolean;
            })
          : null;
      const refreshAccessAll = Boolean(sessionObj?.refreshAccess);
      const refreshSubscriptionFlag =
        Boolean(sessionObj?.refreshSubscription) || refreshAccessAll;
      const refreshGuildFromUpdate =
        Boolean(sessionObj?.refreshGuildGate) || refreshAccessAll;
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

      // Discord guild membership + verification gate (checked frequently so kicked/banned users lose access fast).
      const GUILD_REFRESH_MS = 55 * 1000;
      /** After a definitive "not in guild", re-check sooner so transient Discord/API glitches clear without a new login. */
      const GUILD_REFRESH_MS_AFTER_FALSE = 15 * 1000;
      const guildLastRefresh =
        typeof (token as any).discordGuildRefreshAt === "number"
          ? (token as any).discordGuildRefreshAt
          : 0;
      const guildGateMissing =
        Boolean(discordId) &&
        (typeof (token as any).discordInGuild !== "boolean" ||
          typeof (token as any).discordNeedsVerification !== "boolean");
      const guildStaleMs =
        (token as any).discordInGuild === false ? GUILD_REFRESH_MS_AFTER_FALSE : GUILD_REFRESH_MS;
      const guildGateStale =
        Boolean(discordId) && Date.now() - guildLastRefresh > guildStaleMs;
      const shouldRefreshGuildGate =
        Boolean(discordId) &&
        (guildGateMissing ||
          guildGateStale ||
          Boolean(user) ||
          (trigger === "update" && refreshGuildFromUpdate));

      if (discordId && shouldRefreshAccess) {
        const prevTier =
          token.helpTier === "admin" || token.helpTier === "mod" || token.helpTier === "user"
            ? token.helpTier
            : "";
        try {
          const supabaseUrl = process.env.SUPABASE_URL?.trim();
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
          const sb =
            supabaseUrl && serviceKey
              ? createClient(supabaseUrl, serviceKey)
              : null;
          const [end, exempt, helpTier, userRes] = await Promise.all([
            getSubscriptionEnd(discordId),
            computeSubscriptionExempt(discordId),
            resolveHelpTierAsync(discordId).catch((e) => {
              console.warn("[auth] resolveHelpTierAsync:", e);
              return "user" as const;
            }),
            sb
              ? sb
                  .from("users")
                  .select("trusted_pro, created_at, copy_trade_access_state")
                  .eq("discord_id", discordId)
                  .maybeSingle()
              : Promise.resolve({ data: null as Record<string, unknown> | null, error: null }),
          ]);
          token.subscriptionActiveUntil = end;
          token.subscriptionExempt = exempt;
          token.helpTier = helpTier;
          token.canModerate = meetsModerationMinTier(helpTier);
          token.subscriptionRefreshAt = Date.now();

          const ur = userRes as { data: Record<string, unknown> | null; error: { message?: string } | null };
          if (ur.error) {
            console.warn("[auth] users gate row fetch:", ur.error.message ?? ur.error);
          }
          const urow = !ur.error && ur?.data && typeof ur.data === "object" ? ur.data : null;
          (token as { trustedPro?: boolean }).trustedPro = urow?.trusted_pro === true;
          (token as { accountCreatedAt?: string | null }).accountCreatedAt =
            typeof urow?.created_at === "string" ? urow.created_at : null;
          const cts = urow?.copy_trade_access_state;
          (token as { copyTradeAccessState?: string }).copyTradeAccessState =
            cts === "pending" || cts === "approved" || cts === "denied" || cts === "none" ? String(cts) : "none";
        } catch (e) {
          console.error("[auth] subscription/staff refresh:", e);
          // Do not demote staff or wipe subscription fields on transient DB/network errors.
          if (prevTier === "admin" || prevTier === "mod") {
            token.helpTier = prevTier;
            token.canModerate = meetsModerationMinTier(prevTier);
          } else {
            try {
              const helpTier = await resolveHelpTierAsync(discordId).catch(() => null);
              if (helpTier === "admin" || helpTier === "mod" || helpTier === "user") {
                token.helpTier = helpTier;
                token.canModerate = meetsModerationMinTier(helpTier);
              }
            } catch {
              token.helpTier = "user";
              token.canModerate = false;
            }
          }
        }
      }

      if (discordId && shouldRefreshGuildGate) {
        try {
          const inGuild = await isDiscordGuildMember(discordId);
          if (typeof inGuild === "boolean") {
            (token as any).discordInGuild = inGuild;
          }

          if (inGuild === false) {
            await syncGuildMembershipToUsers(discordId, false);
            (token as any).discordInGuild = false;
            (token as any).discordNeedsVerification = false;
            (token as any).discordBlockedReason = "not_in_guild";
            (token as any).discordGuildRefreshAt = Date.now();
            // Keep the session cookie so they can land on /membership, join, then session refetch
            // picks up membership without going through OAuth again.
          }

          // If we can't confirm membership (null), don't deny — keep last-known values.
          if (inGuild === true) {
            await syncGuildMembershipToUsers(discordId, true);
            const roleIds = await getDiscordGuildMemberRoleIds(discordId);
            if (Array.isArray(roleIds)) {
              (token as any).discordGuildRoleIds = roleIds;
              const gate = discordVerificationGateFromRoleIds(roleIds);
              if (gate && !gate.ok) {
                (token as any).discordNeedsVerification = true;
                (token as any).discordBlockedReason = gate.reason;
              } else {
                (token as any).discordNeedsVerification = false;
                (token as any).discordBlockedReason = null;
              }
            }
          }
          (token as any).discordGuildRefreshAt = Date.now();
        } catch (e) {
          console.warn("[auth] guild gate refresh:", e);
          // keep previous gate fields on transient failure
        }
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
      const tierEarly = token.helpTier;
      const helpTierOk =
        tierEarly === "admin" || tierEarly === "mod" || tierEarly === "user" ? tierEarly : "user";
      const staffVerificationBypass = helpTierOk === "admin" || helpTierOk === "mod";
      const rawNeedsVerification = (token as any).discordNeedsVerification === true;
      const effectiveNeedsVerification = rawNeedsVerification && !staffVerificationBypass;
      const staffSubscriptionBypass = helpTierOk === "admin" || helpTierOk === "mod";
      // Staff can always use tools even if a transient Discord member lookup returned 404.
      const guildAllowsDashboard =
        staffSubscriptionBypass || (token as any).discordInGuild !== false;
      session.user.hasDashboardAccess =
        (staffSubscriptionBypass || exempt || session.user.hasActiveSubscription) &&
        guildAllowsDashboard &&
        !effectiveNeedsVerification;
      const tier = token.helpTier;
      session.user.helpTier =
        tier === "admin" || tier === "mod" || tier === "user" ? tier : "user";
      session.user.canModerate = token.canModerate === true;
      session.user.trustedPro = (token as { trustedPro?: boolean }).trustedPro === true;
      session.user.accountCreatedAt =
        typeof (token as { accountCreatedAt?: string | null }).accountCreatedAt === "string"
          ? (token as { accountCreatedAt?: string }).accountCreatedAt
          : null;
      const cts = (token as { copyTradeAccessState?: string }).copyTradeAccessState;
      session.user.copyTradeAccessState =
        cts === "pending" || cts === "approved" || cts === "denied" || cts === "none" ? cts : "none";

      // Expose Discord gate status to the client for UX.
      (session.user as any).discordInGuild =
        typeof (token as any).discordInGuild === "boolean" ? (token as any).discordInGuild : null;
      (session.user as any).discordNeedsVerification = effectiveNeedsVerification;
      (session.user as any).discordBlockedReason =
        typeof (token as any).discordBlockedReason === "string" ? (token as any).discordBlockedReason : null;
      return session;
    },
  },
};
