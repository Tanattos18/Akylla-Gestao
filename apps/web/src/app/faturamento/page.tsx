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
import { accessStatusLabels, businessModuleLabels, type AccessSummaryDto, type ModuleOfferDto } from "@petflow/shared";
import { ComboBuilder } from "../../components/billing/ComboBuilder";
import { PixCard } from "../../components/billing/PixCard";

/** WhatsApp de vendas (Fase 8): contratação por proposta até o Mercado Pago entrar em produção */
const SALES_WHATSAPP = process.env.NEXT_PUBLIC_SALES_WHATSAPP || "5562981517002";

function salesLink(companyName: string, plan?: TenantPlanDto, cycle?: "MONTHLY" | "YEARLY"): string {
  const text = plan
    ? `Olá! Quero contratar o plano ${plan.name} (${cycle === "YEARLY" ? "anual" : "mensal"}) do Akylla Gestão para a empresa ${companyName}.`
    : `Olá! Quero regularizar a assinatura do Akylla Gestão da empresa ${companyName}.`;
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

const whatsappText = (text: string) => `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;

const accessBadge: Record<AccessSummaryDto["status"], string> = {
  EXEMPT: "bg-slate-100 text-slate-700",
  TRIAL: "bg-sky-50 text-sky-800",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  GRACE: "bg-amber-50 text-amber-800",
  READ_ONLY: "bg-red-50 text-red-800",
  SUSPENDED: "bg-red-50 text-red-800",
};

interface PlansResponse {
  items: TenantPlanDto[];
}

export default function FaturamentoPage() {
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<TenantPlanDto[]>([]);
  const [offers, setOffers] = useState<ModuleOfferDto[]>([]);
  const [subscription, setSubscription] = useState<TenantSubscriptionDto | null>(null);
  const [planUsage, setPlanUsage] = useState<PlanUsageDto | null>(null);
  const [access, setAccess] = useState<AccessSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";

  const load = useCallback(async () => {
    try {
      const plansData = await api<PlansResponse>("/api/billing/plans");
      setPlans(plansData.items);
      // Kits (Fase 8b): preço de cada módulo avulso
      setOffers((await api<{ items: ModuleOfferDto[] }>("/api/billing/modules")).items);
      // O uso já traz a assinatura (sem chamada extra que responde 404 quando não há plano)
      const usage = await api<PlanUsageDto>("/api/billing/usage");
      setPlanUsage(usage);
      setSubscription(usage.subscription);
      setAccess(await api<AccessSummaryDto>("/api/billing/access"));
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

  if (!isAdmin) {
    return (
      <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Acesso restrito: apenas administradores veem o faturamento da empresa.
      </p>
    );
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
        {access && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${accessBadge[access.status]}`}>
              {accessStatusLabels[access.status]}
            </span>
            <span className="text-slate-700">
              {access.status === "TRIAL" && `Teste grátis até ${formatDate(access.trialEndsAt!)} (${access.daysLeft} dia(s)).`}
              {access.status === "ACTIVE" && `Pago até ${formatDate(access.paidUntil!)}.`}
              {access.status === "GRACE" &&
                `Venceu. Você ainda pode usar tudo por ${access.daysLeft} dia(s); depois o sistema fica somente para consulta.`}
              {access.status === "READ_ONLY" &&
                "Somente leitura: você consulta tudo, mas não registra vendas nem cadastros até regularizar. Nenhum dado foi apagado."}
              {access.status === "EXEMPT" && "Empresa isenta de cobrança."}
            </span>
            {(access.status === "TRIAL" || access.status === "GRACE" || access.status === "READ_ONLY") && (
              <a
                href={salesLink(session.company.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800"
              >
                Contratar / regularizar
              </a>
            )}
            {(access.status === "GRACE" || access.status === "READ_ONLY") && (
              <a href="#pagar-com-pix" className="text-xs font-medium text-primary-700 hover:underline">
                Pagar com Pix
              </a>
            )}
          </div>
        )}
        {subscription ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Plano</p>
              <p className="text-sm font-medium text-slate-800">
                {subscription.plan.name} ·{" "}
                {subscription.billingCycle === "YEARLY"
                  ? `${formatBrl(subscription.plan.priceYearly)}/ano`
                  : `${formatBrl(subscription.plan.priceMonthly)}/mês`}
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
            <div className="sm:col-span-2">
              <p className="text-xs uppercase text-slate-500">Módulos contratados</p>
              <p className="text-sm text-slate-800">
                {[...subscription.plan.includedModules, ...(subscription.extraModules ?? [])]
                  .map((module) => businessModuleLabels[module])
                  .join(", ") || "Só o núcleo"}
                {subscription.extraModules?.length ? (
                  <span className="text-slate-500"> (avulsos: {subscription.extraModules.map((m) => businessModuleLabels[m]).join(", ")})</span>
                ) : null}
              </p>
              {access?.status === "TRIAL" && (
                <p className="mt-1 text-xs text-sky-800">Durante o teste grátis, todos os módulos ficam liberados.</p>
              )}
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
                <a
                  href={salesLink(session.company.name, subscription.plan, subscription.billingCycle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
                >
                  Renovar pelo WhatsApp
                </a>
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
            Nenhuma assinatura contratada. Escolha um plano abaixo e fale com a Akylla para contratar.
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
                {plan.priceYearly && (
                  <p className="mt-1 text-xs text-slate-600">
                    ou {formatBrl(plan.priceYearly)}/ano <span className="font-medium text-emerald-700">(2 meses grátis)</span>
                  </p>
                )}
                {plan.description && (
                  <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                )}
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {plan.includedModules.map((module) => (
                    <li key={module} className="flex gap-2">
                      <span aria-hidden="true" className="text-emerald-600">✓</span>
                      {businessModuleLabels[module]}
                    </li>
                  ))}
                  <li className="text-xs text-slate-500">
                    {[
                      plan.userLimit === null ? "usuários ilimitados" : `até ${plan.userLimit} usuário(s)`,
                      plan.clientLimit === null ? "clientes ilimitados" : `até ${plan.clientLimit} clientes`,
                      plan.productLimit === null ? "produtos ilimitados" : `até ${plan.productLimit} produtos`,
                    ].join(" · ")}
                  </li>
                </ul>
                {isAdmin && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <a
                      href={salesLink(session.company.name, plan, "MONTHLY")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
                    >
                      {isCurrent ? "Renovar mensal" : "Contratar mensal"}
                    </a>
                    {plan.priceYearly && (
                      <a
                        href={salesLink(session.company.name, plan, "YEARLY")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-primary-600 px-3 py-2 text-sm font-medium text-primary-800 hover:bg-primary-50"
                      >
                        Anual
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {plans.length === 0 && (
            <p className="text-sm text-slate-500">Nenhum plano disponível.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Todo kit inclui o núcleo: vendas/PDV, estoque, caixa, clientes, financeiro e relatórios.
        </p>
      </div>

      {plans.length > 0 && offers.length > 0 && (
        <ComboBuilder
          plans={plans}
          offers={offers}
          initialPlanId={subscription?.planId}
          initialExtras={subscription?.extraModules}
          contactLink={(text) => whatsappText(`${text} Empresa: ${session.company.name}.`)}
        />
      )}

      <PixCard
        receiptLink={whatsappText(
          `Olá! Paguei o Akylla Gestão por Pix para a empresa ${session.company.name}. Segue o comprovante.`,
        )}
      />
    </div>
  );
}
