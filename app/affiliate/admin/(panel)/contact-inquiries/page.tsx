"use client";

import { useCallback, useEffect, useState } from "react";

type InquiryRow = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  categoryLabel: string;
  subject: string;
  message: string;
  pagePath: string | null;
  status: "open" | "closed";
  reviewedAt: string | null;
};

type Filter = "open" | "closed" | "all";

export default function AffiliateAdminContactInquiriesPage() {
  const [filter, setFilter] = useState<Filter>("open");
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/contact-inquiries?status=${filter}`, {
        credentials: "same-origin",
      });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        inquiries?: InquiryRow[];
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not load inquiries.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.inquiries) ? j.inquiries : []);
    } catch {
      setErr("Could not load inquiries.");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: "open" | "closed") {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/affiliate/admin/contact-inquiries/${encodeURIComponent(id)}`, {
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
      await load();
    } catch {
      setErr("Update failed.");
    } finally {
      setBusy(null);
    }
  }

  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Public contact inbox</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Messages from the marketing site contact form (/affiliate/support). Not logged-in affiliate support
          tickets.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          {openCount} open message{openCount === 1 ? "" : "s"} in this view.
        </p>
      ) : null}

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">No messages for this filter.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => {
              const expanded = expandedId === r.id;
              return (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            r.status === "open"
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900"
                              : "rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-600"
                          }
                        >
                          {r.status}
                        </span>
                        <span className="text-sm font-semibold text-zinc-900">{r.subject}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">
                        {r.name} ·{" "}
                        <a href={`mailto:${encodeURIComponent(r.email)}`} className="font-medium text-violet-700 hover:underline">
                          {r.email}
                        </a>
                        {" · "}
                        {r.categoryLabel}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                        {r.pagePath ? ` · ${r.pagePath}` : ""}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      {r.status === "open" ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void setStatus(r.id, "closed")}
                          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 disabled:opacity-45"
                        >
                          Mark closed
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void setStatus(r.id, "open")}
                          className="rounded border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 disabled:opacity-45"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded ? (
                    <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap text-zinc-800">
                      {r.message}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
