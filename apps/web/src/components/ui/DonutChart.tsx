"use client";

const PALETTE = [
  "var(--color-primary-500)",
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f43f5e",
  "#a855f7",
  "#f59e0b",
];

export function DonutChart({
  data,
  size = 160,
  thickness = 22,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  if (total <= 0 || data.length === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Distribuição percentual"
        className="shrink-0"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={thickness}
        />
        {data.map((d, i) => {
          const fraction = d.value / total;
          const dash = fraction * circumference;
          const element = (
            <circle
              key={d.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={d.color ?? PALETTE[i % PALETTE.length]}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
              strokeLinecap="butt"
            >
              <title>{`${d.label}: ${(fraction * 100).toFixed(1)}%`}</title>
            </circle>
          );
          offset += dash;
          return element;
        })}
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          className="fill-slate-900"
          fontSize="14"
          fontWeight="600"
        >
          {total.toLocaleString("pt-BR")}
        </text>
        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize="9"
        >
          total
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => {
          const fraction = (d.value / total) * 100;
          return (
            <li key={d.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: d.color ?? PALETTE[i % PALETTE.length] }}
              />
              <span className="text-slate-600">{d.label}</span>
              <span className="ml-auto font-medium text-slate-900">
                {fraction.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
