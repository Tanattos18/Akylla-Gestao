"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import { formatBrl, formatDate, formatDateTime } from "../../lib/format";
import {
  fiscalStatusLabels,
  fiscalTypeLabels,
  type FiscalConfigDto,
  type FiscalDocumentDto,
  type FiscalDocumentStatus,
  type FiscalDocumentType,
  type Paginated,
} from "../../lib/types";
import { useDialog } from "../../components/ui/Dialog";
import { DataTable } from "../../components/ui/DataTable";

/** Fase 3 — nota fiscal por integração: configuração (ADMIN) e documentos. */

const providers = [
  { value: "mock", label: "Simulada — autoriza na hora (sem valor fiscal)" },
  { value: "mock-async", label: "Simulada — assíncrona via webhook" },
  { value: "mock-reject", label: "Simulada — sempre rejeita (teste)" },
];

const statusClass: Record<FiscalDocumentStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  AUTHORIZED: "bg-emerald-50 text-emerald-800",
  REJECTED: "bg-red-50 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-700",
};

function formatCnpj(value: string | null): string {
  if (!value || value.length !== 14) return value ?? "";
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export default function FiscalPage() {
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<FiscalConfigDto | null>(null);
  const [form, setForm] = useState({ provider: "mock", environment: "HOMOLOGATION", cnpj: "", nfceSeries: "1", nfeSeries: "1", apiToken: "" });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [docs, setDocs] = useState<Paginated<FiscalDocumentDto> | null>(null);
  const [type, setType] = useState<"" | FiscalDocumentType>("");
  const [status, setStatus] = useState<"" | FiscalDocumentStatus>("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
    });
  }, [router]);

  const loadConfig = useCallback(async () => {
    const data = await api<FiscalConfigDto>("/api/fiscal/config");
    setConfig(data);
    setForm((f) => ({ ...f, provider: data.provider, environment: data.environment, cnpj: formatCnpj(data.cnpj), nfceSeries: String(data.nfceSeries), nfeSeries: String(data.nfeSeries) }));
  }, []);

  const loadDocs = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: "100" });
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    setDocs(await api<Paginated<FiscalDocumentDto>>(`/api/fiscal/documents?${params.toString()}`));
  }, [type, status]);

  useEffect(() => {
    if (!session) return;
    void loadDocs().catch((err) => setError(err instanceof ApiError ? err.message : "Falha ao carregar notas."));
    if (session.user.role === "ADMIN") void loadConfig().catch(() => undefined);
  }, [session, loadDocs, loadConfig]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await Promise.all([loadDocs(), isAdmin ? loadConfig() : Promise.resolve()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  function saveConfig(event: FormEvent, active?: boolean) {
    event.preventDefault();
    void run(
      () =>
        api("/api/fiscal/config", {
          method: "PUT",
          body: JSON.stringify({
            provider: form.provider,
            environment: form.environment,
            cnpj: form.cnpj.trim() || null,
            nfceSeries: Number(form.nfceSeries),
            nfeSeries: Number(form.nfeSeries),
            ...(form.apiToken.trim() ? { apiToken: form.apiToken.trim() } : {}),
            ...(active !== undefined ? { active } : {}),
          }),
        }).then(() => setForm((f) => ({ ...f, apiToken: "" }))),
      active === true ? "Emissão ativada." : active === false ? "Emissão desativada." : "Configuração salva.",
    );
  }

  function uploadCertificate(event: FormEvent) {
    event.preventDefault();
    if (!certFile) return setError("Selecione o arquivo .pfx");
    const data = new FormData();
    data.append("file", certFile);
    data.append("password", certPassword);
    void run(async () => {
      const response = await fetch("/api/fiscal/config/certificate", { method: "POST", body: data, credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(typeof body?.message === "string" ? body.message : "Falha no envio", response.status);
      }
      setCertPassword("");
      setCertFile(null);
    }, "Certificado validado e guardado (cifrado).");
  }

  async function cancelDocument(doc: FiscalDocumentDto) {
    const reason = await dialog.prompt({ title: `Cancelar ${fiscalTypeLabels[doc.type]} nº ${doc.number}`, description: "A SEFAZ exige uma justificativa de 15 a 255 caracteres.", label: "Justificativa", minLength: 15, maxLength: 255, multiline: true, danger: true, confirmLabel: "Cancelar nota" });
    if (!reason) return;
    void run(() => api(`/api/fiscal/documents/${doc.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }), "Nota cancelada.");
  }

  if (!session) return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Nota fiscal</h2>
        <p className="text-sm text-slate-500">NFC-e, NF-e e NFS-e emitidas por integradora autorizada (sem emissor próprio).</p>
      </div>

      {notice && <div role="status" className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>}
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {isAdmin && config && (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Configuração</h3>
            <span className={config.active ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"}>
              {config.active ? "Emissão ativa" : "Emissão desativada"}
            </span>
          </div>
          {config.simulated && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Emissora <strong>simulada</strong>: as notas não têm valor fiscal. Para emitir de verdade é preciso contratar uma
              integradora (NFE.io, Focus NFe, Spedy…), cadastrar o token da API e o certificado A1 — ver o guia do módulo.
            </p>
          )}
          <form onSubmit={(e) => saveConfig(e)} className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="f-provider" className="mb-1 block text-sm text-slate-700">Emissora</label>
              <select id="f-provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className={inputClass}>
                {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                {!providers.some((p) => p.value === form.provider) && <option value={form.provider}>{form.provider}</option>}
              </select>
            </div>
            <div>
              <label htmlFor="f-env" className="mb-1 block text-sm text-slate-700">Ambiente</label>
              <select id="f-env" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} className={inputClass}>
                <option value="HOMOLOGATION">Homologação (testes)</option>
                <option value="PRODUCTION">Produção</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-cnpj" className="mb-1 block text-sm text-slate-700">CNPJ do emitente</label>
              <input id="f-cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className={inputClass} />
            </div>
            <div>
              <label htmlFor="f-nfce" className="mb-1 block text-sm text-slate-700">Série NFC-e</label>
              <input id="f-nfce" type="number" min={1} max={999} value={form.nfceSeries} onChange={(e) => setForm({ ...form, nfceSeries: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="f-nfe" className="mb-1 block text-sm text-slate-700">Série NF-e</label>
              <input id="f-nfe" type="number" min={1} max={999} value={form.nfeSeries} onChange={(e) => setForm({ ...form, nfeSeries: e.target.value })} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="f-token" className="mb-1 block text-sm text-slate-700">Token da API da emissora {config.hasApiToken && <span className="text-xs text-emerald-700">(cadastrado — preencha só para trocar)</span>}</label>
              <input id="f-token" type="password" autoComplete="off" value={form.apiToken} onChange={(e) => setForm({ ...form, apiToken: e.target.value })} className={inputClass} />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <button type="submit" disabled={busy} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">Salvar</button>
              <button type="button" disabled={busy} onClick={(e) => saveConfig(e, !config.active)} className={config.active ? "rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50" : "rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"}>
                {config.active ? "Desativar" : "Ativar emissão"}
              </button>
            </div>
          </form>

          <form onSubmit={uploadCertificate} className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
            <div>
              <p className="mb-1 text-sm text-slate-700">Certificado A1</p>
              <p className="text-xs text-slate-600">
                {config.certificate.uploaded
                  ? `${config.certificate.subject ?? ""} · válido até ${config.certificate.validTo ? formatDate(config.certificate.validTo) : "—"}`
                  : "Nenhum certificado cadastrado."}
              </p>
            </div>
            <label className="text-sm text-slate-700">
              <span className="sr-only">Arquivo .pfx</span>
              <input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} className="text-sm" />
            </label>
            <div>
              <label htmlFor="f-certpass" className="mb-1 block text-xs text-slate-600">Senha do certificado</label>
              <input id="f-certpass" type="password" autoComplete="off" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <button type="submit" disabled={busy || !certFile} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">Enviar certificado</button>
          </form>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Documentos</h3>
          <select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value as "" | FiscalDocumentType)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todos os tipos</option>
            {(Object.keys(fiscalTypeLabels) as FiscalDocumentType[]).map((t) => <option key={t} value={t}>{fiscalTypeLabels[t]}</option>)}
          </select>
          <select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value as "" | FiscalDocumentStatus)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todas as situações</option>
            {(Object.keys(fiscalStatusLabels) as FiscalDocumentStatus[]).map((s) => <option key={s} value={s}>{fiscalStatusLabels[s]}</option>)}
          </select>
        </div>
        <DataTable
          rows={docs?.items ?? []}
          rowKey={(d) => d.id}
          empty={<>Nenhuma nota emitida.</>}
          columns={[
            { key: "c0", header: "Emissão", cell: (d) => formatDateTime(d.createdAt) },
            { key: "c1", header: "Tipo / nº", cell: (d) => <>{fiscalTypeLabels[d.type]} {d.number}/{d.series}{d.environment === "HOMOLOGATION" && <span className="ml-1 text-xs text-slate-600">(homolog.)</span>}</> },
            { key: "c2", header: "Origem", cell: (d) => <>{d.sale && <Link href={`/vendas/${d.sale.id}`} className="font-mono text-xs text-primary-700 hover:underline">{d.sale.receiptCode}</Link>}
                    {d.serviceOrder && <Link href={`/os/${d.serviceOrder.id}`} className="font-mono text-xs text-primary-700 hover:underline">OS-{String(d.serviceOrder.number).padStart(5, "0")}</Link>}</> },
            { key: "c3", header: "Valor", cell: (d) => formatBrl(d.amount), numeric: true },
            { key: "c4", header: "Situação", cell: (d) => <><span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[d.status]}`}>{fiscalStatusLabels[d.status]}</span></> },
            { key: "c5", header: "Chave / motivo", cell: (d) => <>{d.accessKey && <span className="break-all font-mono">{d.accessKey}</span>}
                    {d.rejectionReason && <span className="text-red-700">{d.rejectionReason}</span>}
                    {d.cancellationReason && <span>Cancelada: {d.cancellationReason}</span>}</>, className: "max-w-xs text-xs" },
            { key: "c6", header: "Ações", cell: (d) => <><div className="flex flex-wrap gap-3 text-xs font-medium">
                      {d.status === "AUTHORIZED" && <a href={`/api/fiscal/documents/${d.id}/xml`} className="text-primary-700 hover:underline">XML</a>}
                      {isAdmin && d.status === "AUTHORIZED" && (
                        <button type="button" disabled={busy} onClick={() => cancelDocument(d)} className="text-red-700 hover:underline">Cancelar</button>
                      )}
                    </div></> },
          ]}
        />
      </section>
    </div>
  );
}
