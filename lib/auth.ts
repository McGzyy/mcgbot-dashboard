import type { NextAuthOptions } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify email" } },
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
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_ANON_KEY;
      if (!url || !key || !user?.id) return true;

      const supabase = createClient(url, key);

      const { data: existing, error: selectError } = await supabase
        .from("users")
        .select("tier")
        .eq("discord_id", user.id)
        .maybeSingle();

      if (selectError) {
        console.error(
          "[auth signIn] users select:",
          selectError.message || selectError
        );
        return true;
      }

      if (!existing) {
        const { error: insertError } = await supabase.from("users").insert({
          discord_id: user.id,
          tier: "free",
        });

        if (insertError) {
          console.error(
            "[auth signIn] users insert:",
            insertError.message || insertError
          );
          return true;
        }

        const { error: dashboardSettingsError } = await supabase
          .from("user_dashboard_settings")
          .upsert(
            { discord_id: user.id },
            { onConflict: "discord_id" }
          );

        if (dashboardSettingsError) {
          console.error(
            "[auth signIn] user_dashboard_settings upsert:",
            dashboardSettingsError.message || dashboardSettingsError
          );
        }
      }

      const { error: prefsError } = await supabase
        .from("user_preferences")
        .upsert(
          { discord_id: user.id },
          { onConflict: "discord_id" }
        );

      if (prefsError) {
        console.error(
          "[auth signIn] user_preferences upsert:",
          prefsError.message || prefsError
        );
      }

      return true;
    },
    async jwt({ token, user, profile }) {
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
      return session;
    },
  },
};
