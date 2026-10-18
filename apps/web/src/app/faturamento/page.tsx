"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import { formatBrl, formatDate } from "../../lib/format";
import {
  tenantSubscriptionStatusLabels,
  type PlanUsageDto,
  type TenantPlanDto,
  type TenantSubscriptionDto,
} from "../../lib/types";
import { useDialog } from "../../components/ui/Dialog";

interface PlansResponse {
  items: TenantPlanDto[];
}

export default function FaturamentoPage() {
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<TenantPlanDto[]>([]);
  const [subscription, setSubscription] = useState<TenantSubscriptionDto | null>(null);
  const [planUsage, setPlanUsage] = useState<PlanUsageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";

  const load = useCallback(async () => {
    try {
      const plansData = await api<PlansResponse>("/api/billing/plans");
      setPlans(plansData.items);
      try {
        const sub = await api<TenantSubscriptionDto>("/api/billing/subscription");
        setSubscription(sub);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setSubscription(null);
        } else {
          throw err;
        }
      }
      const usage = await api<PlanUsageDto>("/api/billing/usage");
      setPlanUsage(usage);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar o faturamento.");
    }
  }, []);

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

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function handleChoose(plan: TenantPlanDto) {
    if (!await dialog.confirm(`Assinar o plano "${plan.name}" por ${formatBrl(plan.priceMonthly)}?`)) {
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await api("/api/billing/subscription", {
        method: "PUT",
        body: JSON.stringify({ planId: plan.id }),
      });
      setNotice(subscription ? "Plano atualizado." : "Assinatura criada.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao assinar o plano.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRenew() {
    if (!await dialog.confirm("Renovar a assinatura no Akylla Gestão (inicia novo período)?")) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await api("/api/billing/subscription/renew", { method: "POST" });
      setNotice("Assinatura renovada.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao renovar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const reason = await dialog.prompt({ title: "Cancelar assinatura do Akylla", label: "Motivo do cancelamento (opcional)", optional: true, maxLength: 500, danger: true, confirmLabel: "Cancelar assinatura" });
    if (reason === null) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await api("/api/billing/subscription/cancel", {
        method: "POST",
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setNotice("Assinatura do Akylla Gestão cancelada.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Faturamento do Akylla Gestão</h2>
          <p className="text-sm text-slate-500">
            Assinatura da sua empresa no SaaS · {session.company.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/assinaturas"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Assinaturas de clientes
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Situação atual
        </h3>
        {subscription ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Plano</p>
              <p className="text-sm font-medium text-slate-800">
                {subscription.plan.name} · {formatBrl(subscription.plan.priceMonthly)}/mês
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Status</p>
              <span
                className={
                  subscription.status === "ACTIVE"
                    ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                }
              >
                {tenantSubscriptionStatusLabels[subscription.status]}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Período atual</p>
              <p className="text-sm text-slate-800">
                {formatDate(subscription.currentPeriodStart)} —{" "}
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            {subscription.cancelReason && (
              <div>
                <p className="text-xs uppercase text-slate-500">Motivo do cancelamento</p>
                <p className="text-sm text-slate-800">{subscription.cancelReason}</p>
              </div>
            )}
            {isAdmin && (
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => void handleRenew()}
                  disabled={busy}
                  className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
                >
                  {busy ? "Processando..." : "Renovar"}
                </button>
                {subscription.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={() => void handleCancel()}
                    disabled={busy}
                    className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Nenhuma assinatura ativa para esta empresa. Escolha um plano abaixo.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Uso do plano
        </h3>
        {planUsage?.subscription ? (
          <div className="space-y-4">
            {(
              [
                { label: "Usuários", used: planUsage.usage.users, limit: planUsage.subscription.plan.userLimit },
                { label: "Clientes", used: planUsage.usage.clients, limit: planUsage.subscription.plan.clientLimit },
                { label: "Produtos", used: planUsage.usage.products, limit: planUsage.subscription.plan.productLimit },
              ] as { label: string; used: number; limit: number | null }[]
            ).map((row) => {
              const pct = row.limit === null ? 0 : Math.min(100, Math.round((row.used / row.limit) * 100));
              const bar = row.limit === null ? "bg-primary-500" : pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary-500";
              return (
                <div key={row.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{row.label}</span>
                    <span className="font-medium text-slate-800">
                      {row.used}
                      {row.limit === null ? " · ilimitado" : ` de ${row.limit}`}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-valuenow={row.limit === null ? undefined : row.used}
                    aria-valuemax={row.limit ?? undefined}
                    aria-label={`${row.label}: ${row.used}${row.limit === null ? ", ilimitado" : ` de ${row.limit}`}`}
                  >
                    <div className={`h-full rounded-full ${bar}`} style={{ width: row.limit === null ? "100%" : `${pct}%` }} />
                  </div>
                  {row.limit !== null && pct >= 80 && (
                    <p className="mt-1 text-xs text-amber-700">
                      {pct >= 100
                        ? `Limite de ${row.label.toLowerCase()} atingido no plano ${planUsage.subscription?.plan.name}.`
                        : `Você já usou ${pct}% do limite de ${row.label.toLowerCase()}.`}{" "}
                      <a href="#planos-disponiveis" className="font-medium underline">
                        Ver planos maiores
                      </a>
                    </p>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-slate-500">
              Limites aplicados apenas com assinatura ativa. Sem assinatura, expirada ou
              cancelada, nenhum bloqueio é aplicado.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Sem assinatura no momento — os limites do plano passam a valer quando
            a assinatura estiver ativa.
          </p>
        )}
      </div>

      <div>
        <h3 id="planos-disponiveis" className="mb-4 scroll-mt-24 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Planos disponíveis
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;
            return (
              <div
                key={plan.id}
                className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="font-medium text-slate-800">{plan.name}</h4>
                  {isCurrent && (
                    <span className="whitespace-nowrap rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                      Atual
                    </span>
                  )}
                </div>
                <p className="text-lg font-semibold text-slate-900">
                  {formatBrl(plan.priceMonthly)}
                  <span className="text-sm font-normal text-slate-500">/mês</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Período de {plan.durationDays} dias</p>
                {plan.description && (
                  <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                )}
                {isAdmin && !isCurrent && (
                  <button
                    type="button"
                    onClick={() => void handleChoose(plan)}
                    disabled={busy}
                    className="mt-4 rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
                  >
                    {busy ? "Salvando..." : subscription ? "Trocar plano" : "Assinar"}
                  </button>
                )}
              </div>
            );
          })}
          {plans.length === 0 && (
            <p className="text-sm text-slate-500">Nenhum plano disponível.</p>
          )}
        </div>
      </div>
    </div>
  );
}
