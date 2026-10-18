"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
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
  CANCELLED: "bg-slate-100 text-slate-600",
};

function firstDayOfMonth(): string {
  const now = new Date();
  return localDayKey(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function ComissoesPage() {
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
    if (!window.confirm(detail)) return;
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
        <div className="flex gap-2">
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
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="px-4 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fechamento do período por profissional
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Profissional</th>
                <th className="px-4 py-3 text-right">A pagar</th>
                <th className="px-4 py-3 text-right">Pago</th>
                <th className="px-4 py-3 text-right">Pendente</th>
                <th className="px-4 py-3 text-right">Cancelado</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((row) => (
                <tr key={row.professionalId} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatBrl(row.toPay)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatBrl(row.paid)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatBrl(row.pending)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatBrl(row.cancelled)}</td>
                </tr>
              ))}
              {summary.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Nenhuma comissão no período.</td></tr>
              )}
            </tbody>
            {summary.items.length > 0 && (
              <tfoot>
                <tr className="text-sm font-semibold text-slate-900">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{formatBrl(summary.totals.released)}</td>
                  <td className="px-4 py-3 text-right">{formatBrl(summary.totals.paid)}</td>
                  <td className="px-4 py-3 text-right">{formatBrl(summary.totals.pending)}</td>
                  <td className="px-4 py-3 text-right">{formatBrl(summary.totals.cancelled)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {list && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="px-4 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comissões ({list.total}) · total {formatBrl(list.totals.amount)} sobre {formatBrl(list.totals.baseAmount)} vendidos
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Venda</th>
                <th className="px-4 py-3">Profissional</th>
                <th className="px-4 py-3 text-right">Base</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3 text-right">Comissão</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((c) => (
                <Fragment key={c.id}>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      {c.sale ? (
                        <Link href={`/vendas/${c.sale.id}`} className="font-mono text-xs text-primary-700 hover:underline">{c.sale.receiptCode}</Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{c.professional.name}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatBrl(c.baseAmount)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{Number(c.percentage).toLocaleString("pt-BR")}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatBrl(c.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[c.status]}`} title={c.cancelReason ?? undefined}>
                        {statusLabels[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3 text-xs font-medium">
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
                    </td>
                  </tr>
                  {expanded === c.id && (
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td colSpan={8} className="px-4 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-500">
                              <th className="py-1 text-left font-medium">Item</th>
                              <th className="py-1 text-right font-medium">Base</th>
                              <th className="py-1 text-right font-medium">%</th>
                              <th className="py-1 text-right font-medium">Comissão</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.lines.map((line) => (
                              <tr key={line.saleItemId}>
                                <td className="py-1 text-slate-700">{line.productName}</td>
                                <td className="py-1 text-right text-slate-700">{formatBrl(line.base)}</td>
                                <td className="py-1 text-right text-slate-700">{Number(line.percentage).toLocaleString("pt-BR")}%</td>
                                <td className="py-1 text-right text-slate-900">{formatBrl(line.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {c.cancelReason && <p className="mt-2 text-xs text-slate-600">Motivo: {c.cancelReason}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {list.items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Nenhuma comissão com estes filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
