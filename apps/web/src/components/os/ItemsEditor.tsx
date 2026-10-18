"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatBrl } from "../../lib/format";
import type { Paginated, ProductDto, ServiceDto } from "../../lib/types";

/**
 * Editor de itens da OS (Fase 2 · 2.3). Serviço/produto usam o preço do
 * catálogo (o servidor recalcula); item livre (ex.: mão de obra) tem preço
 * informado. Os valores exibidos aqui são só prévia.
 */

export type ItemKind = "SERVICE" | "PRODUCT" | "FREE";

export interface EditableItem {
  key: string;
  kind: ItemKind;
  refId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export function newItem(kind: ItemKind = "SERVICE"): EditableItem {
  return { key: Math.random().toString(36).slice(2), kind, refId: "", description: "", quantity: "1", unitPrice: "" };
}

export function toPayload(items: EditableItem[]) {
  return items.map((item) => ({
    serviceId: item.kind === "SERVICE" ? item.refId || null : null,
    productId: item.kind === "PRODUCT" ? item.refId || null : null,
    description: item.kind === "FREE" ? item.description.trim() : item.description.trim() || null,
    quantity: item.quantity.trim().replace(",", ".") || "1",
    unitPrice: item.kind === "FREE" ? item.unitPrice.trim().replace(",", ".") || null : null,
  }));
}

export function ItemsEditor({ items, onChange }: { items: EditableItem[]; onChange: (items: EditableItem[]) => void }) {
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);

  useEffect(() => {
    api<Paginated<ServiceDto>>("/api/services?status=ACTIVE&pageSize=100", { redirectOnUnauthorized: false })
      .then((d) => setServices(d.items))
      .catch(() => setServices([]));
    api<Paginated<ProductDto>>("/api/products?status=ACTIVE&pageSize=100", { redirectOnUnauthorized: false })
      .then((d) => setProducts(d.items))
      .catch(() => setProducts([]));
  }, []);

  function update(key: string, patch: Partial<EditableItem>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function priceOf(item: EditableItem): number {
    if (item.kind === "SERVICE") return Number(services.find((s) => s.id === item.refId)?.price ?? 0);
    if (item.kind === "PRODUCT") return Number(products.find((p) => p.id === item.refId)?.salePrice ?? 0);
    return Number(item.unitPrice.replace(",", ".") || 0);
  }

  const inputClass = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none";
  const subtotal = items.reduce((acc, item) => acc + priceOf(item) * Number(item.quantity.replace(",", ".") || 0), 0);

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.key} className="grid items-end gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-12">
          <div className="sm:col-span-2">
            <label htmlFor={`kind-${item.key}`} className="mb-1 block text-xs text-slate-600">Tipo</label>
            <select id={`kind-${item.key}`} value={item.kind} onChange={(e) => update(item.key, { kind: e.target.value as ItemKind, refId: "" })} className={inputClass}>
              <option value="SERVICE">Serviço</option>
              <option value="PRODUCT">Produto/peça</option>
              <option value="FREE">Item livre</option>
            </select>
          </div>
          <div className="sm:col-span-5">
            {item.kind === "FREE" ? (
              <>
                <label htmlFor={`desc-${item.key}`} className="mb-1 block text-xs text-slate-600">Descrição</label>
                <input id={`desc-${item.key}`} value={item.description} onChange={(e) => update(item.key, { description: e.target.value })} placeholder="Mão de obra, peça avulsa…" className={inputClass} />
              </>
            ) : (
              <>
                <label htmlFor={`ref-${item.key}`} className="mb-1 block text-xs text-slate-600">{item.kind === "SERVICE" ? "Serviço" : "Produto"}</label>
                <select id={`ref-${item.key}`} value={item.refId} onChange={(e) => update(item.key, { refId: e.target.value })} className={inputClass}>
                  <option value="">Selecione…</option>
                  {(item.kind === "SERVICE" ? services : products).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} — {formatBrl("price" in option ? option.price : option.salePrice)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`qty-${item.key}`} className="mb-1 block text-xs text-slate-600">Qtd.</label>
            <input id={`qty-${item.key}`} inputMode="decimal" value={item.quantity} onChange={(e) => update(item.key, { quantity: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`price-${item.key}`} className="mb-1 block text-xs text-slate-600">Valor unit.</label>
            {item.kind === "FREE" ? (
              <input id={`price-${item.key}`} inputMode="decimal" value={item.unitPrice} onChange={(e) => update(item.key, { unitPrice: e.target.value })} placeholder="0,00" className={inputClass} />
            ) : (
              <p id={`price-${item.key}`} className="py-1.5 text-sm text-slate-700">{formatBrl(priceOf(item))}</p>
            )}
          </div>
          <div className="sm:col-span-1">
            <button type="button" onClick={() => onChange(items.filter((i) => i.key !== item.key))} className="text-xs font-medium text-red-700 hover:underline" aria-label={`Remover item ${index + 1}`}>
              Remover
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => onChange([...items, newItem()])} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          + Adicionar item
        </button>
        <p className="text-sm text-slate-700">Prévia do subtotal: <strong>{formatBrl(subtotal)}</strong></p>
      </div>
    </div>
  );
}
