"use client";

import { useCallback, useEffect, useState } from "react";

type CampaignRow = {
  id: string;
  slug: string;
  name: string;
  clickCount: number;
  trackingUrl: string | null;
};

type CampaignsPayload = {
  defaultLink: string;
  defaultClickCount: number;
  campaigns: CampaignRow[];
};

export default function AffiliateCampaignsPage() {
  const [data, setData] = useState<CampaignsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/campaigns", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        defaultLink?: string;
        defaultClickCount?: number;
        campaigns?: CampaignRow[];
      };
      if (!res.ok || !j.success || typeof j.defaultLink !== "string") {
        setErr(typeof j.error === "string" ? j.error : "Could not load campaigns.");
        return;
      }
      setData({
        defaultLink: j.defaultLink,
        defaultClickCount: Math.floor(Number(j.defaultClickCount)) || 0,
        campaigns: Array.isArray(j.campaigns) ? j.campaigns : [],
      });
    } catch {
      setErr("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = await fetch("/api/affiliate/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ slug: slug.trim(), name: name.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) {
        setErr(typeof j.error === "string" ? j.error : "Could not create campaign.");
        return;
      }
      setSlug("");
      setName("");
      setNote("Campaign created.");
      await load();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied.");
    } catch {
      setNote("Copy failed — select the link manually.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-10">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/90">Campaigns</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Tracking links</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Each link opens a McGBot landing page (clicks are counted) before Discord. Use campaigns to track YouTube,
          X, Discord posts, etc.
        </p>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {note ? <p className="text-sm text-emerald-800">{note}</p> : null}

      {data ? (
        <>
          <section className="rounded-2xl border border-violet-200/90 bg-violet-50/60 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/90">Default link</p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-900">{data.defaultLink}</p>
            <p className="mt-2 text-xs text-zinc-600">{data.defaultClickCount} landing view(s)</p>
            <button
              type="button"
              onClick={() => void copyLink(data.defaultLink)}
              className="mt-3 h-8 rounded-lg border border-violet-300 bg-white px-3 text-xs font-semibold text-violet-900 hover:bg-violet-50"
            >
              Copy link
            </button>
          </section>

          <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">New campaign</h2>
            <form onSubmit={createCampaign} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Slug</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="youtube-may"
                  className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="YouTube May 2026"
                  className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="h-9 rounded-lg bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-45 sm:col-span-2"
              >
                {busy ? "Creating…" : "Create campaign"}
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Campaigns</h2>
            </div>
            {data.campaigns.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">No campaigns yet — create one to get a tracked sub-link.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {data.campaigns.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{c.name}</p>
                        <p className="font-mono text-[11px] text-zinc-500">?c={c.slug}</p>
                      </div>
                      <p className="text-xs font-medium text-violet-800">{c.clickCount} clicks</p>
                    </div>
                    {c.trackingUrl ? (
                      <p className="mt-2 break-all font-mono text-[11px] text-zinc-700">{c.trackingUrl}</p>
                    ) : null}
                    {c.trackingUrl ? (
                      <button
                        type="button"
                        onClick={() => void copyLink(c.trackingUrl!)}
                        className="mt-2 h-7 rounded border border-zinc-200 bg-zinc-50 px-2 text-[10px] font-semibold text-zinc-700"
                      >
                        Copy
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}
    </div>
  );
}
