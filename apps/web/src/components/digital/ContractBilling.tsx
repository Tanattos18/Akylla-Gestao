"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { contractBillingMessage } from "@petflow/shared";
import { api } from "../../lib/api";
import { formatBrl, formatDate } from "../../lib/format";
import type { ContractReceivableDto, OverduePolicyDto, SubscriptionDto } from "../../lib/types";
import { useToast } from "../ui/Toast";

const statusLabel = { OPEN: "Em aberto", PAID: "Pago", CANCELLED: "Cancelado" } as const;

/**
 * Cobrança do contrato (2026-10-24): títulos gerados automaticamente no
 * Financeiro e a mensagem de cobrança pronta para copiar e enviar à mão.
 */
export function ContractBilling({ subscription }: { subscription: SubscriptionDto }) {
  const toast = useToast();
  const [pixKey, setPixKey] = useState<string | null>(null);
  const receivables = subscription.receivables ?? [];
  const open = receivables.filter((r) => r.status === "OPEN").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next: ContractReceivableDto | undefined = open[0];

  useEffect(() => {
    api<OverduePolicyDto>("/api/overdue-policy")
      .then((policy) => setPixKey(policy.pixKey))
      .catch(() => setPixKey(null));
  }, []);

  const contract = `${subscription.plan.name}${subscription.delivery ? ` — ${subscription.delivery.name}` : ""}`;
  const due = next?.dueDate ?? subscription.endAt;
  const message = contractBillingMessage({
    clientName: subscription.client.name,
    contract,
    amount: formatBrl(next?.amount ?? subscription.plan.price),
    dueDate: formatDate(due),
    pixKey,
    overdue: new Date(due).getTime() < Date.now() - 86_400_000,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem de cobrança copiada.");
    } catch {
      toast.error(null, "Não foi possível copiar. Selecione o texto e copie.");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cobrança</h3>
          <p className="text-xs text-slate-500">
            O título de cada período entra sozinho no Financeiro (até 30 dias antes do vencimento). Ao marcar como
            pago, o contrato é renovado.
          </p>
        </div>
        {subscription.status !== "CANCELLED" && (
          <button type="button" onClick={() => void copy()} className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800">
            Copiar mensagem de cobrança
          </button>
        )}
      </div>

      {subscription.status !== "CANCELLED" && (
        <p className="mb-4 whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</p>
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
