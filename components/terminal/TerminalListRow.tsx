"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { terminalListRow } from "@/lib/terminalListRow";

type TerminalListRowProps = {
  children: ReactNode;
  className?: string;
} & (
  | ({
      as?: "button";
    } & ButtonHTMLAttributes<HTMLButtonElement>)
  | ({
      as: "motionless";
    } & HTMLAttributes<HTMLDivElement>)
);

/** Unified home-dashboard list row — interactive button or static divided row. */
export function TerminalListRow({
  children,
  className = "",
  as = "button",
  ...rest
}: TerminalListRowProps) {
  const base =
    as === "button" ? terminalListRow.interactive : terminalListRow.static;
  const merged = `${base} ${className}`.trim();

  if (as === "motionless") {
    const divRest = rest as HTMLAttributes<HTMLDivElement>;
    return (
      <div className={merged} {...divRest}>
        {children}
      </div>
    );
  }

  const btnRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={merged} {...btnRest}>
      {children}
    </button>
  );
}
