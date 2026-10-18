"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import type { Paginated, ProfessionalDto } from "../../lib/types";

/** Fase 2 · 2.1 — cadastro de profissionais que recebem comissão. */

const emptyForm = { name: "", document: "", commissionDefault: "" };

export default function ProfissionaisPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProfessionalDto[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const load = useCallback(async () => {
    try {
      const data = await api<Paginated<ProfessionalDto>>("/api/professionals?pageSize=100");
      setItems(data.items);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao carregar profissionais.");
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
    });
  }, [router]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  function startEdit(p: ProfessionalDto) {
    setEditingId(p.id);
    setForm({ name: p.name, document: p.document ?? "", commissionDefault: p.commissionDefault ?? "" });
    setFieldErrors({});
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    if (form.name.trim().length < 2) {
      setFieldErrors({ name: "Nome deve ter ao menos 2 caracteres" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        document: form.document.trim() || null,
        commissionDefault: form.commissionDefault.trim().replace(",", ".") || null,
      };
      if (editingId) {
        await api(`/api/professionals/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice("Profissional atualizado.");
      } else {
        await api("/api/professionals", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Profissional cadastrado.");
      }
      resetForm();
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o profissional.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(p: ProfessionalDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!window.confirm(`Deseja ${label} "${p.name}"?`)) return;
    try {
      await api(`/api/professionals/${p.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`Profissional ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao atualizar status.");
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Profissionais</h2>
          <p className="text-sm text-slate-500">
            Quem recebe comissão nas vendas (vendedores, tosadores, cabeleireiros…)
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/comissoes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Comissões
          </Link>
          {isAdmin && (
            <Link href="/comissoes/regras" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Regras
            </Link>
          )}
        </div>
      </div>

      {notice && (
        <div role="status" className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}
      {listError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {listError}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {editingId ? "Editar profissional" : "Novo profissional"}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="prof-name" className="mb-1 block text-sm text-slate-700">Nome *</label>
              <input id="prof-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} aria-invalid={Boolean(fieldErrors.name)} />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="prof-document" className="mb-1 block text-sm text-slate-700">CPF/documento</label>
              <input id="prof-document" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="prof-default" className="mb-1 block text-sm text-slate-700">Comissão padrão (%)</label>
              <input id="prof-default" inputMode="decimal" placeholder="10" value={form.commissionDefault} onChange={(e) => setForm({ ...form, commissionDefault: e.target.value })} className={inputClass} aria-invalid={Boolean(fieldErrors.commissionDefault)} />
              {fieldErrors.commissionDefault && <p className="mt-1 text-xs text-red-600">{fieldErrors.commissionDefault}</p>}
              <p className="mt-1 text-xs text-slate-500">Usada quando nenhuma regra específica se aplica.</p>
            </div>
            {formError && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-3">
                {formError}
              </div>
            )}
            <div className="flex gap-2 sm:col-span-3">
              <button type="submit" disabled={saving} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
                {saving ? "Salvando..." : editingId ? "Salvar" : "Cadastrar"}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Profissional</th>
              <th className="px-4 py-3 text-right">Comissão padrão</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{p.name}</p>
                  {p.document && <p className="text-xs text-slate-500">{p.document}</p>}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {p.commissionDefault ? `${Number(p.commissionDefault).toLocaleString("pt-BR")}%` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={p.status === "ACTIVE" ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"}>
                    {p.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs font-medium">
                      <button type="button" onClick={() => startEdit(p)} className="text-primary-700 hover:underline">Editar</button>
                      {p.status === "ACTIVE" ? (
                        <button type="button" onClick={() => void handleStatus(p, "INACTIVE")} className="text-red-700 hover:underline">Inativar</button>
                      ) : (
                        <button type="button" onClick={() => void handleStatus(p, "ACTIVE")} className="text-primary-700 hover:underline">Reativar</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">Nenhum profissional cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
