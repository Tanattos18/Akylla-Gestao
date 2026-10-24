"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import { formatBrl, formatDate } from "../../lib/format";
import type { DigitalReportsDto } from "../../lib/types";
import { DataTable } from "../ui/DataTable";

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

/**
 * Relatórios de clientes e contratos (2026-10-24): receita recorrente por mês,
 * receita por produto do catálogo, inadimplência e clientes por status.
 */
export function DigitalReports() {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<DigitalReportsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    api<DigitalReportsDto>(`/api/digital/reports?months=${months}`)
      .then((value) => {
        setData(value);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar os relatórios."));
  }, [months]);

  if (error) return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Carregando...</p>;

  const maxMrr = Math.max(1, ...data.months.map((m) => Number(m.monthlyRecurringRevenue)));
  const status = data.clientsByStatus;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Receita recorrente = contratos ativos no fim de cada mês (preço × 30 ÷ duração). Recebido = títulos de
          contrato pagos e renovações pelo caixa.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700 print:hidden">
          Meses
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            {[3, 6, 12, 24].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Receita mensal recorrente</h3>
        <ul className="space-y-1.5" aria-label="Receita recorrente por mês">
          {data.months.map((m) => (
            <li key={m.month} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="text-slate-500">{monthLabel(m.month)}</span>
              <span className="h-3 overflow-hidden rounded bg-slate-100" aria-hidden="true">
                <span className="block h-full rounded bg-primary-500" style={{ width: `${(Number(m.monthlyRecurringRevenue) / maxMrr) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-slate-800">
                {formatBrl(m.monthlyRecurringRevenue)}
                <span className="ml-2 text-xs text-slate-500">recebido {formatBrl(m.received)} · {m.activeContracts} contrato(s)</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Receita por produto do catálogo</h3>
        <DataTable
          bare
          rows={data.revenueByProduct}
          rowKey={(row) => row.product}
          empty={<>Sem contratos ainda.</>}
          columns={[
            { key: "p", header: "Produto", cell: (row) => row.product },
            { key: "r", header: "Recebido no período", cell: (row) => formatBrl(row.received), numeric: true },
            { key: "m", header: "Receita recorrente atual", cell: (row) => formatBrl(row.monthlyRecurringRevenue), numeric: true },
            { key: "c", header: "Contratos ativos", cell: (row) => row.contracts, numeric: true },
          ]}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Inadimplência</h3>
          <p className="mt-2 text-2xl font-semibold text-red-700">{formatBrl(data.delinquency.overdueTotal)}</p>
          <p className="text-sm text-slate-500">
            {data.delinquency.overdueCount} título(s) vencido(s) · {(data.delinquency.rate * 100).toFixed(1).replace(".", ",")}% do que venceu
            nos últimos 90 dias
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Clientes por status</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {[
              ["Ativos", status.active],
              ["Inativos", status.inactive],
              ["Com contrato ativo", status.withActiveContract],
              ["Com atraso", status.withOverdue],
              ["Ativos sem contrato", status.withoutContract],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-lg font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Maiores atrasos</h3>
        <DataTable
          bare
          rows={data.delinquency.topClients}
          rowKey={(row) => row.clientId}
          empty={<>Nenhum cliente em atraso.</>}
          columns={[
            { key: "n", header: "Cliente", cell: (row) => <Link href={`/clientes/${row.clientId}`} className="hover:underline">{row.name}</Link> },
            { key: "t", header: "Em atraso", cell: (row) => formatBrl(row.total), numeric: true },
            { key: "q", header: "Títulos", cell: (row) => row.count, numeric: true },
            { key: "d", header: "Mais antigo", cell: (row) => formatDate(row.oldestDueDate) },
          ]}
        />
      </section>
    </div>
  );
}
