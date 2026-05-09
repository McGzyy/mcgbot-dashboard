import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insertTradeJournalEntry, listTradeJournalEntries } from "@/lib/tradeJournalDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim() ?? "";
  if (!id) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const entries = await listTradeJournalEntries(id);
  return Response.json({ success: true, entries });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim() ?? "";
  if (!id) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    notes?: string;
    mint?: string | null;
    tags?: string[];
    status?: "open" | "closed";
    hasEdge?: boolean;
  } | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return Response.json({ success: false, error: "Title is required." }, { status: 400 });
  }

  const res = await insertTradeJournalEntry({
    discordUserId: id,
    title,
    notes: typeof body?.notes === "string" ? body.notes : "",
    mint: typeof body?.mint === "string" ? body.mint : body?.mint ?? null,
    tags: Array.isArray(body?.tags) ? body.tags : [],
    status: body?.status === "closed" ? "closed" : "open",
    hasEdge: Boolean(body?.hasEdge),
  });

  if (!res.ok) {
    return Response.json({ success: false, error: res.error }, { status: 500 });
  }
  return Response.json({ success: true, entry: res.row });
}
