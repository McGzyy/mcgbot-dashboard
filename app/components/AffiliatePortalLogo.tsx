import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string;
  subtitle?: string;
  className?: string;
};

export function AffiliatePortalLogo({ href = "/affiliate/login", subtitle, className = "" }: Props) {
  const inner = (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        src="/brand/traders-edge-logo.png"
        alt="Traders Edge"
        width={220}
        height={56}
        className="h-9 w-auto max-w-[min(220px,70vw)] object-contain object-left"
        priority
      />
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
