"use client";

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "../../../../lib/api";
import { formatBrl, formatBrlCompact, formatDateTime } from "../../../../lib/format";
import { fetchSession } from "../../../../lib/session";
import {
  adCampaignStatusLabels,
  adLogActionLabels,
  adMetricSourceLabels,
  adObjectiveLabels,
  adObjectiveResultLabels,
  adPlatformLabels,
  type AdCampaignDetailDto,
  type AdCampaignLogDto,
  type AdCampaignStatus,
  type AdLinkDto,
} from "../../../../lib/types";
import { ComboChart } from "../../../../components/ui/ComboChart";
import { DataTable } from "../../../../components/ui/DataTable";
import { AdStatusBadge, AdsNav, IndicatorGrid, formatDay, formatInt } from "../../../../components/ads/AdsShared";
import { CampaignForm } from "../../../../components/ads/CampaignForm";
import { CsvImport } from "../../../../components/ads/CsvImport";

const REASON_REQUIRED: AdCampaignStatus[] = ["PAUSED", "FINISHED"];
const STATUS_ACTION: Record<AdCampaignStatus, string> = {
  DRAFT: "Voltar para rascunho",
  WAITING_APPROVAL: "Enviar para aprovação do cliente",
  ACTIVE: "Ativar",
  PAUSED: "Pausar",
  FINISHED: "Finalizar",
};

