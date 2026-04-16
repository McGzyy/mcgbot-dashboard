import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  titleClassName?: string;
  /** e.g. `px-5 py-3` for tighter vertical rhythm */
  paddingClassName?: string;
};

const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-[#2a2a2a] hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-[#2a2a2a]/30";

export default function PanelCard({
  title,
  children,
  className = "",
  elevated = false,
  titleClassName,
  paddingClassName = "px-4 py-3",
}: Props) {
  const surface = elevated
    ? "border-[#1a1a1a] bg-[#0a0a0a] shadow-md shadow-black/25"
    : "border-[#1a1a1a] bg-[#0a0a0a] shadow-sm shadow-black/20";

  return (
    <div
      className={`rounded-xl border ${paddingClassName} backdrop-blur-sm ${surface} ${CARD_HOVER} ${className}`}
    >
      <h2
        className={`text-sm font-semibold tracking-wide text-zinc-400 ${
          titleClassName ?? "uppercase"
        }`}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

