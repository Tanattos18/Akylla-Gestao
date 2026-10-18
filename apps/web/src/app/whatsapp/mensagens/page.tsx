"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { templateVariableCount } from "@petflow/shared";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  whatsappMessageStatusLabels,
  type ClientDto,
  type Paginated,
  type WhatsAppMessageDto,
  type WhatsAppMessageStatus,
  type WhatsAppTemplateDto,
} from "../../../lib/types";
import { useDialog } from "../../../components/ui/Dialog";
import { DataTable } from "../../../components/ui/DataTable";
import { useToast } from "../../../components/ui/Toast";

const statusFilterOptions: Array<WhatsAppMessageStatus | ""> = [
  "",
  "PENDING",
  "ACCEPTED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "CANCELLED",
];

const statusBadgeClass: Record<WhatsAppMessageStatus, string> = {
  PENDING: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700",
  PROCESSING: "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700",
  ACCEPTED: "rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700",
  SENT: "rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700",
  DELIVERED: "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700",
  READ: "rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-800",
  FAILED: "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700",
  CANCELLED: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

export default function WhatsAppMensagensPage() {
  const toast = useToast();
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<WhatsAppMessageDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [listError, setListError] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientDto[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateDto[]>([]);
  const [form, setForm] = useState({ clientId: "", templateId: "", variables: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";
  const pageSize = 20;

  const selectedTemplate = templates.find((template) => template.id === form.templateId);
  const variableCount = selectedTemplate
    ? templateVariableCount(selectedTemplate.body)
    : 0;

  const loadMessages = useCallback(
    async (currentStatus: string, term: string, currentPage: number) => {
      try {
        const params = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) });
        if (currentStatus) params.set("status", currentStatus);
        if (term.trim()) params.set("search", term.trim());
        const data = await api<Paginated<WhatsAppMessageDto>>(
          `/api/whatsapp/messages?${params.toString()}`,
        );
        setMessages(data.items);
        setTotal(data.total);
        setListError(null);
      } catch (err) {
        setListError(err instanceof ApiError ? err.message : "Falha ao carregar mensagens.");
      }
    },
    [],
  );

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
    if (session) void loadMessages(statusFilter, search, page);
  }, [session, loadMessages, statusFilter, search, page]);

  useEffect(() => {
    if (!session || !isAdmin) return;
    Promise.all([
      api<Paginated<ClientDto>>("/api/clients?pageSize=100"),
      api<Paginated<WhatsAppTemplateDto>>(
        "/api/whatsapp/templates?pageSize=100&status=ACTIVE&approval=APPROVED",
      ),
    ])
      .then(([clientsData, templatesData]) => {
        setClients(clientsData.items);
        setTemplates(templatesData.items);
      })
      .catch(() => {
        setFormError("Falha ao carregar clientes ou templates.");
      });
  }, [session, isAdmin]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!form.clientId) {
      setFormError("Selecione o cliente.");
      return;
    }
    if (!form.templateId) {
      setFormError("Selecione o template.");
      return;
    }

    const variables = form.variables
      .split("\n")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (variables.length !== variableCount) {
      setFormError(
        variableCount === 0
          ? "Este template não aceita variáveis."
          : `Este template exige ${variableCount} variável(is) — informe uma por linha.`,
      );
      return;
    }

    setSending(true);
    try {
      await api("/api/whatsapp/messages", {
        method: "POST",
        body: JSON.stringify({ clientId: form.clientId, templateId: form.templateId, variables }),
      });
      toast.success("Mensagem enfileirada — o worker envia em seguida.");
      setForm({ clientId: "", templateId: "", variables: "" });
      await loadMessages(statusFilter, search, page);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível enfileirar.");
    } finally {
      setSending(false);
    }
  }

  async function handleCancel(message: WhatsAppMessageDto) {
    const reason = await dialog.prompt({ title: "Cancelar mensagem", label: "Motivo do cancelamento", minLength: 3, maxLength: 500, danger: true, confirmLabel: "Cancelar mensagem" });
    if (!reason || reason.trim().length < 3) return;
    setListError(null);
    try {
      await api(`/api/whatsapp/messages/${message.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast.success("Mensagem cancelada.");
      await loadMessages(statusFilter, search, page);
    } catch (err) {
      toast.error(err, "Falha ao cancelar.");
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Mensagens do WhatsApp</h2>
          <p className="text-sm text-slate-500">
            Histórico de envios, status de entrega e cancelamento
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/whatsapp"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Integração
          </Link>
          <Link
            href="/whatsapp/templates"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Templates
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

      {isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Enviar mensagem (template aprovado)
          </h3>
          <form onSubmit={handleSend} noValidate className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="msg-client" className="mb-1 block text-sm text-slate-700">
                Cliente *
              </label>
              <select
                id="msg-client"
                value={form.clientId}
                onChange={(event) => setForm({ ...form, clientId: event.target.value })}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.phone || client.mobile ? ` — ${client.phone ?? client.mobile}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="msg-template" className="mb-1 block text-sm text-slate-700">
                Template *
              </label>
              <select
                id="msg-template"
                value={form.templateId}
                onChange={(event) => setForm({ ...form, templateId: event.target.value })}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.language})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="msg-variables" className="mb-1 block text-sm text-slate-700">
                Variáveis {variableCount > 0 ? `(${variableCount} — uma por linha)` : "(nenhuma)"}
              </label>
              <textarea
                id="msg-variables"
                value={form.variables}
                onChange={(event) => setForm({ ...form, variables: event.target.value })}
                rows={Math.max(2, variableCount)}
                placeholder={variableCount > 0 ? "Ana\nRex" : ""}
                className={inputClass}
              />
            </div>
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                {formError}
              </div>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={sending}
                className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {sending ? "Enfileirando..." : "Enviar mensagem"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="msg-status" className="text-sm text-slate-600">
          Status
        </label>
        <select
          id="msg-status"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          {statusFilterOptions.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? whatsappMessageStatusLabels[option] : "Todos"}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar por telefone ou cliente"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
      </div>

      <DataTable
        rows={messages}
        rowKey={(message) => message.id}
        empty={<>Nenhuma mensagem encontrada.</>}
        columns={[
          { key: "c0", header: "Cliente", cell: (message) => message.client?.name ?? "—", className: "font-medium" },
          { key: "c1", header: "Destino", cell: (message) => message.toPhone },
          { key: "c2", header: "Template", cell: (message) => message.templateNameSnapshot },
          { key: "c3", header: "Status", cell: (message) => <><span className={statusBadgeClass[message.status]}>
                    {whatsappMessageStatusLabels[message.status]}
                  </span>
                  {message.failureReason && (
                    <p className="mt-1 max-w-[16rem] truncate text-xs text-red-700">
                      {message.failureReason}
                    </p>
                  )}
                  {message.cancelReason && (
                    <p className="mt-1 max-w-[16rem] truncate text-xs text-amber-700">
                      {message.cancelReason}
                    </p>
                  )}</> },
          { key: "c4", header: "Tentativas", cell: (message) => <>{message.attempts}/{message.maxAttempts}</> },
          { key: "c5", header: "Criada em", cell: (message) => formatDate(message.createdAt) },
          { key: "c6", header: "Ações", cell: (message) => <><div className="flex gap-3 text-xs font-medium">
                    <Link
                      href={`/whatsapp/mensagens/${message.id}`}
                      className="text-primary-700 hover:underline"
                    >
                      Detalhe
                    </Link>
                    {isAdmin && message.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => void handleCancel(message)}
                        className="text-red-700 hover:underline"
                      >
                        Cancelar
                      </button>
                    )}
                  </div></> },
        ]}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Página {page} de {totalPages} · {total} mensagens
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
