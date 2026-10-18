"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  accessStatusLabels,
  platformPaymentMethodLabels,
  type AccessStatus,
  type BillingCycle,
  type PlatformCompanyDto,
  type PlatformPaymentDto,
  type PlatformPaymentMethod,
} from "@petflow/shared";
import { api } from "../../lib/api";
import { fetchSession } from "../../lib/session";
import { formatBrl, formatDate, formatDateTime } from "../../lib/format";
import type { TenantPlanDto } from "../../lib/types";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog, useDialog } from "../../components/ui/Dialog";
import { useToast } from "../../components/ui/Toast";

const STATUS_ORDER: AccessStatus[] = ["TRIAL", "ACTIVE", "GRACE", "READ_ONLY", "SUSPENDED", "EXEMPT"];

const badge: Record<AccessStatus, string> = {
  EXEMPT: "bg-slate-100 text-slate-700",
  TRIAL: "bg-sky-50 text-sky-800",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  GRACE: "bg-amber-50 text-amber-800",
  READ_ONLY: "bg-red-50 text-red-800",
  SUSPENDED: "bg-red-100 text-red-900",
};

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

function accessDetail(company: PlatformCompanyDto): string {
  const a = company.access;
  if (a.status === "TRIAL") return `teste até ${formatDate(a.trialEndsAt!)} (${a.daysLeft} d)`;
  if (a.status === "ACTIVE") return `${a.planName} ${a.cycle === "YEARLY" ? "anual" : "mensal"} · até ${formatDate(a.paidUntil!)}`;
  if (a.status === "GRACE") return `venceu · ${a.daysLeft} d de tolerância`;
  if (a.status === "READ_ONLY") return `bloqueada desde ${formatDate(a.graceEndsAt!)}`;
  if (a.status === "SUSPENDED") return company.suspendedReason ?? "suspensa";
  return company.billingExempt ? "isenta pelo dono" : "isenta (sem cobrança)";
}

