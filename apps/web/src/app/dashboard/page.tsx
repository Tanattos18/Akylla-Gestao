"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Activity,
  Package,
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarClock,
  MessageCircle,
  ShoppingCart,
  Receipt,
  FileText,
  Zap,
  Users,
} from "lucide-react";
import { api } from "../../lib/api";
import {
  formatBrl,
  formatBrlCompact,
  formatDateTime,
  formatLocalTime,
  todayLocal,
  shiftDay,
} from "../../lib/format";
import { fetchSession, type Session } from "../../lib/session";
import {
  appointmentStatusLabels,
  paymentMethodLabels,
  type AppointmentDto,
  type DashboardSummaryDto,
  type FinancialSummaryDto,
  type Paginated,
  type SaleDto,
} from "../../lib/types";
import {
  Card,
  CardHeader,
  CardBody,
  StatCard,
  Button,
  Input,
  Skeleton,
  StatCardSkeleton,
  EmptyState,
  Badge,
  ComboChart,
  DonutChart,
  Progress,
} from "@/components/ui";

interface MiniStat {
  label: string;
  value: string;
  accent?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [financial, setFinancial] = useState<FinancialSummaryDto | null>(null);
  const [recentSales, setRecentSales] = useState<SaleDto[]>([]);
  const [upcoming, setUpcoming] = useState<AppointmentDto[]>([]);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
    });
  }, [router]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const query = params.toString();
      const today = todayLocal();
      const horizon = shiftDay(today, 14);

      const [sumData, finData, salesData, apptData] = await Promise.all([
        api<DashboardSummaryDto>(`/api/reports/summary${query ? `?${query}` : ""}`),
        api<FinancialSummaryDto>("/api/financial/summary").catch(() => null),
        api<Paginated<SaleDto>>("/api/sales?pageSize=6").catch(() => ({
          items: [] as SaleDto[],
          total: 0,
          page: 1,
          pageSize: 6,
        })),
        api<Paginated<AppointmentDto>>(
          `/api/appointments?from=${today}&to=${horizon}&pageSize=20`,
        ).catch(() => ({ items: [] as AppointmentDto[], total: 0, page: 1, pageSize: 20 })),
      ]);

      setSummary(sumData);
      setFinancial(finData);
      setRecentSales(salesData.items);
      setUpcoming(
        apptData.items
          .filter((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED")
          .sort((a, b) => a.startAt.localeCompare(b.startAt))
          .slice(0, 5),
      );
      setLoadedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível carregar o dashboard.",
      );
    } finally {
      setLoadingData(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (session) {
      void loadData();
    }
  }, [session]);

  function handlePeriod(event: FormEvent) {
    event.preventDefault();
    void loadData();
  }

  if (loading || !session) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const userName = session.user.name.split(" ")[0];
  const periodLabel = summary ? `${summary.period.from} — ${summary.period.to}` : "";

  const comboData =
    summary?.salesByDay.map((day) => ({
      label: day.day,
      bar: Number(day.net),
      line: day.count > 0 ? Number(day.net) / day.count : null,
    })) ?? [];

  const donutData =
    summary?.salesByPaymentMethod.map((item) => ({
      label: item.label,
      value: Number(item.net),
    })) ?? [];

  const entries = summary ? Number(summary.cash.entriesInCash) : 0;
  const exits = summary ? Number(summary.cash.exitsInCash) : 0;
  const cashFlowMax = Math.max(entries + exits, 1);
  const cashBalance = entries - exits;

  const paidIn = financial ? Number(financial.paidInTotal) : 0;
  const paidOut = financial ? Number(financial.paidOutTotal) : 0;
  const overdueReceivables = financial?.overdueReceivablesTotal ?? "0";
  const overduePayables = financial?.overduePayablesTotal ?? "0";
  const overdueCount =
    (financial?.overdueReceivablesCount ?? 0) + (financial?.overduePayablesCount ?? 0);
  const hasOverdue = overdueCount > 0;
  const hasStockAlert =
    summary != null && summary.stock.lowStockCount + summary.stock.outOfStockCount > 0;

  const miniStats: MiniStat[] = summary
    ? [
        { label: "Pedidos", value: String(summary.sales.completedCount) },
        {
          label: "Canceladas",
          value: String(summary.sales.cancelledCount),
        },
        {
          label: "Ticket médio",
          value: summary.sales.ticketAverage ? formatBrl(summary.sales.ticketAverage) : "—",
        },
        {
          label: "Clientes novos",
          value: String(summary.clients.newClients),
        },
        {
          label: "Vencidas",
          value: formatBrl(Number(overdueReceivables) + Number(overduePayables)),
          accent: hasOverdue,
        },
        {
          label: "Resultado",
          value: formatBrl(paidIn - paidOut),
          accent: paidIn - paidOut < 0,
        },
      ]
    : [];

  const shortcuts = [
    { label: "Abrir PDV", href: "/pdv", icon: ShoppingCart, primary: true },
    { label: "Novo produto", href: "/produtos/novo", icon: Package },
    { label: "Novo agendamento", href: "/agenda/novo", icon: Calendar },
    { label: "Clientes", href: "/clientes", icon: Users },
    { label: "Abrir caixa", href: "/caixa", icon: Wallet },
    { label: "Relatórios", href: "/relatorios", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Saudação + período */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
            Seu negócio em um olhar
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Olá {userName}, vamos cuidar do que importa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {periodLabel && (
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm">
              {periodLabel}
            </span>
          )}
          <Link href="/relatorios">
            <Button variant="secondary" size="sm">
              <BarChart3 className="h-4 w-4" />
              Relatórios
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtro de período */}
      <Card>
        <CardBody>
          <form onSubmit={handlePeriod} className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Input
                id="dash-from"
                type="date"
                label="De"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Input
                id="dash-to"
                type="date"
                label="Até"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loadingData} size="md">
              {loadingData ? "Atualizando..." : "Atualizar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Padrão 30 dias
            </Button>
            {loadedAt && (
              <span className="ml-auto text-xs text-slate-500">
                Atualizado {formatDateTime(loadedAt)}
              </span>
            )}
          </form>
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPIs */}
      {loadingData && !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Vendas"
              value={formatBrl(summary.sales.net)}
              subtext={`${summary.sales.completedCount} concluída(s)`}
              icon={<TrendingUp className="h-5 w-5" />}
              iconBg="violet"
            />
            <StatCard
              label="Recebido"
              value={financial ? formatBrl(financial.paidInTotal) : "—"}
              subtext="entradas quitadas no período"
              icon={<ArrowDownLeft className="h-5 w-5" />}
              iconBg="teal"
            />
            <StatCard
              label="Pago"
              value={financial ? formatBrl(financial.paidOutTotal) : "—"}
              subtext="despesas quitadas no período"
              icon={<ArrowUpRight className="h-5 w-5" />}
              iconBg="red"
            />
            <StatCard
              label="A receber"
              value={financial ? formatBrl(financial.openReceivablesTotal) : "—"}
              subtext={
                financial && financial.overdueReceivablesCount > 0
                  ? `${financial.overdueReceivablesCount} vencida(s)`
                  : `${financial?.openReceivablesCount ?? 0} título(s) em aberto`
              }
              icon={<Receipt className="h-5 w-5" />}
              iconBg={financial && financial.overdueReceivablesCount > 0 ? "red" : "amber"}
            />
            <StatCard
              label="A pagar"
              value={financial ? formatBrl(financial.openPayablesTotal) : "—"}
              subtext={
                financial && financial.overduePayablesCount > 0
                  ? `${financial.overduePayablesCount} vencida(s)`
                  : `${financial?.openPayablesCount ?? 0} título(s) em aberto`
              }
              icon={<ArrowUpRight className="h-5 w-5" />}
              iconBg={financial && financial.overduePayablesCount > 0 ? "red" : "sky"}
            />
            <StatCard
              label="Saldo do caixa"
              value={formatBrl(cashBalance)}
              subtext={
                summary.cash.openSession
                  ? `Caixa aberto · esperado ${formatBrl(summary.cash.openSession.expectedBalance)}`
                  : "Caixa fechado"
              }
              icon={<Wallet className="h-5 w-5" />}
              iconBg={cashBalance >= 0 ? "teal" : "red"}
            />
          </div>

          {/* Faixa compacta de indicadores */}
          {miniStats.length > 0 && (
            <Card>
              <CardBody>
                <dl className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  {miniStats.map((stat) => (
                    <div key={stat.label} className="min-w-[100px]">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        {stat.label}
                      </dt>
                      <dd
                        className={`mt-0.5 text-sm font-semibold ${
                          stat.accent ? "text-red-700" : "text-slate-900"
                        }`}
                      >
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          )}

          {/* Alertas */}
          {(hasStockAlert || hasOverdue) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {hasStockAlert && summary && (
                <Card className="border-amber-200 bg-amber-50/60">
                  <CardBody>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-900">
                          Atenção ao estoque
                        </p>
                        <p className="mt-0.5 text-sm text-amber-800">
                          {summary.stock.outOfStockCount} sem saldo ·{" "}
                          {summary.stock.lowStockCount} abaixo do mínimo
                        </p>
                        <Link
                          href="/produtos"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
                        >
                          Conferir produtos →
                        </Link>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}
              {hasOverdue && financial && (
                <Card className="border-red-200 bg-red-50/60">
                  <CardBody>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                        <CalendarClock className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-red-900">
                          Contas vencidas
                        </p>
                        <p className="mt-0.5 text-sm text-red-800">
                          {formatBrl(financial.overdueReceivablesTotal)} a receber ·{" "}
                          {formatBrl(financial.overduePayablesTotal)} a pagar
                        </p>
                        <Link
                          href="/financeiro"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-900 underline-offset-2 hover:underline"
                        >
                          Abrir financeiro →
                        </Link>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {/* Gráficos */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                subtitle="Vendas (barras) e ticket médio por dia (linha)"
                title="Vendas e ticket médio"
              />
              <CardBody>
                {comboData.length === 0 ? (
                  <EmptyState
                    icon={<Activity className="h-6 w-6" />}
                    title="Ainda não há atividade"
                    description="Quando houver vendas concluídas, elas aparecerão aqui."
                  />
                ) : (
                  <ComboChart
                    data={comboData}
                    barLabel="Vendas"
                    lineLabel="Ticket médio"
                    formatBar={formatBrlCompact}
                    formatLine={formatBrlCompact}
                  />
                )}
              </CardBody>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                <span>Valores baseados nos registros da sua empresa</span>
                {periodLabel && <span>{periodLabel}</span>}
              </div>
            </Card>

            <Card>
              <CardHeader
                subtitle="Participação no faturamento"
                title="Vendas por pagamento"
              />
              <CardBody>
                {donutData.length === 0 ? (
                  <EmptyState
                    icon={<BarChart3 className="h-6 w-6" />}
                    title="Sem vendas no período"
                    description="A distribuição por forma de pagamento aparecerá aqui."
                  />
                ) : (
                  <DonutChart data={donutData} size={150} thickness={20} />
                )}
              </CardBody>
            </Card>
          </div>

          {/* Atividades · Agenda · Atalhos */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Atividades recentes */}
            <Card>
              <CardHeader
                title="Atividades recentes"
                action={
                  <Link
                    href="/vendas"
                    className="text-xs font-medium text-primary-700 hover:text-primary-800"
                  >
                    Ver todas →
                  </Link>
                }
              />
              <CardBody>
                {recentSales.length === 0 ? (
                  <EmptyState
                    icon={<Zap className="h-6 w-6" />}
                    title="Sem atividade recente"
                    description="As últimas vendas registradas aparecerão aqui."
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {recentSales.map((sale) => (
                      <li key={sale.id}>
                        <Link
                          href={`/vendas/${sale.id}`}
                          className="flex items-center gap-3 py-2.5 hover:bg-slate-50"
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              sale.status === "CANCELLED"
                                ? "bg-red-50 text-red-700"
                                : "bg-primary-50 text-primary-700"
                            }`}
                          >
                            <Receipt className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {sale.receiptCode}
                              {sale.client ? ` · ${sale.client.name}` : ""}
                            </p>
                            <p className="text-xs text-slate-500">
                              {paymentMethodLabels[sale.paymentMethod]} ·{" "}
                              {formatDateTime(sale.createdAt)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-sm font-semibold ${
                              sale.status === "CANCELLED"
                                ? "text-red-700 line-through"
                                : "text-slate-900"
                            }`}
                          >
                            {formatBrl(sale.total)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {/* Próximos agendamentos */}
            <Card>
              <CardHeader
                title="Próximos agendamentos"
                action={
                  <Link
                    href="/agenda"
                    className="text-xs font-medium text-primary-700 hover:text-primary-800"
                  >
                    Ver agenda →
                  </Link>
                }
              />
              <CardBody>
                {upcoming.length === 0 ? (
                  <EmptyState
                    icon={<Calendar className="h-6 w-6" />}
                    title="Nenhum agendamento próximo"
                    description="Agendamentos confirmados nos próximos dias aparecerão aqui."
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {upcoming.map((appt) => (
                      <li key={appt.id}>
                        <Link
                          href={`/agenda/${appt.id}`}
                          className="flex items-center gap-3 py-2.5 hover:bg-slate-50"
                        >
                          <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                            <span className="text-[9px] font-semibold uppercase leading-none">
                              {new Date(appt.startAt + "Z").toLocaleDateString("pt-BR", {
                                month: "short",
                              })}
                            </span>
                            <span className="text-xs font-bold leading-none">
                              {new Date(appt.startAt + "Z").getDate()}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {appt.client.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {appt.service.name} ·{" "}
                              {formatLocalTime(appt.startLocal)}
                            </p>
                          </div>
                          <Badge
                            color={
                              appt.status === "CONFIRMED" ? "teal" : "sky"
                            }
                          >
                            {appointmentStatusLabels[appt.status]}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {/* Atalhos */}
            <Card>
              <CardHeader
                subtitle="Ações mais usadas no dia a dia"
                title="Atalhos"
              />
              <CardBody>
                <div className="grid grid-cols-2 gap-2">
                  {shortcuts.map((sc) => {
                    const Icon = sc.icon;
                    return (
                      <Link
                        key={sc.href}
                        href={sc.href}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-colors ${
                          sc.primary
                            ? "border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100"
                            : "border-slate-200 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50/50"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${sc.primary ? "text-primary-700" : "text-slate-500"}`}
                        />
                        <span className="text-xs font-medium">{sc.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Saúde do caixa + WhatsApp */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                subtitle="Entradas vs saídas no período"
                title="Saúde do caixa"
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  <div className="rounded-lg bg-teal-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-teal-700">
                      Em dinheiro
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-teal-700">
                      {formatBrl(entries)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-red-700">
                      Saídas
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-red-700">
                      {formatBrl(exits)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-sky-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-sky-700">
                      Recebido
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-sky-700">
                      {financial ? formatBrl(financial.paidInTotal) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-amber-700">
                      Pago
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-amber-700">
                      {financial ? formatBrl(financial.paidOutTotal) : "—"}
                    </p>
                  </div>
                </div>
                <Progress
                  label="Fluxo positivo (dinheiro em caixa)"
                  value={entries}
                  max={cashFlowMax}
                  valueLabel={`${Math.round((entries / cashFlowMax) * 100)}% entradas`}
                  color={entries >= exits ? "success" : "danger"}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                  <span className="text-slate-500">Saldo do período (caixa)</span>
                  <span className="font-semibold text-slate-900">
                    {formatBrl(cashBalance)}
                  </span>
                  {summary.cash.openSession && (
                    <span className="text-xs text-slate-500">
                      Caixa aberto · esperado{" "}
                      {formatBrl(summary.cash.openSession.expectedBalance)}
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      WhatsApp
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {summary.whatsapp.pending} pendente(s)
                    </p>
                    <p className="text-xs text-slate-500">
                      {summary.whatsapp.sent} enviada(s) · {summary.whatsapp.delivered} entregue(s) ·{" "}
                      {summary.whatsapp.failed} falha(s)
                    </p>
                    <Link
                      href="/whatsapp"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-700"
                    >
                      Ver mensagens →
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
