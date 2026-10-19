"use client";

import { normalizeDecimalInput } from "@petflow/shared";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import type { CommissionRuleDto, Paginated, ProfessionalDto, ReleasePolicy } from "../../../lib/types";
import { DataTable } from "../../../components/ui/DataTable";

/** Fase 2 · 2.1 — regras de comissão (ADMIN). */

interface Option {
  id: string;
  name: string;
}

const policyLabels: Record<ReleasePolicy, string> = {
  ON_SALE: "Na venda",
  ON_PAYMENT: "No pagamento",
  SPLIT_50_50: "50% / 50%",
};

const emptyForm = {
  professionalId: "",
  target: "ALL" as "ALL" | "PRODUCT" | "CATEGORY",
  productId: "",
  categoryId: "",
  percentage: "",
  releasePolicy: "ON_SALE" as ReleasePolicy,
};

function describeTarget(rule: CommissionRuleDto): string {
  if (rule.product) return `Produto: ${rule.product.name}`;
  if (rule.category) return `Categoria: ${rule.category.name}`;
  return "Todos os produtos";
}

export default function RegrasComissaoPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [rules, setRules] = useState<CommissionRuleDto[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Paginated<CommissionRuleDto>>("/api/commission-rules?pageSize=100");
      setRules(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar regras.");
    }
  }, []);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      if (value.user.role !== "ADMIN") {
        router.replace("/comissoes");
        return;
      }
      setSession(value);
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    void load();
    void api<Paginated<ProfessionalDto>>("/api/professionals?pageSize=100&status=ACTIVE").then((d) => setProfessionals(d.items)).catch(() => undefined);
    void api<Paginated<Option>>("/api/products?pageSize=100").then((d) => setProducts(d.items)).catch(() => undefined);
    void api<Paginated<Option>>("/api/categories?pageSize=100").then((d) => setCategories(d.items)).catch(() => undefined);
  }, [session, load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!form.percentage.trim()) {
      setFieldErrors({ percentage: "Informe o percentual" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/commission-rules", {
        method: "POST",
        body: JSON.stringify({
          professionalId: form.professionalId || null,
          productId: form.target === "PRODUCT" ? form.productId || null : null,
          categoryId: form.target === "CATEGORY" ? form.categoryId || null : null,
          percentage: normalizeDecimalInput(form.percentage),
          releasePolicy: form.releasePolicy,
        }),
      });
      setNotice("Regra criada.");
      setForm(emptyForm);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Record<string, string> = {};
        for (const issue of err.issues ?? []) mapped[issue.path] = issue.message;
        setFieldErrors(mapped);
        setError(err.message);
      } else {
        setError("Não foi possível salvar a regra.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule: CommissionRuleDto) {
    try {
      await api(`/api/commission-rules/${rule.id}`, { method: "PATCH", body: JSON.stringify({ active: !rule.active }) });
      setNotice(rule.active ? "Regra desativada." : "Regra reativada.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao atualizar regra.");
    }
  }

  if (!session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Regras de comissão</h2>
          <p className="text-sm text-slate-500">
            A mais específica vence: produto → categoria → regra do profissional → padrão do profissional → regra geral.
          </p>
        </div>
        <Link href="/comissoes" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Comissões
        </Link>
      </div>

      {notice && <div role="status" className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>}
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Nova regra</h3>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="r-prof" className="mb-1 block text-sm text-slate-700">Profissional</label>
            <select id="r-prof" value={form.professionalId} onChange={(e) => setForm({ ...form, professionalId: e.target.value })} className={inputClass}>
              <option value="">Todos os profissionais</option>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="r-target" className="mb-1 block text-sm text-slate-700">Vale para</label>
            <select id="r-target" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as typeof form.target })} className={inputClass}>
              <option value="ALL">Todos os produtos</option>
              <option value="PRODUCT">Um produto</option>
              <option value="CATEGORY">Uma categoria</option>
            </select>
          </div>
          {form.target === "PRODUCT" && (
            <div>
              <label htmlFor="r-product" className="mb-1 block text-sm text-slate-700">Produto</label>
              <select id="r-product" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className={inputClass}>
                <option value="">Selecione…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {form.target === "CATEGORY" && (
            <div>
              <label htmlFor="r-category" className="mb-1 block text-sm text-slate-700">Categoria</label>
              <select id="r-category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputClass}>
                <option value="">Selecione…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="r-pct" className="mb-1 block text-sm text-slate-700">Percentual (%) *</label>
            <input id="r-pct" inputMode="decimal" placeholder="5" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} className={inputClass} aria-invalid={Boolean(fieldErrors.percentage)} />
            {fieldErrors.percentage && <p className="mt-1 text-xs text-red-700">{fieldErrors.percentage}</p>}
          </div>
          <div>
            <label htmlFor="r-policy" className="mb-1 block text-sm text-slate-700">Liberação</label>
            <select id="r-policy" value={form.releasePolicy} onChange={(e) => setForm({ ...form, releasePolicy: e.target.value as ReleasePolicy })} className={inputClass}>
              {(Object.keys(policyLabels) as ReleasePolicy[]).map((p) => <option key={p} value={p}>{policyLabels[p]}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Vendas pagas na hora liberam a comissão na venda.</p>
          </div>
          <div className="flex items-end sm:col-span-3">
            <button type="submit" disabled={saving} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
              {saving ? "Salvando..." : "Criar regra"}
            </button>
          </div>
        </form>
      </div>

      <DataTable
        rows={rules}
        rowKey={(rule) => rule.id}
        empty={<>Nenhuma regra. Sem regras, vale o padrão de cada profissional.</>}
        columns={[
          { key: "c0", header: "Profissional", cell: (rule) => rule.professional?.name ?? "Todos" },
          { key: "c1", header: "Alvo", cell: (rule) => describeTarget(rule) },
          { key: "c2", header: "%", cell: (rule) => <>{Number(rule.percentage).toLocaleString("pt-BR")}%</>, numeric: true, className: "font-medium" },
          { key: "c3", header: "Liberação", cell: (rule) => policyLabels[rule.releasePolicy] },
          { key: "c4", header: "Status", cell: (rule) => <><span className={rule.active ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"}>
                    {rule.active ? "Ativa" : "Inativa"}
                  </span></> },
          { key: "c5", header: "Ações", cell: (rule) => <><button type="button" onClick={() => void toggle(rule)} className={rule.active ? "text-xs font-medium text-red-700 hover:underline" : "text-xs font-medium text-primary-700 hover:underline"}>
                    {rule.active ? "Desativar" : "Reativar"}
                  </button></> },
        ]}
      />
    </div>
  );
}