/** Painel do dono da plataforma (Fase 8): empresas, cobrança e acesso. */
export default function PlataformaPage() {
  const toast = useToast();
  const dialog = useDialog();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [companies, setCompanies] = useState<PlatformCompanyDto[]>([]);
  const [plans, setPlans] = useState<TenantPlanDto[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | AccessStatus>("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<PlatformCompanyDto | null>(null);
  const [payForm, setPayForm] = useState({ planId: "", cycle: "MONTHLY" as BillingCycle, method: "PIX" as PlatformPaymentMethod, amount: "", note: "" });
  const [history, setHistory] = useState<{ id: string; items: PlatformPaymentDto[] } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    try {
      const data = await api<{ items: PlatformCompanyDto[] }>(`/api/platform/companies?${params.toString()}`);
      setCompanies(data.items);
    } catch (err) {
      toast.error(err, "Não foi possível carregar as empresas.");
    }
  }, [search, status, toast]);

  useEffect(() => {
    fetchSession().then((session) => setAllowed(session?.user.isPlatformAdmin === true));
    api<{ items: TenantPlanDto[] }>("/api/billing/plans").then((d) => setPlans(d.items)).catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const counts = useMemo(() => {
    const map = new Map<AccessStatus, number>();
    for (const c of companies) map.set(c.access.status, (map.get(c.access.status) ?? 0) + 1);
    return map;
  }, [companies]);

  function replace(updated: PlatformCompanyDto) {
    setCompanies((current) => current.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function act(label: string, run: () => Promise<PlatformCompanyDto>) {
    setBusy(true);
    try {
      replace(await run());
      toast.success(label);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  function openPay(company: PlatformCompanyDto) {
    const planId = plans.find((p) => p.name === company.access.planName)?.id ?? plans[0]?.id ?? "";
    setPayForm({ planId, cycle: company.access.cycle ?? "MONTHLY", method: "PIX", amount: "", note: "" });
    setPaying(company);
  }

  const selectedPlan = plans.find((p) => p.id === payForm.planId);
  const defaultAmount = selectedPlan ? (payForm.cycle === "YEARLY" ? selectedPlan.priceYearly : selectedPlan.priceMonthly) : null;

  async function submitPay(event: FormEvent) {
    event.preventDefault();
    if (!paying) return;
    const company = paying;
    await act(`Pagamento registrado: ${company.name}`, () =>
      api<PlatformCompanyDto>(`/api/platform/companies/${company.id}/activate`, {
        method: "POST",
        body: JSON.stringify({
          planId: payForm.planId,
          cycle: payForm.cycle,
          method: payForm.method,
          ...(payForm.amount.trim() ? { amount: payForm.amount.trim().replace(",", ".") } : {}),
          ...(payForm.note.trim() ? { note: payForm.note.trim() } : {}),
        }),
      }),
    );
    setPaying(null);
  }

  async function extendTrial(company: PlatformCompanyDto) {
    const days = await dialog.prompt({ title: `Estender teste: ${company.name}`, label: "Quantos dias a mais? (1 a 90)", minLength: 1, maxLength: 2 });
    if (!days) return;
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 90) return toast.error("Informe um número de 1 a 90.");
    await act(`Teste estendido em ${n} dia(s)`, () =>
      api(`/api/platform/companies/${company.id}/trial`, { method: "POST", body: JSON.stringify({ days: n }) }),
    );
  }

  async function toggleExempt(company: PlatformCompanyDto) {
    const exempt = !company.billingExempt;
    if (!(await dialog.confirm({ title: exempt ? `Isentar ${company.name} de cobrança?` : `Remover a isenção de ${company.name}?` }))) return;
    await act(exempt ? "Empresa isenta" : "Isenção removida", () =>
      api(`/api/platform/companies/${company.id}/exempt`, { method: "POST", body: JSON.stringify({ exempt }) }),
    );
  }

  async function suspend(company: PlatformCompanyDto) {
    const reason = await dialog.prompt({
      title: `Suspender ${company.name}`,
      description: "Bloqueia o login de todos os usuários e encerra as sessões abertas. Os dados são mantidos.",
      label: "Motivo",
      minLength: 3,
      maxLength: 500,
      danger: true,
      confirmLabel: "Suspender",
    });
    if (!reason) return;
    await act("Empresa suspensa", () =>
      api(`/api/platform/companies/${company.id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),
    );
  }

  async function reactivate(company: PlatformCompanyDto) {
    if (!(await dialog.confirm({ title: `Reativar ${company.name}?` }))) return;
    await act("Empresa reativada", () => api(`/api/platform/companies/${company.id}/reactivate`, { method: "POST" }));
  }

  async function toggleHistory(company: PlatformCompanyDto) {
    if (history?.id === company.id) return setHistory(null);
    try {
      const data = await api<{ items: PlatformPaymentDto[] }>(`/api/platform/companies/${company.id}/payments`);
      setHistory({ id: company.id, items: data.items });
    } catch (err) {
      toast.error(err);
    }
  }

  if (allowed === null) return <p className="py-16 text-center text-sm text-slate-600">Carregando…</p>;
  if (!allowed) {
    return (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        Área restrita ao dono da plataforma.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Plataforma Akylla</h2>
        <p className="text-sm text-slate-600">Empresas clientes, cobrança e acesso. Visível só para você.</p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Empresas por situação">
        {STATUS_ORDER.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStatus(status === s ? "" : s)}
              aria-pressed={status === s}
              className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm hover:bg-slate-50 ${status === s ? "border-primary-500" : "border-slate-200"}`}
            >
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[s]}`}>{accessStatusLabels[s]}</span>
              <span className="mt-2 block text-2xl font-semibold text-slate-900">{status && status !== s ? "–" : counts.get(s) ?? 0}</span>
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="plat-search" className="mb-1 block text-sm text-slate-700">
            Buscar
          </label>
          <input
            id="plat-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Empresa, identificador, CNPJ ou e-mail do admin"
            className={inputClass}
          />
        </div>
        <button type="submit" className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800">
          Buscar
        </button>
      </form>

      <DataTable
        caption="Empresas"
        rows={companies}
        rowKey={(c) => c.id}
        empty="Nenhuma empresa encontrada."
        expanded={(c) =>
          history?.id === c.id ? (
            <DataTable
              bare
              caption={`Pagamentos de ${c.name}`}
              rows={history.items}
              rowKey={(p) => p.id}
              empty="Nenhum pagamento registrado."
              columns={[
                { key: "date", header: "Registrado em", cell: (p) => formatDateTime(p.createdAt) },
                { key: "plan", header: "Plano", cell: (p) => `${p.planName} ${p.cycle === "YEARLY" ? "anual" : "mensal"}` },
                { key: "period", header: "Período", cell: (p) => `${formatDate(p.periodStart)} a ${formatDate(p.periodEnd)}` },
                { key: "method", header: "Forma", cell: (p) => platformPaymentMethodLabels[p.method] },
                { key: "amount", header: "Valor", cell: (p) => formatBrl(p.amount), numeric: true },
                { key: "note", header: "Obs.", cell: (p) => p.note ?? "—" },
                { key: "by", header: "Por", cell: (p) => p.recordedBy },
              ]}
            />
          ) : null
        }
        columns={[
          {
            key: "company",
            header: "Empresa",
            cell: (c) => (
              <span className="block text-left">
                <span className="font-medium text-slate-900">{c.name}</span>
                <span className="block text-xs text-slate-600">
                  {c.adminEmail ?? "sem admin"} · desde {formatDate(c.createdAt)}
                </span>
              </span>
            ),
          },
          {
            key: "status",
            header: "Situação",
            cell: (c) => (
              <span className="block text-left">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[c.access.status]}`}>
                  {accessStatusLabels[c.access.status]}
                </span>
                <span className="mt-1 block text-xs text-slate-600">{accessDetail(c)}</span>
              </span>
            ),
          },
          {
            key: "usage",
            header: "Uso",
            cell: (c) => (
              <span className="text-xs text-slate-700">
                {c.usage.users} usu · {c.usage.clients} cli · {c.usage.products} prod · {c.usage.sales30d} vendas/30d
              </span>
            ),
            hideOnMobile: true,
          },
          { key: "last", header: "Último acesso", cell: (c) => (c.lastLoginAt ? formatDateTime(c.lastLoginAt) : "—"), hideOnMobile: true },
          {
            key: "actions",
            header: "Ações",
            cell: (c) => (
              <span className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs font-medium md:justify-start">
                <button type="button" disabled={busy} onClick={() => openPay(c)} className="text-primary-700 hover:underline">
                  Registrar pagamento
                </button>
                <button type="button" disabled={busy} onClick={() => void extendTrial(c)} className="text-slate-700 hover:underline">
                  + Teste
                </button>
                <button type="button" disabled={busy} onClick={() => void toggleExempt(c)} className="text-slate-700 hover:underline">
                  {c.billingExempt ? "Remover isenção" : "Isentar"}
                </button>
                <button type="button" onClick={() => void toggleHistory(c)} aria-expanded={history?.id === c.id} className="text-slate-700 hover:underline">
                  Pagamentos
                </button>
                {c.access.status === "SUSPENDED" ? (
                  <button type="button" disabled={busy} onClick={() => void reactivate(c)} className="text-emerald-700 hover:underline">
                    Reativar
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => void suspend(c)} className="text-red-700 hover:underline">
                    Suspender
                  </button>
                )}
              </span>
            ),
          },
        ]}
      />

      <Dialog
        open={paying !== null}
        title={paying ? `Registrar pagamento: ${paying.name}` : ""}
        description="Ativa ou renova o plano. Se ainda houver período pago, o novo período começa quando ele terminar."
        onClose={() => setPaying(null)}
      >
        <form onSubmit={(event) => void submitPay(event)} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pay-plan" className="mb-1 block text-sm text-slate-700">Plano</label>
            <select id="pay-plan" value={payForm.planId} onChange={(e) => setPayForm((f) => ({ ...f, planId: e.target.value }))} className={inputClass}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pay-cycle" className="mb-1 block text-sm text-slate-700">Ciclo</label>
            <select id="pay-cycle" value={payForm.cycle} onChange={(e) => setPayForm((f) => ({ ...f, cycle: e.target.value as BillingCycle }))} className={inputClass}>
              <option value="MONTHLY">Mensal</option>
              <option value="YEARLY" disabled={!selectedPlan?.priceYearly}>Anual</option>
            </select>
          </div>
          <div>
            <label htmlFor="pay-method" className="mb-1 block text-sm text-slate-700">Forma de pagamento</label>
            <select id="pay-method" value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value as PlatformPaymentMethod }))} className={inputClass}>
              {Object.entries(platformPaymentMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pay-amount" className="mb-1 block text-sm text-slate-700">Valor recebido (R$)</label>
            <input
              id="pay-amount"
              inputMode="decimal"
              value={payForm.amount}
              placeholder={defaultAmount ? `${defaultAmount} (preço do plano)` : ""}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pay-note" className="mb-1 block text-sm text-slate-700">Observação</label>
            <input id="pay-note" value={payForm.note} maxLength={500} placeholder="Ex.: Pix recebido em 18/10, desconto de lançamento" onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setPaying(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Voltar
            </button>
            <button type="submit" disabled={busy || !payForm.planId} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
              Registrar e ativar
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
