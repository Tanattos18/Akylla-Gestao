"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import { formatBrl, formatDate } from "../../lib/format";
import {
  renderBillingText,
  type BillingSettingsDto,
  type BillingTextKey,
  type ContractReceivableDto,
  type OverduePolicyDto,
  type SubscriptionDto,
} from "../../lib/types";
import { useDialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { BillingBadge } from "./BillingBadge";

const statusLabel = { OPEN: "Em aberto", PAID: "Pago", CANCELLED: "Cancelado" } as const;

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Cobrança do contrato: títulos gerados sozinhos no Financeiro, situação
 * (em dia, vence em N dias, vencido, em débito, em acordo), mensagens para
 * copiar (textos editáveis em Configurações › Contratos), prazo combinado e
 * atalho para pausar o site até pagar (2026-10-24/27).
 */
export function ContractBilling({
  subscription,
  isAdmin,
  onChanged,
}: {
  subscription: SubscriptionDto;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const dialog = useDialog();
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<BillingSettingsDto | null>(null);
  const [graceOpen, setGraceOpen] = useState(false);
  const [graceUntil, setGraceUntil] = useState(todayPlus(7));
  const [graceNote, setGraceNote] = useState("");
  const [busy, setBusy] = useState(false);

  const receivables = subscription.receivables ?? [];
  const open = receivables.filter((r) => r.status === "OPEN").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next: ContractReceivableDto | undefined = open[0];
  const billing = subscription.billing ?? null;

  useEffect(() => {
    api<OverduePolicyDto>("/api/overdue-policy")
      .then((policy) => setPixKey(policy.pixKey))
      .catch(() => setPixKey(null));
    api<BillingSettingsDto>("/api/billing-settings")
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  const due = next?.dueDate ?? subscription.endAt;
  const daysLeft = billing?.daysToDue ?? Math.round((new Date(due).getTime() - Date.now()) / 86_400_000);
  const values = {
    cliente: subscription.client.name.split(" ")[0] || subscription.client.name,
    contrato: `${subscription.plan.name}${subscription.delivery ? ` — ${subscription.delivery.name}` : ""}`,
    valor: formatBrl(next?.amount ?? subscription.plan.price),
    vencimento: formatDate(due),
    dias: Math.max(0, daysLeft),
    pix: pixKey,
    prazo: subscription.graceUntil ? formatDate(subscription.graceUntil) : null,
  };

  async function copy(key: BillingTextKey) {
    if (!settings) return;
    const text = renderBillingText(settings.texts[key], values);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error(null, "Não foi possível copiar. Selecione o texto e copie.");
    }
  }

  async function grantGrace(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/subscriptions/${subscription.id}/grace`, {
        method: "POST",
        body: JSON.stringify({ until: graceUntil, note: graceNote.trim() }),
      });
      toast.success("Prazo registrado. Nada será pausado até essa data.");
      setGraceOpen(false);
      setGraceNote("");
      onChanged();
    } catch (err) {
      toast.error(err, "Não foi possível registrar o prazo.");
    } finally {
      setBusy(false);
    }
  }

  async function pauseSite() {
    if (!subscription.delivery) return;
    const reason = await dialog.prompt({
      title: `Pausar "${subscription.delivery.name}" até pagar`,
      label: "Motivo",
      minLength: 3,
      maxLength: 500,
      danger: true,
      confirmLabel: "Pausar site",
    });
    if (reason === null) return;
    try {
      await api(`/api/deliveries/${subscription.delivery.id}/pause`, { method: "POST", body: JSON.stringify({ reason }) });
      toast.success("Site pausado. Ele volta sozinho quando o pagamento for registrado.");
      onChanged();
    } catch (err) {
      toast.error(err, err instanceof ApiError ? err.message : "Não foi possível pausar.");
    }
  }

  const cancelled = subscription.status === "CANCELLED";
  const canPause =
    isAdmin && subscription.delivery && !subscription.delivery.neverPause && ["ACTIVE", "IN_PROGRESS"].includes(subscription.delivery.status);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cobrança</h3>
          <p className="text-xs text-slate-500">
            O título de cada período entra sozinho no Financeiro. Ao marcar como pago, o contrato é renovado e o site pausado
            por débito volta ao ar.
          </p>
        </div>
        <BillingBadge billing={billing} />
      </div>

      {subscription.graceUntil && (
        <p className="mb-3 rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-900">
          Prazo combinado até <strong>{formatDate(subscription.graceUntil)}</strong>
          {subscription.graceNote ? ` — ${subscription.graceNote}` : ""}
          {billing?.agreementBroken ? " · acordo descumprido" : ""}
        </p>
      )}

      {!cancelled && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" disabled={!settings} onClick={() => void copy("billingTextBefore")} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Copiar aviso: vence em {Math.max(0, daysLeft)} dia(s)
          </button>
          <button type="button" disabled={!settings} onClick={() => void copy("billingTextOverdue")} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Copiar aviso: vencido, renove
          </button>
          {subscription.graceUntil && (
            <button type="button" disabled={!settings} onClick={() => void copy("billingTextAgreement")} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              Copiar mensagem do prazo combinado
            </button>
          )}
          {isAdmin && (
            <button type="button" onClick={() => setGraceOpen((v) => !v)} className="rounded-md border border-violet-300 px-3 py-2 text-sm text-violet-800 hover:bg-violet-50">
              Dar prazo
            </button>
          )}
          {canPause && (
            <button type="button" onClick={() => void pauseSite()} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
              Pausar site até pagar
            </button>
          )}
        </div>
      )}

      {graceOpen && (
        <form onSubmit={grantGrace} className="mb-4 grid gap-3 rounded-md border border-violet-200 p-4 sm:grid-cols-[auto_1fr_auto]">
          <div>
            <label htmlFor="grace-until" className="mb-1 block text-sm text-slate-700">Pagar até</label>
            <input id="grace-until" type="date" min={todayPlus(0)} value={graceUntil} onChange={(e) => setGraceUntil(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="grace-note" className="mb-1 block text-sm text-slate-700">Acordo com o cliente</label>
            <input
              id="grace-note"
              value={graceNote}
              onChange={(e) => setGraceNote(e.target.value)}
              placeholder="Ex.: pediu até dia 15, paga metade no dia 10"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={busy || graceNote.trim().length < 3} className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60">
              Registrar prazo
            </button>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-3">
            Durante o prazo nada é pausado e os avisos de atraso esperam. Se a data passar sem pagamento, o contrato volta a
            &quot;em débito&quot; (acordo descumprido) e aparece no Início.
          </p>
        </form>
      )}

      {!pixKey && (
        <p className="mb-4 text-xs text-amber-700">
          Sem chave Pix cadastrada. Cadastre em{" "}
          <Link href="/configuracoes" className="underline">
            Configurações › Contratos
          </Link>
          .
        </p>
      )}

      {receivables.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum título gerado ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {receivables.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-slate-700">
                {r.kind === "inicio" ? "1º período" : "Renovação"} · vence {formatDate(r.dueDate)}
              </span>
              <span className={r.status === "OPEN" ? "font-medium text-amber-800" : "text-slate-500"}>
                {formatBrl(r.amount)} · {statusLabel[r.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Para dar baixa, use o{" "}
        <Link href="/financeiro" className="underline">
          Financeiro
        </Link>{" "}
        (exige caixa aberto).
      </p>
    </div>
  );
}
