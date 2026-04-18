import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveHelpTier } from "@/lib/helpRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ role: resolveHelpTier(id) });
}
