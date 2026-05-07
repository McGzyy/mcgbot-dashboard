import { Connection, PublicKey } from "@solana/web3.js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { solanaRpcUrlServer } from "@/lib/solanaEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function yyyyMmDdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ linked: false, points: [] });

    const { data: row, error: linkErr } = await db
      .from("dashboard_linked_wallets")
      .select("wallet_pubkey")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (linkErr) {
      console.error("[me/wallet/balance-history] linked wallet select:", linkErr);
      return Response.json({ linked: false, points: [] }, { status: 500 });
    }

    const pkStr =
      row && typeof row === "object" && typeof (row as Record<string, unknown>).wallet_pubkey === "string"
        ? String((row as Record<string, unknown>).wallet_pubkey).trim()
        : "";
    if (!pkStr) return Response.json({ linked: false, points: [] });

    // Fetch current SOL balance (native). This is intentionally lightweight; token USD valuation can come later.
    const conn = new Connection(solanaRpcUrlServer(), "confirmed");
    let lamports = 0;
    try {
      const pk = new PublicKey(pkStr);
      lamports = await conn.getBalance(pk, "confirmed");
    } catch {
      return Response.json({ linked: true, walletPubkey: pkStr, points: [] });
    }
    const solBalance = lamports / 1_000_000_000;

    const today = new Date();
    const todayKey = yyyyMmDdUtc(today); // date-only string, UTC

    const syntheticPoints = () => {
      const points: { day: string; sol: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        points.push({
          day: yyyyMmDdUtc(new Date(Date.now() - i * 24 * 60 * 60 * 1000)),
          sol: solBalance,
        });
      }
      return points;
    };

    // Upsert today's snapshot (one per day).
    const { error: upsertErr } = await db.from("dashboard_wallet_balance_snapshots").upsert(
      {
        discord_id: discordId,
        wallet_pubkey: pkStr,
        day: todayKey,
        sol_balance: solBalance,
      },
      { onConflict: "discord_id,day" }
    );

    if (upsertErr) {
      console.error("[me/wallet/balance-history] upsert:", upsertErr);
      // If the snapshots table isn't migrated yet, still return a usable chart.
      return Response.json({ linked: true, walletPubkey: pkStr, points: syntheticPoints() });
    }

    const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const sinceKey = yyyyMmDdUtc(since);

    const { data, error } = await db
      .from("dashboard_wallet_balance_snapshots")
      .select("day, sol_balance")
      .eq("discord_id", discordId)
      .gte("day", sinceKey)
      .order("day", { ascending: true })
      .limit(8);

    if (error) {
      console.error("[me/wallet/balance-history] select:", error);
      return Response.json({ linked: true, walletPubkey: pkStr, points: syntheticPoints() });
    }

    const points = (data ?? [])
      .map((r) => ({
        day: typeof (r as any).day === "string" ? String((r as any).day) : "",
        sol: Number((r as any).sol_balance),
      }))
      .filter((p) => p.day && Number.isFinite(p.sol));

    return Response.json({ linked: true, walletPubkey: pkStr, points });
  } catch (e) {
    console.error("[me/wallet/balance-history] GET:", e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

