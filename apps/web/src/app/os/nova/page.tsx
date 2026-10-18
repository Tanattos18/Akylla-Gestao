"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import type { ClientDto, Paginated, ProfessionalDto, ServiceOrderDto } from "../../../lib/types";
import { ItemsEditor, newItem, toPayload, type EditableItem } from "../../../components/os/ItemsEditor";

/** Fase 2 · 2.3 — abertura de ordem de serviço. */

export default function NovaOsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([]);
  const [clientId, setClientId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [items, setItems] = useState<EditableItem[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    api<Paginated<ClientDto>>("/api/clients?status=ACTIVE&pageSize=100").then((d) => setClients(d.items)).catch(() => setClients([]));
    api<Paginated<ProfessionalDto>>("/api/professionals?status=ACTIVE&pageSize=100", { redirectOnUnauthorized: false })
      .then((d) => setProfessionals(d.items))
      .catch(() => setProfessionals([]));
  }, [session]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!clientId) return setError("Selecione o cliente.");
    if (title.trim().length < 3) return setError("Descreva o serviço ou equipamento (mín. 3 caracteres).");
    const filled = items.filter((i) => (i.kind === "FREE" ? i.description.trim() : i.refId));
    setSaving(true);
    try {
      const order = await api<ServiceOrderDto>("/api/service-orders", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          professionalId: professionalId || null,
          title: title.trim(),
          notes: notes.trim() || null,
          discount: discount.trim().replace(",", ".") || "0",
          items: toPayload(filled),
        }),
      });
      router.push(`/os/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível abrir a OS.");
      setSaving(false);
    }
  }

  if (!session) return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Nova ordem de serviço</h2>
          <p className="text-sm text-slate-500">A OS começa como rascunho; depois vira orçamento para o cliente aprovar.</p>
        </div>
        <Link href="/os" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Voltar</Link>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="os-client" className="mb-1 block text-sm text-slate-700">Cliente *</label>
            <select id="os-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
              <option value="">Selecione…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {professionals.length > 0 && (
            <div>
              <label htmlFor="os-prof" className="mb-1 block text-sm text-slate-700">Técnico / profissional (comissão)</label>
              <select id="os-prof" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={inputClass}>
                <option value="">Sem comissão</option>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label htmlFor="os-title" className="mb-1 block text-sm text-slate-700">Serviço / equipamento e problema *</label>
            <input id="os-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Notebook Dell — não liga" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="os-notes" className="mb-1 block text-sm text-slate-700">Observações</label>
            <textarea id="os-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Itens</h3>
          <ItemsEditor items={items} onChange={setItems} />
        </div>

        <div className="max-w-xs">
          <label htmlFor="os-discount" className="mb-1 block text-sm text-slate-700">Desconto (R$)</label>
          <input id="os-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" className={inputClass} />
        </div>

        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button type="submit" disabled={saving} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
          {saving ? "Abrindo..." : "Abrir OS"}
        </button>
      </form>
    </div>
  );
}
