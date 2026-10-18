"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import {
  fiscalStatusLabels,
  fiscalTypeLabels,
  type FiscalDocumentDto,
  type FiscalDocumentType,
  type FiscalStatusDto,
  type Paginated,
} from "../../lib/types";

/**
 * Emissão de nota a partir da venda/OS (Fase 3). Só aparece para ADMIN e com
 * a emissão fiscal ativa. Mostra a nota já existente, se houver.
 */
export function EmitFiscalButton({
  saleId,
  serviceOrderId,
  types,
  isAdmin,
}: {
  saleId?: string;
  serviceOrderId?: string;
  types: FiscalDocumentType[];
  isAdmin: boolean;
}) {
  const [status, setStatus] = useState<FiscalStatusDto | null>(null);
  const [documents, setDocuments] = useState<FiscalDocumentDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = saleId ? `saleId=${saleId}` : `serviceOrderId=${serviceOrderId}`;

  useEffect(() => {
    api<FiscalStatusDto>("/api/fiscal/status", { redirectOnUnauthorized: false })
      .then(setStatus)
      .catch(() => setStatus(null));
    api<Paginated<FiscalDocumentDto>>(`/api/fiscal/documents?${query}&pageSize=10`, { redirectOnUnauthorized: false })
      .then((d) => setDocuments(d.items))
      .catch(() => setDocuments([]));
  }, [query]);

  async function emit(type: FiscalDocumentType) {
    setBusy(true);
    setError(null);
    try {
      const document = await api<FiscalDocumentDto>("/api/fiscal/documents", {
        method: "POST",
        body: JSON.stringify({ ...(saleId ? { saleId } : { serviceOrderId }), type }),
      });
      setDocuments((current) => [document, ...current]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível emitir a nota.");
    } finally {
      setBusy(false);
    }
  }

  if (!status?.active && documents.length === 0) return null;
  const blocking = (type: FiscalDocumentType) =>
    documents.some((d) => d.type === type && (d.status === "AUTHORIZED" || d.status === "PENDING"));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm print:hidden" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-800">
          Nota fiscal {status?.simulated && <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">simulada — sem valor fiscal</span>}
          {status?.environment === "HOMOLOGATION" && !status.simulated && <span className="ml-1 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-800">homologação</span>}
        </p>
        {isAdmin && status?.active && (
          <div className="flex flex-wrap gap-2">
            {types.filter((t) => !blocking(t)).map((type) => (
              <button key={type} type="button" disabled={busy} onClick={() => void emit(type)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                {busy ? "Emitindo..." : `Emitir ${fiscalTypeLabels[type]}`}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      {documents.length > 0 && (
        <ul className="mt-2 space-y-1">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
              <span className="font-medium">{fiscalTypeLabels[d.type]} nº {d.number}</span>
              <span>· {fiscalStatusLabels[d.status]}</span>
              {d.accessKey && <span className="font-mono">· {d.accessKey}</span>}
              {d.rejectionReason && <span className="text-red-700">· {d.rejectionReason}</span>}
              {d.status === "AUTHORIZED" && (
                <a href={`/api/fiscal/documents/${d.id}/xml`} className="font-medium text-primary-700 hover:underline">XML</a>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/fiscal" className="mt-2 inline-block text-xs text-slate-600 hover:underline">Ver todas as notas</Link>
    </div>
  );
}
