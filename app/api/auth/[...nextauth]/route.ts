import type { NextAuthOptions } from 'next-auth';
import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: 'identify email' } }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
