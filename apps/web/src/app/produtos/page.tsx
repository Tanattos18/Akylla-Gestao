"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import {
  productUnitLabels,
  type CategoryDto,
  type LowStockDto,
  type Paginated,
  type ProductDto,
  type RecordStatus,
  type SupplierDto,
} from "../../lib/types";
import { useDialog } from "../../components/ui/Dialog";
import { DataTable } from "../../components/ui/DataTable";

const pageSize = 10;

export default function ProdutosPage() {
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState<ProductDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"" | RecordStatus>("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockDto[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isAdmin = session?.user.role === "ADMIN";

  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (categoryId) params.set("categoryId", categoryId);
      if (supplierId) params.set("supplierId", supplierId);
      if (status) params.set("status", status);
      if (lowStockOnly) params.set("lowStock", "true");

      const data = await api<Paginated<ProductDto>>(`/api/products?${params.toString()}`);
      setProducts(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os produtos.");
    }
  }, [page, search, categoryId, supplierId, status, lowStockOnly]);

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
    if (q) {
      setSearch(q);
      setSearchInput(q);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void Promise.all([
      api<Paginated<CategoryDto>>("/api/categories?pageSize=100"),
      api<Paginated<SupplierDto>>("/api/suppliers?pageSize=100"),
      api<LowStockDto[]>("/api/stock/low-stock"),
    ])
      .then(([categoryPage, supplierPage, alerts]) => {
        setCategories(categoryPage.items);
        setSuppliers(supplierPage.items);
        setLowStockAlerts(alerts);
      })
      .catch(() => undefined);
  }, [session]);

  useEffect(() => {
    if (session) void loadProducts();
  }, [session, loadProducts]);

  useEffect(() => {
    if (session) {
      void api<LowStockDto[]>("/api/stock/low-stock").then(setLowStockAlerts).catch(() => undefined);
    }
  }, [session, products]);

  async function handleInactive(product: ProductDto) {
    if (!await dialog.confirm(`Inativar o produto "${product.name}"?`)) return;
    setNotice(null);
    try {
      await api(`/api/products/${product.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      });
      setNotice(`Produto ${product.name} inativado.`);
      await loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao inativar o produto.");
    }
  }

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Produtos e estoque</h2>
          <p className="text-sm text-slate-500">Empresa {session.company.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/categorias"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Categorias
          </Link>
          <Link
            href="/fornecedores"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Fornecedores
          </Link>
          {isAdmin && (
            <Link
              href="/produtos/novo"
              className="rounded-md bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
            >
              Novo produto
            </Link>
          )}
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {lowStockAlerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-800">
            Estoque baixo ({lowStockAlerts.length})
          </h3>
          <ul className="space-y-1 text-sm text-amber-900">
            {lowStockAlerts.map((item) => (
              <li key={item.id}>
                <Link href={`/produtos/${item.id}`} className="font-medium underline">
                  {item.name}
                </Link>{" "}
                — saldo {Number(item.stockQuantity)} {productUnitLabels[item.unit]} (mín.{" "}
                {Number(item.minimumStock)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="search" className="mb-1 block text-sm text-slate-700">
              Busca (nome, SKU ou código de barras)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={applySearch}
                className="rounded-md border border-primary-600 px-3 py-2 text-sm font-medium text-primary-800 hover:bg-primary-50"
              >
                Buscar
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="filter-category" className="mb-1 block text-sm text-slate-700">
              Categoria
            </label>
            <select
              id="filter-category"
              value={categoryId}
              onChange={(event) => {
                setPage(1);
                setCategoryId(event.target.value);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-supplier" className="mb-1 block text-sm text-slate-700">
              Fornecedor
            </label>
            <select
              id="filter-supplier"
              value={supplierId}
              onChange={(event) => {
                setPage(1);
                setSupplierId(event.target.value);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-status" className="mb-1 block text-sm text-slate-700">
              Status
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as "" | RecordStatus);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
            </select>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => {
              setPage(1);
              setLowStockOnly(event.target.checked);
            }}
            className="rounded border-slate-300"
          />
          Somente estoque baixo
        </label>
      </div>

      <DataTable
        rows={products}
        rowKey={(product) => product.id}
        empty={<>Nenhum produto encontrado.</>}
        columns={[
          { key: "c0", header: "Produto", cell: (product) => <><div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{product.name}</span>
                    {product.lowStock && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Estoque baixo
                      </span>
                    )}
                  </div></> },
          { key: "c1", header: "SKU", cell: (product) => product.sku ?? "—" },
          { key: "c2", header: "Categoria", cell: (product) => product.category?.name ?? "—" },
          { key: "c3", header: "Saldo", cell: (product) => <>{Number(product.stockQuantity)} {productUnitLabels[product.unit]}</> },
          { key: "c4", header: "Status", cell: (product) => <><span
                    className={
                      product.status === "ACTIVE"
                        ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    }
                  >
                    {product.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </span></> },
          { key: "c5", header: "Ações", cell: (product) => <><div className="flex gap-3 text-xs font-medium">
                    <Link href={`/produtos/${product.id}`} className="text-primary-700 hover:underline">
                      Detalhes
                    </Link>
                    {isAdmin && product.status === "ACTIVE" && (
                      <>
                        <Link
                          href={`/produtos/${product.id}/editar`}
                          className="text-primary-700 hover:underline"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleInactive(product)}
                          className="text-red-700 hover:underline"
                        >
                          Inativar
                        </button>
                      </>
                    )}
                  </div></> },
        ]}
      />

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} produto(s) — página {page} de {totalPages}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
