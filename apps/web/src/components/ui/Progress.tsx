"use client";

export function Progress({
  value,
  max,
  label,
  valueLabel,
  color = "primary",
}: {
  value: number;
  max: number;
  label: string;
  valueLabel?: string;
  color?: "primary" | "success" | "warning" | "danger";
}) {
  const safeMax = Math.max(max, value, 1);
  const pct = Math.min(100, (value / safeMax) * 100);
  const colors: Record<string, string> = {
    primary: "bg-primary-500",
    success: "bg-teal-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">
          {valueLabel ?? `${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100">
        <div
          className={`h-2.5 rounded-full transition-all ${colors[color] ?? colors.primary}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
