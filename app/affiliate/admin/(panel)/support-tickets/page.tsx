"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TicketListRow = {
  id: string;
  affiliateId: string;
  affiliateEmail: string | null;
  affiliateDisplayName: string | null;
  categoryLabel: string;
  subject: string;
  status: "open" | "closed";
  updatedAt: string;
  messageCount: number;
};

type MessageRow = {
  id: string;
  authorRole: "partner" | "ops";
  body: string;
  createdAt: string;
};

type TicketDetail = TicketListRow & {
  messages: MessageRow[];
};

type Filter = "open" | "closed" | "all";

export default function AffiliateAdminSupportTicketsPage() {
  const [filter, setFilter] = useState<Filter>("open");
  const [rows, setRows] = useState<TicketListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const loadList = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/support-tickets?status=${filter}`, {
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        tickets?: TicketListRow[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load tickets.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.tickets) ? j.tickets : []);
    } catch {
      setErr("Could not load tickets.");
    }
  }, [filter]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/affiliate/admin/support-tickets/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        ticket?: TicketDetail;
        error?: string;
      };
      if (!res.ok || !j.success || !j.ticket) {
        setDetail(null);
        return;
      }
      setDetail({
        ...j.ticket,
        affiliateEmail: j.ticket.affiliateEmail ?? null,
        affiliateDisplayName: j.ticket.affiliateDisplayName ?? null,
      });
    } catch {
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    void loadList();
    setSelectedId(null);
    setDetail(null);
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function setStatus(id: string, status: "open" | "closed") {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/support-tickets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Update failed.");
        return;
      }
      await loadList();
      if (selectedId === id) await loadDetail(id);
    } catch {
      setErr("Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !detail || detail.status === "closed") return;
    setBusy("reply");
    setErr(null);
    try {
      const res = await fetch(
        `/api/affiliate/admin/support-tickets/${encodeURIComponent(selectedId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ message: reply }),
        }
      );
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        ticket?: TicketDetail;
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not send reply.");
        return;
      }
      setReply("");
      if (j.ticket) setDetail({ ...j.ticket, affiliateEmail: detail.affiliateEmail, affiliateDisplayName: detail.affiliateDisplayName });
      await loadList();
    } catch {
      setErr("Could not send reply.");
    } finally {
      setBusy(null);
    }
  }

  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Partner support tickets</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Logged-in affiliates only. For prospects, use{" "}
          <Link href="/affiliate/admin/contact-inquiries" className="font-semibold text-violet-700 hover:underline">
            public contact inbox
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["open", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900"
                : "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            }
          >
            {f === "open" ? "Open" : f === "closed" ? "Closed" : "All"}
          </button>
        ))}
      </div>

      {filter === "open" && openCount > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {openCount} open ticket{openCount === 1 ? "" : "s"} in this view.
        </p>
      ) : null}

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">No tickets for this filter.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {rows.map((r) => {
                const active = selectedId === r.id;
                const who = r.affiliateDisplayName || r.affiliateEmail || "Partner";
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={
                        active
                          ? "w-full px-4 py-3 text-left bg-violet-50"
                          : "w-full px-4 py-3 text-left hover:bg-zinc-50"
                      }
                    >
                      <p className="text-sm font-semibold text-zinc-900">{r.subject}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {who} · {r.categoryLabel} · {r.status === "open" ? "Open" : "Closed"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm min-h-[320px]">
          {!selectedId || !detail ? (
            <p className="py-12 text-center text-sm text-zinc-500">Select a ticket.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">{detail.subject}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {detail.affiliateDisplayName || detail.affiliateEmail} · {detail.categoryLabel}
                  </p>
                  {detail.affiliateEmail ? (
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-600">{detail.affiliateEmail}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {detail.affiliateId ? (
                    <Link
                      href={`/affiliate/admin/partners/${detail.affiliateId}`}
                      className="rounded border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Partner profile
                    </Link>
                  ) : null}
                  {detail.status === "open" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void setStatus(detail.id, "closed")}
                      className="rounded border border-zinc-300 px-2 py-1 text-[10px] font-semibold text-zinc-800 disabled:opacity-45"
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void setStatus(detail.id, "open")}
                      className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-900 disabled:opacity-45"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>

              <ul className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {detail.messages.map((m) => (
                  <li
                    key={m.id}
                    className={
                      m.authorRole === "ops"
                        ? "rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-2"
                        : "rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                    }
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {m.authorRole === "ops" ? "Ops" : "Partner"} · {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{m.body}</p>
                  </li>
                ))}
              </ul>

              {detail.status === "open" ? (
                <form onSubmit={sendReply} className="space-y-2 border-t border-zinc-100 pt-4">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Reply to partner
                    </span>
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      className="mt-1 min-h-[88px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      maxLength={4000}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-45"
                  >
                    {busy === "reply" ? "Sending…" : "Send reply"}
                  </button>
                </form>
              ) : (
                <p className="border-t border-zinc-100 pt-4 text-xs text-zinc-500">Ticket closed.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
