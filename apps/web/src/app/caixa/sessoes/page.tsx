"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  cashSessionStatusLabels,
  type CashSessionDto,
  type Paginated,
} from "../../../lib/types";
import { DataTable } from "../../../components/ui/DataTable";
import { formatBrl } from "../../../lib/format";

export default function SessoesCaixaPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<CashSessionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
    });
  }, [router]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api<Paginated<CashSessionDto>>("/api/cash/sessions");
      setSessions(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as sessões.");
    }
  }, []);

  useEffect(() => {
    if (session) {
      void loadSessions();
    }
  }, [session, loadSessions]);

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Histórico de sessões de caixa</h2>
          <p className="text-sm text-slate-500">
            {total} sessão{total === 1 ? "" : "ões"} registrada{total === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/caixa"
            className="rounded-md border border-primary-600 px-3 py-2 text-sm font-medium text-primary-800 hover:bg-primary-100"
          >
            Caixa
          </Link>
          <Link
            href="/financeiro"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Resumo financeiro
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable
        rows={sessions}
        rowKey={(item) => item.id}
        empty={<>Nenhuma sessão de caixa registrada.</>}
        columns={[
          { key: "c0", header: "Abertura", cell: (item) => new Date(item.openedAt).toLocaleString("pt-BR") },
          { key: "c1", header: "Fechamento", cell: (item) => item.closedAt ? new Date(item.closedAt).toLocaleString("pt-BR") : "—" },
          { key: "c2", header: "Status", cell: (item) => <><span
                    className={
                      item.status === "OPEN"
                        ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    }
                  >
                    {cashSessionStatusLabels[item.status]}
                  </span></> },
          { key: "c3", header: "Aberto por", cell: (item) => item.openedBy.name },
          { key: "c4", header: "Fechado por", cell: (item) => item.closedBy?.name ?? "—" },
          { key: "c5", header: "Inicial", cell: (item) => <>{formatBrl(item.initialAmount)}</> },
          { key: "c6", header: "Saldo esperado", cell: (item) => <>{formatBrl(item.expectedBalance)}</>, className: "font-medium" },
          { key: "c7", header: "Contado", cell: (item) => <>{item.countedAmount ? `${formatBrl(item.countedAmount)}` : "—"}</> },
          { key: "c8", header: "Diferença", cell: (item) => <>{item.difference ? (
                    <span
                      className={
                        Number(item.difference) === 0
                          ? "text-primary-700"
                          : "font-medium text-red-700"
                      }
                    >
                      {formatBrl(item.difference)}
                    </span>
                  ) : (
                    "—"
                  )}</> },
          { key: "c9", header: "Ação", cell: (item) => <><Link
                    href={`/caixa/movimentos?sessionId=${item.id}`}
                    className="text-sm text-primary-700 hover:underline"
                  >
                    Movimentações
                  </Link></>, numeric: true },
        ]}
      />
    </div>
  );
}
