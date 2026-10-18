"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import type { CompanyModuleDto, OnboardingStatusDto } from "../../lib/types";
import { Tabs } from "../../components/ui/Tabs";
import { useToast } from "../../components/ui/Toast";
import { CompanyForm } from "../../components/settings/CompanyForm";
import { SecurityForm } from "../../components/settings/SecurityForm";
import { fetchSession } from "../../lib/session";

const segmentLabels: Record<string, string> = {
  COMERCIO: "Comércio",
  SERVICOS: "Serviços",
  HIBRIDO: "Comércio e serviços",
  PERSONALIZADO: "Personalizado",
};

/** Configurações da empresa (ADMIN): dados (Fase 7), módulos e perfil (Fase 4). */
export default function ConfiguracoesPage() {
  const [modules, setModules] = useState<CompanyModuleDto[]>([]);
  const [status, setStatus] = useState<OnboardingStatusDto | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [tab, setTab] = useState<"empresa" | "modulos" | "perfil" | "seguranca">("empresa");
  const toast = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetchSession().then((session) => setIsAdmin(session?.user.role === "ADMIN"));
  }, []);

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
      toast.success(`${updated.label}: ${updated.status === "ACTIVE" ? "ligado" : "desligado"}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(null);
    }
  }

  if (isAdmin === false) {
    return (
      <p role="alert" className="mx-auto max-w-3xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Acesso restrito: apenas administradores alteram as configurações da empresa.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Configurações</h2>
      <Tabs
        label="Configurações"
        items={[
          { key: "empresa", label: "Empresa" },
          { key: "modulos", label: "Módulos" },
          { key: "perfil", label: "Perfil do negócio" },
          { key: "seguranca", label: "Segurança" },
        ]}
        value={tab}
        onChange={setTab}
      >
      {tab === "empresa" && <CompanyForm />}
      {tab === "seguranca" && <SecurityForm />}

      {tab === "perfil" && (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Perfil do negócio</h3>
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
      )}

      {tab === "modulos" && (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Módulos</h3>
        <p className="mt-1 text-sm text-slate-600">
          Módulos desligados somem do menu e as rotas deles ficam bloqueadas. Os dados são mantidos.
          Módulos fora do seu plano aparecem como “Não contratado” — veja os preços em{" "}
          <Link href="/faturamento" className="font-medium text-primary-700 hover:underline">
            Faturamento
          </Link>
          .
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <ul className="mt-4 divide-y divide-slate-100">
          {modules.map((entry) => {
            const active = entry.status === "ACTIVE";
            if (entry.entitled === false) {
              return (
                <li key={entry.module} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-slate-500">{entry.label}</span>
                  <Link
                    href="/faturamento#monte-seu-plano"
                    className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Não contratado · contratar
                  </Link>
                </li>
              );
            }
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
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${active ? "bg-primary-700" : "bg-slate-300"}`}
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
      )}
      </Tabs>
    </div>
  );
}
