"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import qrcode from "qrcode-generator";
import type { TwoFactorSetupDto } from "@petflow/shared";
import { api } from "../../lib/api";
import { fetchSession } from "../../lib/session";
import { useToast } from "../ui/Toast";
import { useDialog } from "../ui/Dialog";

const inputClass = "w-40 rounded-md border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-primary-500 focus:outline-none";

/**
 * Verificação em duas etapas (2FA) do administrador: QR para o app
 * autenticador (Google Authenticator, Microsoft Authenticator…), confirmação
 * com o código de 6 dígitos e desativação com a senha. Obrigatória para o
 * dono da plataforma em produção (Fase 8).
 */
export function SecurityForm() {
  const toast = useToast();
  const dialog = useDialog();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetupDto | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSession().then((s) => setEnabled(s?.user.twoFactorEnabled === true));
  }, []);

  const qrDataUrl = useMemo(() => {
    if (!setup) return null;
    const qr = qrcode(0, "M");
    qr.addData(setup.otpauthUrl);
    qr.make();
    return qr.createDataURL(5, 4);
  }, [setup]);

  async function start() {
    setBusy(true);
    try {
      setSetup(await api<TwoFactorSetupDto>("/api/auth/2fa/setup", { method: "POST" }));
      setCode("");
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ token: code.trim() }) });
      setEnabled(true);
      setSetup(null);
      toast.success("Verificação em duas etapas ativada. No próximo login o código será pedido.");
    } catch (err) {
      toast.error(err, "Código inválido. Confira o horário do celular e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    const password = await dialog.prompt({
      title: "Desativar a verificação em duas etapas",
      description: "Sua conta fica protegida só pela senha.",
      label: "Sua senha",
      minLength: 1,
      maxLength: 200,
      danger: true,
      confirmLabel: "Desativar",
    });
    if (!password) return;
    setBusy(true);
    try {
      await api("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) });
      setEnabled(false);
      toast.success("Verificação em duas etapas desativada.");
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  if (enabled === null) return <p className="text-sm text-slate-600">Carregando…</p>;

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Verificação em duas etapas</h3>
        <p className="mt-1 text-sm text-slate-600">
          Além da senha, o login pede um código de 6 dígitos gerado no seu celular. Protege a conta mesmo se a senha vazar.
        </p>
      </div>

      {enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Ativada</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void disable()}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Desativar
          </button>
        </div>
      ) : setup && qrDataUrl ? (
        <form onSubmit={(event) => void confirm(event)} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Instale um app autenticador no celular (Google Authenticator ou Microsoft Authenticator).</li>
            <li>No app, toque em "+" e escaneie o código abaixo.</li>
            <li>Digite o código de 6 dígitos que aparecer no app.</li>
          </ol>
          <img src={qrDataUrl} alt="Código QR para o app autenticador" width={200} height={200} className="rounded border border-slate-200" />
          <p className="text-xs text-slate-600">
            Sem câmera? Digite esta chave no app: <code className="break-all rounded bg-slate-100 px-1 font-mono text-slate-800">{setup.secret}</code>
          </p>
          <div>
            <label htmlFor="totp-code" className="mb-1 block text-sm text-slate-700">
              Código do app
            </label>
            <input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
            >
              Ativar
            </button>
            <button type="button" onClick={() => setSetup(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
        >
          Configurar verificação em duas etapas
        </button>
      )}
    </section>
  );
}
