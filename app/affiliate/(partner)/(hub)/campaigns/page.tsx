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
  referralCode: string;
  defaultClickCount: number;
  campaigns: CampaignRow[];
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export default function AffiliateCampaignsPage() {
  const [data, setData] = useState<CampaignsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/affiliate/campaigns", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        defaultLink?: string;
        referralCode?: string;
        defaultClickCount?: number;
        campaigns?: CampaignRow[];
      };
      if (!res.ok || !j.success || typeof j.defaultLink !== "string") {
        setErr(typeof j.error === "string" ? j.error : "Could not load campaigns.");
        return;
      }
      setData({
        defaultLink: j.defaultLink,
        referralCode: typeof j.referralCode === "string" ? j.referralCode : "",
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
    setNote(null);
    setErr(null);
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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700/90">Campaigns</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Tracking links</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Your default link attributes all traffic. Create named campaigns for YouTube, Discord, or email — each gets
          its own short <span className="font-mono text-zinc-800">/r/XXXXX</span> code and click stats.
        </p>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {note ? <p className="text-sm text-emerald-800">{note}</p> : null}

      {data ? (
        <>
          <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/90">Default link</p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-900">{data.defaultLink}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Code <span className="font-mono font-medium text-zinc-700">{data.referralCode}</span> ·{" "}
              {data.defaultClickCount.toLocaleString()} clicks (not tied to a campaign)
            </p>
            <div className="mt-3">
              <CopyButton text={data.defaultLink} label="Copy link" />
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">New campaign</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Slug is for your reference (e.g. <span className="font-mono">youtube-may</span>). Share the generated
              short link publicly.
            </p>
            <form onSubmit={createCampaign} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-700">
                Slug
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  placeholder="youtube-may"
                  pattern="[a-zA-Z0-9][a-zA-Z0-9-]{2,29}"
                  required
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Display name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  placeholder="YouTube May 2026"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create campaign"}
                </button>
              </div>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-zinc-900">Your campaigns</h2>
            </div>
            {data.campaigns.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-500 sm:px-5">
                No campaigns yet — create one to track channel-specific performance.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5 sm:px-5">Name</th>
                      <th className="px-4 py-2.5">Slug</th>
                      <th className="px-4 py-2.5 text-right">Clicks</th>
                      <th className="px-4 py-2.5">Short link</th>
                      <th className="px-4 py-2.5 sm:px-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="text-zinc-800">
                        <td className="px-4 py-3 font-medium text-zinc-900 sm:px-5">{c.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-600">{c.slug}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{c.clickCount.toLocaleString()}</td>
                        <td className="max-w-[12rem] truncate px-4 py-3 font-mono text-xs text-zinc-700">
                          {c.trackingUrl ?? "—"}
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          {c.trackingUrl ? <CopyButton text={c.trackingUrl} label="Copy" /> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Loading campaigns…</p>
      )}
    </div>
  );
}
