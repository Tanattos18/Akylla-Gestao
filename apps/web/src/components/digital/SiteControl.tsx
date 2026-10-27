"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { billingActionLabels, deliveryStatusLabels, type BillingActionDto, type DeliveryDto } from "../../lib/types";
import { useDialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { BillingBadge } from "./BillingBadge";
import { DeliveryStatusBadge, NeverPauseBadge } from "./DeliveryBadges";

/**
 * Controle do site vendido (2026-10-27) — só ADMIN: pausar até pagar,
 * ativar, inativar (cliente desistiu) e reativar, sempre com motivo e
 * histórico. "Nunca pausar" fica bloqueado aqui e no servidor. O código de
 * instalação é o que faz a pausa valer de verdade no site do cliente.
 */
export function SiteControl({ delivery, isAdmin, onChanged }: { delivery: DeliveryDto; isAdmin: boolean; onChanged: () => void }) {
  const dialog = useDialog();
  const toast = useToast();
  const [history, setHistory] = useState<BillingActionDto[]>([]);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistory(await api<BillingActionDto[]>(`/api/deliveries/${delivery.id}/billing-actions`).catch(() => []));
  }, [delivery.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, delivery.status]);

  async function run(path: string, prompt: { title: string; label: string; confirmLabel: string; danger?: boolean; optional?: boolean }) {
    const reason = await dialog.prompt({
      title: prompt.title,
      label: prompt.label,
      minLength: prompt.optional ? 0 : 3,
      maxLength: 500,
      danger: prompt.danger,
      confirmLabel: prompt.confirmLabel,
      optional: prompt.optional,
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await api(`/api/deliveries/${delivery.id}/${path}`, { method: "POST", body: JSON.stringify(reason ? { reason } : {}) });
      toast.success("Feito.");
      onChanged();
      await loadHistory();
    } catch (err) {
      toast.error(err, "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  async function copySnippet() {
    try {
      const code = snippet ?? (await api<{ snippet: string }>(`/api/deliveries/${delivery.id}/install-code`)).snippet;
      setSnippet(code);
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado. Cole no site do cliente, antes de </body>.");
      onChanged();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err, "Não foi possível gerar o código.");
      else toast.error(null, "Não foi possível copiar; selecione o código abaixo.");
    }
  }

  const status = delivery.status;
  const blocked = delivery.neverPause;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Controle do site</h3>
          <p className="text-xs text-slate-500">Você decide: pausar até pagar, ativar, inativar ou dar prazo no contrato.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <DeliveryStatusBadge status={status} />
          {blocked && <NeverPauseBadge />}
          <BillingBadge billing={delivery.billing} />
        </div>
      </div>

      {blocked ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Esta entrega está marcada como <strong>nunca pausar</strong>: não pode ser pausada nem inativada, e o código de status
          sempre responde &quot;ativo&quot;.
        </p>
      ) : (
        isAdmin && (
          <div className="flex flex-wrap gap-2">
            {(status === "ACTIVE" || status === "IN_PROGRESS") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("pause", { title: "Pausar site até pagar", label: "Motivo (ex.: mensalidade de outubro em aberto)", confirmLabel: "Pausar site", danger: true })}
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Pausar até pagar
              </button>
            )}
            {status === "PAUSED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("activate", { title: "Ativar site", label: "Observação (opcional)", confirmLabel: "Ativar", optional: true })}
                className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
              >
                Ativar
              </button>
            )}
            {status !== "CANCELLED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("deactivate", { title: "Inativar site (cliente desistiu)", label: "Motivo", confirmLabel: "Inativar", danger: true })}
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Inativar (cliente desistiu)
              </button>
            )}
            {status === "CANCELLED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("activate", { title: "Reativar site", label: "Motivo", confirmLabel: "Reativar" })}
                className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
              >
                Reativar
              </button>
            )}
          </div>
        )
      )}

      {!blocked && isAdmin && (
        <div className="mt-4 rounded-md border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700">
              <strong className="font-medium">Código de status</strong> — cole uma vez no site do cliente. É ele que mostra a
              faixa de pendência ou a página de site suspenso. Se o Akylla ficar fora do ar, o site segue normal.
            </p>
            <button type="button" onClick={() => void copySnippet()} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Copiar código de instalação
            </button>
          </div>
          {snippet && <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">{snippet}</pre>}
          {!snippet && (
            <p className="mt-1 text-xs text-slate-500">
              {delivery.hasInstallCode ? "Código já gerado." : "Ainda não instalado: sem o código, pausar só muda o status aqui no Akylla."}
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Histórico de decisões</p>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma ação registrada.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {history.map((h) => (
              <li key={h.id}>
                <span className="text-slate-500">{formatDateTime(h.createdAt)}</span> · {billingActionLabels[h.action]}
                {h.toStatus ? ` (${deliveryStatusLabels[h.toStatus]})` : ""}
                {h.graceUntil ? ` até ${new Date(h.graceUntil).toLocaleDateString("pt-BR")}` : ""}
                {h.reason ? ` — ${h.reason}` : ""} · {h.userName ?? "sistema"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
