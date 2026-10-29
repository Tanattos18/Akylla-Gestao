"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatBrl } from "../../lib/format";
import { adCampaignStatusLabels, type AdCampaignStatus, type AdIndicatorsDto } from "../../lib/types";
import { Badge } from "../ui/Badge";

const statusColors: Record<AdCampaignStatus, "slate" | "amber" | "green" | "sky" | "violet"> = {
  DRAFT: "slate",
  WAITING_APPROVAL: "amber",
  ACTIVE: "green",
  PAUSED: "sky",
  FINISHED: "violet",
};

export function AdStatusBadge({ status }: { status: AdCampaignStatus }) {
  return <Badge color={statusColors[status]}>{adCampaignStatusLabels[status]}</Badge>;
}

/** Abas do módulo: Visão geral, Campanhas e Contas. */
export function AdsNav() {
  const pathname = usePathname();
  const items = [
    { href: "/anuncios", label: "Visão geral" },
    { href: "/anuncios/campanhas", label: "Campanhas" },
    { href: "/anuncios/contas", label: "Contas de anúncio" },
  ];
  return (
    <nav aria-label="Anúncios" className="flex flex-wrap gap-1 border-b border-slate-200">
      {items.map((item) => {
        const active = item.href === "/anuncios" ? pathname === "/anuncios" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active ? "border-primary-600 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function formatCtr(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

/** "AAAA-MM-DD" → "dd/mm/aaaa" sem deslocar o fuso. */
export function formatDay(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

/** Linha de indicadores calculados no servidor ("—" quando não dá para dividir). */
export function IndicatorGrid({ indicators, resultLabel = "resultados" }: { indicators: AdIndicatorsDto; resultLabel?: string }) {
  const items: Array<[string, string]> = [
    ["Investimento (verba do cliente)", formatBrl(indicators.spend)],
    ["Impressões", formatInt(indicators.impressions)],
    ["Alcance", formatInt(indicators.reach)],
    ["Cliques", formatInt(indicators.clicks)],
    ["CTR", formatCtr(indicators.ctr)],
    ["CPC", indicators.cpc === null ? "—" : formatBrl(indicators.cpc)],
    [`Resultados (${resultLabel})`, formatInt(indicators.results)],
    ["Custo por resultado", indicators.costPerResult === null ? "—" : formatBrl(indicators.costPerResult)],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
