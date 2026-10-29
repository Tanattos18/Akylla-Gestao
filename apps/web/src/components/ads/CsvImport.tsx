"use client";

import { useState } from "react";
import { ApiError } from "../../lib/api";
import { formatBrl } from "../../lib/format";
import type { AdImportReportDto } from "../../lib/types";
import { DataTable } from "../ui/DataTable";
import { formatDay, formatInt } from "./AdsShared";

const FORMAT_LABELS: Record<AdImportReportDto["format"], string> = {
  META: "Gerenciador de Anúncios da Meta",
  GOOGLE: "Google Ads",
  GENERIC: "planilha genérica",
};

/**
 * Fase A2: importar o CSV exportado do Gerenciador de Anúncios (Meta) ou do
 * Google Ads. Primeiro mostra a prévia (nada é gravado); depois confirma.
 */
export function CsvImport({ campaignId, onImported }: { campaignId: string; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [preview, setPreview] = useState<AdImportReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(dryRun: boolean, chosen = campaignName) {
    if (!file) {
      setError("Selecione o arquivo CSV.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("dryRun", dryRun ? "true" : "false");
      if (chosen) form.append("campaignName", chosen);
      form.append("file", file);
      const response = await fetch(`/api/ads/campaigns/${campaignId}/metrics/import`, { method: "POST", credentials: "same-origin", body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiError(typeof body?.message === "string" ? body.message : "Falha ao ler a planilha", response.status);
      }
      const report = body as AdImportReportDto;
      if (dryRun) {
        setPreview(report);
        if (report.selectedCampaign && !chosen) setCampaignName(report.selectedCampaign);
      } else {
        setPreview(null);
        setFile(null);
        setCampaignName("");
        const input = document.getElementById(`ads-csv-${campaignId}`) as HTMLInputElement | null;
        if (input) input.value = "";
        setNotice(`${report.imported} dia(s) importado(s) da planilha.`);
        onImported();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao enviar a planilha.");
    } finally {
      setBusy(false);
    }
  }

  const needsChoice = preview !== null && preview.campaignNames.length > 1 && !preview.selectedCampaign;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Na Meta: Gerenciador de Anúncios › Relatórios › Exportar dados da tabela (.csv), com <strong>Detalhamento › Por tempo › Dia</strong>.
        No Google Ads: Campanhas › Download › CSV, com a coluna <strong>Dia</strong> no segmento. Números com vírgula decimal são aceitos.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`ads-csv-${campaignId}`} className="mb-1 block text-sm text-slate-700">Arquivo .csv</label>
          <input
            id={`ads-csv-${campaignId}`}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setCampaignName("");
            }}
            className="text-sm"
          />
        </div>
        <button type="button" disabled={busy || !file} onClick={() => void send(true)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {busy ? "Lendo..." : "Ver prévia"}
        </button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>}

      {preview && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Formato: <strong>{FORMAT_LABELS[preview.format]}</strong>. Colunas usadas:{" "}
            {Object.values(preview.columns).join(", ")}.
            {preview.skipped > 0 && ` ${preview.skipped} linha(s) de total ignorada(s).`}
          </p>
          {preview.campaignNames.length > 1 && (
            <div>
              <label htmlFor={`ads-csv-campaign-${campaignId}`} className="mb-1 block text-sm text-slate-700">A planilha tem várias campanhas. Importar:</label>
              <select
                id={`ads-csv-campaign-${campaignId}`}
                value={campaignName}
                onChange={(e) => {
                  setCampaignName(e.target.value);
                  if (e.target.value) void send(true, e.target.value);
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Escolha a campanha</option>
                {preview.campaignNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          {preview.errors.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">{preview.errors.length} linha(s) com problema (não serão importadas):</p>
              <ul className="mt-1 list-disc pl-5">
                {preview.errors.slice(0, 10).map((issue) => (
                  <li key={issue.row}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
          <DataTable
            title="Prévia (nada foi gravado ainda)"
            rows={preview.rows}
            rowKey={(row) => row.date}
            empty={<>{needsChoice ? "Escolha a campanha para ver os dias." : "Nenhuma linha válida."}</>}
            columns={[
              { key: "date", header: "Dia", cell: (row) => <>{formatDay(row.date)}{row.replaces && <span className="ml-1 text-xs text-amber-700">(substitui)</span>}</> },
              { key: "impressions", header: "Impressões", numeric: true, cell: (row) => <>{formatInt(row.impressions)}</> },
              { key: "clicks", header: "Cliques", numeric: true, cell: (row) => <>{formatInt(row.clicks)}</> },
              { key: "spend", header: "Investimento", numeric: true, cell: (row) => <>{formatBrl(row.spend)}</> },
              { key: "results", header: "Resultados", numeric: true, cell: (row) => <>{formatInt(row.results)}</> },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || needsChoice || preview.rows.length === 0}
              onClick={() => void send(false)}
              className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
            >
              Importar {preview.rows.length} dia(s) — {formatBrl(preview.totals.spend)}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="text-sm text-slate-600 hover:underline">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
