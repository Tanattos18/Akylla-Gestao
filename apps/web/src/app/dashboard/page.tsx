"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  Receipt,
  Users,
  Activity,
  Package,
  AlertTriangle,
  BarChart3,
  Calendar,
  MessageCircle,
} from "lucide-react";
import { api } from "../../lib/api";
import { formatBrl, formatBrlCompact, formatDateTime } from "../../lib/format";
import { fetchSession, type Session } from "../../lib/session";
import type { DashboardSummaryDto, FinancialSummaryDto } from "../../lib/types";
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

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [financial, setFinancial] = useState<FinancialSummaryDto | null>(null);
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
      const [sumData, finData] = await Promise.all([
        api<DashboardSummaryDto>(`/api/reports/summary${query ? `?${query}` : ""}`),
        api<FinancialSummaryDto>("/api/financial/summary").catch(() => null),
      ]);
      setSummary(sumData);
      setFinancial(finData);
      setLoadedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o dashboard.");
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

  const ticketAverage = summary?.sales.ticketAverage ? Number(summary.sales.ticketAverage) : null;
  const maxDayTicket = comboData.length > 0
    ? Math.max(...comboData.map((d) => d.line ?? 0))
    : null;

  return (
    <div className="space-y-6">
      {/* Saudação + período */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
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
              <span className="ml-auto text-xs text-slate-400">
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

      {/* KPIs — 6 cards inspirados no dashboard de referência */}
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
              label="Pedidos"
              value={String(summary.sales.completedCount)}
              subtext={`${summary.sales.cancelledCount} cancelado(s)`}
              icon={<ShoppingCart className="h-5 w-5" />}
              iconBg="sky"
            />
            <StatCard
              label="Ticket médio"
              value={ticketAverage != null ? formatBrl(ticketAverage) : "—"}
              subtext={
                maxDayTicket != null
                  ? `Melhor dia: ${formatBrl(maxDayTicket)}`
                  : "Valor médio por venda"
              }
              icon={<Receipt className="h-5 w-5" />}
              iconBg="amber"
            />
            <StatCard
              label="Clientes novos"
              value={String(summary.clients.newClients)}
              subtext="no período"
              icon={<Users className="h-5 w-5" />}
              iconBg="teal"
            />
            <StatCard
              label="A receber"
              value={financial ? formatBrl(financial.openReceivablesTotal) : "—"}
              subtext={
                financial
                  ? `${financial.openReceivablesCount} título(s)`
                  : "indisponível"
              }
              icon={<ArrowDownLeft className="h-5 w-5" />}
              iconBg="amber"
            />
            <StatCard
              label="A pagar"
              value={financial ? formatBrl(financial.openPayablesTotal) : "—"}
              subtext={
                financial
                  ? `${financial.openPayablesCount} título(s)`
                  : "indisponível"
              }
              icon={<ArrowUpRight className="h-5 w-5" />}
              iconBg="red"
            />
          </div>

          {/* Combo chart + Donut */}
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
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
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

          {/* Saúde do caixa + widgets */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader
                subtitle="Entradas vs saídas no período"
                title="Saúde do caixa"
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-teal-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-teal-600">
                      Entradas
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-teal-700">
                      {formatBrl(entries)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-red-500">
                      Saídas
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-red-600">
                      {formatBrl(exits)}
                    </p>
                  </div>
                </div>
                <Progress
                  label="Fluxo positivo"
                  value={entries}
                  max={cashFlowMax}
                  valueLabel={`${Math.round((entries / cashFlowMax) * 100)}% entradas`}
                  color={entries >= exits ? "success" : "danger"}
                />
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Saldo do período
                  </p>
                  <p className="mt-0.5 text-xl font-semibold text-slate-900">
                    {formatBrl(entries - exits)}
                  </p>
                  {summary.cash.openSession && (
                    <p className="mt-1 text-xs text-slate-500">
                      Caixa aberto — saldo esperado{" "}
                      {formatBrl(summary.cash.openSession.expectedBalance)}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        Catálogo
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {summary.stock.outOfStockCount + summary.stock.lowStockCount === 0
                          ? "Tudo certo"
                          : `${summary.stock.outOfStockCount + summary.stock.lowStockCount} produto(s)`}
                      </p>
                      <Link
                        href="/produtos"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        Ver produtos →
                      </Link>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className={summary.stock.lowStockCount > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        Estoque atenção
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {summary.stock.lowStockCount} produto(s)
                      </p>
                      <p className="text-xs text-slate-500">abaixo do mínimo</p>
                      <Link
                        href="/produtos"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
                      >
                        Conferir estoque →
                      </Link>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        Agendamentos
                      </p>
                      {summary.modules.servicesRealized.available && summary.services ? (
                        <p className="text-lg font-semibold text-slate-900">
                          {summary.services.completed} concluído(s)
                        </p>
                      ) : (
                        <Badge color="amber">Módulo indisponível</Badge>
                      )}
                      <Link
                        href="/agenda"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                      >
                        Ver agenda →
                      </Link>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        WhatsApp
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {summary.whatsapp.pending} pendente(s)
                      </p>
                      <p className="text-xs text-slate-500">
                        {summary.whatsapp.sent} enviada(s) · {summary.whatsapp.failed} falha(s)
                      </p>
                      <Link
                        href="/whatsapp"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Ver mensagens →
                      </Link>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
