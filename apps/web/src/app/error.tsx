"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Fase 1 · 1B: no-op quando o Sentry está desligado (sem DSN)
    Sentry.captureException(error);
  }, [error]);

  const details =
    process.env.NODE_ENV !== "production" ? error.message : undefined;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
        <span className="text-lg font-semibold">!</span>
      </div>

      <h1 className="text-base font-semibold text-slate-900">
        Algo deu errado
      </h1>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        Não foi possível concluir a operação. Tente novamente — se o
        problema continuar, avise o suporte.
      </p>

      {details && (
        <pre className="mt-3 max-w-lg overflow-x-auto rounded-md bg-slate-100 p-3 text-left text-[11px] text-slate-700">
          {details}
        </pre>
      )}

      {error.digest && (
        <p className="mt-3 text-[11px] text-slate-500">
          Código: {error.digest}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        Tentar novamente
      </button>
    </div>
  );
}
