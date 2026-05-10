import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchCaAnalyzeDashboardIntel, normalizeCaAnalyzeInput } from "@/lib/caAnalyzeIntel";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id?.trim() ?? "";
    if (!viewerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const caRaw =
      body && typeof body === "object" && body !== null && "ca" in body
        ? String((body as { ca?: unknown }).ca ?? "")
        : "";
    const mintCore = normalizeCaAnalyzeInput(caRaw);
    if (!mintCore) {
      return Response.json(
        { error: "Enter a valid Solana mint (base58) or a DexScreener / Birdeye Solana token URL." },
        { status: 400 }
      );
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Database not configured" }, { status: 503 });
    }

    const intel = await fetchCaAnalyzeDashboardIntel(db, { mintCore, viewerDiscordId: viewerId });

    const baseUrl = String(
      process.env.MCGBOT_INTERNAL_API_BASE_URL ?? process.env.BOT_API_URL ?? ""
    )
      .trim()
      .replace(/\/+$/, "");
    const secret = String(process.env.CALL_INTERNAL_SECRET ?? "").trim();

    type FaSolPayload =
      | { ok: true; parsed: unknown }
      | { ok: false; error: string }
      | { ok: null; skipped: true; reason: string };

    let faSol: FaSolPayload;
    if (!baseUrl || !secret) {
      faSol = {
        ok: null,
        skipped: true,
        reason: "Set MCGBOT_INTERNAL_API_BASE_URL and CALL_INTERNAL_SECRET on the dashboard host to enable live FaSol cards.",
      };
    } else {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 40_000);
        const r = await fetch(`${baseUrl}/internal/ca-fasol-enrich`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({ ca: mintCore, timeoutMs: 32_000 }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const j = (await r.json().catch(() => ({}))) as {
          success?: boolean;
          parsed?: unknown;
          error?: string;
        };
        if (r.ok && j.success === true) {
          faSol = { ok: true, parsed: j.parsed ?? null };
        } else {
          faSol = {
            ok: false,
            error: typeof j.error === "string" ? j.error : `FaSol bridge HTTP ${r.status}`,
          };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "FaSol bridge request failed";
        faSol = { ok: false, error: msg };
      }
    }

    return Response.json({
      ok: true,
      mint: mintCore,
      intel,
      faSol,
    });
  } catch (e) {
    console.error("[me/ca-analyze POST]", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
