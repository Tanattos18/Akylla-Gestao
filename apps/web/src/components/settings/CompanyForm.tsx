"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { CompanyProfileDto } from "@petflow/shared";
import { api, ApiError } from "../../lib/api";
import { formatDocument } from "../../lib/format";
import { useToast } from "../ui/Toast";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

/** Dados da empresa (Fase 7 · 7.1): nome, CNPJ/CPF, contato e endereço do comprovante. */
export function CompanyForm() {
  const toast = useToast();
  const [profile, setProfile] = useState<CompanyProfileDto | null>(null);
  const [form, setForm] = useState({ name: "", document: "", phone: "", address: "" });
  const [slug, setSlug] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<CompanyProfileDto>("/api/company")
      .then((data) => {
        setProfile(data);
        setForm({
          name: data.name,
          document: data.document ? formatDocument(data.document) : "",
          phone: data.phone ?? "",
          address: data.address ?? "",
        });
        setSlug(data.slug);
      })
      .catch((err) => toast.error(err, "Não foi possível carregar os dados da empresa."));
  }, [toast]);

  function fieldErrors(err: unknown): Record<string, string> {
    if (!(err instanceof ApiError) || !err.issues) return {};
    return Object.fromEntries(err.issues.map((issue) => [issue.path, issue.message]));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const updated = await api<CompanyProfileDto>("/api/company", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          document: form.document.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
        }),
      });
      setProfile(updated);
      setForm((current) => ({ ...current, document: updated.document ? formatDocument(updated.document) : "" }));
      toast.success("Dados da empresa salvos.");
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(err, "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSlug(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const updated = await api<CompanyProfileDto>("/api/company/slug", {
        method: "PATCH",
        body: JSON.stringify({ slug }),
      });
      setProfile(updated);
      setSlug(updated.slug);
      toast.success("Identificador atualizado.");
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(err, "Não foi possível alterar o identificador.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <p className="text-sm text-slate-600">Carregando…</p>;

  const field = (id: keyof typeof form, label: string, hint?: string, placeholder?: string) => (
    <div>
      <label htmlFor={`company-${id}`} className="mb-1 block text-sm text-slate-700">
        {label}
      </label>
      <input
        id={`company-${id}`}
        value={form[id]}
        placeholder={placeholder}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={errors[id] ? `company-${id}-error` : hint ? `company-${id}-hint` : undefined}
        onChange={(event) => setForm((current) => ({ ...current, [id]: event.target.value }))}
        className={inputClass}
      />
      {errors[id] ? (
        <p id={`company-${id}-error`} className="mt-1 text-xs text-red-700">
          {errors[id]}
        </p>
      ) : (
        hint && (
          <p id={`company-${id}-hint`} className="mt-1 text-xs text-slate-600">
            {hint}
          </p>
        )
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Dados da empresa</h3>
        <p className="text-sm text-slate-600">Aparecem nos comprovantes e na ordem de serviço impressos.</p>
        {field("name", "Nome da empresa *")}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("document", "CNPJ ou CPF", "Só os números ou com máscara.", "00.000.000/0000-00")}
          {field("phone", "Telefone", undefined, "(11) 99999-9999")}
        </div>
        {field("address", "Endereço", "Uma linha: rua, número, bairro e cidade.")}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar dados"}
        </button>
      </form>

      <form onSubmit={saveSlug} className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Identificador da empresa</h3>
        <p className="text-sm text-slate-600">
          Usado em links e na seleção de empresa. Precisa ser único entre todas as empresas do Akylla.
        </p>
        <div>
          <label htmlFor="company-slug" className="mb-1 block text-sm text-slate-700">
            Identificador
          </label>
          <input
            id="company-slug"
            value={slug}
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby="company-slug-hint"
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            className={inputClass}
          />
          <p id="company-slug-hint" className={`mt-1 text-xs ${errors.slug ? "text-red-700" : "text-slate-600"}`}>
            {errors.slug ?? "Letras minúsculas, números e hífens."}
          </p>
        </div>
        <button
          type="submit"
          disabled={saving || slug === profile.slug}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          Alterar identificador
        </button>
      </form>
    </div>
  );
}
