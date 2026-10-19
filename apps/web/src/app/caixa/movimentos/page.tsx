"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  cashMovementOriginLabels,
  cashMovementTypeLabels,
  type CashMovementDto,
  type CashMovementOrigin,
  type CashMovementType,
  type CashSessionDto,
  type Paginated,
} from "../../../lib/types";
import { DataTable } from "../../../components/ui/DataTable";
import { formatBrl } from "../../../lib/format";

const pageSize = 20;

export default function MovimentosCaixaPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<CashMovementDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [sessions, setSessions] = useState<CashSessionDto[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<"" | CashMovementType>("");
  const [origin, setOrigin] = useState<"" | CashMovementOrigin>("");
  const [sessionId, setSessionId] = useState("");

  const [reversalTarget, setReversalTarget] = useState<CashMovementDto | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
      const params = new URLSearchParams(window.location.search);
      const preset = params.get("sessionId");
      if (preset) setSessionId(preset);
    });
  }, [router]);

  const loadMovements = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (type) params.set("type", type);
      if (origin) params.set("origin", origin);
      if (sessionId) params.set("sessionId", sessionId);

      const data = await api<Paginated<CashMovementDto>>(`/api/cash/movements?${params.toString()}`);
      setMovements(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as movimentações.");
    }
  }, [page, from, to, type, origin, sessionId]);

  useEffect(() => {
    if (session) {
      void loadMovements();
      api<Paginated<CashSessionDto>>("/api/cash/sessions")
        .then((data) => setSessions(data.items))
        .catch(() => setSessions([]));
    }
  }, [session, loadMovements]);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadMovements();
  }

  function clearFilters() {
    setFrom("");
    setTo("");
    setType("");
    setOrigin("");
    setSessionId("");
    setPage(1);
  }

  async function handleReversal(event: FormEvent) {
    event.preventDefault();
    if (!reversalTarget) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/cash/movements/${reversalTarget.id}/reversal`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setNotice(`Lançamento "${reversalTarget.description}" estornado.`);
      setReversalTarget(null);
      setReason("");
      await loadMovements();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível estornar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Movimentações de caixa</h2>
          <p className="text-sm text-slate-500">
            {total} movimentação{total === 1 ? "" : "ões"} encontrada{total === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/caixa"
            className="rounded-md border border-primary-600 px-3 py-2 text-sm font-medium text-primary-800 hover:bg-primary-100"
          >
            Caixa
          </Link>
          <Link
            href="/caixa/sessoes"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sessões
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}

      <form
        onSubmit={handleFilter}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6"
      >
        <div>
          <label htmlFor="mov-from" className="mb-1 block text-sm text-slate-700">
            De
          </label>
          <input
            id="mov-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="mov-to" className="mb-1 block text-sm text-slate-700">
            Até
          </label>
          <input
            id="mov-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="mov-type" className="mb-1 block text-sm text-slate-700">
            Tipo
          </label>
          <select
            id="mov-type"
            value={type}
            onChange={(event) => setType(event.target.value as "" | CashMovementType)}
            className={inputClass}
          >
            <option value="">Todos</option>
            <option value="IN">Entrada</option>
            <option value="OUT">Saída</option>
          </select>
        </div>
        <div>
          <label htmlFor="mov-origin" className="mb-1 block text-sm text-slate-700">
            Origem
          </label>
          <select
            id="mov-origin"
            value={origin}
            onChange={(event) => setOrigin(event.target.value as "" | CashMovementOrigin)}
            className={inputClass}
          >
            <option value="">Todas</option>
            <option value="MANUAL">Manual</option>
            <option value="SALE">Venda</option>
            <option value="SALE_CANCELMENT">Cancelamento</option>
            <option value="REVERSAL">Estorno</option>
          </select>
        </div>
        <div>
          <label htmlFor="mov-session" className="mb-1 block text-sm text-slate-700">
            Sessão
          </label>
          <select
            id="mov-session"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            className={inputClass}
          >
            <option value="">Todas</option>
            {sessions.map((item) => (
              <option key={item.id} value={item.id}>
                {new Date(item.openedAt).toLocaleString("pt-BR")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Limpar
          </button>
        </div>
      </form>

      {reversalTarget && (
        <form
          onSubmit={handleReversal}
          className="rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-sm font-medium text-amber-900">
            Estornar: {reversalTarget.description} — {formatBrl(reversalTarget.amount)}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Um lançamento compensatório do tipo oposto será criado e este lançamento ficará
            marcado como estornado (registro imutável).
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <label htmlFor="reversal-reason" className="mb-1 block text-sm text-amber-900">
                Motivo (mínimo 3 caracteres) *
              </label>
              <input
                id="reversal-reason"
                required
                minLength={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              {saving ? "Estornando..." : "Confirmar estorno"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReversalTarget(null);
                setReason("");
              }}
              className="rounded-md border border-amber-700 px-4 py-2 text-sm text-amber-900 hover:bg-amber-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <DataTable
        rows={movements}
        rowKey={(movement) => movement.id}
        empty={<>Nenhuma movimentação encontrada.</>}
        columns={[
          { key: "c0", header: "Data", cell: (movement) => new Date(movement.createdAt).toLocaleString("pt-BR") },
          { key: "c1", header: "Tipo", cell: (movement) => <><span
                    className={
                      movement.type === "IN"
                        ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                        : "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                    }
                  >
                    {cashMovementTypeLabels[movement.type]}
                  </span></> },
          { key: "c2", header: "Origem", cell: (movement) => <>{cashMovementOriginLabels[movement.origin]}
                  {movement.sale && (
                    <span className="ml-1 font-mono text-xs text-slate-500">
                      {movement.sale.receiptCode}
                    </span>
                  )}</> },
          { key: "c3", header: "Descrição", cell: (movement) => <><span className="block truncate">{movement.description}</span>
                  {movement.saleId && (
                    <Link
                      href={`/vendas/${movement.saleId}`}
                      className="text-xs text-primary-700 hover:underline"
                    >
                      Ver venda
                    </Link>
                  )}</>, className: "max-w-xs" },
          { key: "c4", header: "Caixa", cell: (movement) => <><span
                    className={
                      movement.inCash
                        ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        : "rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-500"
                    }
                  >
                    {movement.inCash ? "Físico" : "Outro"}
                  </span></> },
          { key: "c5", header: "Situação", cell: (movement) => <>{movement.reversedAt ? (
                    <span
                      title={movement.reversalReason ?? undefined}
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                    >
                      Estornado
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                      Ativo
                    </span>
                  )}</> },
          { key: "c6", header: "Valor", cell: (movement) => <>{movement.type === "IN" ? "+" : "-"} {formatBrl(movement.amount)}</>, numeric: true, className: "font-medium" },
          { key: "c7", header: "Ação", cell: (movement) => <>{movement.origin === "MANUAL" && !movement.reversedAt ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReversalTarget(movement);
                          setReason("");
                        }}
                        className="text-sm text-red-700 hover:underline"
                      >
                        Estornar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}</>, numeric: true, hidden: !(isAdmin) },
        ]}
      />

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Página {page} de {pages}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
