import type { ReactNode } from "react";
import { terminalSurface } from "@/lib/terminalDesignTokens";

export const CARD_HOVER =
  "transition-[box-shadow,border-color,ring-color] duration-200 ease-out hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/35 hover:ring-1 hover:ring-zinc-700/25";

export function PanelCard({
  title,
  children,
  className = "",
  elevated = false,
  titleClassName,
  paddingClassName = "px-4 py-3",
  titleRight,
  /** When set with `titleRight`, title stays compact on the left and the right slot grows (e.g. filter chips). */
  titleSlotWide = false,
  "data-tutorial": dataTutorial,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  titleClassName?: string;
  /** e.g. `px-5 py-3` for tighter vertical rhythm */
  paddingClassName?: string;
  titleRight?: ReactNode;
  titleSlotWide?: boolean;
  "data-tutorial"?: string;
}) {
  const surface = elevated ? terminalSurface.panelCardElevated : terminalSurface.panelCard;

  return (
    <div
      data-tutorial={dataTutorial}
      className={`min-w-0 max-w-full rounded-xl border ${paddingClassName} backdrop-blur-sm ${surface} ${CARD_HOVER} ${className}`}
    >
      <div
        className={`flex gap-3 ${titleSlotWide ? "min-w-0 items-center justify-between" : "items-start justify-between"}`}
      >
        <h2
          className={`min-w-0 text-sm font-semibold tracking-wide text-zinc-400 ${
            titleSlotWide ? "shrink-0" : "flex-1"
          } ${titleClassName ?? "uppercase"}`}
        >
          {title}
        </h2>
        {titleRight ? (
          <div
            className={`flex items-center gap-1 ${titleSlotWide ? "min-w-0 flex-1 justify-end" : "shrink-0 pt-0.5"}`}
          >
            {titleRight}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
