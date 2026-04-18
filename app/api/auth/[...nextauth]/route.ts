import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

// NextAuth relies on Node crypto + stable cookie signing. Running this handler on Edge
// can cause "successful OAuth" flows that never establish a session (looks like a login loop).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
