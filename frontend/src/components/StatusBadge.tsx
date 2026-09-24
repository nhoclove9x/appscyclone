import clsx from "clsx";
import type { ReactNode } from "react";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "positive" | "negative" | "info";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "positive" && "bg-emerald-50 text-emerald-700",
        tone === "negative" && "bg-rose-50 text-rose-700",
        tone === "info" && "bg-indigo-50 text-indigo-700",
      )}
    >
      {children}
    </span>
  );
}
