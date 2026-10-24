"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import { formatBrl, formatDate, formatDateTime } from "../../lib/format";
import {
  digitalProductTypeLabels,
  subscriptionStatusLabels,
  type ClientHistoryItemDto,
  type DeliveryDto,
  type Paginated,
  type SubscriptionDto,
} from "../../lib/types";
import { Tabs } from "../ui/Tabs";
import { DeliveryStatusBadge, ExternalLink, NeverPauseBadge } from "./DeliveryBadges";

type TabKey = "entregas" | "contratos" | "historico";

/** Abas da ficha do cliente (transformação 2026-10-23): Entregas, Contratos e Histórico. */
export function ClientTabs({ clientId, clientName, isAdmin }: { clientId: string; clientName: string; isAdmin: boolean }) {
  const [tab, setTab] = useState<TabKey>("entregas");
  const [deliveries, setDeliveries] = useState<DeliveryDto[] | null>(null);
  const [contracts, setContracts] = useState<SubscriptionDto[] | null>(null);
  const [history, setHistory] = useState<ClientHistoryItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "Falha ao carregar a ficha.");
    if (tab === "entregas" && deliveries === null) {
      api<Paginated<DeliveryDto>>(`/api/deliveries?clientId=${clientId}&pageSize=100`)
        .then((data) => setDeliveries(data.items))
        .catch(fail);
    }
    if (tab === "contratos" && contracts === null) {
      api<Paginated<SubscriptionDto>>(`/api/subscriptions?clientId=${clientId}&pageSize=100&orderBy=createdAt&direction=desc`, {
        redirectOnUnauthorized: false,
      })
        .then((data) => setContracts(data.items))
        .catch((err) => {
          // Módulo de contratos desligado/fora do plano: aba vazia, sem erro
          if (err instanceof ApiError && err.status === 403) setContracts([]);
          else fail(err);
        });
    }
    if (tab === "historico" && history === null) {
      api<ClientHistoryItemDto[]>(`/api/clients/${clientId}/history`).then(setHistory).catch(fail);
    }
  }, [tab, clientId, deliveries, contracts, history]);

  const newDeliveryHref = `/entregas/nova?cliente=${clientId}&nome=${encodeURIComponent(clientName)}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <Tabs<TabKey>
        label="Ficha do cliente"
        value={tab}
        onChange={setTab}
        items={[
          { key: "entregas", label: "Entregas" },
          { key: "contratos", label: "Contratos" },
          { key: "historico", label: "Histórico" },
        ]}
      >
        {error && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {tab === "entregas" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Link href={newDeliveryHref} className="text-sm font-medium text-primary-700 hover:underline">Nova entrega</Link>
            </div>
            {deliveries === null ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : deliveries.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma entrega cadastrada para este cliente.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {deliveries.map((delivery) => (
                  <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <Link href={`/entregas/${delivery.id}`} className="font-medium text-slate-800 hover:underline">{delivery.name}</Link>
                      <p className="text-xs text-slate-500">
                        {digitalProductTypeLabels[delivery.type]}
                        {delivery.domain ? ` · ${delivery.domain}` : ""}
                      </p>
                      <p className="text-xs"><ExternalLink href={delivery.siteUrl} /></p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <DeliveryStatusBadge status={delivery.status} />
                      {delivery.neverPause && <NeverPauseBadge />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "contratos" && (
          <div className="space-y-3">
            {isAdmin && (
              <div className="flex justify-end">
                <Link href={`/assinaturas/nova?cliente=${clientId}`} className="text-sm font-medium text-primary-700 hover:underline">Novo contrato</Link>
              </div>
            )}
            {contracts === null ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : contracts.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum contrato para este cliente.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {contracts.map((contract) => (
                  <li key={contract.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <Link href={`/assinaturas/${contract.id}`} className="font-medium text-slate-800 hover:underline">{contract.plan.name}</Link>
                      <p className="text-xs text-slate-500">
                        {contract.delivery ? `Entrega: ${contract.delivery.name} · ` : ""}
                        {formatDate(contract.startAt)} — {formatDate(contract.endAt)}
                      </p>
                    </div>
                    <span className="text-slate-600">
                      {formatBrl(contract.plan.price)} · {subscriptionStatusLabels[contract.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "historico" &&
          (history === null ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {history.map((item, index) => (
                <li key={`${item.kind}-${item.at}-${index}`} className="text-sm">
                  <p className="text-xs text-slate-500">{formatDateTime(item.at)}</p>
                  {item.href ? (
                    <Link href={item.href} className="font-medium text-slate-800 hover:underline">{item.title}</Link>
                  ) : (
                    <p className="font-medium text-slate-800">{item.title}</p>
                  )}
                  {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
                </li>
              ))}
            </ol>
          ))}
      </Tabs>
    </div>
  );
}
