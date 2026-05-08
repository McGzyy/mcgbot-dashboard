import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type TrackedCallsService = {
  initTrackedCallsStore: () => Promise<void>;
  setApprovalStatus: (
    contractAddress: string,
    status: string,
    moderation?: {
      excludedFromStats?: boolean;
      moderatedById?: string | null;
      moderatedByUsername?: string | null;
      moderationTags?: string[];
      moderationNotes?: string;
    }
  ) => unknown;
};

function discordIdFromToken(token: Record<string, unknown> | null): string {
  const pick = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : "");
  return pick(token?.discord_id) || pick(token?.sub) || pick(token?.id);
}

function usernameFromToken(token: Record<string, unknown> | null): string {
  const pick = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : "");
  return pick(token?.discord_username) || pick(token?.name) || "";
}

export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? ((await getToken({ req, secret })) as Record<string, unknown> | null) : null;
  if (!token) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  const tier = String(token.helpTier || "").toLowerCase();
  const isStaff = tier === "admin" || tier === "mod";
  if (!isStaff) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    callCa?: string;
    excluded?: boolean;
    reason?: string;
  };
  const ca = String(body.callCa || "").trim();
  if (!ca) return NextResponse.json({ success: false, error: "missing_contract" }, { status: 400 });

  const excluded = body.excluded === true;
  const moderatedById = discordIdFromToken(token) || null;
  const moderatedByUsername = usernameFromToken(token) || null;

  const service = require("../../../../utils/trackedCallsService.js") as TrackedCallsService;
  await service.initTrackedCallsStore();

  // We encode exclusion as approvalStatus='excluded' which drives excludedFromStats.
  // Restore uses approvalStatus='none' (keeps call tracked, just counted again).
  service.setApprovalStatus(ca, excluded ? "excluded" : "none", {
    excludedFromStats: excluded,
    moderatedById,
    moderatedByUsername,
    moderationTags: excluded ? ["dashboard_exclude"] : [],
    moderationNotes:
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : excluded
          ? "Excluded from bot calls page"
          : "Restored on bot calls page",
  });

  return NextResponse.json({ success: true, excluded });
}

