"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { ApiError } from "../../lib/api";

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  details?: string[];
}

interface ToastApi {
  success: (title: string) => void;
  /** Aceita `ApiError` (usa `message` e `issues[]` do Zod) ou texto. */
  error: (error: unknown, fallback?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 5000;

/** Mensagens rápidas de retorno (Fase 5 · 5.1), anunciadas ao leitor de tela. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-3), { ...item, id }]);
      window.setTimeout(() => dismiss(id), item.kind === "error" ? DURATION_MS * 2 : DURATION_MS);
    },
    [dismiss],
  );

  // Objeto estável: telas podem usar `toast` em dependências de efeitos
  const api = useMemo<ToastApi>(
    () => ({
      success: (title: string) => push({ kind: "success", title }),
      error: (error: unknown, fallback = "Não foi possível concluir a operação.") => {
        if (error instanceof ApiError) {
          push({
            kind: "error",
            title: error.message,
            details: error.issues?.map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message)),
          });
        } else {
          push({ kind: "error", title: typeof error === "string" ? error : fallback });
        }
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white p-4 text-sm shadow-lg ${
              item.kind === "error" ? "border-red-200" : "border-emerald-200"
            }`}
          >
            {item.kind === "error" ? (
              <AlertCircle aria-hidden className="h-5 w-5 shrink-0 text-red-700" />
            ) : (
              <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-emerald-700" />
            )}
            <div className="flex-1">
              <p className={item.kind === "error" ? "font-medium text-red-800" : "font-medium text-slate-900"}>
                {item.title}
              </p>
              {item.details && item.details.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs text-slate-700">
                  {item.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Fechar mensagem"
              className="rounded p-0.5 text-slate-500 hover:text-slate-800"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return context;
}
