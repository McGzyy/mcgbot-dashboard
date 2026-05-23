import { NextResponse } from "next/server";
import {
  dexScreenerSolTokenPngUrl,
  normalizeTokenImageUrl,
} from "@/lib/resolveTokenAvatarUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DexPair = {
  chainId?: string;
  baseToken?: { address?: string };
  info?: { imageUrl?: string };
};

/**
 * Best-effort token logo for dashboard thumbs when DB snapshot URL is missing or dead.
 * Tries DexScreener pair `info.imageUrl`, then the public Dex CDN by mint.
 */
export async function GET(request: Request) {
  const mint = new URL(request.url).searchParams.get("mint")?.trim() ?? "";
  if (!mint) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 900 },
      }
    );
    if (res.ok) {
      const body = (await res.json()) as { pairs?: DexPair[] };
      const pairs = Array.isArray(body?.pairs) ? body.pairs : [];
      const solPairs = pairs.filter(
        (p) => String(p?.chainId || "").toLowerCase() === "solana"
      );
      const sorted = [...solPairs].sort((a, b) => {
        const addrA = String(a?.baseToken?.address || "");
        const addrB = String(b?.baseToken?.address || "");
        if (addrA === mint && addrB !== mint) return -1;
        if (addrB === mint && addrA !== mint) return 1;
        return 0;
      });
      for (const p of sorted) {
        const raw =
          typeof p?.info?.imageUrl === "string" ? p.info.imageUrl.trim() : "";
        const url = normalizeTokenImageUrl(raw);
        if (url) {
          return NextResponse.json({ url, source: "dexscreener_pair" });
        }
      }
    }
  } catch (e) {
    console.warn("[api/token-icon] dexscreener fetch failed:", e);
  }

  const cdn = dexScreenerSolTokenPngUrl(mint);
  if (cdn) {
    return NextResponse.json({ url: cdn, source: "dexscreener_cdn" });
  }

  return NextResponse.json({ url: null });
}
