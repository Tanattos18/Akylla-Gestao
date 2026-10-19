"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import type { ClientDto, Paginated } from "../../lib/types";
import { useDialog } from "../../components/ui/Dialog";
import { DataTable } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { Pagination } from "../../components/ui/Pagination";

const PAGE_SIZE = 20;

const emptyForm = {
  name: "",
  phone: "",
  mobile: "",
  email: "",
  cpf: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};

export default function ClientesPage() {
  const toast = useToast();
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientDto[]>([]);
  // Auditoria (bloco 5): lista paginada com total
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadClients = useCallback(async (term: string, pageNumber = 1) => {
    try {
      const query = term.trim()
        ? `&search=${encodeURIComponent(term.trim())}`
        : "";
      const data = await api<Paginated<ClientDto>>(`/api/clients?pageSize=${PAGE_SIZE}&page=${pageNumber}${query}`);
      setClients(data.items);
      setTotal(data.total);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao carregar clientes.");
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

  // Busca inicial via ?search= (ex.: busca global do header)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("search");
    if (q) setSearch(q);
  }, []);

  useEffect(() => {
    if (session) void loadClients(search, page);
  }, [session, loadClients, search, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  function startEdit(client: ClientDto) {
    setEditingId(client.id);
    setForm({
      name: client.name,
      phone: client.phone ?? "",
      mobile: client.mobile ?? "",
      email: client.email ?? "",
      cpf: client.cpf ?? "",
      street: client.street ?? "",
      number: client.number ?? "",
      complement: client.complement ?? "",
      district: client.district ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      zip: client.zip ?? "",
      notes: client.notes ?? "",
    });
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
        phone: form.phone.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        cpf: form.cpf.trim() || null,
        street: form.street.trim() || null,
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        district: form.district.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await api(`/api/clients/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Cliente atualizado.");
      } else {
        await api("/api/clients", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Cliente criado.");
      }
      resetForm();
      await loadClients(search, page);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o cliente.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(client: ClientDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!await dialog.confirm(`Deseja ${label} o cliente "${client.name}"?`)) return;
    try {
      await api(`/api/clients/${client.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(`Cliente ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadClients(search, page);
    } catch (err) {
      toast.error(err, "Falha ao atualizar status.");
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
          <h2 className="text-xl font-semibold text-slate-900">Clientes</h2>
          <p className="text-sm text-slate-500">Empresa {session.company.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/servicos"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Serviços
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {listError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {editingId ? "Editar cliente" : "Novo cliente"}
        </h3>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="client-name" className="mb-1 block text-sm text-slate-700">
              Nome *
            </label>
            <input
              id="client-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={inputClass}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.name}</p>
            )}
          </div>
          <div>
            <label htmlFor="client-phone" className="mb-1 block text-sm text-slate-700">
              Telefone
            </label>
            <input
              id="client-phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="(11) 99999-8888"
              className={inputClass}
            />
            {fieldErrors.phone && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.phone}</p>
            )}
          </div>
          <div>
            <label htmlFor="client-mobile" className="mb-1 block text-sm text-slate-700">
              Celular
            </label>
            <input
              id="client-mobile"
              value={form.mobile}
              onChange={(event) => setForm({ ...form, mobile: event.target.value })}
              className={inputClass}
            />
            {fieldErrors.mobile && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.mobile}</p>
            )}
          </div>
          <div>
            <label htmlFor="client-email" className="mb-1 block text-sm text-slate-700">
              Email
            </label>
            <input
              id="client-email"
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
            <label htmlFor="client-cpf" className="mb-1 block text-sm text-slate-700">
              CPF
            </label>
            <input
              id="client-cpf"
              value={form.cpf}
              onChange={(event) => setForm({ ...form, cpf: event.target.value })}
              placeholder="000.000.000-00"
              className={inputClass}
            />
            {fieldErrors.cpf && (
              <p className="mt-1 text-xs text-red-700">{fieldErrors.cpf}</p>
            )}
          </div>
          <div>
            <label htmlFor="client-street" className="mb-1 block text-sm text-slate-700">
              Rua
            </label>
            <input
              id="client-street"
              value={form.street}
              onChange={(event) => setForm({ ...form, street: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="client-number" className="mb-1 block text-sm text-slate-700">
              Número
            </label>
            <input
              id="client-number"
              value={form.number}
              onChange={(event) => setForm({ ...form, number: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="client-complement" className="mb-1 block text-sm text-slate-700">
              Complemento
            </label>
            <input
              id="client-complement"
              value={form.complement}
              onChange={(event) => setForm({ ...form, complement: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="client-district" className="mb-1 block text-sm text-slate-700">
              Bairro
            </label>
            <input
              id="client-district"
              value={form.district}
              onChange={(event) => setForm({ ...form, district: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="client-city" className="mb-1 block text-sm text-slate-700">
              Cidade
            </label>
            <input
              id="client-city"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="client-state" className="mb-1 block text-sm text-slate-700">
              UF
            </label>
            <input
              id="client-state"
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value })}
              maxLength={2}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="client-zip" className="mb-1 block text-sm text-slate-700">
              CEP
            </label>
            <input
              id="client-zip"
              value={form.zip}
              onChange={(event) => setForm({ ...form, zip: event.target.value })}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="client-notes" className="mb-1 block text-sm text-slate-700">
              Observações
            </label>
            <textarea
              id="client-notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={2}
              className={inputClass}
            />
          </div>
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 lg:col-span-3">
              {formError}
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
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

      <div className="flex items-center gap-3">
        <label htmlFor="client-search" className="text-sm text-slate-600">
          Buscar
        </label>
        <input
          id="client-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nome, telefone, email ou CPF"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
      </div>

      <DataTable
        rows={clients}
        rowKey={(client) => client.id}
        empty={<>Nenhum cliente encontrado.</>}
        columns={[
          { key: "c0", header: "Nome", cell: (client) => client.name, className: "font-medium" },
          { key: "c1", header: "Contato", cell: (client) => [client.mobile, client.phone, client.email].filter(Boolean).join(" · ") ||
                    "—" },
          { key: "c2", header: "Cidade", cell: (client) => [client.city, client.state].filter(Boolean).join("/") || "—" },
          { key: "c4", header: "Status", cell: (client) => <><span
                    className={
                      client.status === "ACTIVE"
                        ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    }
                  >
                    {client.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </span></> },
          { key: "c5", header: "Ações", cell: (client) => <><div className="flex gap-3 text-xs font-medium">
                    <Link href={`/clientes/${client.id}`} className="text-primary-700 hover:underline">
                      Ficha
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEdit(client)}
                      className="text-primary-700 hover:underline"
                    >
                      Editar
                    </button>
                    {client.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => void handleStatus(client, "INACTIVE")}
                        className="text-red-700 hover:underline"
                      >
                        Inativar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleStatus(client, "ACTIVE")}
                        className="text-primary-700 hover:underline"
                      >
                        Reativar
                      </button>
                    )}
                  </div></> },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} label="clientes" />
    </div>
  );
}
