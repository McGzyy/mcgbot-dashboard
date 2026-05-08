import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? ((await getToken({ req, secret })) as Record<string, unknown> | null) : null;
  if (!token) return NextResponse.json({ ok: false, canExclude: false }, { status: 401 });
  const tier = String(token.helpTier || "").toLowerCase();
  const isStaff = tier === "admin" || tier === "mod";
  return NextResponse.json({ ok: true, canExclude: isStaff });
}

