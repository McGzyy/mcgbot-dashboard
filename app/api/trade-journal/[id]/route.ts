import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteTradeJournalEntry, updateTradeJournalEntry } from "@/lib/tradeJournalDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id?.trim() ?? "";
  if (!uid) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const eid = typeof id === "string" ? id.trim() : "";
  if (!eid) {
    return Response.json({ success: false, error: "Missing entry id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    notes?: string;
    mint?: string | null;
    tags?: string[];
    status?: "open" | "closed";
    hasEdge?: boolean;
  } | null;

  if (body?.title !== undefined && !String(body.title).trim()) {
    return Response.json({ success: false, error: "Title cannot be empty." }, { status: 400 });
  }

  const res = await updateTradeJournalEntry({
    discordUserId: uid,
    id: eid,
    title: body?.title,
    notes: body?.notes,
    mint: body?.mint,
    tags: body?.tags,
    status: body?.status,
    hasEdge: body?.hasEdge,
  });

  if (!res.ok) {
    const status = res.error === "Entry not found." ? 404 : 500;
    return Response.json({ success: false, error: res.error }, { status });
  }
  return Response.json({ success: true, entry: res.row });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id?.trim() ?? "";
  if (!uid) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const eid = typeof id === "string" ? id.trim() : "";
  if (!eid) {
    return Response.json({ success: false, error: "Missing entry id." }, { status: 400 });
  }

  const res = await deleteTradeJournalEntry(uid, eid);
  if (!res.ok) {
    const status = res.error === "Entry not found." ? 404 : 500;
    return Response.json({ success: false, error: res.error }, { status });
  }
  return Response.json({ success: true });
}
