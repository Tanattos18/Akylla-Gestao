"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, downloadCsv } from "../../lib/api";
import { formatBrl, formatDateTime } from "../../lib/format";
import { fetchSession, type Session } from "../../lib/session";
import {
  cashMovementOriginLabels,
  cashMovementTypeLabels,
  paymentMethodLabels,
  saleStatusLabels,
  whatsappMessageStatusLabels,
  type CashMovementDto,
  type CashReportDto,
  type ClientsReportDto,
  type Paginated,
  type PaymentMethod,
  type SaleStatus,
  type SalesReportDto,
  type StockAlertsReportDto,
  type StockMovementsReportDto,
  type WhatsAppReportDto,
} from "../../lib/types";
import { DataTable } from "../../components/ui/DataTable";
import { Tabs } from "../../components/ui/Tabs";

type Tab = "vendas" | "estoque" | "caixa" | "clientes" | "whatsapp";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "vendas", label: "Vendas" },
  { id: "estoque", label: "Estoque" },
  { id: "caixa", label: "Caixa e financeiro" },
  { id: "clientes", label: "Clientes" },
  { id: "whatsapp", label: "WhatsApp" },
];

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";
const secondaryButton =
  "rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50";

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        Página {page} de {pages} ({total} registro(s))
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={secondaryButton}
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className={secondaryButton}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

interface PeriodProps {
  from: string;
  to: string;
  reloadKey: number;
}

function buildPeriodParams(from: string, to: string): URLSearchParams {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return params;
}

