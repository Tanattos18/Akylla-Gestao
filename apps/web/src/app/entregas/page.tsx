"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import { formatDate } from "../../lib/format";
import {
  deliveryStatusLabels,
  digitalProductTypeLabels,
  type DeliveryDto,
  type DeliveryStatus,
  type DigitalProductType,
  type Paginated,
} from "../../lib/types";
import { DataTable } from "../../components/ui/DataTable";
import { Pagination } from "../../components/ui/Pagination";
import { DeliveryStatusBadge, ExternalLink, NeverPauseBadge } from "../../components/digital/DeliveryBadges";

const PAGE_SIZE = 20;
const TYPES = Object.keys(digitalProductTypeLabels) as DigitalProductType[];
const STATUSES = Object.keys(deliveryStatusLabels) as DeliveryStatus[];

function renewal(delivery: DeliveryDto): string {
  const dates = [delivery.domainRenewalAt, delivery.hostingRenewalAt].filter((d): d is string => Boolean(d)).sort();
  return dates[0] ? formatDate(`${dates[0]}T12:00:00`) : "—";
}

/** Entregas de todos os clientes (transformação 2026-10-23). */
export default function EntregasPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<DeliveryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (params: { page: number; search: string; type: string; status: string }) => {
    try {
      const query = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
      if (params.search.trim()) query.set("search", params.search.trim());
      if (params.type) query.set("type", params.type);
      if (params.status) query.set("status", params.status);
      const data = await api<Paginated<DeliveryDto>>(`/api/deliveries?${query.toString()}`);
      setItems(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar entregas.");
    }
  }, []);

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
    if (session) void load({ page, search, type, status });
  }, [session, load, page, search, type, status]);

  useEffect(() => {
    setPage(1);
  }, [search, type, status]);

  if (!session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Entregas</h2>
          <p className="text-sm text-slate-500">Sites, sistemas, lojas virtuais, domínios e hospedagens de cada cliente.</p>
        </div>
        <Link href="/entregas/nova" className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">
          Nova entrega
        </Link>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="delivery-search" className="sr-only">Buscar</label>
        <input
          id="delivery-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, domínio, URL ou cliente"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
        <label htmlFor="delivery-type-filter" className="sr-only">Tipo</label>
        <select id="delivery-type-filter" value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os tipos</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{digitalProductTypeLabels[t]}</option>
          ))}
        </select>
        <label htmlFor="delivery-status-filter" className="sr-only">Status</label>
        <select id="delivery-status-filter" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{deliveryStatusLabels[s]}</option>
          ))}
        </select>
      </div>

      <DataTable
        rows={items}
        rowKey={(delivery) => delivery.id}
        empty={<>Nenhuma entrega cadastrada.</>}
        columns={[
          {
            key: "name",
            header: "Entrega",
            cell: (delivery) => (
              <>
                <Link href={`/entregas/${delivery.id}`} className="font-medium text-slate-800 hover:text-primary-700 hover:underline">
                  {delivery.name}
                </Link>
                <p className="text-xs text-slate-500">{digitalProductTypeLabels[delivery.type]}</p>
              </>
            ),
          },
          {
            key: "client",
            header: "Cliente",
            cell: (delivery) => (
              <Link href={`/clientes/${delivery.client.id}`} className="text-slate-700 hover:underline">{delivery.client.name}</Link>
            ),
          },
          { key: "site", header: "Site", cell: (delivery) => <ExternalLink href={delivery.siteUrl} /> },
          { key: "renewal", header: "Próxima renovação", cell: (delivery) => <>{renewal(delivery)}</> },
          {
            key: "status",
            header: "Status",
            cell: (delivery) => (
              <div className="flex flex-wrap gap-1">
                <DeliveryStatusBadge status={delivery.status} />
                {delivery.neverPause && <NeverPauseBadge />}
              </div>
            ),
          },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} label="entregas" />
    </div>
  );
}
