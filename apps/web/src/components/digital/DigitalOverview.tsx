"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Globe, Repeat, TrendingUp, Wallet } from "lucide-react";
import { api } from "../../lib/api";
import { formatBrl, formatDate, formatDateTime } from "../../lib/format";
import type { DigitalOverviewDto } from "../../lib/types";
import { BillingBadge } from "./BillingBadge";

const kindLabel = { CONTRACT: "Contrato", DOMAIN: "Domínio", HOSTING: "Hospedagem" } as const;

/**
 * Início (2026-10-23): números de clientes e produtos digitais — receita
 * recorrente, a receber, atrasados, vencimentos em 30 dias e sites fora do ar.
 */
export function DigitalOverview() {
  const [data, setData] = useState<DigitalOverviewDto | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<DigitalOverviewDto>("/api/digital/overview")
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!data) return <p className="text-sm text-slate-500">Carregando resumo...</p>;

  const cards = [
    {
      label: "Receita mensal recorrente",
      value: formatBrl(data.monthlyRecurringRevenue),
      sub: `${data.activeContracts} contrato(s) ativo(s)`,
      icon: TrendingUp,
      href: "/assinaturas",
      alert: false,
    },
    {
      label: "A receber em 30 dias",
      value: formatBrl(data.receivableNext30.total),
      sub: `${data.receivableNext30.count} título(s)`,
      icon: Wallet,
      href: "/financeiro",
      alert: false,
    },
    {
      label: "Atrasados",
      value: formatBrl(data.overdueReceivables.total),
      sub: `${data.overdueReceivables.count} título(s) vencido(s)`,
      icon: CalendarClock,
      href: "/financeiro",
      alert: data.overdueReceivables.count > 0,
    },
    {
      label: "Sites fora do ar",
      value: String(data.sitesDown.length),
      sub: `${data.monitoredSites} site(s) monitorado(s)`,
      icon: Globe,
      href: "/entregas",
      alert: data.sitesDown.length > 0,
    },
  ];

  return (
    <section aria-labelledby="resumo-digital" className="space-y-4">
      <h3 id="resumo-digital" className="sr-only">Resumo</h3>

      {data.sitesDown.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {data.sitesDown.length === 1 ? "1 site fora do ar" : `${data.sitesDown.length} sites fora do ar`}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-800">
            {data.sitesDown.map((site) => (
              <li key={site.deliveryId}>
                <Link href={`/entregas/${site.deliveryId}`} className="font-medium underline-offset-2 hover:underline">
                  {site.name}
                </Link>{" "}
                · {site.clientName}
                {site.httpStatus ? ` · HTTP ${site.httpStatus}` : ""}
                {site.since ? ` · desde ${formatDateTime(site.since)}` : ""}
                {site.neverPause ? " · produto que nunca pausa" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.debtors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Clientes com pagamento pendente · {data.debtors.filter((d) => d.state === "EM_DEBITO").length} em débito
            </p>
            <Link href="/clientes?situacao=EM_DEBITO" className="text-xs font-medium text-primary-700 hover:underline">
              Ver clientes em débito →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {data.debtors.map((d) => (
              <li key={d.subscriptionId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <Link href={`/assinaturas/${d.subscriptionId}`} className="font-medium text-slate-800 hover:underline">
                    {d.clientName}
                  </Link>{" "}
                  <span className="text-slate-500">· {d.contract}{d.deliveryName ? ` — ${d.deliveryName}` : ""}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {d.amount && <span className="text-slate-700">{formatBrl(d.amount)}</span>}
                  <BillingBadge
                    billing={{
                      state: d.state,
                      daysToDue: d.daysOverdue ? -d.daysOverdue : null,
                      dueDate: d.dueDate,
                      amount: d.amount,
                      graceUntil: d.graceUntil,
                      agreementBroken: d.agreementBroken,
                    }}
                  />
                  {d.deliveryId && !d.neverPause && (
                    <Link href={`/entregas/${d.deliveryId}`} className="text-xs font-medium text-primary-700 hover:underline">
                      decidir →
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <li key={card.label}>
              <Link
                href={card.href}
                className={`flex h-full items-start gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  card.alert ? "border-red-200" : "border-slate-200"
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.alert ? "bg-red-50 text-red-700" : "bg-primary-50 text-primary-700"}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</span>
                  <span className={`block text-xl font-semibold ${card.alert ? "text-red-700" : "text-slate-900"}`}>{card.value}</span>
                  <span className="block text-xs text-slate-500">{card.sub}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Repeat className="h-4 w-4 text-slate-500" aria-hidden="true" />
          Vencimentos nos próximos 30 dias
        </p>
        {data.upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum contrato, domínio ou hospedagem vence nos próximos 30 dias.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.upcoming.map((item, index) => (
              <li key={`${item.kind}-${item.href}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={item.href} className="text-slate-800 hover:underline">
                  <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{kindLabel[item.kind]}</span>
                  {item.title}
                </Link>
                <span className="text-slate-500">
                  {item.clientName} · {formatDate(item.kind === "CONTRACT" ? item.date : `${item.date.slice(0, 10)}T12:00:00`)}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                      item.daysLeft <= 1 ? "bg-red-50 text-red-700" : item.daysLeft <= 7 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.daysLeft === 0 ? "hoje" : item.daysLeft === 1 ? "amanhã" : `${item.daysLeft} dias`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
