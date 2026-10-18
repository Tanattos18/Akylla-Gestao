"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { fetchSession, type Session } from "../../lib/session";
import { useToast } from "../../components/ui/Toast";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

/** Minha conta (Fase 8): dados do usuário e troca da própria senha. */
export default function ContaPage() {
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSession().then(setSession);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.next.length < 8) return setError("A nova senha precisa ter ao menos 8 caracteres.");
    if (form.next !== form.confirm) return setError("A confirmação não confere com a nova senha.");
    setSaving(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      setForm({ current: "", next: "", confirm: "" });
      toast.success("Senha alterada. Os outros dispositivos conectados foram desconectados.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setSaving(false);
    }
  }

  if (!session) return <p className="py-16 text-center text-sm text-slate-600">Carregando…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Minha conta</h2>
        <p className="text-sm text-slate-600">
          {session.user.name} · {session.user.email} · {session.company.name}
        </p>
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" noValidate>
        <h3 className="text-lg font-semibold text-slate-900">Trocar senha</h3>
        <p className="text-sm text-slate-600">Recebeu uma senha provisória? Troque aqui no primeiro acesso.</p>
        <div>
          <label htmlFor="pw-current" className="mb-1 block text-sm text-slate-700">Senha atual</label>
          <input id="pw-current" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pw-next" className="mb-1 block text-sm text-slate-700">Nova senha (mín. 8 caracteres)</label>
          <input id="pw-next" type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="mb-1 block text-sm text-slate-700">Repita a nova senha</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} className={inputClass} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={saving || !form.current || !form.next}
          className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Trocar senha"}
        </button>
      </form>
    </div>
  );
}
