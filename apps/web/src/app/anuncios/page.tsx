"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Coins, Megaphone, MessageCircle, Wallet } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { formatBrl } from "../../lib/format";
import type { AdOverviewDto } from "../../lib/types";
import { StatCard } from "../../components/ui/StatCard";
import { DataTable } from "../../components/ui/DataTable";
import { AdsNav, formatCtr, formatDay, formatInt } from "../../components/ads/AdsShared";

function todayBr(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Anúncios › Visão geral (fase A1). A verba é do cliente; o Akylla só registra. */
export default function AnunciosPage() {
  const [to, setTo] = useState(todayBr);
  const [from, setFrom] = useState(() => `${todayBr().slice(0, 7)}-01`);
  const [data, setData] = useState<AdOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<AdOverviewDto>(`/api/ads/overview?from=${from}&to=${to}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar a visão geral.");
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Anúncios</h2>
          <p className="text-sm text-slate-500">
            Campanhas dos clientes, investimento e resultados. A verba é paga pelo cliente direto à plataforma.
          </p>
        </div>
        <Link href="/anuncios/campanhas/nova" className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">
          Nova campanha
        </Link>
      </div>
      <AdsNav />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="ads-from" className="mb-1 block text-xs text-slate-500">De</label>
          <input id="ads-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="ads-to" className="mb-1 block text-xs text-slate-500">Até</label>
          <input id="ads-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {!data ? (
        !error && <p className="py-8 text-center text-sm text-slate-500">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Campanhas ativas" value={String(data.activeCampaigns)} icon={<Megaphone className="h-5 w-5" />} iconBg="teal" />
            <StatCard label="Investimento dos clientes" value={formatBrl(data.indicators.spend)} subtext="no período" icon={<Wallet className="h-5 w-5" />} iconBg="sky" />
            <StatCard label="Resultados" value={formatInt(data.indicators.results)} subtext="conversas, cadastros, vendas" icon={<MessageCircle className="h-5 w-5" />} iconBg="violet" />
            <StatCard
              label="Custo médio por resultado"
              value={data.indicators.costPerResult === null ? "—" : formatBrl(data.indicators.costPerResult)}
              subtext={`CTR ${formatCtr(data.indicators.ctr)}`}
              icon={<BarChart3 className="h-5 w-5" />}
              iconBg="amber"
            />
            <StatCard
              label="Receita de gestão por mês"
              value={formatBrl(data.managementMonthly)}
              subtext={`${data.managementContracts} contrato(s) de gestão ativo(s)`}
              icon={<Coins className="h-5 w-5" />}
              iconBg="teal"
            />
          </div>

          {data.stale.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">Campanhas ativas sem métrica há 3 dias ou mais</p>
              <ul className="mt-2 space-y-1">
                {data.stale.map((item) => (
                  <li key={item.id}>
                    <Link href={`/anuncios/campanhas/${item.id}`} className="font-medium underline">{item.name}</Link>
                    {` · ${item.clientName} · `}
                    {item.lastMetricDate ? `último lançamento em ${formatDay(item.lastMetricDate)}` : "nenhum lançamento ainda"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DataTable
            title="Por cliente"
            rows={data.byClient}
            rowKey={(row) => row.client.id}
            empty={<>Nenhuma campanha no período.</>}
            columns={[
              {
                key: "client",
                header: "Cliente",
                cell: (row) => <Link href={`/clientes/${row.client.id}`} className="font-medium text-slate-800 hover:underline">{row.client.name}</Link>,
              },
              { key: "active", header: "Ativas", numeric: true, cell: (row) => <>{row.activeCampaigns}</> },
              { key: "spend", header: "Investimento", numeric: true, cell: (row) => <>{formatBrl(row.indicators.spend)}</> },
              { key: "clicks", header: "Cliques", numeric: true, hideOnMobile: true, cell: (row) => <>{formatInt(row.indicators.clicks)}</> },
              { key: "results", header: "Resultados", numeric: true, cell: (row) => <>{formatInt(row.indicators.results)}</> },
              {
                key: "cpr",
                header: "Custo por resultado",
                numeric: true,
                cell: (row) => <>{row.indicators.costPerResult === null ? "—" : formatBrl(row.indicators.costPerResult)}</>,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
