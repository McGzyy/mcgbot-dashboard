import type { HelpDocSlug } from "@/lib/helpRole";
import type { ReactNode } from "react";

export function getHelpDocToc(slug: HelpDocSlug): { id: string; label: string }[] {
  switch (slug) {
    case "caller":
      return [
        { id: "caller-dashboard", label: "Dashboard" },
        { id: "caller-referrals", label: "Referrals" },
        { id: "caller-reputation", label: "Reputation" },
      ];
    case "moderator":
      return [
        { id: "moderator-overview", label: "Overview" },
        { id: "moderator-moderation", label: "Moderation" },
        { id: "moderator-tone", label: "Community tone" },
      ];
    case "admin":
      return [
        { id: "admin-overview", label: "Overview" },
        { id: "admin-operations", label: "Operations" },
        { id: "admin-roles", label: "Roles" },
      ];
    default:
      return [];
  }
}

export function DocBlock({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-xl border border-zinc-800/90 bg-zinc-950 p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

export function CallerDocBody() {
  return (
    <div className="space-y-4">
      <DocBlock id="caller-dashboard" title="Dashboard">
        <ul className="list-inside list-disc space-y-1.5 text-zinc-400">
          <li>Use the widget rail to focus on what you trade: activity, trending, and quick actions.</li>
          <li>Submit Call opens a structured flow — double-check symbol, chain, and thesis before sending.</li>
          <li>Your Rank tracks leaderboard placement; D/W/M/A mirrors the full leaderboard page.</li>
        </ul>
      </DocBlock>
      <DocBlock id="caller-referrals" title="Referrals">
        <ul className="list-inside list-disc space-y-1.5 text-zinc-400">
          <li>Copy your link from Referrals → Overview and share in communities that allow it.</li>
          <li>Performance and Rewards tabs summarize downstream activity (placeholders until live data).</li>
        </ul>
      </DocBlock>
      <DocBlock id="caller-reputation" title="Reputation">
        <ul className="list-inside list-disc space-y-1.5 text-zinc-400">
          <li>Leaderboard windows reward consistency — spamming low-quality calls hurts more than it helps.</li>
          <li>Profiles support bio and visibility settings under Settings.</li>
        </ul>
      </DocBlock>
    </div>
  );
}

export function ModeratorDocBody() {
  return (
    <div className="space-y-4">
      <div
        id="moderator-overview"
        className="scroll-mt-28 rounded-xl border border-sky-500/15 bg-sky-500/5 p-4"
      >
        <p className="text-sm text-zinc-300">
          You have the <span className="font-semibold text-sky-400/90">Moderator</span> playbook. Caller
          expectations still apply in public.
        </p>
      </div>
      <DocBlock id="moderator-moderation" title="Moderation">
        <ul className="list-inside list-disc space-y-1.5 text-zinc-400">
          <li>Prioritize clear violations (spam, harassment, malicious links) over taste disagreements.</li>
          <li>Document actions when tooling supports it — audit trails help the whole team.</li>
          <li>Escalate edge cases to admins instead of improvising policy.</li>
        </ul>
      </DocBlock>
      <DocBlock id="moderator-tone" title="Community tone">
        <ul className="list-inside list-disc space-y-1.5 text-zinc-400">
          <li>Be fast, neutral, and specific when correcting users in public channels.</li>
          <li>Assume good intent once; repeated abuse gets firmer boundaries.</li>
        </ul>
      </DocBlock>
    </div>
  );
}

export function AdminDocBody() {
  return (
    <div className="space-y-4">
      <div
        id="admin-overview"
        className="scroll-mt-28 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4"
      >
        <p className="text-sm text-zinc-300">
          You have the <span className="font-semibold text-amber-400/90">Admin</span> runbook. Caller and
          moderator expectations still apply to you in public spaces.
        </p>
      </div>
      <DocBlock id="admin-operations" title="Operations">
        <ul className="list-inside list-disc space-y-1.5 text-zinc-400">
          <li>Environment and secrets live in Vercel / host env — never commit tokens to the repo.</li>
          <li>
            Discord OAuth redirect URLs and <code className="text-zinc-500">NEXTAUTH_URL</code> must
            match the canonical site URL (including www vs apex).
          </li>
          <li>When changing DNS, wait for TTL and clear local DNS caches before assuming failure.</li>
        </ul>
      </DocBlock>
      <DocBlock id="admin-roles" title="Roles">
        <ul className="list-inside list-disc space-y-1.5 text-zinc-400">
          <li>
            Today, help tier is resolved from <code className="text-zinc-500">DISCORD_ADMIN_IDS</code>{" "}
            / <code className="text-zinc-500">DISCORD_MOD_IDS</code> (server env). Next: store{" "}
            <code className="text-zinc-500">role</code> on <code className="text-zinc-500">users</code> in
            Supabase and read it here.
          </li>
        </ul>
      </DocBlock>
    </div>
  );
}

export function HelpDocBodyForSlug({ slug }: { slug: HelpDocSlug }) {
  if (slug === "caller") return <CallerDocBody />;
  if (slug === "moderator") return <ModeratorDocBody />;
  return <AdminDocBody />;
}
