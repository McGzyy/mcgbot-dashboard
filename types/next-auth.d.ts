import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Profile {
    id: string;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discord_id?: string;
  }
}
