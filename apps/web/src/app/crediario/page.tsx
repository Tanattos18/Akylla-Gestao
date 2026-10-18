"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import { formatBrl, formatDate } from "../../lib/format";
import type {
  ClientDto,
  CreditAccountDetailDto,
  CreditAccountListDto,
  CreditInstallmentDto,
  CreditInstallmentStatus,
  Paginated,
} from "../../lib/types";

/** Fase 2 · 2.2 — crediário: carteira, aprovação de limite e recebimento de parcelas. */

const statusLabels: Record<CreditInstallmentStatus, string> = {
  OPEN: "Em aberto",
  PAID: "Paga",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

const statusClass: Record<CreditInstallmentStatus, string> = {
  OPEN: "bg-sky-50 text-sky-800",
  PAID: "bg-emerald-50 text-emerald-800",
  OVERDUE: "bg-red-50 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-600",
};

function CrediarioContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [list, setList] = useState<CreditAccountListDto | null>(null);
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [selected, setSelected] = useState<string>(params.get("cliente") ?? "");
  const [detail, setDetail] = useState<CreditAccountDetailDto | null>(null);
  const [limit, setLimit] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const loadList = useCallback(async () => {
    try {
      setList(await api<CreditAccountListDto>("/api/credit-accounts?pageSize=100"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar o crediário.");
    }
  }, []);

  const loadDetail = useCallback(async (clientId: string) => {
    if (!clientId) {
      setDetail(null);
      return;
    }
    try {
      const data = await api<CreditAccountDetailDto>(`/api/credit-accounts/${clientId}`);
      setDetail(data);
      setLimit(data.creditLimit);
    } catch (err) {
      setDetail(null);
      setLimit("");
      if (!(err instanceof ApiError && err.status === 404)) {
        setError(err instanceof ApiError ? err.message : "Falha ao carregar o cliente.");
      }
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void loadList();
    api<Paginated<ClientDto>>("/api/clients?status=ACTIVE&pageSize=100")
      .then((data) => setClients(data.items))
      .catch(() => setClients([]));
  }, [session, loadList]);

  useEffect(() => {
    if (session) void loadDetail(selected);
  }, [session, selected, loadDetail]);

  async function saveAccount(event: FormEvent, status?: "ACTIVE" | "BLOCKED") {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/credit-accounts/${selected}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(limit.trim() ? { creditLimit: limit.trim().replace(",", ".") } : {}),
          ...(status ? { status } : {}),
        }),
      });
      setNotice(status === "BLOCKED" ? "Crediário bloqueado." : status === "ACTIVE" ? "Crediário liberado." : "Limite salvo.");
      await Promise.all([loadDetail(selected), loadList()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function receive(installment: CreditInstallmentDto) {
    const ok = window.confirm(
      `Receber a parcela ${installment.number}/${installment.totalInstallments} de ${installment.client.name} (${formatBrl(installment.amount)})? Entra no caixa aberto agora.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/credit-installments/${installment.id}/pay`, { method: "POST" });
      setNotice("Parcela recebida.");
      await Promise.all([loadDetail(selected), loadList()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível receber a parcela.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass = "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Crediário</h2>
          <p className="text-sm text-slate-500">Venda a prazo: limite por cliente, parcelas e recebimentos</p>
        </div>
        <Link href="/pdv" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Abrir PDV
        </Link>
      </div>

      {notice && <div role="status" className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>}
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {list && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">A receber</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatBrl(list.totals.receivable)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Vencido</p>
            <p className="mt-1 text-xl font-semibold text-red-700">{formatBrl(list.totals.overdue)}</p>
            <p className="text-xs text-slate-600">{list.totals.overdueCount} parcela(s)</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Clientes com crediário</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{list.total}</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="cred-client" className="mb-1 block text-sm text-slate-700">Cliente</label>
        <select id="cred-client" value={selected} onChange={(e) => setSelected(e.target.value)} className={`${inputClass} w-full max-w-md`}>
          <option value="">Selecione um cliente…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {selected && (
          <div className="mt-4 space-y-4">
            {detail ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <div><p className="text-xs text-slate-500">Limite</p><p className="font-semibold text-slate-900">{formatBrl(detail.creditLimit)}</p></div>
                <div><p className="text-xs text-slate-500">Em aberto</p><p className="font-semibold text-slate-900">{formatBrl(detail.balance)}</p></div>
                <div><p className="text-xs text-slate-500">Disponível</p><p className="font-semibold text-emerald-700">{formatBrl(detail.available)}</p></div>
                <div><p className="text-xs text-slate-500">Situação</p><p className={detail.status === "ACTIVE" ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{detail.status === "ACTIVE" ? "Liberado" : "Bloqueado"}</p></div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Este cliente ainda não tem crediário aprovado.</p>
            )}

            {isAdmin && (
              <form onSubmit={(e) => void saveAccount(e)} className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="cred-limit" className="mb-1 block text-xs text-slate-600">Limite de crédito (R$)</label>
                  <input id="cred-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="500.00" className={inputClass} />
                </div>
                <button type="submit" disabled={busy || !limit.trim()} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
                  {detail ? "Salvar limite" : "Aprovar crediário"}
                </button>
                {detail && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => void saveAccount(e, detail.status === "ACTIVE" ? "BLOCKED" : "ACTIVE")}
                    className={detail.status === "ACTIVE" ? "rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50" : "rounded-md border border-emerald-300 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50"}
                  >
                    {detail.status === "ACTIVE" ? "Bloquear" : "Liberar"}
                  </button>
                )}
              </form>
            )}

            {detail && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="px-4 py-3">Venda</th>
                      <th className="px-4 py-3">Parcela</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Status</th>
                      {isAdmin && <th className="px-4 py-3">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.installments.map((i) => (
                      <tr key={i.id} className="border-b border-slate-100">
                        <td className="px-4 py-3"><Link href={`/vendas/${i.sale.id}`} className="font-mono text-xs text-primary-700 hover:underline">{i.sale.receiptCode}</Link></td>
                        <td className="px-4 py-3 text-slate-700">{i.number}/{i.totalInstallments}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(i.dueDate)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{formatBrl(i.amount)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[i.status]}`}>{statusLabels[i.status]}</span></td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            {(i.status === "OPEN" || i.status === "OVERDUE") && (
                              <button type="button" disabled={busy} onClick={() => void receive(i)} className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-60">
                                Receber
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {detail.installments.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Sem compras no crediário.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {list && list.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="px-4 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Carteira</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Limite</th>
                <th className="px-4 py-3 text-right">Em aberto</th>
                <th className="px-4 py-3 text-right">Vencido</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((a) => (
                <tr key={a.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setSelected(a.client.id)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{a.client.name}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatBrl(a.creditLimit)}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{formatBrl(a.balance)}</td>
                  <td className={Number(a.overdue) > 0 ? "px-4 py-3 text-right font-semibold text-red-700" : "px-4 py-3 text-right text-slate-500"}>{formatBrl(a.overdue)}</td>
                  <td className="px-4 py-3">{a.status === "ACTIVE" ? "Liberado" : "Bloqueado"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CrediarioPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">Carregando...</p>}>
      <CrediarioContent />
    </Suspense>
  );
}
