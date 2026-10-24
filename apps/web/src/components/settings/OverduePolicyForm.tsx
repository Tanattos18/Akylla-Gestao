"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import type { OverduePolicyDto } from "../../lib/types";
import { useToast } from "../ui/Toast";

const inputClass =
  "w-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

/**
 * Política de atraso dos contratos (transformação 2026-10-23): aviso no dia
 * N e pausa da entrega no dia M. Por enquanto só fica registrada — nenhuma
 * entrega é pausada automaticamente, e entregas "nunca pausar" ficam de fora.
 */
export function OverduePolicyForm() {
  const toast = useToast();
  const [warnDays, setWarnDays] = useState("");
  const [pauseDays, setPauseDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<OverduePolicyDto>("/api/overdue-policy")
      .then((policy) => {
        setWarnDays(String(policy.warnDays));
        setPauseDays(String(policy.pauseDays));
      })
      .catch(() => setError("Não foi possível carregar a política de atraso."));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const policy = await api<OverduePolicyDto>("/api/overdue-policy", {
        method: "PUT",
        body: JSON.stringify({ warnDays: Number(warnDays), pauseDays: Number(pauseDays) }),
      });
      setWarnDays(String(policy.warnDays));
      setPauseDays(String(policy.pauseDays));
      toast.success("Política de atraso salva.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Atraso de contratos</h3>
        <p className="mt-1 text-sm text-slate-500">
          Quantos dias depois do vencimento o cliente recebe o aviso e quando a entrega seria pausada. Por enquanto
          a configuração só fica registrada: nenhuma entrega é pausada automaticamente, e as marcadas como
          &quot;nunca pausar&quot; sempre ficam de fora.
        </p>
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <label htmlFor="overdue-warn" className="mb-1 block text-sm text-slate-700">Aviso no dia</label>
          <input id="overdue-warn" type="number" min={0} max={365} value={warnDays} onChange={(e) => setWarnDays(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="overdue-pause" className="mb-1 block text-sm text-slate-700">Pausa no dia</label>
          <input id="overdue-pause" type="number" min={1} max={365} value={pauseDays} onChange={(e) => setPauseDays(e.target.value)} className={inputClass} />
        </div>
      </div>
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
