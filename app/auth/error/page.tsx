import Link from "next/link";

export default async function AuthErrorPage(props: PageProps<"/auth/error">) {
  const sp = await props.searchParams;
  const errorRaw = sp?.error;
  const error = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw;

  const title =
    error === "Configuration"
      ? "Auth configuration problem"
      : error === "AccessDenied"
        ? "Access denied"
        : "Discord sign-in failed";

  const hint =
    error === "Configuration"
      ? "This is almost always a Discord Developer Portal redirect mismatch, or missing NEXTAUTH_URL / NEXTAUTH_SECRET in the deployed environment."
      : error === "AccessDenied"
        ? "The user cancelled Discord authorization, or Discord rejected the request."
        : "Try again. If it keeps failing, capture the exact error code shown below and check Discord redirect URLs + env vars.";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-8 shadow-xl shadow-black/40 backdrop-blur-sm">
        <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{hint}</p>

        {error ? (
          <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Error code
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-200">{error}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/40 transition hover:bg-green-500"
          >
            Back to dashboard
          </Link>
          <a
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-zinc-300 hover:text-white"
          >
            Discord Developer Portal →
          </a>
        </div>
      </div>
    </div>
  );
}
