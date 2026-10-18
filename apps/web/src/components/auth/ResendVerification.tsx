"use client";

import { useState } from "react";
import { api, ApiError } from "../../lib/api";

/**
 * Reenvio do link de confirmação (Fase 1 · 1D). A API responde igual exista
 * ou não a conta, então a mensagem de sucesso é sempre a mesma.
 */
export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setMessage(null);
    try {
      await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
        redirectOnUnauthorized: false,
      });
      setState("sent");
    } catch (err) {
      setState("error");
      setMessage(err instanceof ApiError ? err.message : "Não foi possível conectar ao servidor");
    }
  }

  return (
    <div className="mt-3 text-sm" aria-live="polite">
      <button
        type="button"
        onClick={resend}
        disabled={state === "sending" || !email.trim()}
        className="font-medium text-primary-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "sending" ? "Enviando..." : "Reenviar link de confirmação"}
      </button>
      {state === "sent" && (
        <p className="mt-1 text-xs text-slate-600">
          Se houver um cadastro aguardando confirmação para este e-mail, enviamos um novo link.
        </p>
      )}
      {state === "error" && message && <p className="mt-1 text-xs text-red-700">{message}</p>}
    </div>
  );
}
