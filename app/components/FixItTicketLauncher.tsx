"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { FIX_IT_PAGE_OPTIONS, resolveFixItPageFromPathname } from "@/lib/fixItTicketPages";
import { terminalUi } from "@/lib/terminalDesignTokens";

const TICKET_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "ui_ux", label: "UI / UX", hint: "Spacing, readability, controls, visual polish" },
  { value: "workflow", label: "Flow / workflow", hint: "Too many steps, confusing navigation" },
  { value: "idea", label: "Idea", hint: "Feature or improvement you’d like" },
  { value: "opinion", label: "Opinion / vibe", hint: "Hot take, preference, overall feel" },
  { value: "preference", label: "Preference", hint: "Defaults, toggles, what you wish existed" },
  { value: "broken", label: "Something broke", hint: "Not a full Settings bug report — quick heads-up" },
  { value: "other", label: "Other", hint: "Anything else" },
];

const envFabAllowed = process.env.NEXT_PUBLIC_FIX_IT_TICKET_BUTTON !== "false";

export function FixItTicketLauncher() {
  const pathname = usePathname() ?? "/";
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [pageKey, setPageKey] = useState("other");
  const [ticketType, setTicketType] = useState("ui_ux");
  const [description, setDescription] = useState("");
  const [allowContact, setAllowContact] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [serverModuleEnabled, setServerModuleEnabled] = useState<boolean | null>(null);

  const resolved = useMemo(() => resolveFixItPageFromPathname(pathname), [pathname]);

  useEffect(() => {
    if (!envFabAllowed) return;
    if (status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/fix-it-tickets/module", { credentials: "same-origin" });
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && j && j.ok === true && typeof j.enabled === "boolean") {
          setServerModuleEnabled(j.enabled);
        } else {
          setServerModuleEnabled(true);
        }
      } catch {
        if (!cancelled) setServerModuleEnabled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!open) return;
    setPageKey(resolved.key);
    setErr(null);
    setDone(false);
  }, [open, resolved.key]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    setDescription("");
    setImageFile(null);
    setAllowContact(false);
    setTicketType("ui_ux");
    setErr(null);
    setDone(false);
  }, [submitting]);

  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("page_key", pageKey);
      fd.set("page_path", pathname);
      fd.set("ticket_type", ticketType);
      fd.set("description", description.trim());
      fd.set("allow_contact", allowContact ? "1" : "0");
      if (imageFile) fd.set("image", imageFile, imageFile.name);
      const res = await fetch("/api/me/fix-it-tickets", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setErr(typeof json.error === "string" ? json.error : "Could not submit.");
        return;
      }
      setDone(true);
      setDescription("");
      setImageFile(null);
      setAllowContact(false);
    } catch {
      setErr("Network error.");
    } finally {
      setSubmitting(false);
    }
  }, [allowContact, description, imageFile, pageKey, pathname, submitting, ticketType]);

  if (!envFabAllowed) return null;
  if (status !== "authenticated") return null;
  if (pathname.startsWith("/admin")) return null;
  if (serverModuleEnabled === false) return null;
  if (serverModuleEnabled === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[60] max-w-[11.25rem] rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/20 via-zinc-950/95 to-zinc-950 px-3 py-2.5 text-left shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)] shadow-amber-900/20 backdrop-blur-md transition hover:border-amber-400/50 hover:from-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 bottom-[calc(0.35rem+var(--mcg-dock-stack,4rem))] left-3 right-auto sm:max-w-[calc(100vw-2.5rem)] sm:px-4 sm:py-3 sm:bottom-[calc(0.45rem+var(--mcg-dock-stack,4rem))] lg:left-auto lg:right-6"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">Beta</span>
        <span className="mt-0.5 block text-sm font-semibold text-zinc-50">Fix-it ticket</span>
        <span className="mt-0.5 hidden text-[11px] text-zinc-500 sm:block">UI, ideas, prefs — quick send</span>
      </button>

      {open ? (
        <div
          className={terminalUi.fixItTicketBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Submit fix-it ticket"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget && !submitting) close();
          }}
        >
          <div className={`relative z-10 ${terminalUi.modalPanel2xlWide}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">Build phase</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-50">Fix-it ticket</h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  For tester notes: polish, ideas, and opinions. Use{" "}
                  <span className="text-zinc-400">Settings → Report a bug</span> if something is outright broken and
                  you need a tracked repro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => close()}
                className={terminalUi.modalCloseIconBtn}
                aria-label="Close"
                disabled={submitting}
              >
                ✕
              </button>
            </div>

            {done ? (
              <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                Thanks — your note was saved. You can close this or send another.
              </div>
            ) : null}

            {err ? (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200">
                {err}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-500">Page</span>
                <select
                  className={`${terminalUi.formInput} mt-1`}
                  value={pageKey}
                  onChange={(e) => setPageKey(e.target.value)}
                  disabled={submitting}
                >
                  {FIX_IT_PAGE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Auto-selected from <span className="font-mono text-zinc-500">{pathname || "/"}</span> — change if
                  needed.
                </p>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-500">Type</span>
                <select
                  className={`${terminalUi.formInput} mt-1`}
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value)}
                  disabled={submitting}
                >
                  {TICKET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} — {t.hint}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-500">What should we know?</span>
                <textarea
                  className={`${terminalUi.formInput} mt-1 min-h-[100px] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={4000}
                  placeholder="A few sentences is perfect — what you expected, what you got, and how strongly you feel."
                  disabled={submitting}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-zinc-500">Screenshot (optional, one image)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="mt-2 block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-200 hover:file:bg-zinc-800"
                  disabled={submitting}
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
                {imagePreview ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800">
                    <img src={imagePreview} alt="Preview" className="max-h-48 w-full object-contain bg-black/40" />
                  </div>
                ) : null}
              </label>

              <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={allowContact}
                  onChange={(e) => setAllowContact(e.target.checked)}
                  disabled={submitting}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                />
                <span className="text-sm text-zinc-400">
                  OK to reach out in Discord if we need a quick follow-up (uses your linked account; no email stored
                  here).
                </span>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => close()}
                disabled={submitting}
                className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={submitting || description.trim().length < 8}
                onClick={() => void submit()}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
