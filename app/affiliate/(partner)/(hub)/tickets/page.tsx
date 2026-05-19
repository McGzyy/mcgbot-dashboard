"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Category = { value: string; label: string };

type TicketListRow = {
  id: string;
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
  category: string;
  messages: MessageRow[];
};

export default function AffiliateTicketsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tickets, setTickets] = useState<TicketListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [category, setCategory] = useState("payout");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");

  const loadList = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/support-tickets", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        tickets?: TicketListRow[];
        categories?: Category[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load tickets.");
        return;
      }
      setTickets(Array.isArray(j.tickets) ? j.tickets : []);
      if (Array.isArray(j.categories)) setCategories(j.categories);
    } catch {
      setErr("Network error.");
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/support-tickets/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        ticket?: TicketDetail;
        error?: string;
      };
      if (!res.ok || !j.success || !j.ticket) {
        setErr(typeof j.error === "string" ? j.error : "Could not load ticket.");
        setDetail(null);
        return;
      }
      setDetail(j.ticket);
    } catch {
      setErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch("/api/affiliate/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ category, subject, message }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        ticket?: TicketDetail;
        error?: string;
      };
      if (!res.ok || !j.success || !j.ticket) {
        setErr(typeof j.error === "string" ? j.error : "Could not create ticket.");
        return;
      }
      setShowNew(false);
      setSubject("");
      setMessage("");
      setNote("Ticket created. We typically respond within 1–2 business days.");
      await loadList();
      setSelectedId(j.ticket.id);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !detail || detail.status === "closed") return;
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch(
        `/api/affiliate/support-tickets/${encodeURIComponent(selectedId)}/messages`,
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
      if (!res.ok || !j.success || !j.ticket) {
        setErr(typeof j.error === "string" ? j.error : "Could not send reply.");
        return;
      }
      setReply("");
      setDetail(j.ticket);
      await loadList();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Support</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Account-linked tickets for payouts, tracking, and commissions. Replies appear here and by email.
        </p>
      </div>

      {note ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {note}
        </p>
      ) : null}
      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setShowNew((v) => !v);
            setNote(null);
          }}
          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-45"
        >
          {showNew ? "Cancel" : "New ticket"}
        </button>
        <Link
          href="/affiliate/support"
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Public contact form
        </Link>
      </div>

      {showNew ? (
        <form
          onSubmit={createTicket}
          className="space-y-3 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-zinc-900">Open a ticket</h2>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Topic</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            >
              {(categories.length > 0
                ? categories
                : [
                    { value: "payout", label: "Payouts & withdrawals" },
                    { value: "account", label: "Account & login" },
                    { value: "tracking", label: "Links & campaigns" },
                    { value: "commission", label: "Commissions & earnings" },
                    { value: "other", label: "Other" },
                  ]
              ).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              maxLength={160}
              required
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 min-h-[120px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              maxLength={4000}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-45"
          >
            {busy ? "Submitting…" : "Submit ticket"}
          </button>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          <p className="border-b border-zinc-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Your tickets
          </p>
          {tickets.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">No tickets yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {tickets.map((t) => {
                const active = selectedId === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={
                        active
                          ? "w-full px-4 py-3 text-left bg-violet-50"
                          : "w-full px-4 py-3 text-left hover:bg-zinc-50"
                      }
                    >
                      <p className="text-sm font-semibold text-zinc-900">{t.subject}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {t.categoryLabel} · {t.status === "open" ? "Open" : "Closed"} ·{" "}
                        {new Date(t.updatedAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm min-h-[280px]">
          {!selectedId || !detail ? (
            <p className="py-12 text-center text-sm text-zinc-500">Select a ticket to view the thread.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">{detail.subject}</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {detail.categoryLabel} · {detail.status === "open" ? "Open" : "Closed"}
                </p>
              </div>
              <ul className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
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
                      {m.authorRole === "ops" ? "McGBot team" : "You"} ·{" "}
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{m.body}</p>
                  </li>
                ))}
              </ul>
              {detail.status === "open" ? (
                <form onSubmit={sendReply} className="space-y-2 border-t border-zinc-100 pt-4">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Reply
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
                    disabled={busy}
                    className="h-9 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white disabled:opacity-45"
                  >
                    {busy ? "Sending…" : "Send reply"}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-zinc-500 border-t border-zinc-100 pt-4">
                  This ticket is closed. Open a new ticket if you need more help.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
