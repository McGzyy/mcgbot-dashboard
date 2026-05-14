import { requireDashboardAdmin } from "@/lib/adminGate";
import { resetTotpForDiscordUser } from "@/lib/totpAdminReset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSnowflake(id: string): boolean {
  return /^[1-9]\d{9,21}$/.test(id.trim());
}

export async function POST(_request: Request, ctx: { params: Promise<{ discordId: string }> }) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { discordId: raw } = await ctx.params;
  const discordId = typeof raw === "string" ? raw.trim() : "";
  if (!isSnowflake(discordId)) {
    return Response.json({ success: false, error: "Invalid discord id." }, { status: 400 });
  }

  const ok = await resetTotpForDiscordUser(discordId);
  if (!ok) {
    return Response.json({ success: false, error: "Reset failed (database error or user missing)." }, { status: 500 });
  }
  return Response.json({ success: true });
}
