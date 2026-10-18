import type { ReactNode } from "react";
import { Card } from "./Card";

type IconBg = "violet" | "amber" | "red" | "teal" | "sky" | "slate";

const iconBackgrounds: Record<IconBg, string> = {
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  teal: "bg-primary-50 text-primary-600",
  sky: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-700",
};

export function StatCard({
  label,
  value,
  subtext,
  icon,
  iconBg = "slate",
}: {
  label: string;
  value: string;
  subtext?: string;
  icon?: ReactNode;
  iconBg?: IconBg;
}) {
  return (
    <Card className="relative overflow-hidden p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        {icon && (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBackgrounds[iconBg]}`}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
    </Card>
  );
}
