"use client";

import { useId } from "react";

export function ComboChart({
  data,
  barLabel = "Vendas",
  lineLabel = "Ticket médio",
  formatBar,
  formatLine,
}: {
  data: Array<{ label: string; bar: number; line: number | null }>;
  barLabel?: string;
  lineLabel?: string;
  formatBar: (value: number) => string;
  formatLine: (value: number) => string;
}) {
  const gradientId = useId();
  if (data.length === 0) return null;

  const width = 640;
  const height = 200;
  const padding = { top: 16, right: 48, bottom: 28, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxBar = Math.max(1, ...data.map((d) => d.bar));
  const lineValues = data.map((d) => d.line).filter((v): v is number => v != null && v > 0);
  const maxLine = Math.max(1, ...lineValues);
  const minLine = lineValues.length > 0 ? Math.min(...lineValues) : 0;

  const slot = chartWidth / data.length;
  const barWidth = Math.min(28, slot * 0.55);

  const linePoints = data
    .map((d, i) => {
      if (d.line == null || d.line <= 0) return null;
      const x = padding.left + slot * i + slot / 2;
      const normalized =
        maxLine === minLine ? 0.5 : (d.line - minLine) / (maxLine - minLine);
      const y = padding.top + chartHeight - normalized * chartHeight;
      return `${x},${y}`;
    })
    .filter((p): p is string => p != null);

  const ticks = [0, 0.5, 1];

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary-500" />
          {barLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-amber-500" />
          {lineLabel}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${barLabel} e ${lineLabel} ao longo do período`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-400)" />
            <stop offset="100%" stopColor="var(--color-primary-500)" />
          </linearGradient>
        </defs>
        {ticks.map((t) => {
          const y = padding.top + chartHeight - t * chartHeight;
          return (
            <g key={t}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400"
                fontSize="10"
              >
                {formatBar(t * maxBar)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const barHeight = (d.bar / maxBar) * chartHeight;
          const x = padding.left + slot * i + (slot - barWidth) / 2;
          return (
            <rect
              key={d.label}
              x={x}
              y={padding.top + chartHeight - barHeight}
              width={barWidth}
              height={Math.max(2, barHeight)}
              rx="3"
              fill={`url(#${gradientId})`}
            >
              <title>{`${d.label}: ${formatBar(d.bar)}`}</title>
            </rect>
          );
        })}
        {linePoints.length > 1 && (
          <polyline
            points={linePoints.join(" ")}
            fill="none"
            stroke="var(--color-warning-500, #f59e0b)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {data.map((d, i) => {
          if (d.line == null || d.line <= 0) return null;
          const x = padding.left + slot * i + slot / 2;
          const normalized =
            maxLine === minLine ? 0.5 : (d.line - minLine) / (maxLine - minLine);
          const y = padding.top + chartHeight - normalized * chartHeight;
          return (
            <circle
              key={`dot-${d.label}`}
              cx={x}
              cy={y}
              r="3"
              fill="#f59e0b"
              stroke="#fff"
              strokeWidth="1.5"
            >
              <title>{`${lineLabel} ${d.label}: ${formatLine(d.line)}`}</title>
            </circle>
          );
        })}
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 7) !== 0) return null;
          const x = padding.left + slot * i + slot / 2;
          return (
            <text
              key={`axis-${d.label}`}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-400"
              fontSize="9"
            >
              {d.label.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
