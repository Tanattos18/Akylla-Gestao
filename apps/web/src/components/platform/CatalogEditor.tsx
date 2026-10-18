"use client";

import { useState, type FormEvent } from "react";
import type { BusinessModule, ModuleOfferDto } from "@petflow/shared";
import { api } from "../../lib/api";
import type { TenantPlanDto } from "../../lib/types";
import { useToast } from "../ui/Toast";
import { ModulePicker } from "./ModulePicker";

export interface PlatformCatalog {
  plans: TenantPlanDto[];
  modules: ModuleOfferDto[];
}

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";
const money = (value: string) => value.trim().replace(",", ".");
const limit = (value: string) => (value.trim() === "" ? null : Number(value));

/**
 * Catálogo (Fase 8b): o dono edita preço, módulos incluídos e limites de cada
 * kit, e o preço de cada módulo avulso. Vale para novas cobranças; o acesso
 * de quem já tem o kit muda na hora quando os módulos do kit mudam.
 * (Cada cartão é remontado — `key` com os valores — quando o catálogo volta.)
 */
export function CatalogEditor({ catalog, onChange }: { catalog: PlatformCatalog; onChange: (catalog: PlatformCatalog) => void }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="catalog-kits" className="space-y-3">
        <h3 id="catalog-kits" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Kits
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {catalog.plans.map((plan) => (
            <PlanCard key={JSON.stringify(plan)} plan={plan} offers={catalog.modules} onSaved={onChange} />
          ))}
        </div>
      </section>
      <section aria-labelledby="catalog-modules" className="space-y-3">
        <h3 id="catalog-modules" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Módulos avulsos (preço mensal; no anual o cliente paga 10×)
        </h3>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm">
          {catalog.modules.map((offer) => (
            <ModuleRow key={JSON.stringify(offer)} offer={offer} onSaved={onChange} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PlanCard({ plan, offers, onSaved }: { plan: TenantPlanDto; offers: ModuleOfferDto[]; onSaved: (c: PlatformCatalog) => void }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    description: plan.description ?? "",
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly ?? "",
    userLimit: plan.userLimit?.toString() ?? "",
    clientLimit: plan.clientLimit?.toString() ?? "",
    productLimit: plan.productLimit?.toString() ?? "",
    includedModules: plan.includedModules as BusinessModule[],
  }));
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const catalog = await api<PlatformCatalog>(`/api/platform/plans/${plan.id}`, {
        method: "PUT",
        body: JSON.stringify({
          description: form.description,
          priceMonthly: money(form.priceMonthly),
          priceYearly: form.priceYearly.trim() ? money(form.priceYearly) : null,
          includedModules: form.includedModules,
          userLimit: limit(form.userLimit),
          clientLimit: limit(form.clientLimit),
          productLimit: limit(form.productLimit),
        }),
      });
      onSaved(catalog);
      toast.success(`Kit ${plan.name} salvo.`);
    } catch (err) {
      toast.error(err, "Não foi possível salvar o kit.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: "priceMonthly" | "priceYearly" | "userLimit" | "clientLimit" | "productLimit", label: string, hint?: string) => (
    <div>
      <label htmlFor={`${plan.id}-${key}`} className="mb-1 block text-xs text-slate-700">
        {label}
      </label>
      <input
        id={`${plan.id}-${key}`}
        inputMode={key.startsWith("price") ? "decimal" : "numeric"}
        value={form[key]}
        placeholder={hint}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={inputClass}
      />
    </div>
  );

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="font-medium text-slate-900">
        {plan.name}
        {!plan.active && <span className="ml-2 text-xs text-slate-500">(inativo)</span>}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {field("priceMonthly", "Mensal (R$)")}
        {field("priceYearly", "Anual (R$)", "sem anual")}
        {field("userLimit", "Usuários", "ilimitado")}
        {field("clientLimit", "Clientes", "ilimitado")}
        {field("productLimit", "Produtos", "ilimitado")}
      </div>
      <div>
        <label htmlFor={`${plan.id}-description`} className="mb-1 block text-xs text-slate-700">
          Descrição
        </label>
        <textarea
          id={`${plan.id}-description`}
          rows={2}
          maxLength={500}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={inputClass}
        />
      </div>
      <ModulePicker
        idPrefix={`kit-${plan.id}`}
        legend="Módulos incluídos no kit"
        offers={offers}
        value={form.includedModules}
        onChange={(includedModules) => setForm((f) => ({ ...f, includedModules }))}
      />
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar kit"}
        </button>
      </div>
    </form>
  );
}

function ModuleRow({ offer, onSaved }: { offer: ModuleOfferDto; onSaved: (c: PlatformCatalog) => void }) {
  const toast = useToast();
  const [price, setPrice] = useState(offer.priceMonthly);
  const [active, setActive] = useState(offer.active);
  const [saving, setSaving] = useState(false);
  const dirty = money(price) !== offer.priceMonthly || active !== offer.active;

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const catalog = await api<PlatformCatalog>(`/api/platform/modules/${offer.module}`, {
        method: "PUT",
        body: JSON.stringify({ priceMonthly: money(price), active }),
      });
      onSaved(catalog);
      toast.success(`${offer.label} salvo.`);
    } catch (err) {
      toast.error(err, "Não foi possível salvar o módulo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li>
      <form onSubmit={(event) => void save(event)} className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-48 flex-1">
          <p className="text-sm font-medium text-slate-900">{offer.label}</p>
          <p className="text-xs text-slate-500">{offer.description}</p>
        </div>
        <div className="w-28">
          <label htmlFor={`offer-${offer.module}`} className="sr-only">
            Preço mensal de {offer.label}
          </label>
          <input id={`offer-${offer.module}`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </div>
        <label className="flex items-center gap-1 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          À venda
        </label>
        <button
          type="submit"
          disabled={saving || !dirty}
          className="rounded-md border border-primary-600 px-3 py-1.5 text-sm font-medium text-primary-800 hover:bg-primary-50 disabled:opacity-50"
        >
          Salvar
        </button>
      </form>
    </li>
  );
}
