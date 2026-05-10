import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const row = await getDashboardAdminSettings();
  if (!row?.maintenance_enabled) {
    redirect("/");
  }
  const message =
    row?.maintenance_message?.trim() ||
    "We are performing maintenance. Please try again shortly.";

  return (
    <div className="min-h-screen bg-[color:var(--mcg-page)] text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="flex min-w-0 items-center" aria-label="McGBot Terminal — home">
          <Image
            src="/brand/mcgbot-terminal-logo.png"
            alt="McGBot Terminal"
            width={472}
            height={147}
            quality={100}
            sizes="(max-width: 1024px) 480px, 560px"
            className="h-12 w-auto max-w-[min(100%,calc(100vw-4rem))] object-contain object-left sm:h-14"
          />
        </Link>
      </header>
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <p className="text-sm leading-relaxed text-zinc-300">{message}</p>
        <p className="text-xs text-zinc-500">
          Dashboard admins can still sign in and use the app. If you believe you should have access, contact staff in
          Discord.
        </p>
        {row.discord_invite_url?.trim() ? (
          <a
            href={row.discord_invite_url.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center justify-center rounded-lg border border-[#5865F2]/50 bg-[#5865F2]/15 px-4 py-2.5 text-sm font-semibold text-[#949cf7] transition hover:border-[#5865F2] hover:bg-[#5865F2]/25"
          >
            Open Discord
          </a>
        ) : null}
      </main>
    </div>
  );
}