function todayBr(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

function logText(log: AdCampaignLogDto): string {
  const detail = (log.detail ?? {}) as Record<string, unknown>;
  switch (log.action) {
    case "STATUS":
      return `${adCampaignStatusLabels[detail.from as AdCampaignStatus] ?? detail.from} → ${adCampaignStatusLabels[detail.to as AdCampaignStatus] ?? detail.to}${detail.reason ? ` · ${String(detail.reason)}` : ""}`;
    case "METRIC":
    case "METRIC_FIX":
      return `Dia ${formatDay(String(detail.date ?? ""))}`;
    case "CSV_IMPORT":
      return `${String(detail.filename ?? "")} · ${String(detail.days ?? 0)} dia(s) · ${formatBrl(String(detail.spend ?? "0"))}`;
    case "UPDATE":
      return Array.isArray(detail.fields) ? `Campos: ${detail.fields.length}` : "";
    default:
      return detail.utmCampaign ? `UTM ${String(detail.utmCampaign)}` : "";
  }
}

/** Anúncios › Campanha: indicadores, gráfico, lançamento do dia, CSV, link UTM, status e histórico. */
export default function CampanhaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<AdCampaignDetailDto | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [metric, setMetric] = useState({ date: todayBr(), impressions: "", reach: "", clicks: "", spend: "", results: "" });
  const [metricError, setMetricError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [link, setLink] = useState<AdLinkDto | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<AdCampaignDetailDto>(`/api/ads/campaigns/${id}`);
      setCampaign(data);
      setLinkUrl((current) => current || data.targetUrl || "");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err instanceof ApiError ? err.message : "Falha ao carregar a campanha.");
    }
  }, [id]);

  useEffect(() => {
    void load();
    fetchSession().then((session) => setIsAdmin(session?.user.role === "ADMIN"));
  }, [load]);

  async function changeStatus(status: AdCampaignStatus) {
    setError(null);
    setNotice(null);
    try {
      await api(`/api/ads/campaigns/${id}/status`, { method: "POST", body: JSON.stringify({ status, reason: reason.trim() || undefined }) });
      setReason("");
      setNotice(`Status: ${adCampaignStatusLabels[status]}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível mudar o status.");
    }
  }

  async function saveMetric(event: FormEvent) {
    event.preventDefault();
    setMetricError(null);
    try {
      const body = {
        impressions: metric.impressions || 0,
        reach: metric.reach || 0,
        clicks: metric.clicks || 0,
        spend: metric.spend || "0",
        results: metric.results || 0,
      };
      const saved = await api<{ corrected: boolean }>(`/api/ads/campaigns/${id}/metrics/${metric.date}`, { method: "PUT", body: JSON.stringify(body) });
      setNotice(saved.corrected ? "Métrica do dia corrigida (registrada no histórico)." : "Métrica do dia lançada.");
      setMetric({ date: metric.date, impressions: "", reach: "", clicks: "", spend: "", results: "" });
      await load();
    } catch (err) {
      setMetricError(err instanceof ApiError ? (err.issues?.map((i) => i.message).join("; ") || err.message) : "Não foi possível lançar a métrica.");
    }
  }

  async function makeLink(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const query = linkUrl.trim() ? `?url=${encodeURIComponent(linkUrl.trim())}` : "";
      setLink(await api<AdLinkDto>(`/api/ads/campaigns/${id}/link${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? (err.issues?.map((i) => i.message).join("; ") || err.message) : "Não foi possível gerar o link.");
    }
  }

  if (notFound) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-slate-500">Campanha não encontrada.</p>
        <Link href="/anuncios/campanhas" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Voltar às campanhas</Link>
      </div>
    );
  }
  if (!campaign) {
    return <p className="py-16 text-center text-sm text-slate-500">{error ?? "Carregando..."}</p>;
  }

  const resultLabel = adObjectiveResultLabels[campaign.objective];
  const chart = campaign.metrics.slice(-31).map((m) => ({
    label: formatDay(m.date).slice(0, 5),
    bar: Number(m.spend),
    line: m.results,
  }));
  const rows: Array<[string, ReactNode]> = [
    ["Cliente", <Link key="c" href={`/clientes/${campaign.client.id}`} className="text-primary-700 hover:underline">{campaign.client.name}</Link>],
    ["Item anunciado", campaign.delivery ? <Link key="d" href={`/entregas/${campaign.delivery.id}`} className="text-primary-700 hover:underline">{campaign.promotedItem}</Link> : campaign.promotedItem],
    ["Plataforma", adPlatformLabels[campaign.platform]],
    ["Objetivo", adObjectiveLabels[campaign.objective]],
    ["Conta de anúncio", campaign.adAccount?.name ?? "—"],
    ["Contrato de gestão", campaign.subscription ? <Link key="s" href={`/assinaturas/${campaign.subscription.id}`} className="text-primary-700 hover:underline">{campaign.subscription.planName}</Link> : "—"],
    ["Verba de referência do cliente", [campaign.dailyBudget ? `${formatBrl(campaign.dailyBudget)}/dia` : null, campaign.totalBudget ? `${formatBrl(campaign.totalBudget)} no total` : null].filter(Boolean).join(" · ") || "—"],
    ["Período", campaign.startAt || campaign.endAt ? `${formatDay(campaign.startAt)} a ${formatDay(campaign.endAt)}` : "—"],
    ["Público", campaign.audienceNotes ?? "—"],
    ["Código UTM", <code key="u" className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{campaign.utmCampaign}</code>],
  ];
  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{campaign.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <AdStatusBadge status={campaign.status} />
            <span className="text-xs text-slate-500">{adPlatformLabels[campaign.platform]}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              {editing ? "Fechar edição" : "Editar"}
            </button>
          )}
          <Link href="/anuncios/campanhas" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Campanhas</Link>
        </div>
      </div>
      <AdsNav />

      {notice && <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {editing ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <CampaignForm
            campaign={campaign}
            onSaved={() => {
              setEditing(false);
              setNotice("Campanha atualizada.");
              void load();
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
          {campaign.notes && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{campaign.notes}</p>}
        </div>
      )}

      <IndicatorGrid indicators={campaign.indicators} resultLabel={resultLabel} />

      {chart.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Investimento × {resultLabel} por dia</h3>
          <ComboChart
            data={chart}
            barLabel="Investimento"
            lineLabel={resultLabel[0]!.toUpperCase() + resultLabel.slice(1)}
            formatBar={formatBrlCompact}
            formatLine={(value) => formatInt(Math.round(value))}
          />
        </div>
      )}

      {isAdmin && campaign.allowedStatuses.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Status</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label htmlFor="campaign-reason" className="mb-1 block text-xs text-slate-500">Motivo (obrigatório para pausar ou finalizar)</label>
              <input id="campaign-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Ex.: cliente pediu para pausar" />
            </div>
            {campaign.allowedStatuses.map((status) => (
              <button
                key={status}
                type="button"
                disabled={REASON_REQUIRED.includes(status) && reason.trim().length < 3}
                onClick={() => void changeStatus(status)}
                className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                  status === "ACTIVE" ? "bg-primary-700 text-white hover:bg-primary-800" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {STATUS_ACTION[status]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Link do anúncio com UTM</h3>
        <form onSubmit={makeLink} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label htmlFor="campaign-link-url" className="mb-1 block text-xs text-slate-500">Página de destino</label>
            <input id="campaign-link-url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={inputClass} placeholder="https://" />
          </div>
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Gerar link</button>
        </form>
        {link && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">{link.url}</code>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(link.url).then(() => setNotice("Link copiado."))} className="text-sm font-medium text-primary-700 hover:underline">
              Copiar
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Lançar métrica do dia</h3>
            <p className="mb-3 text-xs text-slate-500">Lançar de novo o mesmo dia corrige o valor (fica no histórico). Planilha e API têm prioridade sobre o lançamento manual.</p>
            <form onSubmit={saveMetric} className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="metric-date" className="mb-1 block text-xs text-slate-500">Dia</label>
                <input id="metric-date" type="date" max={todayBr()} value={metric.date} onChange={(e) => setMetric({ ...metric, date: e.target.value })} className={inputClass} />
              </div>
              {([
                ["impressions", "Impressões"],
                ["reach", "Alcance"],
                ["clicks", "Cliques"],
                ["spend", "Investimento (R$)"],
                ["results", `Resultados (${resultLabel})`],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`metric-${key}`} className="mb-1 block text-xs text-slate-500">{label}</label>
                  <input
                    id={`metric-${key}`}
                    inputMode={key === "spend" ? "decimal" : "numeric"}
                    value={metric[key]}
                    onChange={(e) => setMetric({ ...metric, [key]: e.target.value })}
                    className={inputClass}
                    placeholder={key === "spend" ? "0,00" : "0"}
                  />
                </div>
              ))}
              {metricError && <p className="text-xs text-red-700 sm:col-span-3">{metricError}</p>}
              <div className="sm:col-span-3">
                <button type="submit" className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">Salvar dia</button>
              </div>
            </form>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Importar planilha (CSV)</h3>
            <CsvImport campaignId={campaign.id} onImported={() => void load()} />
          </div>
        </div>
      )}

      <DataTable
        title="Métricas por dia"
        rows={[...campaign.metrics].reverse()}
        rowKey={(row) => row.date}
        empty={<>Nenhuma métrica lançada ainda.</>}
        columns={[
          { key: "date", header: "Dia", cell: (row) => <>{formatDay(row.date)}</> },
          {
            key: "source",
            header: "Origem",
            cell: (row) => (
              <>
                {adMetricSourceLabels[row.source]}
                {row.overridden.length > 0 && <span className="block text-xs text-slate-400">substitui {row.overridden.map((s) => adMetricSourceLabels[s]).join(", ")}</span>}
              </>
            ),
          },
          { key: "impressions", header: "Impressões", numeric: true, hideOnMobile: true, cell: (row) => <>{formatInt(row.impressions)}</> },
          { key: "clicks", header: "Cliques", numeric: true, cell: (row) => <>{formatInt(row.clicks)}</> },
          { key: "spend", header: "Investimento", numeric: true, cell: (row) => <>{formatBrl(row.spend)}</> },
          { key: "results", header: "Resultados", numeric: true, cell: (row) => <>{formatInt(row.results)}</> },
        ]}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Histórico</h3>
        {campaign.logs.length === 0 ? (
          <p className="text-sm text-slate-500">Sem registros.</p>
        ) : (
          <ol className="space-y-3 border-l border-slate-200 pl-4">
            {campaign.logs.map((log) => (
              <li key={log.id} className="text-sm">
                <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}{log.userName ? ` · ${log.userName}` : ""}</p>
                <p className="font-medium text-slate-800">{adLogActionLabels[log.action]}</p>
                {logText(log) && <p className="text-xs text-slate-500">{logText(log)}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
