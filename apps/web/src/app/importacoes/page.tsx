"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, downloadCsv } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import {
  importTypeLabels,
  type ImportBatchDto,
  type ImportReport,
  type ImportType,
} from "../../lib/types";

const IMPORT_TYPES: ImportType[] = [
  "CATEGORY",
  "SUPPLIER",
  "PRODUCT",
  "CLIENT",
  "SERVICE",
];

const HISTORY_PAGE_SIZE = 10;

export default function ImportacoesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<ImportType>("CATEGORY");
  const [dryRun, setDryRun] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [history, setHistory] = useState<ImportBatchDto[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async (page: number) => {
    try {
      const data = await api<{ items: ImportBatchDto[]; total: number }>(
        `/api/imports?page=${page}&pageSize=${HISTORY_PAGE_SIZE}`,
      );
      setHistory(data.items);
      setHistoryTotal(data.total);
      setHistoryPage(page);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(
        err instanceof ApiError ? err.message : "Não foi possível carregar o histórico.",
      );
    }
  }, []);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
      if (value.user.role === "ADMIN") {
        void loadHistory(1);
      }
    });
  }, [router, loadHistory]);

  async function handleTemplate() {
    setError(null);
    try {
      await downloadCsv(
        `/api/imports/template?type=${type}`,
        `akylla_modelo_${type.toLowerCase()}.csv`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao baixar o modelo.");
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("dryRun", dryRun ? "true" : "false");
      formData.append("file", file);

      const response = await fetch("/api/imports", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new ApiError(
          typeof body?.message === "string"
            ? body.message
            : "Erro ao processar a importação",
          response.status,
          body?.issues,
        );
      }

      const result = body as ImportReport;
      setReport(result);
      if (result.dryRun) {
        setNotice("Simulação concluída — nada foi gravado.");
      } else {
        setNotice("Importação concluída.");
        setFile(null);
        const input = document.getElementById("import-file") as HTMLInputElement | null;
        if (input) input.value = "";
        await loadHistory(1);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      } else {
        setError(err instanceof ApiError ? err.message : "Falha ao enviar o arquivo.");
      }
    } finally {
      setUploading(false);
    }
  }

  const historyPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE));

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 font-semibold text-amber-900">Acesso restrito</h2>
        <p className="text-sm text-amber-800">
          Apenas administradores podem importar planilhas.{" "}
          <Link href="/" className="underline">
            Voltar ao início
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Importações</h2>
          <p className="text-sm text-slate-500">
            Alimente os dados da empresa com planilhas CSV (máx. 5.000 linhas).
          </p>
        </div>
        <Link
          href="/"
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
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          1. Escolha o tipo de dados
        </h3>
        <div className="flex flex-wrap gap-2">
          {IMPORT_TYPES.map((importType) => (
            <button
              key={importType}
              type="button"
              onClick={() => setType(importType)}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                type === importType
                  ? "border-primary-600 bg-primary-50 font-medium text-primary-800"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {importTypeLabels[importType]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Ordem sugerida: Categorias → Fornecedores → Produtos → Clientes →
          Serviços. Referências de categoria/fornecedor nos produtos são pelo
          nome, portanto importe-as antes.
        </p>
        <button
          type="button"
          onClick={handleTemplate}
          className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Baixar modelo CSV ({importTypeLabels[type]})
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          2. Envie o arquivo
        </h3>
        <form onSubmit={handleUpload} noValidate className="space-y-4">
          <div>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Simular (validar sem gravar nada)
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {uploading ? "Processando..." : dryRun ? "Simular importação" : "Importar"}
          </button>
        </form>
      </div>

      {report && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            3. Resultado {report.dryRun ? "(simulação)" : ""}
          </h3>
          <p className="mb-4 text-sm text-slate-700">
            Arquivo <span className="font-medium">{report.filename}</span> —{" "}
            {report.totalRows} linha(s) de dados:{" "}
            <span className="font-medium text-emerald-700">{report.created} criada(s)</span>,{" "}
            <span className="font-medium text-amber-700">{report.skipped} ignorada(s)</span>,{" "}
            <span className="font-medium text-red-700">{report.errors} erro(s)</span>.
          </p>
          {report.errorDetails.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">Linha</th>
                    <th className="py-2">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {report.errorDetails.map((detail) => (
                    <tr key={detail.row} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-600">
                        {detail.row}
                      </td>
                      <td className="py-2 text-slate-700">{detail.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.errors > report.errorDetails.length && (
                <p className="mt-2 text-xs text-slate-500">
                  Mostrando as primeiras {report.errorDetails.length} de{" "}
                  {report.errors} ocorrências.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Histórico de importações
        </h3>
        {historyError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {historyError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Arquivo</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Criados</th>
                <th className="py-2 pr-4">Ignorados</th>
                <th className="py-2 pr-4">Erros</th>
                <th className="py-2">Por</th>
              </tr>
            </thead>
            <tbody>
              {history.map((batch) => (
                <tr key={batch.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-600">
                    {new Date(batch.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-4 text-slate-800">
                    {importTypeLabels[batch.type]}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{batch.filename}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        batch.status === "COMPLETED"
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                          : "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                      }
                    >
                      {batch.status === "COMPLETED" ? "Concluída" : "Falhou"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{batch.createdCount}</td>
                  <td className="py-2 pr-4">{batch.skippedCount}</td>
                  <td className="py-2 pr-4">{batch.errorCount}</td>
                  <td className="py-2 text-slate-600">{batch.createdByName}</td>
                </tr>
              ))}
              {history.length === 0 && !historyError && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-slate-400">
                    Nenhuma importação realizada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {historyTotal > HISTORY_PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Página {historyPage} de {historyPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={historyPage <= 1}
                onClick={() => void loadHistory(historyPage - 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={historyPage >= historyPages}
                onClick={() => void loadHistory(historyPage + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
