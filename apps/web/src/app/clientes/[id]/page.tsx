"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  whatsappConsentSourceLabels,
  whatsappConsentStatusLabels,
  type ClientDto,
  type WhatsAppConsentDto,
} from "../../../lib/types";
import { useDialog } from "../../../components/ui/Dialog";

export default function ClienteDetalhePage() {
  const dialog = useDialog();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientDto | null>(null);
  const [consent, setConsent] = useState<WhatsAppConsentDto | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadClient = useCallback(async () => {
    try {
      const [clientData, consentData] = await Promise.all([
        api<ClientDto>(`/api/clients/${clientId}`),
        api<WhatsAppConsentDto | Record<string, never>>(
          `/api/whatsapp/consents/${clientId}`,
          { redirectOnUnauthorized: false },
        ).catch(() => null),
      ]);
      setClient(clientData);
      setConsent(
        consentData && typeof consentData === "object" && "id" in consentData
          ? (consentData as WhatsAppConsentDto)
          : null,
      );
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setActionError(err instanceof ApiError ? err.message : "Falha ao carregar cliente.");
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

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
    if (session) void loadClient();
  }, [session, loadClient]);

  async function handleClientStatus(status: "ACTIVE" | "INACTIVE") {
    if (!client) return;
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!await dialog.confirm(`Deseja ${label} o cliente "${client.name}"?`)) return;
    setActionError(null);
    try {
      await api(`/api/clients/${client.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Cliente ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadClient();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Falha ao atualizar status.");
    }
  }

  async function handleConsent(status: "OPTED_IN" | "OPTED_OUT") {
    if (!client) return;
    if (status === "OPTED_OUT") {
      const confirmed = await dialog.confirm(
        `Registrar o descadastro de ${client.name} no WhatsApp? Novos envios ficam bloqueados.`,
      );
      if (!confirmed) return;
    }
    setActionError(null);
    try {
      await api(`/api/whatsapp/consents/${client.id}`, {
        method: "PUT",
        body: JSON.stringify({ status, source: "MANUAL" }),
      });
      setNotice(
        status === "OPTED_IN"
          ? "Consentimento registrado."
          : "Descadastro registrado — envios bloqueados.",
      );
      await loadClient();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Falha ao atualizar o consentimento.",
      );
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (notFound || !client) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-slate-500">Cliente não encontrado.</p>
        <Link
          href="/clientes"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar aos clientes
        </Link>
      </div>
    );
  }

  const address = [
    [client.street, client.number].filter(Boolean).join(", "),
    client.complement,
    client.district,
    [client.city, client.state].filter(Boolean).join("/"),
    client.zip,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{client.name}</h2>
          <p className="text-sm text-slate-500">Ficha do cliente</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/clientes"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Voltar aos clientes
          </Link>
          <Link
            href={`/crediario?cliente=${client.id}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Crediário
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}
      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Dados do cliente
          </h3>
          <div className="flex items-center gap-3">
            <span
              className={
                client.status === "ACTIVE"
                  ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              }
            >
              {client.status === "ACTIVE" ? "Ativo" : "Inativo"}
            </span>
            {client.status === "ACTIVE" ? (
              <button
                type="button"
                onClick={() => void handleClientStatus("INACTIVE")}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                Inativar cliente
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleClientStatus("ACTIVE")}
                className="text-xs font-medium text-primary-700 hover:underline"
              >
                Reativar cliente
              </button>
            )}
          </div>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-slate-500">Contato</dt>
            <dd className="text-slate-700">
              {[client.mobile, client.phone, client.email].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">CPF</dt>
            <dd className="text-slate-700">{client.cpf || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Endereço</dt>
            <dd className="text-slate-700">{address || "—"}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs uppercase text-slate-500">Observações</dt>
            <dd className="text-slate-700">{client.notes || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Vendas</dt>
            <dd className="text-slate-700">{client._count?.sales ?? 0}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Consentimento WhatsApp
          </h3>
          <span
            className={
              consent?.status === "OPTED_IN"
                ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                : consent?.status === "OPTED_OUT"
                  ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
            }
          >
            {consent
              ? whatsappConsentStatusLabels[consent.status]
              : "Sem registro de consentimento"}
          </span>
        </div>
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-slate-500">Origem</dt>
            <dd className="text-slate-700">
              {consent ? whatsappConsentSourceLabels[consent.source] : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Telefone (E.164)</dt>
            <dd className="text-slate-700">{consent?.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Última alteração</dt>
            <dd className="text-slate-700">
              {consent?.changedAt ? new Date(consent.changedAt).toLocaleString("pt-BR") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Envios</dt>
            <dd className="text-slate-700">
              {consent?.status === "OPTED_IN"
                ? "Permitidos"
                : consent?.status === "OPTED_OUT"
                  ? "Bloqueados"
                  : "Sem consentimento — bloqueados"}
            </dd>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => void handleConsent("OPTED_IN")}
            disabled={consent?.status === "OPTED_IN"}
            className="rounded-md border border-primary-600 px-3 py-2 text-xs font-medium text-primary-800 hover:bg-primary-100 disabled:opacity-50"
          >
            Registrar consentimento
          </button>
          <button
            type="button"
            onClick={() => void handleConsent("OPTED_OUT")}
            disabled={consent?.status === "OPTED_OUT"}
            className="rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Registrar descadastro
          </button>
          <Link
            href="/whatsapp"
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver integração
          </Link>
        </div>
      </div>
    </div>
  );
}
