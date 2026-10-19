"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { normalizeDecimalInput, parseDecimalInput, settlementMethodLabels } from "@petflow/shared";
import { api } from "../lib/api";
import { formatBrl } from "../lib/format";
import type {
  FinancialDirection,
  FinancialEntryDto,
  FinancialListResponse,
  FinancialStatus,
} from "../lib/types";
import { useDialog } from "./ui/Dialog";
import { DataTable } from "./ui/DataTable";
import { useToast } from "./ui/Toast";
import { SearchSelect } from "./ui/SearchSelect";

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
  const toast = useToast();
  const dialog = useDialog();
  const [editingCounterpartyName, setEditingCounterpartyName] = useState<string | null>(null);
  const counterpartyLabel = direction === "RECEIVABLE" ? "Cliente" : "Fornecedor";

  const [items, setItems] = useState<FinancialEntryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FinancialStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

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
      setListError(err instanceof Error ? err.message : "Não foi possível carregar os títulos.");
    } finally {
      setLoading(false);
    }
  }, [direction, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setForm({ description: "", amount: "", dueDate: "", counterpartyId: "" });
    setEditingCounterpartyName(null);
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
    setEditingCounterpartyName(entry.client?.name ?? entry.supplier?.name ?? null);
    setEditingId(entry.id);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!form.description.trim() || !form.dueDate) {
      setFormError("Descrição e vencimento são obrigatórios.");
      return;
    }
    const amountValue = parseDecimalInput(form.amount);
    if (!form.amount.trim() || !Number.isFinite(amountValue) || amountValue <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }

    const payload = {
      description: form.description.trim(),
      amount: normalizeDecimalInput(form.amount),
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
        toast.success("Título atualizado.");
      } else {
        await api("/api/financial", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Título criado.");
      }
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar o título.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(entry: FinancialEntryDto) {
    const paymentMethod = await dialog.prompt({
      title: `Liquidar "${entry.description}" (${formatBrl(entry.amount)})`,
      description: "Só dinheiro entra ou sai da gaveta do caixa. Pix, cartão, boleto e transferência ficam registrados, mas fora do saldo da gaveta.",
      label: entry.direction === "PAYABLE" ? "Forma de pagamento" : "Forma de recebimento",
      choices: Object.entries(settlementMethodLabels).map(([value, label]) => ({ value, label })),
      confirmLabel: "Liquidar",
    });
    if (!paymentMethod) return;
    try {
      await api(`/api/financial/${entry.id}/pay`, { method: "POST", body: JSON.stringify({ paymentMethod }) });
      toast.success("Título liquidado e lançado no caixa.");
      await load();
    } catch (err) {
      toast.error(err, "Falha ao liquidar o título.");
    }
  }

  async function handleCancel(entry: FinancialEntryDto) {
    const reason = await dialog.prompt({ title: `Cancelar "${entry.description}"`, label: "Motivo do cancelamento", minLength: 3, maxLength: 500, danger: true, confirmLabel: "Cancelar título" });
    if (!reason) return;
    try {
      await api(`/api/financial/${entry.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast.success("Título cancelado.");
      await load();
    } catch (err) {
      toast.error(err, "Falha ao cancelar o título.");
    }
  }

  async function handleReverse(entry: FinancialEntryDto) {
    const reason = await dialog.prompt({ title: `Estornar a liquidação de "${entry.description}"`, description: "O valor volta para o caixa por um movimento de estorno.", label: "Motivo do estorno", minLength: 3, maxLength: 500, danger: true, confirmLabel: "Estornar" });
    if (!reason) return;
    try {
      await api(`/api/financial/${entry.id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast.success("Liquidação estornada e valor devolvido ao caixa.");
      await load();
    } catch (err) {
      toast.error(err, "Falha ao estornar a liquidação.");
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {listError}
        </div>
      )}

      {/* Auditoria (bloco 3): lançar e liquidar títulos é do administrador */}
      {(isAdmin || editingId) && (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {editingId ? "Editar título" : "Novo título"}
        </h3>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="fin-description" className="mb-1 block text-sm text-slate-700">
              Descrição *
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
              inputMode="decimal"
              placeholder="0,00"
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
            <SearchSelect<Option>
              id="fin-counterparty"
              endpoint={direction === "RECEIVABLE" ? "/api/clients?status=ACTIVE" : "/api/suppliers?status=ACTIVE"}
              value={form.counterpartyId}
              selectedLabel={editingCounterpartyName}
              onChange={(id) => setForm({ ...form, counterpartyId: id })}
              emptyOptionLabel="Sem vínculo"
            />
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
              className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
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
      )}

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
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="OPEN">Em aberto</option>
          <option value="PAID">Liquidado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
        <span className="text-sm text-slate-500">{total} título(s)</span>
      </div>

      <DataTable
        rows={items}
        rowKey={(entry) => entry.id}
        empty={loading ? "Carregando..." : "Nenhum título encontrado."}
        columns={[
          { key: "c0", header: "Descrição", cell: (entry) => entry.description, className: "font-medium" },
          { key: "c1", header: counterpartyLabel, cell: (entry) => entry.client?.name ?? entry.supplier?.name ?? "—" },
          { key: "c2", header: "Valor", cell: (entry) => <>{formatBrl(entry.amount)}</> },
          { key: "c3", header: "Vencimento", cell: (entry) => new Date(entry.dueDate).toLocaleDateString("pt-BR") },
          { key: "c4", header: "Status", cell: (entry) => <><span
                    className={
                      entry.status === "PAID"
                        ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                        : entry.status === "CANCELLED"
                          ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                          : isOverdue(entry)
                            ? "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                            : "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                    }
                  >
                    {isOverdue(entry) ? "Vencido" : statusLabel[entry.status]}
                  </span></> },
          { key: "c5", header: "Ações", cell: (entry) => <><div className="flex gap-3 text-xs font-medium">
                    {entry.status === "OPEN" && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="text-primary-700 hover:underline"
                        >
                          Editar
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => void handlePay(entry)}
                            className="text-primary-700 hover:underline"
                          >
                            Liquidar
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleCancel(entry)}
                            className="text-red-700 hover:underline"
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
                        className="text-red-700 hover:underline"
                      >
                        Estornar
                      </button>
                    )}
                    {entry.status === "CANCELLED" && entry.cancelReason && (
                      <span className="text-xs text-slate-500" title={entry.cancelReason}>
                        motivo registrado
                      </span>
                    )}
                  </div></> },
        ]}
      />

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
            Página {page} de {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
