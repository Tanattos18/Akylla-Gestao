"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import { formatBrl, formatDateTime, formatDate } from "../../../lib/format";
import {
  subscriptionStatusLabels,
  type SubscriptionDto,
} from "../../../lib/types";
import { useDialog } from "../../../components/ui/Dialog";
import { DataTable } from "../../../components/ui/DataTable";
import { ContractBilling } from "../../../components/digital/ContractBilling";

const statusBadge: Record<string, string> = {
  ACTIVE: "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700",
  EXPIRED: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
  CANCELLED: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700",
};

export default function AssinaturaDetalhePage() {
  const dialog = useDialog();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";
  const id = params.id;

  const load = useCallback(async () => {
    try {
      const data = await api<SubscriptionDto>(`/api/subscriptions/${id}`);
      setSubscription(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar o contrato.");
    }
  }, [id]);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  async function handleRenew() {
    if (!await dialog.confirm("Registrar renovação (novo pagamento no caixa)?")) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await api(`/api/subscriptions/${id}/renew`, { method: "POST" });
      setNotice("Contrato renovado.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao renovar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const reason = await dialog.prompt({ title: "Cancelar contrato", label: "Motivo do cancelamento", minLength: 3, maxLength: 500, danger: true, confirmLabel: "Cancelar contrato" });
    if (reason === null) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await api(`/api/subscriptions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setNotice("Contrato cancelado.");
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.issues?.length) {
        setError(err.issues[0].message);
      } else {
        setError(err instanceof ApiError ? err.message : "Falha ao cancelar.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (error && !subscription) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link href="/assinaturas" className="text-sm text-primary-700 underline">
          Voltar para contratos
        </Link>
      </div>
    );
  }

  if (!subscription) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const canRenew =
    subscription.status === "ACTIVE" || subscription.status === "EXPIRED";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{subscription.client.name}</h2>
          <p className="text-sm text-slate-500">
            {subscription.plan.name} · {formatBrl(subscription.plan.price)} ·{" "}
            {subscription.plan.durationDays} dias
          </p>
        </div>
        <Link
          href="/assinaturas"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </Link>
      </div>

      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-slate-500">Entrega coberta</dt>
            <dd className="text-sm text-slate-800">
              {subscription.delivery ? (
                <Link href={`/entregas/${subscription.delivery.id}`} className="text-primary-700 hover:underline">
                  {subscription.delivery.name}
                  {subscription.delivery.neverPause ? " · nunca pausar" : ""}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Período</dt>
            <dd className="text-sm text-slate-800">
              {formatDate(subscription.startAt)} — {formatDate(subscription.endAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Status</dt>
            <dd>
              <span className={statusBadge[subscription.status]}>
                {subscriptionStatusLabels[subscription.status]}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Renovações</dt>
            <dd className="text-sm text-slate-800">{subscription.renewalCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Último pagamento</dt>
            <dd className="text-sm text-slate-800">
              {subscription.lastPaymentAt
                ? formatDateTime(subscription.lastPaymentAt)
                : "—"}
            </dd>
          </div>
          {subscription.status === "CANCELLED" && subscription.cancelReason && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-slate-500">Motivo do cancelamento</dt>
              <dd className="text-sm text-slate-800">{subscription.cancelReason}</dd>
            </div>
          )}
        </dl>

        {isAdmin && (canRenew || subscription.status === "ACTIVE") && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            {canRenew && (
              <button
                type="button"
                onClick={() => void handleRenew()}
                disabled={busy}
                className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {busy ? "Processando..." : "Renovar (pagar no caixa)"}
              </button>
            )}
            {subscription.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={busy}
                className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Cancelar contrato
              </button>
            )}
          </div>
        )}
        {isAdmin && canRenew && (
          <p className="mt-2 text-xs text-slate-500">
            Renovar exige caixa aberto; a entrada é criada como pagamento/renovação do contrato.
          </p>
        )}
      </div>

      <ContractBilling subscription={subscription} />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-6 py-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pagamentos
        </h3>
        <DataTable
          bare
          rows={(subscription.payments ?? [])}
          rowKey={(payment) => payment.id}
          empty={<>Nenhum pagamento registrado.</>}
          columns={[
            { key: "c0", header: "Data", cell: (payment) => formatDateTime(payment.createdAt) },
            { key: "c1", header: "Valor", cell: (payment) => formatBrl(payment.amount), numeric: true, className: "font-medium" },
            { key: "c2", header: "Descrição", cell: (payment) => payment.description },
          ]}
        />
      </div>
    </div>
  );
}