function VendasTab({ from, to, reloadKey }: PeriodProps) {
  const [status, setStatus] = useState<"" | SaleStatus>("");
  const [paymentMethod, setPaymentMethod] = useState<"" | PaymentMethod>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SalesReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildPeriodParams(from, to);
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (status) params.set("status", status);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      const result = await api<SalesReportDto>(`/api/reports/sales?${params.toString()}`);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o relatório de vendas.");
    } finally {
      setLoading(false);
    }
  }, [from, to, page, status, paymentMethod, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [reloadKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCsv() {
    setExporting(true);
    try {
      const params = buildPeriodParams(from, to);
      if (status) params.set("status", status);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      params.set("format", "csv");
      await downloadCsv(`/api/reports/sales?${params.toString()}`, "akylla_vendas.csv");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar CSV.");
    } finally {
      setExporting(false);
    }
  }

  const periodLabel = data ? `${data.period.from} a ${data.period.to} (UTC)` : "—";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="sales-status" className="mb-1 block text-sm text-slate-700">
            Status
          </label>
          <select
            id="sales-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "" | SaleStatus);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Todos</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
        <div>
          <label htmlFor="sales-payment" className="mb-1 block text-sm text-slate-700">
            Forma de pagamento
          </label>
          <select
            id="sales-payment"
            value={paymentMethod}
            onChange={(event) => {
              setPaymentMethod(event.target.value as "" | PaymentMethod);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Todas</option>
            <option value="CASH">Dinheiro</option>
            <option value="CARD">Cartão</option>
            <option value="PIX">Pix</option>
            <option value="OTHER">Outro</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => void handleCsv()}
            disabled={exporting}
            className={secondaryButton}
          >
            {exporting ? "Exportando..." : "Exportar CSV"}
          </button>
        </div>
        <div className="flex items-end text-xs text-slate-500">
          {data ? `Gerado em ${formatDateTime(data.generatedAt)}` : ""}
        </div>
      </div>

      <ErrorBanner error={error} />

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">
              Concluídas — {periodLabel}
            </p>
            <p className="text-xl font-semibold text-slate-900">
              {formatBrl(data.totals.completed.net)}
            </p>
            <p className="text-sm text-slate-600">
              {data.totals.completed.count} venda(s) · bruto{" "}
              {formatBrl(data.totals.completed.gross)} · descontos{" "}
              {formatBrl(data.totals.completed.discounts)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Cancelamentos</p>
            <p className="text-xl font-semibold text-red-700">
              {formatBrl(data.totals.cancelled.total)}
            </p>
            <p className="text-sm text-slate-600">
              {data.totals.cancelled.count} venda(s) cancelada(s) — fora do líquido
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Ticket médio</p>
            <p className="text-xl font-semibold text-slate-900">
              {data.totals.completed.count > 0
                ? formatBrl(
                    Number(data.totals.completed.net) / data.totals.completed.count,
                  )
                : "—"}
            </p>
            <p className="text-sm text-slate-600">líquido ÷ vendas concluídas</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Status</p>
            <p className="text-sm text-slate-600">
              Filtro atual: <strong>{status ? saleStatusLabels[status] : "Todos"}</strong>
            </p>
            <p className="text-sm text-slate-600">
              {data.total} venda(s) na lista — totais sempre separados em concluídas ×
              canceladas
            </p>
          </div>
        </div>
      )}

      <DataTable
        rows={data?.items ?? []}
        rowKey={(sale) => sale.id}
        empty={<>{data && data.items.length === 0 ? "Nenhuma venda no período/filtros selecionados." : !data && !error ? loading ? "Carregando..." : "Sem dados." : null}</>}
        columns={[
          { key: "c0", header: "Data (UTC)", cell: (sale) => formatDateTime(sale.createdAt) },
          { key: "c1", header: "Código", cell: (sale) => sale.receiptCode, className: "font-mono text-xs font-semibold" },
          { key: "c2", header: "Status", cell: (sale) => <><span
                    className={
                      sale.status === "COMPLETED"
                        ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                        : "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                    }
                  >
                    {saleStatusLabels[sale.status]}
                  </span></> },
          { key: "c3", header: "Pagamento", cell: (sale) => paymentMethodLabels[sale.paymentMethod] },
          { key: "c4", header: "Subtotal", cell: (sale) => formatBrl(sale.subtotal), numeric: true },
          { key: "c5", header: "Desconto", cell: (sale) => formatBrl(sale.discount), numeric: true },
          { key: "c6", header: "Total", cell: (sale) => formatBrl(sale.total), numeric: true, className: "font-medium" },
          { key: "c7", header: "Cliente", cell: (sale) => sale.client ?? "—" },
          { key: "c8", header: "Responsável", cell: (sale) => sale.createdBy },
        ]}
      />

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPage={setPage}
        />
      )}
    </div>
  );
}

