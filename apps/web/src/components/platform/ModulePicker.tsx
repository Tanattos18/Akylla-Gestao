"use client";

import { businessModuleLabels, type BusinessModule, type ModuleOfferDto } from "@petflow/shared";
import { formatBrl } from "../../lib/format";

/**
 * Lista de módulos com caixas de seleção (Fase 8b). Módulos em `locked`
 * (já incluídos no kit) aparecem marcados e desabilitados.
 */
export function ModulePicker({
  idPrefix,
  legend,
  offers,
  value,
  locked = [],
  onChange,
}: {
  idPrefix: string;
  legend: string;
  offers: ModuleOfferDto[];
  value: readonly BusinessModule[];
  locked?: readonly BusinessModule[];
  onChange: (modules: BusinessModule[]) => void;
}) {
  const selected = new Set(value);
  const lockedSet = new Set(locked);

  function toggle(module: BusinessModule) {
    const next = new Set(selected);
    if (next.has(module)) next.delete(module);
    else next.add(module);
    onChange(offers.map((o) => o.module).filter((m) => next.has(m)));
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm text-slate-700">{legend}</legend>
      <ul className="grid gap-1 sm:grid-cols-2">
        {offers.map((offer) => {
          const id = `${idPrefix}-${offer.module}`;
          const inKit = lockedSet.has(offer.module);
          return (
            <li key={offer.module} className="flex items-center gap-2 text-sm">
              <input
                id={id}
                type="checkbox"
                checked={inKit || selected.has(offer.module)}
                disabled={inKit}
                onChange={() => toggle(offer.module)}
              />
              <label htmlFor={id} className={inKit ? "text-slate-500" : "text-slate-800"}>
                {businessModuleLabels[offer.module]}{" "}
                <span className="text-xs text-slate-500">
                  {inKit ? "(no kit)" : `${formatBrl(offer.priceMonthly)}/mês${offer.active ? "" : " · fora de venda"}`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
