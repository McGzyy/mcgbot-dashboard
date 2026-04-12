import type { NextAuthOptions } from "next-auth";
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
