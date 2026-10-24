"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { formatBrl, formatDate } from "../../../lib/format";
import {
  digitalProductTypeLabels,
  subscriptionStatusLabels,
  type DeliveryDto,
  type Paginated,
  type SubscriptionDto,
} from "../../../lib/types";
import { DeliveryForm } from "../../../components/digital/DeliveryForm";
import { DeliveryStatusBadge, ExternalLink, NeverPauseBadge } from "../../../components/digital/DeliveryBadges";

function day(value: string | null): string {
  return value ? formatDate(`${value}T12:00:00`) : "—";
}

export default function EntregaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [delivery, setDelivery] = useState<DeliveryDto | null>(null);
  const [contracts, setContracts] = useState<SubscriptionDto[]>([]);
  const [editing, setEditing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<DeliveryDto>(`/api/deliveries/${id}`);
      setDelivery(data);
      const subs = await api<Paginated<SubscriptionDto>>(`/api/subscriptions?deliveryId=${id}&pageSize=50`, {
        redirectOnUnauthorized: false,
      }).catch(() => null);
      setContracts(subs?.items ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err instanceof ApiError ? err.message : "Falha ao carregar a entrega.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-slate-500">Entrega não encontrada.</p>
        <Link href="/entregas" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Voltar às entregas</Link>
      </div>
    );
  }
  if (!delivery) {
    return <p className="py-16 text-center text-sm text-slate-500">{error ?? "Carregando..."}</p>;
  }

  const rows: Array<[string, ReactNode]> = [
    ["Cliente", <Link key="c" href={`/clientes/${delivery.client.id}`} className="text-primary-700 hover:underline">{delivery.client.name}</Link>],
    ["Tipo", digitalProductTypeLabels[delivery.type]],
    ["Produto do catálogo", delivery.product?.name ?? "—"],
    ["Site", <ExternalLink key="s" href={delivery.siteUrl} />],
    ["Admin", <ExternalLink key="a" href={delivery.adminUrl} />],
    ["Repositório", <ExternalLink key="r" href={delivery.repositoryUrl} />],
    ["Domínio", delivery.domain ?? "—"],
    ["Renovação do domínio", day(delivery.domainRenewalAt)],
    ["Hospedagem", delivery.hostingProvider ?? "—"],
    ["Renovação da hospedagem", day(delivery.hostingRenewalAt)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{delivery.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            <DeliveryStatusBadge status={delivery.status} />
            {delivery.neverPause && <NeverPauseBadge />}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            {editing ? "Fechar edição" : "Editar"}
          </button>
          <Link href="/entregas" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Entregas</Link>
        </div>
      </div>

      {notice && <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>}

      {editing ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <DeliveryForm
            delivery={delivery}
            onSaved={(saved) => {
              setDelivery(saved);
              setEditing(false);
              setNotice("Entrega atualizada.");
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          {delivery.notes && <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm text-slate-700">{delivery.notes}</p>}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contratos desta entrega</h3>
          <Link href={`/assinaturas/nova?cliente=${delivery.client.id}&entrega=${delivery.id}`} className="text-sm font-medium text-primary-700 hover:underline">
            Novo contrato
          </Link>
        </div>
        {contracts.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum contrato vinculado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {contracts.map((contract) => (
              <li key={contract.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/assinaturas/${contract.id}`} className="font-medium text-slate-800 hover:underline">{contract.plan.name}</Link>
                <span className="text-slate-500">
                  {formatBrl(contract.plan.price)} · até {formatDate(contract.endAt)} · {subscriptionStatusLabels[contract.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
