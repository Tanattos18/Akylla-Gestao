"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { businessModuleLabels } from "@petflow/shared";
import { api, ApiError } from "../../lib/api";
import { fetchSession } from "../../lib/session";
import type { OnboardingPresetDto, OnboardingSegment, OnboardingStatusDto } from "../../lib/types";

/** Escolha do perfil do negócio (Fase 4): liga os módulos certos. */
export default function OnboardingPage() {
  const [presets, setPresets] = useState<OnboardingPresetDto[]>([]);
  const [status, setStatus] = useState<OnboardingStatusDto | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState<OnboardingSegment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession().then((s) => setIsAdmin(s?.user.role === "ADMIN"));
    api<OnboardingPresetDto[]>("/api/onboarding/presets").then(setPresets).catch(() => setPresets([]));
    api<OnboardingStatusDto>("/api/onboarding/status").then(setStatus).catch(() => setStatus(null));
  }, []);

  async function choose(slug: OnboardingSegment) {
    setBusy(slug);
    setError(null);
    try {
      await api("/api/onboarding/apply", { method: "POST", body: JSON.stringify({ slug }) });
      // Recarrega para o menu refletir os módulos ligados
      window.location.href = slug === "PERSONALIZADO" ? "/configuracoes" : "/";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível aplicar o perfil.");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="text-xl font-semibold text-slate-900">Como é o seu negócio?</h2>
      <p className="mt-1 text-sm text-slate-600">
        Escolha o perfil e o Akylla liga os módulos certos. Você pode mudar isso depois em Configurações.
      </p>
      {!isAdmin && (
        <p role="status" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Só o administrador da empresa pode escolher o perfil.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {presets.map((preset) => {
          const current = status?.segment === preset.slug;
          return (
            <div
              key={preset.slug}
              className={`flex flex-col rounded-lg border bg-white p-5 shadow-sm ${current ? "border-primary-500" : "border-slate-200"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{preset.name}</h3>
                {current && (
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                    Perfil atual
                  </span>
                )}
              </div>
              <p className="mt-1 flex-1 text-sm text-slate-600">{preset.description}</p>
              {preset.defaultModules.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1" aria-label="Módulos ligados">
                  {preset.defaultModules.map((m) => (
                    <li key={m} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {businessModuleLabels[m]}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                disabled={!isAdmin || busy !== null}
                onClick={() => void choose(preset.slug)}
                className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy === preset.slug
                  ? "Aplicando..."
                  : preset.slug === "PERSONALIZADO"
                    ? "Escolher os módulos"
                    : `Usar perfil ${preset.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm">
        <Link href="/" className="text-slate-600 hover:underline">
          Pular por enquanto
        </Link>
      </p>
    </div>
  );
}
