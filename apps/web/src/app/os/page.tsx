"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import { formatBrl, formatDate } from "../../lib/format";
import { serviceOrderStatusLabels, type ServiceOrderListDto, type ServiceOrderStatus } from "../../lib/types";
import { serviceOrderStatusClass as statusClass } from "../../components/os/status";
import { DataTable } from "../../components/ui/DataTable";

/** Fase 2 · 2.3 — lista de ordens de serviço. */

const filters: Array<"" | ServiceOrderStatus> = ["", "DRAFT", "QUOTE", "APPROVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default function OsListPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"" | ServiceOrderStatus>("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ServiceOrderListDto | null>(null);
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
    const params = new URLSearchParams({ pageSize: "100" });
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    try {
      setData(await api<ServiceOrderListDto>(`/api/service-orders?${params.toString()}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar as ordens de serviço.");
    }
  }, [status, search]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  if (!session) return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Ordens de serviço</h2>
          <p className="text-sm text-slate-500">Orçamento → aprovação → execução → conclusão</p>
        </div>
        <Link href="/os/nova" className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">
          Nova OS
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por situação">
        {filters.map((value) => (
          <button
            key={value || "ALL"}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={status === value ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white" : "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"}
          >
            {value ? serviceOrderStatusLabels[value] : "Todas"}
            {value && data?.countsByStatus[value] ? ` (${data.countsByStatus[value]})` : ""}
          </button>
        ))}
        <label htmlFor="os-search" className="sr-only">Buscar</label>
        <input id="os-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nº, cliente ou equipamento" className="ml-auto w-full max-w-xs rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none" />
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <DataTable
        rows={data?.items ?? []}
        rowKey={(o) => o.id}
          onRowClick={(o) => router.push(`/os/${o.id}`)}
          rowLabel={(o) => `Abrir OS ${o.number}`}
        empty={<>Nenhuma ordem de serviço.</>}
        columns={[
          { key: "c0", header: "OS", cell: (o) => <><Link href={`/os/${o.id}`} className="font-mono text-xs font-semibold text-primary-700 hover:underline">{o.code}</Link></> },
          { key: "c1", header: "Abertura", cell: (o) => formatDate(o.openedAt) },
          { key: "c2", header: "Cliente", cell: (o) => o.client.name },
          { key: "c3", header: "Serviço / equipamento", cell: (o) => o.title },
          { key: "c4", header: "Técnico", cell: (o) => o.professional?.name ?? "—" },
          { key: "c5", header: "Total", cell: (o) => formatBrl(o.total), numeric: true, className: "font-medium" },
          { key: "c6", header: "Situação", cell: (o) => <><span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[o.status]}`}>{serviceOrderStatusLabels[o.status]}</span></> },
        ]}
      />
    </div>
  );
}
