"use client";

import { useMemo, useState } from "react";
import { businessModuleLabels, computeComboPrice, type BusinessModule, type ModuleOfferDto } from "@petflow/shared";
import { formatBrl } from "../../lib/format";
import type { TenantPlanDto } from "../../lib/types";

/**
 * "Monte seu plano" (Fase 8b): o cliente escolhe um kit, soma módulos
 * avulsos e vê o total mensal/anual. A contratação segue pelo WhatsApp
 * (o dono libera no painel da plataforma).
 */
export function ComboBuilder({
  plans,
  offers,
  initialPlanId,
  initialExtras,
  contactLink,
}: {
  plans: TenantPlanDto[];
  offers: ModuleOfferDto[];
  initialPlanId?: string;
  initialExtras?: BusinessModule[];
  contactLink: (text: string) => string;
}) {
  const [planId, setPlanId] = useState(initialPlanId ?? plans[0]?.id ?? "");
  const [extras, setExtras] = useState<Set<BusinessModule>>(new Set(initialExtras ?? []));
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const plan = plans.find((p) => p.id === planId) ?? plans[0];

  const included = useMemo(() => new Set(plan?.includedModules ?? []), [plan]);
  const chosenExtras = [...extras].filter((module) => !included.has(module));
  const priceOf = (cycleValue: "MONTHLY" | "YEARLY") =>
    plan
      ? computeComboPrice({
          kit: { priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly, includedModules: plan.includedModules },
          extraModules: chosenExtras,
          offers,
          cycle: cycleValue,
        })
      : "0.00";
  const total = priceOf(cycle);

  if (!plan) return null;

  function toggle(module: BusinessModule) {
    setExtras((current) => {
      const next = new Set(current);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  const summary =
    `Olá! Quero contratar o Akylla Gestão: kit ${plan.name}` +
    (chosenExtras.length ? ` + ${chosenExtras.map((m) => businessModuleLabels[m]).join(", ")}` : "") +
    ` (${cycle === "YEARLY" ? "anual" : "mensal"}, ${formatBrl(total)}${cycle === "YEARLY" ? "/ano" : "/mês"}).`;

  return (
    <section
      id="monte-seu-plano"
      aria-labelledby="monte-seu-plano-titulo"
      className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h3 id="monte-seu-plano-titulo" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Monte seu plano
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Escolha um kit e some só os módulos de que precisa. Módulos que já vêm no kit não são cobrados de novo.
      </p>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-slate-800">1. Kit</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {plans.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm ${p.id === plan.id ? "border-primary-600 bg-primary-50" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="kit" value={p.id} checked={p.id === plan.id} onChange={() => setPlanId(p.id)} />
                <span className="font-medium text-slate-900">{p.name}</span>
              </span>
              <span className="mt-1 text-slate-700">{formatBrl(p.priceMonthly)}/mês</span>
              <span className="mt-1 text-xs text-slate-500">
                {p.includedModules.length
                  ? p.includedModules.map((m) => businessModuleLabels[m]).join(", ")
                  : "Só o núcleo (vendas, estoque, caixa, clientes, financeiro)"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-slate-800">2. Módulos avulsos</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {offers.map((offer) => {
            const inKit = included.has(offer.module);
            const id = `extra-${offer.module}`;
            return (
              <li key={offer.module} className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm">
                <input
                  id={id}
                  type="checkbox"
                  className="mt-0.5"
                  checked={inKit || extras.has(offer.module)}
                  disabled={inKit}
                  onChange={() => toggle(offer.module)}
                />
                <label htmlFor={id} className="flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900">{offer.label}</span>
                    <span className={inKit ? "text-xs font-medium text-emerald-700" : "text-slate-700"}>
                      {inKit ? "incluído no kit" : `+ ${formatBrl(offer.priceMonthly)}/mês`}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{offer.description}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md bg-slate-50 p-4">
        <div>
          <div role="radiogroup" aria-label="Ciclo de cobrança" className="mb-2 inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
            {(["MONTHLY", "YEARLY"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={cycle === value}
                onClick={() => setCycle(value)}
                className={`rounded px-3 py-1 ${cycle === value ? "bg-primary-700 text-white" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {value === "MONTHLY" ? "Mensal" : "Anual (2 meses grátis)"}
              </button>
            ))}
          </div>
          <p className="text-2xl font-semibold text-slate-900" aria-live="polite">
            {formatBrl(total)}
            <span className="text-sm font-normal text-slate-500">{cycle === "YEARLY" ? "/ano" : "/mês"}</span>
          </p>
          <p className="text-xs text-slate-500">
            {plan.name}
            {chosenExtras.length ? ` + ${chosenExtras.length} módulo(s) avulso(s)` : ""}
            {cycle === "MONTHLY" && ` · no anual: ${formatBrl(priceOf("YEARLY"))}/ano`}
          </p>
        </div>
        <a
          href={contactLink(summary)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
        >
          Contratar pelo WhatsApp
        </a>
      </div>
    </section>
  );
}
