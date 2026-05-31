"use client";

import { useCallback, useEffect, useState } from "react";

type NoteRow = { id: string; authorDiscordId: string; note: string; createdAt: string };

export function ModQueueItemTools({
  subjectType,
  subjectId,
  escalateLabel,
}: {
  subjectType: string;
  subjectId: string;
  escalateLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ subjectType, subjectId });
      const res = await fetch(`/api/mod/notes?${qs}`, { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; notes?: NoteRow[] };
      if (res.ok && j.success) setNotes(Array.isArray(j.notes) ? j.notes : []);
    } catch {
      /* ignore */
    }
  }, [subjectType, subjectId]);

  useEffect(() => {
    if (expanded) void loadNotes();
  }, [expanded, loadNotes]);

  async function saveNote() {
    if (!noteDraft.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/mod/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ subjectType, subjectId, note: noteDraft.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not save note.");
        return;
      }
      setNoteDraft("");
      setMsg("Note saved.");
      await loadNotes();
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    const reason = escalateReason.trim() || escalateLabel?.trim() || "";
    if (!reason) {
      setErr("Add a short reason before escalating.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/mod/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          subjectType,
          subjectId,
          reason,
          detail: escalateLabel ? { label: escalateLabel } : {},
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Escalation failed.");
        return;
      }
      setEscalateReason("");
      setMsg("Escalated to admin inbox.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-zinc-800/60 pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80 hover:text-emerald-300"
      >
        {expanded ? "Hide staff tools" : "Staff note · Escalate"}
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {notes.length > 0 ? (
            <ul className="max-h-28 space-y-1.5 overflow-y-auto rounded-md border border-zinc-800/70 bg-zinc-950/40 px-2 py-2">
              {notes.map((n) => (
                <li key={n.id} className="text-[10px] leading-relaxed text-zinc-500">
                  <span className="font-mono text-zinc-600">{n.authorDiscordId.slice(0, 8)}…</span> ·{" "}
                  {n.note}
                </li>
              ))}
            </ul>
          ) : null}
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            placeholder="Internal note (staff only)…"
            className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-2.5 py-2 text-[11px] text-zinc-200 placeholder:text-zinc-600"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !noteDraft.trim()}
              onClick={() => void saveNote()}
              className="rounded-lg border border-zinc-600 bg-zinc-900/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            >
              Save note
            </button>
          </div>
          <input
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            placeholder={escalateLabel ? `Escalate: ${escalateLabel}` : "Escalation reason for admin…"}
            className="w-full rounded-lg border border-amber-700/40 bg-amber-950/20 px-2.5 py-2 text-[11px] text-amber-100/90 placeholder:text-amber-200/40"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void escalate()}
            className="rounded-lg border border-amber-500/35 bg-amber-950/35 px-2.5 py-1 text-[10px] font-semibold text-amber-100 hover:bg-amber-900/40 disabled:opacity-40"
          >
            Escalate to admin
          </button>
          {msg ? <p className="text-[10px] text-emerald-400/90">{msg}</p> : null}
          {err ? <p className="text-[10px] text-red-400">{err}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
