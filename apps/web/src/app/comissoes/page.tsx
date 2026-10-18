"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import { formatBrl, formatDateTime, localDayKey } from "../../lib/format";
import type {
  CommissionDto,
  CommissionListDto,
  CommissionStatus,
  CommissionSummaryDto,
  Paginated,
  ProfessionalDto,
} from "../../lib/types";
import { useDialog } from "../../components/ui/Dialog";
import { DataTable } from "../../components/ui/DataTable";

/** Fase 2 · 2.1 — comissões: fechamento por período, liberação e pagamento. */

const statusLabels: Record<CommissionStatus, string> = {
  PENDING: "Pendente",
  RELEASED: "Liberada (a pagar)",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

const statusClass: Record<CommissionStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  RELEASED: "bg-sky-50 text-sky-800",
  PAID: "bg-emerald-50 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-700",
};

function firstDayOfMonth(): string {
  const now = new Date();
  return localDayKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function ComissoesPage() {
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([]);
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(localDayKey(new Date()));
  const [professionalId, setProfessionalId] = useState("");
  const [status, setStatus] = useState<"" | CommissionStatus>("");
  const [summary, setSummary] = useState<CommissionSummaryDto | null>(null);
  const [list, setList] = useState<CommissionListDto | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
    });
  }, [router]);

  const load = useCallback(async () => {
    const period = `from=${from}&to=${to}`;
    const filters = `${period}${professionalId ? `&professionalId=${professionalId}` : ""}${status ? `&status=${status}` : ""}`;
    try {
      const [s, l] = await Promise.all([
        api<CommissionSummaryDto>(`/api/commissions/summary?${period}`),
        api<CommissionListDto>(`/api/commissions?pageSize=100&${filters}`),
      ]);
      setSummary(s);
      setList(l);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar comissões.");
    }
  }, [from, to, professionalId, status]);

  useEffect(() => {
    if (!session) return;
    void load();
    api<Paginated<ProfessionalDto>>("/api/professionals?pageSize=100")
      .then((data) => setProfessionals(data.items))
      .catch(() => setProfessionals([]));
  }, [session, load]);

  async function act(c: CommissionDto, action: "release" | "pay") {
    const verb = action === "pay" ? "Pagar" : "Liberar";
    const detail =
      action === "pay"
        ? `${verb} ${formatBrl(c.amount)} para ${c.professional.name}? Sai do caixa aberto agora.`
        : `${verb} a comissão de ${c.professional.name} (${formatBrl(c.amount)})? Gera conta a pagar.`;
    if (!await dialog.confirm(detail)) return;
    setBusyId(c.id);
    setNotice(null);
    try {
      await api(`/api/commissions/${c.id}/${action}`, { method: "POST" });
      setNotice(action === "pay" ? "Comissão paga." : "Comissão liberada.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir.");
    } finally {
      setBusyId(null);
    }
  }

  if (!session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Comissões</h2>
          <p className="text-sm text-slate-500">
            Calculadas automaticamente nas vendas com profissional · pagamento sai do caixa aberto
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/profissionais" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Profissionais
          </Link>
          {isAdmin && (
            <Link href="/comissoes/regras" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Regras
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="c-from" className="mb-1 block text-xs text-slate-600">De</label>
          <input id="c-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-to" className="mb-1 block text-xs text-slate-600">Até</label>
          <input id="c-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="c-prof" className="mb-1 block text-xs text-slate-600">Profissional</label>
          <select id="c-prof" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="c-status" className="mb-1 block text-xs text-slate-600">Status</label>
          <select id="c-status" value={status} onChange={(e) => setStatus(e.target.value as "" | CommissionStatus)} className={inputClass}>
            <option value="">Todos</option>
            {(Object.keys(statusLabels) as CommissionStatus[]).map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {notice && <div role="status" className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>}
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {summary && (
        <DataTable
          title="Fechamento do período por profissional"
          rows={summary.items}
          rowKey={(row) => row.professionalId}
          empty="Nenhuma comissão no período."
          totals={{
            label: "Total",
            cells: {
              toPay: formatBrl(summary.totals.released),
              paid: formatBrl(summary.totals.paid),
              pending: formatBrl(summary.totals.pending),
              cancelled: formatBrl(summary.totals.cancelled),
            },
          }}
          columns={[
            { key: "name", header: "Profissional", cell: (row) => row.name, className: "font-medium" },
            { key: "toPay", header: "A pagar", cell: (row) => formatBrl(row.toPay), numeric: true, className: "font-semibold" },
            { key: "paid", header: "Pago", cell: (row) => formatBrl(row.paid), numeric: true },
            { key: "pending", header: "Pendente", cell: (row) => formatBrl(row.pending), numeric: true },
            { key: "cancelled", header: "Cancelado", cell: (row) => formatBrl(row.cancelled), numeric: true },
          ]}
        />
      )}

      {list && (
        <DataTable
          title={<>Comissões ({list.total}) · total {formatBrl(list.totals.amount)} sobre {formatBrl(list.totals.baseAmount)} vendidos</>}
          caption="Comissões"
          rows={list.items}
          rowKey={(c) => c.id}
          empty="Nenhuma comissão com estes filtros."
          expanded={(c) =>
            expanded === c.id ? (
              <>
                <DataTable
                  bare
                  caption="Itens da comissão"
                  rows={c.lines}
                  rowKey={(line) => line.saleItemId}
                  columns={[
                    { key: "item", header: "Item", cell: (line) => line.productName },
                    { key: "base", header: "Base", cell: (line) => formatBrl(line.base), numeric: true },
                    { key: "pct", header: "%", cell: (line) => <>{Number(line.percentage).toLocaleString("pt-BR")}%</>, numeric: true },
                    { key: "amount", header: "Comissão", cell: (line) => formatBrl(line.amount), numeric: true },
                  ]}
                />
                {c.cancelReason && <p className="mt-2 text-xs text-slate-600">Motivo: {c.cancelReason}</p>}
              </>
            ) : null
          }
          columns={[
            { key: "date", header: "Data", cell: (c) => formatDateTime(c.createdAt) },
            {
              key: "sale",
              header: "Venda",
              cell: (c) =>
                c.sale ? (
                  <Link href={`/vendas/${c.sale.id}`} className="font-mono text-xs text-primary-700 hover:underline">
                    {c.sale.receiptCode}
                  </Link>
                ) : (
                  "—"
                ),
            },
            { key: "professional", header: "Profissional", cell: (c) => c.professional.name },
            { key: "base", header: "Base", cell: (c) => formatBrl(c.baseAmount), numeric: true },
            { key: "pct", header: "%", cell: (c) => <>{Number(c.percentage).toLocaleString("pt-BR")}%</>, numeric: true },
            { key: "amount", header: "Comissão", cell: (c) => formatBrl(c.amount), numeric: true, className: "font-semibold" },
            {
              key: "status",
              header: "Status",
              cell: (c) => (
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[c.status]}`} title={c.cancelReason ?? undefined}>
                  {statusLabels[c.status]}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Ações",
              cell: (c) => (
                <div className="flex flex-wrap justify-end gap-3 text-xs font-medium md:justify-start">
                  <button type="button" onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-slate-700 hover:underline" aria-expanded={expanded === c.id}>
                    {expanded === c.id ? "Ocultar itens" : "Itens"}
                  </button>
                  {isAdmin && c.status === "PENDING" && (
                    <button type="button" disabled={busyId === c.id} onClick={() => void act(c, "release")} className="text-primary-700 hover:underline disabled:opacity-60">Liberar</button>
                  )}
                  {isAdmin && c.status === "RELEASED" && (
                    <button type="button" disabled={busyId === c.id} onClick={() => void act(c, "pay")} className="text-emerald-700 hover:underline disabled:opacity-60">Pagar</button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
