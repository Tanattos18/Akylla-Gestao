"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import type { CompanyModuleDto, OnboardingStatusDto } from "../../lib/types";

const segmentLabels: Record<string, string> = {
  COMERCIO: "Comércio",
  SERVICOS: "Serviços",
  HIBRIDO: "Comércio e serviços",
  PERSONALIZADO: "Personalizado",
};

/** Configurações da empresa (Fase 4, ADMIN): perfil e módulos ligados. */
export default function ConfiguracoesPage() {
  const [modules, setModules] = useState<CompanyModuleDto[]>([]);
  const [status, setStatus] = useState<OnboardingStatusDto | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    api<CompanyModuleDto[]>("/api/company-modules").then(setModules).catch(() => setModules([]));
    api<OnboardingStatusDto>("/api/onboarding/status").then(setStatus).catch(() => setStatus(null));
  }, []);

  async function toggle(entry: CompanyModuleDto) {
    setSaving(entry.module);
    setError(null);
    try {
      const updated = await api<CompanyModuleDto>("/api/company-modules", {
        method: "PATCH",
        body: JSON.stringify({
          module: entry.module,
          status: entry.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
        }),
      });
      setModules((current) => current.map((m) => (m.module === updated.module ? updated : m)));
      setChanged(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Perfil do negócio</h2>
        <p className="mt-1 text-sm text-slate-600">
          {status?.segment ? (
            <>
              Perfil atual:{" "}
              <strong className="font-medium">{segmentLabels[status.segment] ?? status.segment}</strong>.
            </>
          ) : (
            "Nenhum perfil escolhido ainda."
          )}{" "}
          Trocar o perfil liga os módulos dele e desliga os demais.
        </p>
        <Link
          href="/onboarding"
          className="mt-3 inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Trocar perfil
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Módulos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Módulos desligados somem do menu e as rotas deles ficam bloqueadas. Os dados são mantidos.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <ul className="mt-4 divide-y divide-slate-100">
          {modules.map((entry) => {
            const active = entry.status === "ACTIVE";
            return (
              <li key={entry.module} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-slate-800">{entry.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={entry.label}
                  disabled={saving !== null}
                  onClick={() => void toggle(entry)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${active ? "bg-primary-600" : "bg-slate-300"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${active ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        {changed && (
          <p className="mt-3 text-sm text-slate-600">
            Alterações salvas.{" "}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-medium text-primary-700 hover:underline"
            >
              Atualizar o menu
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
