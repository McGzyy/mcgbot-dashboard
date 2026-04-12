import type { NextAuthOptions } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify email" } },
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
        }
      }

      return true;
    },
    async jwt({ token, profile }) {
      const discordId =
        profile &&
        typeof profile === "object" &&
        "id" in profile &&
        typeof (profile as { id: unknown }).id === "string"
          ? (profile as { id: string }).id
          : undefined;
      if (discordId) {
        token.discordId = discordId;
      }
      return token;
    },
    async session({ session, token }) {
      const id =
        (typeof token.discordId === "string" && token.discordId) ||
        (typeof token.sub === "string" && token.sub) ||
        "";
      if (session.user && id) {
        session.user.id = id;
      }
      return session;
    },
  },
};
