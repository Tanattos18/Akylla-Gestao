"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type {
  FinancialDirection,
  FinancialEntryDto,
  FinancialListResponse,
  FinancialStatus,
} from "../lib/types";

interface Option {
  id: string;
  name: string;
}

interface Props {
  direction: FinancialDirection;
  isAdmin: boolean;
}

const statusLabel: Record<FinancialStatus, string> = {
  OPEN: "Em aberto",
  PAID: "Liquidado",
  CANCELLED: "Cancelado",
};

function isOverdue(entry: FinancialEntryDto): boolean {
  if (entry.status !== "OPEN") return false;
  return new Date(entry.dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

export default function FinancialEntries({ direction, isAdmin }: Props) {
  const counterpartyLabel = direction === "RECEIVABLE" ? "Cliente" : "Fornecedor";

  const [items, setItems] = useState<FinancialEntryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FinancialStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [options, setOptions] = useState<Option[]>([]);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    dueDate: "",
    counterpartyId: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        direction,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (status) params.set("status", status);
      const data = await api<FinancialListResponse>(`/api/financial?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
      setListError(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel carregar os tÃ­tulos.");
    } finally {
      setLoading(false);
    }
  }, [direction, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const path =
      direction === "RECEIVABLE"
        ? "/api/clients?pageSize=100&status=ACTIVE"
        : "/api/suppliers?pageSize=100&status=ACTIVE";
    api<{ items: Option[] }>(path)
      .then((data) => setOptions(data.items))
      .catch(() => setOptions([]));
  }, [direction]);

  function resetForm() {
    setForm({ description: "", amount: "", dueDate: "", counterpartyId: "" });
    setEditingId(null);
    setFormError(null);
  }

  function startEdit(entry: FinancialEntryDto) {
    setForm({
      description: entry.description,
      amount: entry.amount,
      dueDate: entry.dueDate.slice(0, 10),
      counterpartyId: entry.clientId ?? entry.supplierId ?? "",
    });
    setEditingId(entry.id);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!form.description.trim() || !form.dueDate) {
      setFormError("DescriÃ§Ã£o e vencimento sÃ£o obrigatÃ³rios.");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }

    const payload = {
      description: form.description.trim(),
      amount: Number(form.amount).toFixed(2),
      dueDate: form.dueDate,
      ...(direction === "RECEIVABLE"
        ? { clientId: form.counterpartyId || null }
        : { supplierId: form.counterpartyId || null }),
    };

    setSaving(true);
    try {
      if (editingId) {
        await api(`/api/financial/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("TÃ­tulo atualizado.");
      } else {
        await api("/api/financial", { method: "POST", body: JSON.stringify(payload) });
        setNotice("TÃ­tulo criado.");
      }
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "NÃ£o foi possÃ­vel salvar o tÃ­tulo.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(entry: FinancialEntryDto) {
    if (!window.confirm(`Confirmar liquidaÃ§Ã£o de "${entry.description}" (R$ ${entry.amount})?`)) {
      return;
    }
    setNotice(null);
    try {
      await api(`/api/financial/${entry.id}/pay`, { method: "POST" });
      setNotice("TÃ­tulo liquidado e lanÃ§ado no caixa.");
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Falha ao liquidar o tÃ­tulo.");
    }
  }

  async function handleCancel(entry: FinancialEntryDto) {
    const reason = window.prompt(`Motivo para cancelar "${entry.description}":`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) window.alert("Motivo Ã© obrigatÃ³rio (mÃ­nimo 3 caracteres).");
      return;
    }
    setNotice(null);
    try {
      await api(`/api/financial/${entry.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setNotice("TÃ­tulo cancelado.");
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Falha ao cancelar o tÃ­tulo.");
    }
  }

  async function handleReverse(entry: FinancialEntryDto) {
    const reason = window.prompt(`Motivo para estornar a liquidaÃ§Ã£o de "${entry.description}":`);
    if (!reason || reason.trim().length < 3) {
      if (reason !== null) window.alert("Motivo Ã© obrigatÃ³rio (mÃ­nimo 3 caracteres).");
      return;
    }
    setNotice(null);
    try {
      await api(`/api/financial/${entry.id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setNotice("LiquidaÃ§Ã£o estornada e valor devolvido ao caixa.");
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Falha ao estornar a liquidaÃ§Ã£o.");
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      )}
      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {listError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {editingId ? "Editar tÃ­tulo" : "Novo tÃ­tulo"}
        </h3>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="fin-description" className="mb-1 block text-sm text-slate-700">
              DescriÃ§Ã£o *
            </label>
            <input
              id="fin-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fin-amount" className="mb-1 block text-sm text-slate-700">
              Valor (R$) *
            </label>
            <input
              id="fin-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fin-due" className="mb-1 block text-sm text-slate-700">
              Vencimento *
            </label>
            <input
              id="fin-due"
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="fin-counterparty" className="mb-1 block text-sm text-slate-700">
              {counterpartyLabel} (opcional)
            </label>
            <select
              id="fin-counterparty"
              value={form.counterpartyId}
              onChange={(event) => setForm({ ...form, counterpartyId: event.target.value })}
              className={inputClass}
            >
              <option value="">Sem vÃ­nculo</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 lg:col-span-4">
              {formError}
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="fin-status" className="text-sm text-slate-600">
          Status
        </label>
        <select
          id="fin-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as FinancialStatus | "");
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="OPEN">Em aberto</option>
          <option value="PAID">Liquidado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
        <span className="text-sm text-slate-500">{total} tÃ­tulo(s)</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">DescriÃ§Ã£o</th>
              <th className="px-4 py-3">{counterpartyLabel}</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">AÃ§Ãµes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{entry.description}</td>
                <td className="px-4 py-3 text-slate-600">
                  {entry.client?.name ?? entry.supplier?.name ?? "â€”"}
                </td>
                <td className="px-4 py-3 text-slate-700">R$ {entry.amount}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(entry.dueDate).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      entry.status === "PAID"
                        ? "rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                        : entry.status === "CANCELLED"
                          ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                          : isOverdue(entry)
                            ? "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                            : "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                    }
                  >
                    {isOverdue(entry) ? "Vencido" : statusLabel[entry.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs font-medium">
                    {entry.status === "OPEN" && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="text-teal-700 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handlePay(entry)}
                          className="text-teal-700 hover:underline"
                        >
                          Liquidar
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleCancel(entry)}
                            className="text-red-600 hover:underline"
                          >
                            Cancelar
                          </button>
                        )}
                      </>
                    )}
                    {entry.status === "PAID" && isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleReverse(entry)}
                        className="text-red-600 hover:underline"
                      >
                        Estornar
                      </button>
                    )}
                    {entry.status === "CANCELLED" && entry.cancelReason && (
                      <span className="text-xs text-slate-400" title={entry.cancelReason}>
                        motivo registrado
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nenhum tÃ­tulo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-500">
            PÃ¡gina {page} de {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            PrÃ³xima
          </button>
        </div>
      )}
    </div>
  );
}
