import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  insertTradeJournalEntry,
  listTradeJournalEntries,
  tradeJournalPayloadFromBody,
} from "@/lib/tradeJournalDb";

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

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const payload = tradeJournalPayloadFromBody(body);
  if (!payload) {
    return Response.json({ success: false, error: "Title is required." }, { status: 400 });
  }

  const res = await insertTradeJournalEntry({
    discordUserId: id,
    ...payload,
  });

  if (!res.ok) {
    return Response.json({ success: false, error: res.error }, { status: 500 });
  }
  return Response.json({ success: true, entry: res.row });
}
