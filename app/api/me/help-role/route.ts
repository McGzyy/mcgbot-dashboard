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

  const role = resolveHelpTier(id);
  const modChatConfigured = !!(process.env.DISCORD_MOD_CHAT_CHANNEL_ID ?? "").trim();

  if (role === "mod" || role === "admin") {
    return Response.json({ role, modChatConfigured });
  }

  return Response.json({ role });
}
