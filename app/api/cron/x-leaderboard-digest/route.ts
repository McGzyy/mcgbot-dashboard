import { createRequire } from "node:module";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runXLeaderboardDigestCron } from "@/lib/xLeaderboardDigestCron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const require = createRequire(import.meta.url);

function authorizeCron(request: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = (request.headers.get("x-cron-secret") ?? "").trim();
  return bearer === secret || header === secret;
}

function loadCreatePost() {
  const modPath = path.join(process.cwd(), "utils", "xPoster.js");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(modPath).createPost as (
    text: string,
    replyToId?: string | null,
    mediaPngBuffer?: unknown,
    options?: unknown
  ) => Promise<{ success: boolean; id?: string | null; error?: unknown }>;
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const createPostRaw = loadCreatePost();
  const result = await runXLeaderboardDigestCron(db, (text, replyToId) =>
    createPostRaw(text, replyToId ?? null, null, null)
  );

  return Response.json({ success: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
