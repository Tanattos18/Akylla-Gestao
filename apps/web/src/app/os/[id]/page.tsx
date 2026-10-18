"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import { formatBrl, formatDateTime } from "../../../lib/format";
import { serviceOrderStatusLabels, type ServiceOrderDto, type ServiceOrderStatus } from "../../../lib/types";
import { ItemsEditor, newItem, toPayload, type EditableItem } from "../../../components/os/ItemsEditor";
import { serviceOrderStatusClass } from "../../../components/os/status";
import { EmitFiscalButton } from "../../../components/fiscal/EmitFiscalButton";

/** Fase 2 · 2.3 — detalhe da OS: etapas, itens, anexos e histórico de WhatsApp. */

const nextStep: Partial<Record<ServiceOrderStatus, { status: string; label: string; confirm: string }>> = {
  DRAFT: { status: "QUOTE", label: "Emitir orçamento", confirm: "Emitir o orçamento para o cliente?" },
  QUOTE: { status: "APPROVED", label: "Aprovar orçamento", confirm: "O cliente aprovou? Depois disso itens e valores ficam travados." },
  APPROVED: { status: "IN_PROGRESS", label: "Iniciar execução", confirm: "Iniciar a execução do serviço?" },
  IN_PROGRESS: { status: "COMPLETED", label: "Concluir OS", confirm: "Concluir a OS? Baixa as peças do estoque e gera a conta a receber." },
};

interface MessageDto {
  id: string;
  status: string;
  templateNameSnapshot: string;
  failureReason: string | null;
  createdAt: string;
}

function toEditable(order: ServiceOrderDto): EditableItem[] {
  return order.items.map((item) => ({
    key: item.id,
    kind: item.serviceId ? "SERVICE" : item.productId ? "PRODUCT" : "FREE",
    refId: item.serviceId ?? item.productId ?? "",
    description: item.serviceId || item.productId ? "" : item.description,
    quantity: Number(item.quantity).toString(),
    unitPrice: item.serviceId || item.productId ? "" : item.unitPrice,
  }));
}

