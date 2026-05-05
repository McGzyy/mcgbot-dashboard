import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchDexscreenerMintMeta, normalizeDexscreenerMint } from "@/lib/dexscreenerMintMeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id?.trim()) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const mint = normalizeDexscreenerMint(url.searchParams.get("mint"));
    if (!mint) {
      return Response.json({ error: "Invalid mint" }, { status: 400 });
    }

    const meta = await fetchDexscreenerMintMeta(mint);
    if (!meta.found) {
      return Response.json({
        ok: true as const,
        mint: meta.mint,
        found: false as const,
        symbol: null,
        name: null,
        imageUrl: null,
      });
    }

    return Response.json({
      ok: true as const,
      mint: meta.mint,
      found: true as const,
      symbol: meta.symbol,
      name: meta.name,
      imageUrl: meta.imageUrl,
    });
  } catch (e) {
    console.error("[solana/mint-meta] GET:", e);
    return Response.json({ ok: false, error: "Lookup failed" }, { status: 502 });
  }
}
