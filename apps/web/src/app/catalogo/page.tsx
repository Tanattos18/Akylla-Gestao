"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import {
  digitalBillingPeriodLabels,
  digitalProductTypeLabels,
  type DigitalBillingPeriod,
  type DigitalProductDto,
  type DigitalProductType,
  type Paginated,
} from "../../lib/types";
import { useDialog } from "../../components/ui/Dialog";
import { DataTable } from "../../components/ui/DataTable";
import { Pagination } from "../../components/ui/Pagination";
import { formatBrl } from "../../lib/format";

const PAGE_SIZE = 20;
const TYPES = Object.keys(digitalProductTypeLabels) as DigitalProductType[];

const emptyForm = {
  name: "",
  type: "SITE" as DigitalProductType,
  defaultPrice: "",
  billingPeriod: "MONTHLY" as DigitalBillingPeriod,
  description: "",
};

/** Catálogo de produtos digitais (transformação 2026-10-23). */
export default function CatalogoPage() {
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<DigitalProductDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const load = useCallback(async (term: string, type: string, pageNumber: number) => {
    try {
      const query = new URLSearchParams({ page: String(pageNumber), pageSize: String(PAGE_SIZE) });
      if (term.trim()) query.set("search", term.trim());
      if (type) query.set("type", type);
      const data = await api<Paginated<DigitalProductDto>>(`/api/digital-products?${query.toString()}`);
      setItems(data.items);
      setTotal(data.total);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao carregar o catálogo.");
    }
  }, []);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
    });
  }, [router]);

  useEffect(() => {
    if (session) void load(search, typeFilter, page);
  }, [session, load, search, typeFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  function startEdit(product: DigitalProductDto) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      type: product.type,
      defaultPrice: product.defaultPrice,
      billingPeriod: product.billingPeriod,
      description: product.description ?? "",
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
    if (!form.defaultPrice.trim()) {
      setFieldErrors({ defaultPrice: "Preço é obrigatório" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        defaultPrice: form.defaultPrice.trim(),
        billingPeriod: form.billingPeriod,
        description: form.description.trim() || null,
      };
      if (editingId) {
        await api(`/api/digital-products/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice("Produto atualizado.");
      } else {
        await api("/api/digital-products", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Produto criado.");
      }
      resetForm();
      await load(search, typeFilter, page);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível salvar o produto.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(product: DigitalProductDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!(await dialog.confirm(`Deseja ${label} o produto "${product.name}"?`))) return;
    try {
      await api(`/api/digital-products/${product.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`Produto ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await load(search, typeFilter, page);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao atualizar status.");
    }
  }

  if (!session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Catálogo digital</h2>
        <p className="text-sm text-slate-500">
          Sites, perfis, sistemas, lojas virtuais, hospedagem, domínios e manutenção, com preço padrão e
          periodicidade.
        </p>
      </div>

      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>
      )}
      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{listError}</div>
      )}

      {isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {editingId ? "Editar produto" : "Novo produto"}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dp-name" className="mb-1 block text-sm text-slate-700">Nome *</label>
              <input id="dp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-700">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="dp-type" className="mb-1 block text-sm text-slate-700">Tipo *</label>
              <select id="dp-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DigitalProductType })} className={inputClass}>
                {TYPES.map((type) => (
                  <option key={type} value={type}>{digitalProductTypeLabels[type]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dp-price" className="mb-1 block text-sm text-slate-700">Preço padrão (R$) *</label>
              <input id="dp-price" inputMode="decimal" value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} placeholder="150,00" className={inputClass} />
              {fieldErrors.defaultPrice && <p className="mt-1 text-xs text-red-700">{fieldErrors.defaultPrice}</p>}
            </div>
            <div>
              <label htmlFor="dp-period" className="mb-1 block text-sm text-slate-700">Periodicidade</label>
              <select id="dp-period" value={form.billingPeriod} onChange={(e) => setForm({ ...form, billingPeriod: e.target.value as DigitalBillingPeriod })} className={inputClass}>
                <option value="MONTHLY">Mensal</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="dp-description" className="mb-1 block text-sm text-slate-700">Descrição</label>
              <textarea id="dp-description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
            </div>
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{formError}</div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
                {saving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
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

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="dp-search" className="sr-only">Buscar</label>
        <input id="dp-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou descrição" className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" />
        <label htmlFor="dp-filter" className="sr-only">Tipo</label>
        <select id="dp-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os tipos</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>{digitalProductTypeLabels[type]}</option>
          ))}
        </select>
      </div>

      <DataTable
        rows={items}
        rowKey={(product) => product.id}
        empty={<>Nenhum produto digital cadastrado.</>}
        columns={[
          {
            key: "name",
            header: "Produto",
            cell: (product) => (
              <>
                <p className="font-medium text-slate-800">{product.name}</p>
                {product.description && <p className="text-xs text-slate-500">{product.description}</p>}
              </>
            ),
          },
          { key: "type", header: "Tipo", cell: (product) => <>{digitalProductTypeLabels[product.type]}</> },
          {
            key: "price",
            header: "Preço padrão",
            cell: (product) => <>{formatBrl(product.defaultPrice)} / {digitalBillingPeriodLabels[product.billingPeriod].toLowerCase()}</>,
            className: "font-medium",
          },
          { key: "deliveries", header: "Entregas", cell: (product) => <>{product.deliveriesCount}</> },
          {
            key: "status",
            header: "Status",
            cell: (product) => (
              <span className={product.status === "ACTIVE" ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"}>
                {product.status === "ACTIVE" ? "Ativo" : "Inativo"}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Ações",
            hidden: !isAdmin,
            cell: (product) => (
              <div className="flex gap-3 text-xs font-medium">
                <button type="button" onClick={() => startEdit(product)} className="text-primary-700 hover:underline">Editar</button>
                {product.status === "ACTIVE" ? (
                  <button type="button" onClick={() => void handleStatus(product, "INACTIVE")} className="text-red-700 hover:underline">Inativar</button>
                ) : (
                  <button type="button" onClick={() => void handleStatus(product, "ACTIVE")} className="text-primary-700 hover:underline">Reativar</button>
                )}
              </div>
            ),
          },
        ]}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} label="produtos" />
    </div>
  );
}
