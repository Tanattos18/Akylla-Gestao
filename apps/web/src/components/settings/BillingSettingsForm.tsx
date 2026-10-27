"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { BILLING_TEXT_VARIABLES, DEFAULT_BILLING_TEXTS, type BillingSettingsDto, type BillingTextKey } from "../../lib/types";
import { useToast } from "../ui/Toast";

const TEXT_FIELDS: Array<{ key: BillingTextKey; label: string; hint: string }> = [
  { key: "billingTextBefore", label: "Aviso antes do vencimento", hint: "\"Seu plano vence em N dias\"" },
  { key: "billingTextOverdue", label: "Aviso de vencido", hint: "\"Vencido — renove sua conta\"" },
  { key: "billingTextAgreement", label: "Prazo combinado", hint: "Confirma a nova data acordada" },
  { key: "siteWarningText", label: "Faixa de pendência no site do cliente", hint: "Aparece no site (sem dados pessoais)" },
  { key: "siteSuspendedText", label: "Página de site suspenso", hint: "Aparece no lugar do site pausado/inativo" },
];

/**
 * Configurações › Contratos (2026-10-27): pausa automática (desligada por
 * padrão — quem decide é o dono) e textos das mensagens e do aviso no site.
 */
export function BillingSettingsForm() {
  const toast = useToast();
  const [settings, setSettings] = useState<BillingSettingsDto | null>(null);
  const [autoPause, setAutoPause] = useState(false);
  const [autoPauseDays, setAutoPauseDays] = useState("15");
  const [texts, setTexts] = useState<Record<BillingTextKey, string>>({ ...DEFAULT_BILLING_TEXTS });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function apply(value: BillingSettingsDto) {
    setSettings(value);
    setAutoPause(value.autoPauseEnabled);
    setAutoPauseDays(String(value.autoPauseDays));
    setTexts(value.texts);
  }

  useEffect(() => {
    api<BillingSettingsDto>("/api/billing-settings")
      .then(apply)
      .catch(() => setError("Não foi possível carregar as configurações de cobrança."));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = { autoPauseEnabled: autoPause, autoPauseDays: Number(autoPauseDays) };
      for (const field of TEXT_FIELDS) {
        // Igual ao padrão: grava vazio (continua acompanhando o padrão)
        body[field.key] = texts[field.key].trim() === DEFAULT_BILLING_TEXTS[field.key] ? "" : texts[field.key].trim();
      }
      apply(await api<BillingSettingsDto>("/api/billing-settings", { method: "PUT", body: JSON.stringify(body) }));
      toast.success("Configurações de cobrança salvas.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings && !error) return <p className="text-sm text-slate-500">Carregando...</p>;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Pausa dos sites dos clientes</h3>
        <p className="mt-1 text-sm text-slate-500">
          Por padrão o sistema <strong>não pausa nada sozinho</strong>: ele marca o contrato como &quot;em débito&quot; e você
          decide (pausar, dar prazo ou cobrar). Entregas &quot;nunca pausar&quot; ficam sempre de fora.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={autoPause} onChange={(e) => setAutoPause(e.target.checked)} />
          Pausar automaticamente o site após
          <input
            type="number"
            min={1}
            max={365}
            value={autoPauseDays}
            onChange={(e) => setAutoPauseDays(e.target.value)}
            disabled={!autoPause}
            aria-label="Dias de atraso para a pausa automática"
            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-60"
          />
          dias de atraso (fora de prazo combinado)
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Textos das mensagens</h3>
          <p className="mt-1 text-xs text-slate-500">
            Variáveis: {BILLING_TEXT_VARIABLES.join(" ")}. Usados nos botões &quot;Copiar&quot; do contrato e no aviso do site. Os
            lembretes automáticos do WhatsApp usam os modelos aprovados na Meta.
          </p>
        </div>
        {TEXT_FIELDS.map((field) => (
          <div key={field.key}>
            <label htmlFor={`text-${field.key}`} className="mb-1 block text-sm text-slate-700">
              {field.label} <span className="text-xs text-slate-500">· {field.hint}</span>
            </label>
            <textarea
              id={`text-${field.key}`}
              rows={2}
              value={texts[field.key]}
              onChange={(e) => setTexts({ ...texts, [field.key]: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
            {texts[field.key] !== DEFAULT_BILLING_TEXTS[field.key] && (
              <button type="button" onClick={() => setTexts({ ...texts, [field.key]: DEFAULT_BILLING_TEXTS[field.key] })} className="mt-1 text-xs text-primary-700 hover:underline">
                Voltar ao texto padrão
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
