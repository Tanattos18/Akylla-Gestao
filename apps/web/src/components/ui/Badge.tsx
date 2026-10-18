import type { ReactNode } from "react";

type Color = "teal" | "amber" | "red" | "sky" | "slate" | "violet" | "green";

const colors: Record<Color, string> = {
  teal: "bg-primary-50 text-primary-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  sky: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-700",
  violet: "bg-violet-50 text-violet-700",
  green: "bg-green-50 text-green-700",
};

export function Badge({
  color = "slate",
  children,
  className = "",
}: {
  color?: Color;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]} ${className}`}
    >
      {children}
    </span>
  );
}
