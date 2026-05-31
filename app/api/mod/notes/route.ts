import { addModItemNote, listModItemNotes } from "@/lib/mod/modQueueOps";
import { requireModOrAdmin } from "@/lib/modStaffAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireModOrAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const subjectType = searchParams.get("subjectType")?.trim() ?? "";
  const subjectId = searchParams.get("subjectId")?.trim() ?? "";
  if (!subjectType || !subjectId) {
    return Response.json({ success: false, error: "subjectType and subjectId are required." }, { status: 400 });
  }

  const notes = await listModItemNotes(subjectType, subjectId);
  return Response.json({
    success: true,
    notes: notes.map((n) => ({
      id: n.id,
      authorDiscordId: n.authorDiscordId,
      note: n.note,
      createdAt: n.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireModOrAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    subjectType?: string;
    subjectId?: string;
    note?: string;
  } | null;

  const subjectType = body?.subjectType?.trim() ?? "";
  const subjectId = body?.subjectId?.trim() ?? "";
  const note = body?.note?.trim() ?? "";
  if (!subjectType || !subjectId || !note) {
    return Response.json({ success: false, error: "subjectType, subjectId, and note are required." }, { status: 400 });
  }

  const row = await addModItemNote({
    subjectType,
    subjectId,
    authorDiscordId: auth.staffDiscordId,
    note,
  });

  if (!row) {
    return Response.json(
      { success: false, error: "Could not save note. Confirm mod_item_notes migration ran." },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    note: {
      id: row.id,
      authorDiscordId: row.authorDiscordId,
      note: row.note,
      createdAt: row.createdAt,
    },
  });
}