export default function OsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [order, setOrder] = useState<ServiceOrderDto | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
    });
  }, [router]);

  const load = useCallback(async () => {
    try {
      const data = await api<ServiceOrderDto>(`/api/service-orders/${id}`);
      setOrder(data);
      setItems(data.items.length ? toEditable(data) : [newItem()]);
      setDiscount(data.discount);
      setNotes(data.notes ?? "");
      const msgs = await api<{ items: MessageDto[] }>(`/api/service-orders/${id}/messages`);
      setMessages(msgs.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar a OS.");
    }
  }, [id]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    if (!order) return;
    const step = nextStep[order.status];
    if (!step || !window.confirm(step.confirm)) return;
    void run(
      () => api(`/api/service-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: step.status }) }),
      `OS: ${serviceOrderStatusLabels[step.status as ServiceOrderStatus]}.`,
    );
  }

  function cancel() {
    const reason = window.prompt("Motivo do cancelamento (mínimo 3 caracteres):");
    if (!reason) return;
    void run(() => api(`/api/service-orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }), "OS cancelada.");
  }

  function saveItems() {
    const filled = items.filter((i) => (i.kind === "FREE" ? i.description.trim() : i.refId));
    void run(async () => {
      await api(`/api/service-orders/${id}/items`, { method: "PUT", body: JSON.stringify({ items: toPayload(filled) }) });
      await api(`/api/service-orders/${id}`, { method: "PATCH", body: JSON.stringify({ discount: discount.trim().replace(",", ".") || "0" }) });
    }, "Itens e desconto salvos.");
  }

  function saveNotes() {
    void run(() => api(`/api/service-orders/${id}`, { method: "PATCH", body: JSON.stringify({ notes: notes.trim() || null }) }), "Observações salvas.");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Arquivo maior que 5 MB.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    await run(async () => {
      // fetch direto: o helper api() força JSON e quebraria o multipart
      const response = await fetch(`/api/service-orders/${id}/attachments`, { method: "POST", body: form, credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(typeof body?.message === "string" ? body.message : "Falha no envio", response.status);
      }
    }, "Anexo enviado.");
  }

  function removeAttachment(attachmentId: string, filename: string) {
    if (!window.confirm(`Remover o anexo "${filename}"?`)) return;
    void run(() => api(`/api/service-orders/${id}/attachments/${attachmentId}`, { method: "DELETE" }), "Anexo removido.");
  }

  if (!session || (!order && !error)) return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  if (!order) return <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;

  const editable = order.status === "DRAFT" || order.status === "QUOTE";
  const terminal = order.status === "COMPLETED" || order.status === "CANCELLED";
  const step = nextStep[order.status];
  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xl font-semibold text-slate-900">{order.code}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs ${serviceOrderStatusClass[order.status]}`}>{serviceOrderStatusLabels[order.status]}</span>
          </div>
          <p className="mt-1 text-sm text-slate-700">{order.title}</p>
          <p className="text-xs text-slate-600">
            Cliente: <Link href={`/clientes/${order.client.id}`} className="text-primary-700 hover:underline">{order.client.name}</Link>
            {order.professional ? ` · Técnico: ${order.professional.name}` : ""} · Aberta em {formatDateTime(order.openedAt)} por {order.createdBy.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {step && (
            <button type="button" disabled={busy} onClick={advance} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
              {step.label}
            </button>
          )}
          {!terminal && (
            <button type="button" disabled={busy} onClick={cancel} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
              Cancelar OS
            </button>
          )}
          <button type="button" onClick={() => window.print()} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Imprimir
          </button>
          <Link href="/os" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Voltar</Link>
        </div>
      </div>

      {notice && <div role="status" className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800 print:hidden">{notice}</div>}
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">{error}</div>}
      {order.status === "CANCELLED" && order.cancelReason && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">Cancelada em {formatDateTime(order.cancelledAt as string)}: {order.cancelReason}</p>
      )}
      {order.status === "COMPLETED" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Concluída em {formatDateTime(order.completedAt as string)}.{" "}
          {order.financialEntryId && <>Conta a receber gerada em <Link href="/financeiro" className="font-medium underline">Financeiro</Link>.</>}
        </p>
      )}

      {order.status === "COMPLETED" && (
        <EmitFiscalButton serviceOrderId={order.id} types={["NFSE"]} isAdmin={session.user.role === "ADMIN"} />
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Itens</h3>
        {editable ? (
          <div className="space-y-4">
            <ItemsEditor items={items} onChange={setItems} />
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <label htmlFor="os-discount" className="mb-1 block text-sm text-slate-700">Desconto (R$)</label>
                <input id="os-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
              </div>
              <button type="button" disabled={busy} onClick={saveItems} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                Salvar itens
              </button>
            </div>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2">Descrição</th>
                <th className="py-2 text-right">Qtd.</th>
                <th className="py-2 text-right">Unit.</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-800">{item.description}</td>
                  <td className="py-2 text-right text-slate-700">{Number(item.quantity).toLocaleString("pt-BR")}</td>
                  <td className="py-2 text-right text-slate-700">{formatBrl(item.unitPrice)}</td>
                  <td className="py-2 text-right text-slate-900">{formatBrl(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd>{formatBrl(order.subtotal)}</dd></div>
          <div className="flex justify-between text-slate-600"><dt>Desconto</dt><dd>- {formatBrl(order.discount)}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-slate-900"><dt>Total</dt><dd>{formatBrl(order.total)}</dd></div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Observações</h3>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={order.status === "CANCELLED"} className={inputClass} aria-label="Observações da OS" />
        {order.status !== "CANCELLED" && (
          <button type="button" disabled={busy} onClick={saveNotes} className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Salvar observações</button>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Anexos ({order.attachments.length})</h3>
          {order.status !== "CANCELLED" && (
            <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Enviar foto ou PDF
              <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" className="sr-only" onChange={(e) => void upload(e)} disabled={busy} />
            </label>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-600">JPG, PNG ou PDF até 5 MB. Após concluir ou cancelar, os anexos ficam como histórico.</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {order.attachments.map((a) => (
            <li key={a.id} className="rounded-md border border-slate-200 p-2 text-xs">
              {a.mimeType.startsWith("image/") ? (
                <img src={`/api/service-orders/${id}/attachments/${a.id}`} alt={a.filename} className="mb-2 h-28 w-full rounded object-cover" />
              ) : (
                <div className="mb-2 flex h-28 items-center justify-center rounded bg-slate-100 text-slate-600">PDF</div>
              )}
              <a href={`/api/service-orders/${id}/attachments/${a.id}`} target="_blank" rel="noreferrer" className="block truncate font-medium text-primary-700 hover:underline">{a.filename}</a>
              <p className="text-slate-600">{(a.size / 1024).toFixed(0)} KB · {formatDateTime(a.uploadedAt)}</p>
              {!terminal && (
                <button type="button" onClick={() => removeAttachment(a.id, a.filename)} className="mt-1 text-red-700 hover:underline">Remover</button>
              )}
            </li>
          ))}
          {order.attachments.length === 0 && <li className="text-sm text-slate-500">Nenhum anexo.</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Mensagens de WhatsApp desta OS</h3>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma mensagem vinculada.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1">
                <span className="text-slate-800">{m.templateNameSnapshot}</span>
                <span className="text-slate-600">{m.status}{m.failureReason ? ` — ${m.failureReason}` : ""} · {formatDateTime(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
