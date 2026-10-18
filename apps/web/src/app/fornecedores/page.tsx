"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import type { Paginated, SupplierDto } from "../../lib/types";
import { useDialog } from "../../components/ui/Dialog";
import { DataTable } from "../../components/ui/DataTable";

const emptyForm = {
  name: "",
  document: "",
  email: "",
  phone: "",
  notes: "",
};

export default function FornecedoresPage() {
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await api<Paginated<SupplierDto>>("/api/suppliers?pageSize=100");
      setSuppliers(data.items);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao carregar fornecedores.");
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
    if (session) void loadSuppliers();
  }, [session, loadSuppliers]);

  function startEdit(supplier: SupplierDto) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      document: supplier.document ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      notes: supplier.notes ?? "",
    });
    setFieldErrors({});
    setFormError(null);
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
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await api(`/api/suppliers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Fornecedor atualizado.");
      } else {
        await api("/api/suppliers", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Fornecedor criado.");
      }
      resetForm();
      await loadSuppliers();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o fornecedor.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(supplier: SupplierDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!await dialog.confirm(`Deseja ${label} o fornecedor "${supplier.name}"?`)) return;
    setNotice(null);
    try {
      await api(`/api/suppliers/${supplier.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Fornecedor ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadSuppliers();
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Fornecedores</h2>
          <p className="text-sm text-slate-500">Empresa {session.company.name}</p>
        </div>
        <Link
          href="/produtos"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar aos produtos
        </Link>
      </div>

      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}
      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {listError}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {editingId ? "Editar fornecedor" : "Novo fornecedor"}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="supplier-name" className="mb-1 block text-sm text-slate-700">
                Nome *
              </label>
              <input
                id="supplier-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.name}</p>
              )}
            </div>
            <div>
              <label htmlFor="supplier-document" className="mb-1 block text-sm text-slate-700">
                CPF/CNPJ
              </label>
              <input
                id="supplier-document"
                value={form.document}
                onChange={(event) => setForm({ ...form, document: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="supplier-email" className="mb-1 block text-sm text-slate-700">
                Email
              </label>
              <input
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={inputClass}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor="supplier-phone" className="mb-1 block text-sm text-slate-700">
                Telefone
              </label>
              <input
                id="supplier-phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="supplier-notes" className="mb-1 block text-sm text-slate-700">
                Observações
              </label>
              <textarea
                id="supplier-notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={2}
                className={inputClass}
              />
            </div>
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                {formError}
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <DataTable
        rows={suppliers}
        rowKey={(supplier) => supplier.id}
        empty={<>Nenhum fornecedor cadastrado.</>}
        columns={[
          { key: "c0", header: "Nome", cell: (supplier) => supplier.name, className: "font-medium" },
          { key: "c1", header: "Documento", cell: (supplier) => supplier.document ?? "—" },
          { key: "c2", header: "Contato", cell: (supplier) => [supplier.email, supplier.phone].filter(Boolean).join(" · ") || "—" },
          { key: "c3", header: "Status", cell: (supplier) => <><span
                    className={
                      supplier.status === "ACTIVE"
                        ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    }
                  >
                    {supplier.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </span></> },
          { key: "c4", header: "Ações", cell: (supplier) => <><div className="flex gap-3 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => startEdit(supplier)}
                        className="text-primary-700 hover:underline"
                      >
                        Editar
                      </button>
                      {supplier.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => void handleStatus(supplier, "INACTIVE")}
                          className="text-red-700 hover:underline"
                        >
                          Inativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleStatus(supplier, "ACTIVE")}
                          className="text-primary-700 hover:underline"
                        >
                          Reativar
                        </button>
                      )}
                    </div></>, hidden: !(isAdmin) },
        ]}
      />
    </div>
  );
}
