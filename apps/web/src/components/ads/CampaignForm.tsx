"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import {
  adObjectiveLabels,
  adPlatformLabels,
  type AdAccountDto,
  type AdCampaignDto,
  type AdObjective,
  type AdPlatform,
  type ClientDto,
  type DeliveryDto,
  type Paginated,
  type SubscriptionDto,
} from "../../lib/types";
import { SearchSelect } from "../ui/SearchSelect";

const PLATFORMS = Object.keys(adPlatformLabels) as AdPlatform[];
const OBJECTIVES = Object.keys(adObjectiveLabels) as AdObjective[];

function initialForm(campaign?: AdCampaignDto | null, clientId?: string) {
  return {
    clientId: campaign?.clientId ?? clientId ?? "",
    platform: campaign?.platform ?? ("META" as AdPlatform),
    objective: campaign?.objective ?? ("MESSAGES" as AdObjective),
    name: campaign?.name ?? "",
    deliveryId: campaign?.deliveryId ?? "",
    promotedItem: campaign?.promotedItem ?? "",
    targetUrl: campaign?.targetUrl ?? "",
    adAccountId: campaign?.adAccountId ?? "",
    subscriptionId: campaign?.subscriptionId ?? "",
    audienceNotes: campaign?.audienceNotes ?? "",
    dailyBudget: campaign?.dailyBudget?.replace(".", ",") ?? "",
    totalBudget: campaign?.totalBudget?.replace(".", ",") ?? "",
    startAt: campaign?.startAt ?? "",
    endAt: campaign?.endAt ?? "",
    notes: campaign?.notes ?? "",
  };
}

/**
 * Nova campanha / editar: cliente → o que promover (entrega ou texto livre)
 * → plataforma e objetivo → verba de referência e datas. O código UTM é
 * gerado pelo servidor ao criar.
 */
