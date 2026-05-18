import Link from "next/link";

type Props = {
  href?: string;
  subtitle?: string;
  className?: string;
};

export function AffiliatePortalLogo({ href = "/affiliate/login", subtitle, className = "" }: Props) {
  const inner = (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <span className="text-lg font-extrabold tracking-tight text-zinc-900">
        TRADERS <span className="text-violet-700">EDGE</span>
      </span>
      {subtitle ? (
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700/80 sm:inline">
          {subtitle}
        </span>
      ) : null}
    </div>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="group min-w-0 shrink-0">
      {inner}
    </Link>
  );
}

