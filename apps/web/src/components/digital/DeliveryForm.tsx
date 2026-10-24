"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import {
  deliveryStatusLabels,
  digitalProductTypeLabels,
  type ClientDto,
  type DeliveryDto,
  type DeliveryStatus,
  type DigitalProductDto,
  type DigitalProductType,
  type Paginated,
} from "../../lib/types";
import { SearchSelect } from "../ui/SearchSelect";

const TYPES = Object.keys(digitalProductTypeLabels) as DigitalProductType[];
const STATUSES = Object.keys(deliveryStatusLabels) as DeliveryStatus[];

function initialForm(delivery?: DeliveryDto | null, clientId?: string) {
  return {
    clientId: delivery?.clientId ?? clientId ?? "",
    productId: delivery?.productId ?? "",
    name: delivery?.name ?? "",
    type: delivery?.type ?? ("SITE" as DigitalProductType),
    siteUrl: delivery?.siteUrl ?? "",
    adminUrl: delivery?.adminUrl ?? "",
    repositoryUrl: delivery?.repositoryUrl ?? "",
    domain: delivery?.domain ?? "",
    domainRenewalAt: delivery?.domainRenewalAt ?? "",
    hostingProvider: delivery?.hostingProvider ?? "",
    hostingRenewalAt: delivery?.hostingRenewalAt ?? "",
    notes: delivery?.notes ?? "",
    status: delivery?.status ?? ("ACTIVE" as DeliveryStatus),
    neverPause: delivery?.neverPause ?? false,
  };
}

/** Formulário de entrega (criar e editar). Campos vazios são gravados como vazio. */
export function DeliveryForm({
  delivery,
  clientId,
  clientName,
  onSaved,
  onCancel,
}: {
  delivery?: DeliveryDto | null;
  /** Cliente fixo (ex.: aberto pela ficha do cliente). */
  clientId?: string;
  clientName?: string;
  onSaved: (saved: DeliveryDto) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(() => initialForm(delivery, clientId));
  const [products, setProducts] = useState<DigitalProductDto[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Paginated<DigitalProductDto>>("/api/digital-products?status=ACTIVE&pageSize=100")
      .then((data) => setProducts(data.items))
      .catch(() => setProducts([]));
  }, []);

  function pickProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    setForm((current) => ({
      ...current,
      productId,
      type: product?.type ?? current.type,
      name: current.name || product?.name || "",
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
      name: form.name.trim(),
      type: form.type,
      productId: form.productId || null,
      siteUrl: form.siteUrl.trim(),
      adminUrl: form.adminUrl.trim(),
      repositoryUrl: form.repositoryUrl.trim(),
      domain: form.domain.trim(),
      domainRenewalAt: form.domainRenewalAt,
      hostingProvider: form.hostingProvider.trim(),
      hostingRenewalAt: form.hostingRenewalAt,
      notes: form.notes.trim(),
      status: form.status,
      neverPause: form.neverPause,
    };
    try {
      const saved = delivery
        ? await api<DeliveryDto>(`/api/deliveries/${delivery.id}`, { method: "PATCH", body: JSON.stringify(fields) })
        : await api<DeliveryDto>("/api/deliveries", {
            method: "POST",
            body: JSON.stringify({ clientId: form.clientId, ...fields }),
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
        setError("Não foi possível salvar a entrega.");
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  function text(name: keyof typeof form, label: string, placeholder?: string, type = "text") {
    return (
      <div>
        <label htmlFor={`delivery-${name}`} className="mb-1 block text-sm text-slate-700">{label}</label>
        <input
          id={`delivery-${name}`}
          type={type}
          value={String(form[name])}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          placeholder={placeholder}
          className={inputClass}
        />
        {fieldErrors[name] && <p className="mt-1 text-xs text-red-700">{fieldErrors[name]}</p>}
      </div>
    );
  }

  const fixedClient = Boolean(delivery || clientId);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="delivery-client" className="mb-1 block text-sm text-slate-700">Cliente *</label>
        {fixedClient ? (
          <p id="delivery-client" className="py-2 text-sm font-medium text-slate-800">
            {delivery?.client.name ?? clientName ?? "Cliente selecionado"}
          </p>
        ) : (
          <SearchSelect<ClientDto>
            id="delivery-client"
            endpoint="/api/clients?status=ACTIVE"
            value={form.clientId}
            onChange={(id) => setForm({ ...form, clientId: id })}
            placeholder="Digite o nome do cliente"
            invalid={Boolean(fieldErrors.clientId)}
          />
        )}
        {fieldErrors.clientId && <p className="mt-1 text-xs text-red-700">{fieldErrors.clientId}</p>}
      </div>
      <div>
        <label htmlFor="delivery-product" className="mb-1 block text-sm text-slate-700">Produto do catálogo</label>
        <select id="delivery-product" value={form.productId} onChange={(e) => pickProduct(e.target.value)} className={inputClass}>
          <option value="">Sem vínculo com o catálogo</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.name}</option>
          ))}
        </select>
      </div>
      {text("name", "Nome da entrega *", "Site da Ana")}
      <div>
        <label htmlFor="delivery-type" className="mb-1 block text-sm text-slate-700">Tipo *</label>
        <select id="delivery-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DigitalProductType })} className={inputClass}>
          {TYPES.map((type) => (
            <option key={type} value={type}>{digitalProductTypeLabels[type]}</option>
          ))}
        </select>
      </div>
      {text("siteUrl", "URL do site", "https://")}
      {text("adminUrl", "URL do admin", "https://")}
      {text("repositoryUrl", "Repositório Git", "https://github.com/...")}
      {text("domain", "Domínio", "exemplo.com.br")}
      {text("domainRenewalAt", "Renovação do domínio", undefined, "date")}
      {text("hostingProvider", "Hospedagem (onde)", "Hostinger, Vercel, GitHub Pages...")}
      {text("hostingRenewalAt", "Renovação da hospedagem", undefined, "date")}
      <div>
        <label htmlFor="delivery-status" className="mb-1 block text-sm text-slate-700">Status</label>
        <select id="delivery-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DeliveryStatus })} className={inputClass}>
          {STATUSES.map((status) => (
            <option key={status} value={status} disabled={status === "PAUSED" && form.neverPause}>
              {deliveryStatusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="delivery-notes" className="mb-1 block text-sm text-slate-700">Observações</label>
        <textarea id="delivery-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          checked={form.neverPause}
          onChange={(e) => setForm({ ...form, neverPause: e.target.checked, status: e.target.checked && form.status === "PAUSED" ? "ACTIVE" : form.status })}
          className="mt-0.5"
        />
        <span>
          <strong className="font-medium">Nunca pausar</strong> — produtos próprios e clientes estratégicos ficam
          fora de qualquer pausa por atraso.
        </span>
      </label>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={saving} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
          {saving ? "Salvando..." : delivery ? "Salvar" : "Criar entrega"}
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
