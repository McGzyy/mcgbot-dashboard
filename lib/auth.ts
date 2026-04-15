import type { NextAuthOptions } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import DiscordProvider from "next-auth/providers/discord";

console.log("DISCORD ID:", process.env.DISCORD_CLIENT_ID);
console.log(
  "DISCORD SECRET:",
  process.env.DISCORD_CLIENT_SECRET ? "[present]" : "[missing]"
);

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
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: existingUser, error } = await supabase
          .from("users")
          .select("*")
          .eq("discord_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Supabase fetch error:", error);
          return true; // never break auth
        }

        if (!existingUser) {
          await supabase.from("users").insert({
            discord_id: user.id,
            username: user.name,
          });
        }

        return true;
      } catch (err) {
        console.error("Auth error:", err);
        return true; // NEVER crash auth
      }
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
