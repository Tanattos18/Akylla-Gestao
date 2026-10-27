import { billingStateLabels, type BillingState, type BillingStatusDto } from "../../lib/types";

const tone: Record<BillingState, string> = {
  EM_DIA: "bg-emerald-50 text-emerald-800",
  VENCE_EM: "bg-sky-50 text-sky-800",
  VENCIDO: "bg-amber-50 text-amber-800",
  EM_DEBITO: "bg-red-50 text-red-700",
  EM_ACORDO: "bg-violet-50 text-violet-800",
  PAUSADO: "bg-slate-200 text-slate-800",
  INATIVO: "bg-slate-100 text-slate-600",
};

function detail(billing: BillingStatusDto): string | null {
  const days = billing.daysToDue;
  if (billing.state === "VENCE_EM" && days !== null) {
    return days === 0 ? "vence hoje" : days === 1 ? "vence amanhã" : `vence em ${days} dias`;
  }
  if ((billing.state === "VENCIDO" || billing.state === "EM_DEBITO") && days !== null && days < 0) {
    return `${-days} dia(s) de atraso${billing.agreementBroken ? " · acordo descumprido" : ""}`;
  }
  if (billing.state === "EM_ACORDO" && billing.graceUntil) {
    return `prazo até ${new Date(billing.graceUntil).toLocaleDateString("pt-BR")}`;
  }
  return null;
}

/** Etiqueta da situação de cobrança (calculada no servidor). */
export function BillingBadge({ billing, showDetail = true }: { billing: BillingStatusDto | null | undefined; showDetail?: boolean }) {
  if (!billing) return <span className="text-xs text-slate-400">Sem contrato</span>;
  const extra = showDetail ? detail(billing) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[billing.state]}`}>{billingStateLabels[billing.state]}</span>
      {extra && <span className="text-xs text-slate-500">{extra}</span>}
    </span>
  );
}

export const BILLING_FILTER_OPTIONS: BillingState[] = ["EM_DEBITO", "VENCIDO", "EM_ACORDO", "VENCE_EM", "PAUSADO", "INATIVO", "EM_DIA"];
