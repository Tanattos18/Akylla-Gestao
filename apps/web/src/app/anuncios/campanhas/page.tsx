"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { formatBrl } from "../../../lib/format";
import {
  adCampaignStatusLabels,
  adObjectiveLabels,
  adPlatformLabels,
  type AdCampaignListItemDto,
  type AdCampaignStatus,
  type AdPlatform,
  type Paginated,
} from "../../../lib/types";
import { DataTable } from "../../../components/ui/DataTable";
import { Pagination } from "../../../components/ui/Pagination";
import { AdStatusBadge, AdsNav, formatDay, formatInt } from "../../../components/ads/AdsShared";

const PAGE_SIZE = 20;
const STATUSES = Object.keys(adCampaignStatusLabels) as AdCampaignStatus[];
const PLATFORMS = Object.keys(adPlatformLabels) as AdPlatform[];

/** Anúncios › Campanhas: lista com filtros (fase A1). */
export default function CampanhasPage() {
  const [items, setItems] = useState<AdCampaignListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [platform, setPlatform] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (params: { page: number; search: string; status: string; platform: string }) => {
    try {
      const query = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
      if (params.search.trim()) query.set("search", params.search.trim());
      if (params.status) query.set("status", params.status);
      if (params.platform) query.set("platform", params.platform);
      const data = await api<Paginated<AdCampaignListItemDto>>(`/api/ads/campaigns?${query.toString()}`);
      setItems(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar as campanhas.");
    }
  }, []);

  useEffect(() => {
    void load({ page, search, status, platform });
  }, [load, page, search, status, platform]);

  useEffect(() => {
    setPage(1);
  }, [search, status, platform]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Campanhas</h2>
          <p className="text-sm text-slate-500">O que está sendo anunciado, para qual cliente, onde e com quanto.</p>
        </div>
        <Link href="/anuncios/campanhas/nova" className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">
          Nova campanha
        </Link>
      </div>
      <AdsNav />

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="campaign-search" className="sr-only">Buscar</label>
        <input
          id="campaign-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Campanha, item anunciado, UTM ou cliente"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
        <label htmlFor="campaign-status" className="sr-only">Status</label>
        <select id="campaign-status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{adCampaignStatusLabels[s]}</option>
          ))}
        </select>
        <label htmlFor="campaign-platform" className="sr-only">Plataforma</label>
        <select id="campaign-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todas as plataformas</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{adPlatformLabels[p]}</option>
          ))}
        </select>
      </div>

      <DataTable
        rows={items}
        rowKey={(campaign) => campaign.id}
        empty={<>Nenhuma campanha cadastrada.</>}
        columns={[
          {
            key: "name",
            header: "Campanha",
            cell: (campaign) => (
              <>
                <Link href={`/anuncios/campanhas/${campaign.id}`} className="font-medium text-slate-800 hover:text-primary-700 hover:underline">
                  {campaign.name}
                </Link>
                <p className="text-xs text-slate-500">{campaign.promotedItem} · {adObjectiveLabels[campaign.objective]}</p>
              </>
            ),
          },
          {
            key: "client",
            header: "Cliente",
            cell: (campaign) => <Link href={`/clientes/${campaign.client.id}`} className="text-slate-700 hover:underline">{campaign.client.name}</Link>,
          },
          { key: "platform", header: "Plataforma", hideOnMobile: true, cell: (campaign) => <>{adPlatformLabels[campaign.platform]}</> },
          { key: "spend", header: "Investimento", numeric: true, cell: (campaign) => <>{formatBrl(campaign.indicators.spend)}</> },
          { key: "results", header: "Resultados", numeric: true, cell: (campaign) => <>{formatInt(campaign.indicators.results)}</> },
          {
            key: "cpr",
            header: "Custo/resultado",
            numeric: true,
            hideOnMobile: true,
            cell: (campaign) => <>{campaign.indicators.costPerResult === null ? "—" : formatBrl(campaign.indicators.costPerResult)}</>,
          },
          { key: "last", header: "Última métrica", hideOnMobile: true, cell: (campaign) => <>{formatDay(campaign.lastMetricDate)}</> },
          { key: "status", header: "Status", cell: (campaign) => <AdStatusBadge status={campaign.status} /> },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} label="campanhas" />
    </div>
  );
}
