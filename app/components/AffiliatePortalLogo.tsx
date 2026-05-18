import Image from "next/image";
import Link from "next/link";

/** Intrinsic size of `public/brand/mcgbot-logo.png` — keep in sync with the file. */
const LOGO_WIDTH = 819;
const LOGO_HEIGHT = 673;

type Props = {
  href?: string;
  subtitle?: string;
  className?: string;
};

export function AffiliatePortalLogo({ href = "/affiliate/login", subtitle, className = "" }: Props) {
  const inner = (
    <div className={`flex min-w-0 items-center gap-2.5 sm:gap-3 ${className}`}>
      <Image
        src="/brand/mcgbot-logo.png"
        alt="McGBot"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        sizes="(max-width: 640px) 108px, 130px"
        className="h-8 w-auto max-h-9 shrink-0 object-contain object-left brightness-0 sm:h-9"
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
    <Link href={href} className="group flex min-w-0 shrink-0 items-center">
      {inner}
    </Link>
  );
}
