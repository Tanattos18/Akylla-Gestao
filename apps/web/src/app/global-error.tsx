"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Erro no próprio layout raiz (o error.tsx não cobre). Fase 1 · 1B.
 * Precisa renderizar <html>/<body> porque substitui o layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 48, textAlign: "center", color: "#0f172a" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Algo deu errado</h1>
        <p style={{ fontSize: 13, color: "#475569" }}>
          Não foi possível carregar o Akylla Gestão. Tente novamente — se o problema continuar, avise o suporte.
        </p>
        {error.digest && <p style={{ fontSize: 11, color: "#475569" }}>Código: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: 0, background: "#b45309", color: "#fff", cursor: "pointer" }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