function EstoqueTab({ from, to, reloadKey }: PeriodProps) {
  const [view, setView] = useState<"alertas" | "movimentos">("alertas");
  const [alerts, setAlerts] = useState<StockAlertsReportDto | null>(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const [movements, setMovements] = useState<StockMovementsReportDto | null>(null);
  const [movementsPage, setMovementsPage] = useState(1);
  const [type, setType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(alertsPage), pageSize: "20" });
      setAlerts(await api<StockAlertsReportDto>(`/api/reports/stock/alerts?${params}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar alertas de estoque.");
    } finally {
      setLoading(false);
    }
  }, [alertsPage, reloadKey]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildPeriodParams(from, to);
      params.set("page", String(movementsPage));
      params.set("pageSize", "20");
      if (type) params.set("type", type);
      setMovements(
        await api<StockMovementsReportDto>(`/api/reports/stock/movements?${params}`),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar movimentos.");
    } finally {
      setLoading(false);
    }
  }, [from, to, movementsPage, type, reloadKey]);

  useEffect(() => {
    if (view === "alertas") void loadAlerts();
    else void loadMovements();
  }, [view, loadAlerts, loadMovements]);

  async function handleCsv(kind: "alertas" | "movimentos") {
    setExporting(true);
    try {
      if (kind === "alertas") {
        await downloadCsv("/api/reports/stock/alerts?format=csv", "akylla_estoque.csv");
      } else {
        const params = buildPeriodParams(from, to);
        if (type) params.set("type", type);
        params.set("format", "csv");
        await downloadCsv(
          `/api/reports/stock/movements?${params.toString()}`,
          "akylla_movimentos.csv",
        );
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar CSV.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setView("alertas")}
          className={
            view === "alertas"
              ? "rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white"
              : secondaryButton
          }
        >
          Alertas (baixo/zerado)
        </button>
        <button
          type="button"
          onClick={() => setView("movimentos")}
          className={
            view === "movimentos"
              ? "rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white"
              : secondaryButton
          }
        >
          Movimentações
        </button>
        <button
          type="button"
          onClick={() => void handleCsv(view)}
          disabled={exporting}
          className={secondaryButton}
        >
          {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
        {view === "movimentos" && (
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setMovementsPage(1);
            }}
            aria-label="Tipo de movimento"
            className="w-auto rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="IN">Entrada</option>
            <option value="OUT">Saída</option>
            <option value="ADJUST_POSITIVE">Ajuste positivo</option>
            <option value="ADJUST_NEGATIVE">Ajuste negativo</option>
          </select>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {alerts && view === "alertas"
            ? `Gerado em ${formatDateTime(alerts.generatedAt)}`
            : movements && view === "movimentos"
              ? `Período ${movements.period.from} a ${movements.period.to} (UTC) · gerado em ${formatDateTime(movements.generatedAt)}`
              : ""}
        </span>
      </div>

      <ErrorBanner error={error} />

      {view === "alertas" && alerts && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Total em alerta</p>
            <p className="text-xl font-semibold text-slate-900">{alerts.alerts.total}</p>
            <p className="text-sm text-slate-600">produtos ativos</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Sem estoque</p>
            <p className="text-xl font-semibold text-red-700">
              {alerts.alerts.outOfStockCount}
            </p>
            <p className="text-sm text-slate-600">saldo zerado</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Estoque baixo</p>
            <p className="text-xl font-semibold text-amber-700">
              {alerts.alerts.lowStockCount}
            </p>
            <p className="text-sm text-slate-600">abaixo do mínimo (exclui zerados)</p>
          </div>
        </div>
      )}

      {view === "movimentos" && movements && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {movements.totals.byType.map((item) => (
            <div key={item.type} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">{item.label}</p>
              <p className="text-xl font-semibold text-slate-900">{item.count}</p>
              <p className="text-sm text-slate-600">unidades: {item.quantity}</p>
            </div>
          ))}
        </div>
      )}

      {view === "alertas" ? (
        <DataTable
          caption="Produtos em alerta de estoque"
          rows={alerts?.items ?? []}
          rowKey={(item) => item.id}
          empty={alerts ? "Nenhum produto em alerta." : !error && loading ? "Carregando..." : "Sem dados."}
          columns={[
            { key: "name", header: "Produto", cell: (item) => item.name },
            { key: "sku", header: "SKU", cell: (item) => item.sku ?? "—", className: "font-mono text-xs" },
            { key: "stock", header: "Estoque", cell: (item) => `${item.stockQuantity} ${item.unitLabel}`, numeric: true },
            { key: "min", header: "Mínimo", cell: (item) => item.minimumStock, numeric: true },
            {
              key: "alert",
              header: "Situação",
              cell: (item) => (
                <span
                  className={
                    item.alert === "OUT_OF_STOCK"
                      ? "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                      : "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
                  }
                >
                  {item.alert === "OUT_OF_STOCK" ? "Sem estoque" : "Estoque baixo"}
                </span>
              ),
            },
          ]}
        />
      ) : (
        <DataTable
          caption="Movimentações de estoque"
          rows={movements?.items ?? []}
          rowKey={(item) => item.id}
          empty={movements ? "Nenhuma movimentação no período/filtros." : !error && loading ? "Carregando..." : "Sem dados."}
          columns={[
            { key: "date", header: "Data (UTC)", cell: (item) => formatDateTime(item.createdAt) },
            {
              key: "product",
              header: "Produto",
              cell: (item) => (
                <>
                  {item.product.name}
                  {item.product.sku ? <span className="ml-2 font-mono text-xs text-slate-600">{item.product.sku}</span> : null}
                </>
              ),
            },
            { key: "type", header: "Tipo", cell: (item) => item.typeLabel },
            { key: "qty", header: "Quantidade", cell: (item) => item.quantity, numeric: true },
            { key: "ref", header: "Referência", cell: (item) => item.reference ?? "—" },
            { key: "by", header: "Responsável", cell: (item) => item.createdBy },
          ]}
        />
      )}

      {view === "alertas" && alerts && (
        <Pagination
          page={alerts.page}
          pageSize={alerts.pageSize}
          total={alerts.total}
          onPage={setAlertsPage}
        />
      )}
      {view === "movimentos" && movements && (
        <Pagination
          page={movements.page}
          pageSize={movements.pageSize}
          total={movements.total}
          onPage={setMovementsPage}
        />
      )}
    </div>
  );
}

function CaixaTab({ from, to, reloadKey }: PeriodProps) {
  const [data, setData] = useState<CashReportDto | null>(null);
  const [movements, setMovements] = useState<Paginated<CashMovementDto> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const periodParams = buildPeriodParams(from, to);
      const listParams = buildPeriodParams(from, to);
      listParams.set("page", String(page));
      listParams.set("pageSize", "20");
      const [report, list] = await Promise.all([
        api<CashReportDto>(`/api/reports/cash?${periodParams.toString()}`),
        api<Paginated<CashMovementDto>>(`/api/cash/movements?${listParams.toString()}`),
      ]);
      setData(report);
      setMovements(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o relatório de caixa.");
    } finally {
      setLoading(false);
    }
  }, [from, to, page, reloadKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodLabel = data ? `${data.period.from} a ${data.period.to} (UTC)` : "—";

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Período: {periodLabel}</span>
        <span>{data ? `Gerado em ${formatDateTime(data.generatedAt)}` : ""}</span>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Dinheiro no período</p>
            <p className="text-xl font-semibold text-slate-900">
              {formatBrl(data.movements.inCash.net)}
            </p>
            <p className="text-sm text-slate-600">
              entradas {formatBrl(data.movements.inCash.entries)} · saídas{" "}
              {formatBrl(data.movements.inCash.exits)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Todas as movimentações</p>
            <p className="text-sm text-slate-600">
              entradas {formatBrl(data.movements.all.entries)} · saídas{" "}
              {formatBrl(data.movements.all.exits)}
            </p>
            <p className="text-xs text-slate-500">inclui cartão/pix e estornos</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Estornos</p>
            <p className="text-xl font-semibold text-slate-900">
              {data.movements.reversals.count}
            </p>
            <p className="text-sm text-slate-600">
              total {formatBrl(data.movements.reversals.total)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Sessões fechadas</p>
            <p className="text-xl font-semibold text-slate-900">
              {data.sessions.closedCount}
            </p>
            <p className="text-sm text-slate-600">
              {data.sessions.openedCount} aberta(s) no período ·{" "}
              {data.sessions.closedWithDifferenceCount} com diferença · total{" "}
              {formatBrl(data.sessions.totalDifference)}
            </p>
          </div>
        </div>
      )}

      {data && (
        <DataTable
          rows={data.movements.byOrigin}
          rowKey={(row) => `${row.origin}-${row.type}`}
          empty={<>{data.movements.byOrigin.length === 0 ? "Nenhuma movimentação no período." : null}</>}
          columns={[
            { key: "c0", header: "Origem", cell: (row) => row.originLabel },
            { key: "c1", header: "Tipo", cell: (row) => row.typeLabel },
            { key: "c2", header: "Lançamentos", cell: (row) => row.count },
            { key: "c3", header: "Total", cell: (row) => formatBrl(row.total), numeric: true, className: "font-medium" },
          ]}
        />
      )}

      {data && data.sessions.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            Sessões de caixa fechadas no período (máx. 100)
          </div>
          <DataTable
            bare
            rows={data.sessions.items}
            rowKey={(session) => session.id}
            columns={[
              { key: "c0", header: "Abertura (UTC)", cell: (session) => formatDateTime(session.openedAt) },
              { key: "c1", header: "Fechamento (UTC)", cell: (session) => session.closedAt ? formatDateTime(session.closedAt) : "—" },
              { key: "c2", header: "Esperado", cell: (session) => formatBrl(session.expectedAmount), numeric: true },
              { key: "c3", header: "Contado", cell: (session) => formatBrl(session.countedAmount), numeric: true },
              { key: "c4", header: "Diferença", cell: (session) => formatBrl(session.difference), numeric: true, className: "font-medium" },
            ]}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-xs font-semibold uppercase text-slate-500">
            Movimentações do período
          </span>
          <Link href="/caixa/movimentos" className="text-xs text-primary-700 hover:underline">
            Ver histórico completo
          </Link>
        </div>
        <DataTable
          rows={movements?.items ?? []}
          rowKey={(movement) => movement.id}
          empty={<>{movements && movements.items.length === 0 ? "Nenhuma movimentação no período." : !movements && !error ? loading ? "Carregando..." : "Sem dados." : null}</>}
          columns={[
            { key: "c0", header: "Data (UTC)", cell: (movement) => formatDateTime(movement.createdAt) },
            { key: "c1", header: "Tipo", cell: (movement) => cashMovementTypeLabels[movement.type] },
            { key: "c2", header: "Origem", cell: (movement) => cashMovementOriginLabels[movement.origin] },
            { key: "c3", header: "Descrição", cell: (movement) => movement.description },
            { key: "c4", header: "Valor", cell: (movement) => formatBrl(movement.amount), numeric: true, className: "font-medium" },
          ]}
        />
      </div>

      {movements && (
        <Pagination
          page={movements.page}
          pageSize={movements.pageSize}
          total={movements.total}
          onPage={setPage}
        />
      )}
    </div>
  );
}

function ClientesTab({ from, to, reloadKey }: PeriodProps) {
  const [data, setData] = useState<ClientsReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildPeriodParams(from, to);
      setData(await api<ClientsReportDto>(`/api/reports/clients?${params.toString()}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o relatório.");
    } finally {
      setLoading(false);
    }
  }, [from, to, reloadKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodLabel = data ? `${data.period.from} a ${data.period.to} (UTC)` : "—";

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Período: {periodLabel}</span>
        <span>{data ? `Gerado em ${formatDateTime(data.generatedAt)}` : ""}</span>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Novos clientes</p>
            <p className="text-2xl font-semibold text-slate-900">{data.newClients}</p>
            <p className="text-sm text-slate-600">pela data de cadastro (UTC)</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Agendamentos no período</p>
            <p className="text-2xl font-semibold text-slate-900">{data.services.completed}</p>
            <p className="text-sm text-slate-600">concluído(s) pela data/hora de início</p>
            <p className="mt-1 text-xs text-slate-500">
              Confirmados: {data.services.confirmed} · Agendados: {data.services.scheduled} ·
              Cancelados: {data.services.cancelled} · Não compareceu: {data.services.noShow}
            </p>
          </div>
        </div>
      )}

      {!data && !error && (
        <p className="py-6 text-center text-sm text-slate-500">
          {loading ? "Carregando..." : "Sem dados."}
        </p>
      )}
    </div>
  );
}

