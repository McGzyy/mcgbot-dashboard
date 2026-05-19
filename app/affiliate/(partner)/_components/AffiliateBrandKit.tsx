"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AffiliateCopySnippet } from "@/app/affiliate/(partner)/_components/AffiliateCopySnippet";
import {
  AFFILIATE_BRAND_ASSETS,
  AFFILIATE_BRAND_COLORS,
  AFFILIATE_PRODUCT_PITCHES,
  AFFILIATE_PROMOTION_RULES,
  affiliateCopyTemplates,
} from "@/lib/affiliate/affiliateBrandKit";

export function AffiliateBrandKit() {
  const [trackingLink, setTrackingLink] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/campaigns", { credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; defaultLink?: string };
      if (res.ok && j.success && typeof j.defaultLink === "string") {
        setTrackingLink(j.defaultLink);
      }
    } catch {
      /* templates fall back to placeholder */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const templates = affiliateCopyTemplates(trackingLink);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Brand kit</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">
          Approved logos, colors, and copy templates. Templates below use your{" "}
          {loading ? (
            <span className="text-zinc-400">loading link…</span>
          ) : trackingLink ? (
            <span className="break-all font-mono text-xs text-violet-800">{trackingLink}</span>
          ) : (
            <span className="text-zinc-500">default tracking link</span>
          )}
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/affiliate/campaigns"
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            Campaign links
          </Link>
          <a
            href="/affiliate/mcgbot-affiliate-brand-guidelines.md"
            download
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Download guidelines (.md)
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Logo & downloads</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 p-6">
            <Image src="/brand/mcgbot-logo.png" alt="McGBot" width={200} height={48} className="h-12 w-auto" />
          </div>
          <ul className="flex-1 space-y-2">
            {AFFILIATE_BRAND_ASSETS.map((a) => (
              <li key={a.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-900">{a.name}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    {a.format}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{a.usage}</p>
                <a
                  href={a.href}
                  download={a.format !== "Markdown" ? true : undefined}
                  className="mt-2 inline-block text-xs font-semibold text-violet-700 hover:underline"
                >
                  Download →
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Brand colors</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {AFFILIATE_BRAND_COLORS.map((c) => (
            <li key={c.hex} className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-2">
              <span
                className="h-8 w-8 shrink-0 rounded-lg border border-zinc-200 shadow-inner"
                style={{ backgroundColor: c.hex }}
              />
              <div>
                <p className="text-sm font-medium text-zinc-900">{c.name}</p>
                <p className="font-mono text-xs text-zinc-600">{c.hex}</p>
                <p className="text-[11px] text-zinc-500">{c.usage}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Copy templates</h2>
        <p className="mt-1 text-xs text-zinc-500">One-click copy — edit tone to match your audience before posting.</p>
        <div className="mt-4 space-y-3">
          {templates.map((t) => (
            <AffiliateCopySnippet key={t.id} title={t.title} description={t.description} body={t.body} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Product talking points</h2>
        <p className="mt-1 text-xs text-zinc-500">Accurate feature language — do not promise returns.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {AFFILIATE_PRODUCT_PITCHES.map((p) => (
            <div
              key={p.tier}
              className={
                p.tier === "pro"
                  ? "rounded-xl border border-sky-200/80 bg-sky-50/40 p-4"
                  : "rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4"
              }
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{p.title}</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{p.tagline}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-700">
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Promotion rules</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
          {AFFILIATE_PROMOTION_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
