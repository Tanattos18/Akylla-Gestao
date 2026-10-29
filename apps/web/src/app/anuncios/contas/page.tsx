"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { fetchSession } from "../../../lib/session";
import { adPlatformLabels, type AdAccountDto, type AdPlatform, type ClientDto } from "../../../lib/types";
import { DataTable } from "../../../components/ui/DataTable";
import { Badge } from "../../../components/ui/Badge";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { AdsNav } from "../../../components/ads/AdsShared";

const PLATFORMS = Object.keys(adPlatformLabels) as AdPlatform[];

/**
 * Anúncios › Contas de anúncio por cliente. O cartão é do cliente; aqui fica
 * só a referência (id da conta). "Conectar com a Meta/Google" é da fase A5.
 */
export default function ContasAnuncioPage() {
  const [accounts, setAccounts] = useState<AdAccountDto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({ clientId: "", platform: "META" as AdPlatform, name: "", externalAccountId: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setAccounts(await api<AdAccountDto[]>("/api/ads/accounts"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar as contas.");
    }
  }, []);

  useEffect(() => {
    void load();
    fetchSession().then((session) => setIsAdmin(session?.user.role === "ADMIN"));
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.clientId) {
      setError("Escolha o cliente.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/ads/accounts", {
        method: "POST",
        body: JSON.stringify({ ...form, name: form.name.trim(), externalAccountId: form.externalAccountId.trim() || null }),
      });
      setForm({ ...form, name: "", externalAccountId: "" });
      setNotice("Conta cadastrada.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? (err.issues?.map((i) => i.message).join("; ") || err.message) : "Não foi possível cadastrar a conta.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(account: AdAccountDto) {
    setError(null);
    try {
      await api(`/api/ads/accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível alterar a conta.");
    }
  }

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Contas de anúncio</h2>
        <p className="text-sm text-slate-500">Conta de cada cliente na Meta, no Google ou no TikTok. O cartão de pagamento é sempre do cliente.</p>
      </div>
      <AdsNav />

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</div>}

      {isAdmin && (
        <form onSubmit={create} noValidate className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="account-client" className="mb-1 block text-sm text-slate-700">Cliente *</label>
            <SearchSelect<ClientDto>
              id="account-client"
              endpoint="/api/clients?status=ACTIVE"
              value={form.clientId}
              onChange={(id) => setForm({ ...form, clientId: id })}
              placeholder="Digite o nome do cliente"
            />
          </div>
          <div>
            <label htmlFor="account-platform" className="mb-1 block text-sm text-slate-700">Plataforma *</label>
            <select id="account-platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as AdPlatform })} className={inputClass}>
              {PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>{adPlatformLabels[platform]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="account-external" className="mb-1 block text-sm text-slate-700">ID da conta</label>
            <input id="account-external" value={form.externalAccountId} onChange={(e) => setForm({ ...form, externalAccountId: e.target.value })} className={inputClass} placeholder="act_123 ou 123-456-7890" />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="account-name" className="mb-1 block text-sm text-slate-700">Nome *</label>
            <input id="account-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="BM da Barbearia" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="w-full rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
              {saving ? "Salvando..." : "Cadastrar conta"}
            </button>
          </div>
        </form>
      )}

      <DataTable
        rows={accounts}
        rowKey={(account) => account.id}
        empty={<>Nenhuma conta de anúncio cadastrada.</>}
        columns={[
          { key: "name", header: "Conta", cell: (account) => <span className="font-medium text-slate-800">{account.name}</span> },
          {
            key: "client",
            header: "Cliente",
            cell: (account) => <Link href={`/clientes/${account.client.id}`} className="text-slate-700 hover:underline">{account.client.name}</Link>,
          },
          { key: "platform", header: "Plataforma", cell: (account) => <>{adPlatformLabels[account.platform]}</> },
          { key: "external", header: "ID da conta", hideOnMobile: true, cell: (account) => <>{account.externalAccountId ?? "—"}</> },
          { key: "campaigns", header: "Campanhas", numeric: true, cell: (account) => <>{account.campaignsCount}</> },
          {
            key: "status",
            header: "Situação",
            cell: (account) => <Badge color={account.status === "ACTIVE" ? "green" : "slate"}>{account.status === "ACTIVE" ? "Ativa" : "Inativa"}</Badge>,
          },
          {
            key: "actions",
            header: "Ações",
            hidden: !isAdmin,
            cell: (account) => (
              <button type="button" onClick={() => void toggle(account)} className="text-sm font-medium text-primary-700 hover:underline">
                {account.status === "ACTIVE" ? "Inativar" : "Reativar"}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