function WhatsAppTab({ from, to, reloadKey }: PeriodProps) {
  const [data, setData] = useState<WhatsAppReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildPeriodParams(from, to);
      setData(await api<WhatsAppReportDto>(`/api/reports/whatsapp?${params.toString()}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o relatório.");
    } finally {
      setLoading(false);
    }
  }, [from, to, reloadKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodLabel = data ? `${data.period.from} a ${data.period.to} (UTC)` : "—";

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Período: {periodLabel}</span>
        <span>{data ? `Gerado em ${formatDateTime(data.generatedAt)}` : ""}</span>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Mensagens no período</p>
            <p className="text-2xl font-semibold text-slate-900">{data.total}</p>
            <p className="text-sm text-slate-600">pela data de criação (UTC)</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Entregues / lidas</p>
            <p className="text-2xl font-semibold text-primary-700">
              {data.states.delivered} / {data.states.read}
            </p>
            <p className="text-sm text-slate-600">
              aceitas pela API: {data.states.accepted} (não confundir com entregues)
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Falhas</p>
            <p className="text-2xl font-semibold text-red-700">{data.failed.count}</p>
            <p className="text-sm text-slate-600">status final FAILED no período</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase text-slate-500">Pendentes / canceladas</p>
            <p className="text-2xl font-semibold text-slate-900">
              {data.states.pending} / {data.states.cancelled}
            </p>
            <p className="text-sm text-slate-600">na fila ou canceladas antes do envio</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              Mensagens por status atual
            </div>
            <DataTable
              bare
              rows={data.byStatus}
              rowKey={(row) => row.status}
              columns={[
                { key: "c0", header: "Status", cell: (row) => whatsappMessageStatusLabels[row.status] },
                { key: "c1", header: "Quantidade", cell: (row) => row.count },
              ]}
            />
          </div>
        )}

        {data && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
              Motivos de falha
            </div>
            <DataTable
              rows={data.failed.byReason}
              rowKey={(row) => row.reason}
              empty={<>{data.failed.byReason.length === 0 ? "Nenhuma falha no período." : null}</>}
              columns={[
                { key: "c0", header: "Motivo", cell: (row) => row.reason },
                { key: "c1", header: "Quantidade", cell: (row) => row.count },
              ]}
            />
          </div>
        )}
      </div>

      {!data && !error && (
        <p className="py-6 text-center text-sm text-slate-500">
          {loading ? "Carregando..." : "Sem dados."}
        </p>
      )}
    </div>
  );
}

export default function RelatoriosPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("vendas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "", key: 0 });

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

  function handlePeriod(event: FormEvent) {
    event.preventDefault();
    setApplied((current) => ({ from, to, key: current.key + 1 }));
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const periodProps: PeriodProps = {
    from: applied.from,
    to: applied.to,
    reloadKey: applied.key,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Relatórios</h2>
          <p className="text-sm text-slate-500">
            Consultas por período com agregação no servidor (fuso UTC, datas
            inclusivas).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      <form
        onSubmit={handlePeriod}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label htmlFor="report-from" className="mb-1 block text-sm text-slate-700">
            De
          </label>
          <input
            id="report-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="report-to" className="mb-1 block text-sm text-slate-700">
            Até
          </label>
          <input
            id="report-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            Aplicar período
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              setApplied((current) => ({ from: "", to: "", key: current.key + 1 }));
            }}
            className={secondaryButton}
          >
            Padrão 30 dias
          </button>
        </div>
        <div className="flex items-end text-xs text-slate-500">
          Período aplicado:{" "}
          {applied.from || applied.to
            ? `${applied.from || "(padrão)"} a ${applied.to || "(hoje)"}`
            : "últimos 30 dias (padrão)"}
        </div>
      </form>

      <Tabs label="Relatórios" items={tabs.map((item) => ({ key: item.id, label: item.label }))} value={tab} onChange={setTab}>
        {tab === "vendas" && <VendasTab {...periodProps} />}
        {tab === "estoque" && <EstoqueTab {...periodProps} />}
        {tab === "caixa" && <CaixaTab {...periodProps} />}
        {tab === "clientes" && <ClientesTab {...periodProps} />}
        {tab === "whatsapp" && <WhatsAppTab {...periodProps} />}
      </Tabs>
    </div>
  );
}
