"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "../../lib/api";

/** Destino do link enviado por e-mail no cadastro (Fase 1 · 1D). */
function ConfirmarEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(token ? null : "Link de confirmação incompleto.");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    // Tira o token da barra de endereço/histórico assim que for lido
    window.history.replaceState(null, "", "/confirmar-email");
    api("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
      redirectOnUnauthorized: false,
    })
      .then(() => router.replace("/"))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Não foi possível conectar ao servidor"),
      );
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm" aria-live="polite">
        <h2 className="mb-2 text-xl font-semibold text-slate-900">Confirmação de e-mail</h2>
        {!error ? (
          <p className="text-sm text-slate-600">Confirmando seu e-mail e ativando a conta…</p>
        ) : (
          <>
            <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
            <p className="text-sm text-slate-600">
              O link vale por 24 horas e só pode ser usado uma vez. Entre com seu e-mail e senha para pedir um novo
              link.
            </p>
            <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary-700 hover:underline">
              Ir para o login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmarEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmarEmail />
    </Suspense>
  );
}
