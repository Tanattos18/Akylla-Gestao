"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import {
  credentialActionLabels,
  type CredentialAccessLogDto,
  type DeliveryCredentialDto,
} from "../../lib/types";
import { useDialog } from "../ui/Dialog";
import { ExternalLink } from "./DeliveryBadges";

/** Senha mostrada some sozinha depois deste tempo. */
const REVEAL_MS = 30_000;

const emptyForm = { label: "", username: "", secret: "", url: "", notes: "" };

/**
 * Logins da entrega (2026-10-23). A senha nunca vem na listagem: "Mostrar"
 * pede ao servidor (só ADMIN), que registra na auditoria; ela some em 30 s
 * ou ao clicar em "Ocultar".
 */
export function CredentialsPanel({ deliveryId, isAdmin }: { deliveryId: string; isAdmin: boolean }) {
  const dialog = useDialog();
  const [items, setItems] = useState<DeliveryCredentialDto[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string | null>>({});
  const [logs, setLogs] = useState<Record<string, CredentialAccessLogDto[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    try {
      setItems(await api<DeliveryCredentialDto[]>(`/api/deliveries/${deliveryId}/credentials`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar os logins.");
    }
  }, [deliveryId]);

  useEffect(() => {
    void load();
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, [load]);

  function hide(id: string) {
    clearTimeout(timers.current[id]);
    setRevealed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function reveal(id: string) {
    setError(null);
    try {
      const { secret } = await api<{ secret: string | null }>(`/api/delivery-credentials/${id}/reveal`, { method: "POST" });
      setRevealed((current) => ({ ...current, [id]: secret }));
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => hide(id), REVEAL_MS);
      if (logs[id]) void loadLog(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível mostrar a senha.");
    }
  }

  async function copy(id: string) {
    const secret = revealed[id];
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
    } catch {
      setError("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  async function loadLog(id: string) {
    try {
      const data = await api<CredentialAccessLogDto[]>(`/api/delivery-credentials/${id}/access-log`);
      setLogs((current) => ({ ...current, [id]: data }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao carregar o histórico.");
    }
  }

  function startEdit(item: DeliveryCredentialDto) {
    setEditingId(item.id);
    setForm({ label: item.label, username: item.username ?? "", secret: "", url: item.url ?? "", notes: item.notes ?? "" });
    setShowForm(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.label.trim().length < 2) {
      setError("Descreva o login (ex.: Painel admin).");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        label: form.label.trim(),
        username: form.username.trim(),
        url: form.url.trim(),
        notes: form.notes.trim(),
      };
      // Na edição, senha em branco mantém a atual
      if (form.secret || !editingId) payload.secret = form.secret || null;
      if (editingId) {
        await api(`/api/delivery-credentials/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        hide(editingId);
      } else {
        await api(`/api/deliveries/${deliveryId}/credentials`, { method: "POST", body: JSON.stringify(payload) });
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o login.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(item: DeliveryCredentialDto) {
    if (!(await dialog.confirm(`Arquivar o login "${item.label}"? Ele sai da lista, mas o registro e o histórico ficam guardados.`))) return;
    try {
      await api(`/api/delivery-credentials/${item.id}/archive`, { method: "POST" });
      hide(item.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível arquivar.");
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Logins</h3>
          <p className="text-xs text-slate-500">Senhas guardadas com criptografia. Cada vez que alguém mostra a senha fica registrado.</p>
        </div>
        {isAdmin && !showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="text-sm font-medium text-primary-700 hover:underline">
            Novo login
          </button>
        )}
      </div>

      {error && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} noValidate className="mb-4 grid gap-3 rounded-md border border-slate-200 p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cred-label" className="mb-1 block text-sm text-slate-700">Descrição *</label>
            <input id="cred-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Painel admin, Hostinger, Registro.br..." className={inputClass} />
          </div>
          <div>
            <label htmlFor="cred-user" className="mb-1 block text-sm text-slate-700">Usuário / e-mail</label>
            <input id="cred-user" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="cred-secret" className="mb-1 block text-sm text-slate-700">
              Senha {editingId && <span className="text-xs text-slate-500">(em branco mantém a atual)</span>}
            </label>
            <input id="cred-secret" type="password" autoComplete="new-password" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="cred-url" className="mb-1 block text-sm text-slate-700">Endereço de acesso</label>
            <input id="cred-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cred-notes" className="mb-1 block text-sm text-slate-700">Observações</label>
            <input id="cred-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
              {saving ? "Salvando..." : editingId ? "Salvar" : "Guardar login"}
            </button>
            <button type="button" onClick={closeForm} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum login guardado.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const isRevealed = item.id in revealed;
            return (
              <li key={item.id} className="space-y-1 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">{item.label}</p>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-3 text-xs font-medium">
                      {item.hasSecret &&
                        (isRevealed ? (
                          <button type="button" onClick={() => hide(item.id)} className="text-slate-700 hover:underline">Ocultar</button>
                        ) : (
                          <button type="button" onClick={() => void reveal(item.id)} className="text-primary-700 hover:underline">Mostrar senha</button>
                        ))}
                      <button type="button" onClick={() => startEdit(item)} className="text-primary-700 hover:underline">Editar</button>
                      <button type="button" onClick={() => (logs[item.id] ? setLogs((c) => { const n = { ...c }; delete n[item.id]; return n; }) : void loadLog(item.id))} className="text-slate-600 hover:underline">
                        {logs[item.id] ? "Fechar histórico" : "Histórico"}
                      </button>
                      <button type="button" onClick={() => void archive(item)} className="text-red-700 hover:underline">Arquivar</button>
                    </div>
                  )}
                </div>
                <p className="text-slate-600">
                  Usuário: <span className="font-mono">{item.username ?? "—"}</span>
                  {" · "}
                  Senha:{" "}
                  {!item.hasSecret ? (
                    "—"
                  ) : isRevealed ? (
                    <>
                      <span className="rounded bg-amber-50 px-1 font-mono text-slate-900">{revealed[item.id] ?? "—"}</span>{" "}
                      <button type="button" onClick={() => void copy(item.id)} className="text-xs text-primary-700 hover:underline">copiar</button>
                    </>
                  ) : (
                    <span className="font-mono">••••••••</span>
                  )}
                </p>
                {item.url && <p className="text-xs"><ExternalLink href={item.url} /></p>}
                {item.notes && <p className="text-xs text-slate-500">{item.notes}</p>}
                {logs[item.id] && (
                  <ul className="mt-2 space-y-0.5 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                    {logs[item.id]!.map((log) => (
                      <li key={log.id}>
                        {formatDateTime(log.createdAt)} · {log.userName} · {credentialActionLabels[log.action]}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