export function CampaignForm({
  campaign,
  clientId,
  clientName,
  onSaved,
  onCancel,
}: {
  campaign?: AdCampaignDto | null;
  clientId?: string;
  clientName?: string;
  onSaved: (saved: AdCampaignDto) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(() => initialForm(campaign, clientId));
  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [accounts, setAccounts] = useState<AdAccountDto[]>([]);
  const [contracts, setContracts] = useState<SubscriptionDto[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.clientId) {
      setDeliveries([]);
      setContracts([]);
      return;
    }
    api<Paginated<DeliveryDto>>(`/api/deliveries?clientId=${form.clientId}&pageSize=100`)
      .then((data) => setDeliveries(data.items))
      .catch(() => setDeliveries([]));
    api<Paginated<SubscriptionDto>>(`/api/subscriptions?clientId=${form.clientId}&pageSize=100`, { redirectOnUnauthorized: false })
      .then((data) => setContracts(data.items))
      .catch(() => setContracts([]));
  }, [form.clientId]);

  useEffect(() => {
    if (!form.clientId) {
      setAccounts([]);
      return;
    }
    api<AdAccountDto[]>(`/api/ads/accounts?clientId=${form.clientId}&platform=${form.platform}`)
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [form.clientId, form.platform]);

  function pickDelivery(deliveryId: string) {
    const delivery = deliveries.find((d) => d.id === deliveryId);
    setForm((current) => ({
      ...current,
      deliveryId,
      promotedItem: current.promotedItem || delivery?.name || "",
      targetUrl: current.targetUrl || delivery?.siteUrl || "",
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!form.clientId) {
      setFieldErrors({ clientId: "Escolha o cliente" });
      return;
    }
    if (form.name.trim().length < 2) {
      setFieldErrors({ name: "Nome deve ter ao menos 2 caracteres" });
      return;
    }
    setSaving(true);
    const fields = {
      objective: form.objective,
      name: form.name.trim(),
      deliveryId: form.deliveryId || null,
      promotedItem: form.promotedItem.trim() || null,
      targetUrl: form.targetUrl.trim(),
      adAccountId: form.adAccountId || null,
      subscriptionId: form.subscriptionId || null,
      audienceNotes: form.audienceNotes.trim() || null,
      dailyBudget: form.dailyBudget.trim() || null,
      totalBudget: form.totalBudget.trim() || null,
      startAt: form.startAt,
      endAt: form.endAt,
      notes: form.notes.trim() || null,
    };
    try {
      const saved = campaign
        ? await api<AdCampaignDto>(`/api/ads/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify(fields) })
        : await api<AdCampaignDto>("/api/ads/campaigns", {
            method: "POST",
            body: JSON.stringify({ clientId: form.clientId, platform: form.platform, ...fields }),
          });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setError(err.message);
      } else {
        setError("Não foi possível salvar a campanha.");
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";
  const fieldError = (name: string) => fieldErrors[name] && <p className="mt-1 text-xs text-red-700">{fieldErrors[name]}</p>;

  function text(name: keyof typeof form, label: string, placeholder?: string, type = "text", hint?: string) {
    return (
      <div>
        <label htmlFor={`campaign-${name}`} className="mb-1 block text-sm text-slate-700">{label}</label>
        <input
          id={`campaign-${name}`}
          type={type}
          inputMode={name === "dailyBudget" || name === "totalBudget" ? "decimal" : undefined}
          value={String(form[name])}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          placeholder={placeholder}
          className={inputClass}
        />
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        {fieldError(name)}
      </div>
    );
  }

  const fixedClient = Boolean(campaign || clientId);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="campaign-client" className="mb-1 block text-sm text-slate-700">Cliente *</label>
        {fixedClient ? (
          <p id="campaign-client" className="py-2 text-sm font-medium text-slate-800">
            {campaign?.client.name ?? clientName ?? "Cliente selecionado"}
          </p>
        ) : (
          <SearchSelect<ClientDto>
            id="campaign-client"
            endpoint="/api/clients?status=ACTIVE"
            value={form.clientId}
            onChange={(id) => setForm({ ...form, clientId: id, deliveryId: "", adAccountId: "", subscriptionId: "" })}
            placeholder="Digite o nome do cliente"
            invalid={Boolean(fieldErrors.clientId)}
          />
        )}
        {fieldError("clientId")}
      </div>
      {text("name", "Nome da campanha *", "Promoção corte + barba — outubro")}

      <div>
        <label htmlFor="campaign-delivery" className="mb-1 block text-sm text-slate-700">O que promover (entrega)</label>
        <select id="campaign-delivery" value={form.deliveryId} onChange={(e) => pickDelivery(e.target.value)} className={inputClass} disabled={!form.clientId}>
          <option value="">Nenhuma — descrever abaixo</option>
          {deliveries.map((delivery) => (
            <option key={delivery.id} value={delivery.id}>{delivery.name}</option>
          ))}
        </select>
      </div>
      {text("promotedItem", "Item anunciado", "Corte + barba, loja de roupas, perfil @...", "text", "Vazio com entrega escolhida usa o nome da entrega.")}

      <div>
        <label htmlFor="campaign-platform" className="mb-1 block text-sm text-slate-700">Plataforma *</label>
        <select
          id="campaign-platform"
          value={form.platform}
          disabled={Boolean(campaign)}
          onChange={(e) => setForm({ ...form, platform: e.target.value as AdPlatform, adAccountId: "" })}
          className={inputClass}
        >
          {PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>{adPlatformLabels[platform]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="campaign-objective" className="mb-1 block text-sm text-slate-700">Objetivo *</label>
        <select id="campaign-objective" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value as AdObjective })} className={inputClass}>
          {OBJECTIVES.map((objective) => (
            <option key={objective} value={objective}>{adObjectiveLabels[objective]}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="campaign-account" className="mb-1 block text-sm text-slate-700">Conta de anúncio do cliente</label>
        <select id="campaign-account" value={form.adAccountId} onChange={(e) => setForm({ ...form, adAccountId: e.target.value })} className={inputClass} disabled={!form.clientId}>
          <option value="">Sem conta cadastrada</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}{account.externalAccountId ? ` (${account.externalAccountId})` : ""}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="campaign-contract" className="mb-1 block text-sm text-slate-700">Contrato de gestão</label>
        <select id="campaign-contract" value={form.subscriptionId} onChange={(e) => setForm({ ...form, subscriptionId: e.target.value })} className={inputClass} disabled={!form.clientId}>
          <option value="">Sem contrato vinculado</option>
          {contracts.map((contract) => (
            <option key={contract.id} value={contract.id}>{contract.plan.name}</option>
          ))}
        </select>
      </div>

      {text("targetUrl", "URL de destino", "https://")}
      <div>
        <label htmlFor="campaign-audienceNotes" className="mb-1 block text-sm text-slate-700">Público</label>
        <input
          id="campaign-audienceNotes"
          value={form.audienceNotes}
          onChange={(e) => setForm({ ...form, audienceNotes: e.target.value })}
          placeholder="Cidade, raio, idade, interesses"
          className={inputClass}
        />
      </div>
      {text("dailyBudget", "Verba diária do cliente (R$)", "30,00", "text", "Só referência: o cliente paga direto à plataforma.")}
      {text("totalBudget", "Verba total do cliente (R$)", "900,00")}
      {text("startAt", "Início", undefined, "date")}
      {text("endAt", "Fim", undefined, "date")}
      <div className="sm:col-span-2">
        <label htmlFor="campaign-notes" className="mb-1 block text-sm text-slate-700">Observações</label>
        <textarea id="campaign-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={saving} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
          {saving ? "Salvando..." : campaign ? "Salvar" : "Criar campanha"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
