"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./Button";

/**
 * Diálogo modal (Fase 5 · 5.1), no padrão do shadcn/ui, mas sobre o
 * `<dialog>` nativo: `showModal()` já prende o foco, deixa o resto da página
 * inerte, fecha com Esc e expõe `aria-modal`. Sem Radix.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="mt-1 text-sm text-slate-700">
              {description}
            </div>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação destrutiva (cancelar, estornar, excluir): botão vermelho. */
  danger?: boolean;
}

interface PromptOptions extends ConfirmOptions {
  label: string;
  minLength?: number;
  maxLength?: number;
  /** Campo opcional: aceita vazio (devolve ""). */
  optional?: boolean;
  multiline?: boolean;
  /** Lista de opções: vira um seletor (a primeira é a padrão). */
  choices?: Array<{ value: string; label: string }>;
}

type Pending =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

interface DialogApi {
  /** Texto simples vira o título do diálogo. */
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  /** Pede um texto (ex.: motivo do cancelamento). `null` = cancelado. */
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

/** Substitui `window.confirm`/`window.prompt` por diálogos acessíveis. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const confirm = useCallback(
    (input: ConfirmOptions | string) =>
      new Promise<boolean>((resolve) =>
        setPending({ kind: "confirm", options: typeof input === "string" ? { title: input } : input, resolve }),
      ),
    [],
  );
  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setText(options.choices?.[0]?.value ?? "");
        setTouched(false);
        setPending({ kind: "prompt", options, resolve });
      }),
    [],
  );

  const contextValue = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  function close(result: "ok" | "cancel") {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(result === "ok");
    else pending.resolve(result === "ok" ? text.trim() : null);
    setPending(null);
  }

  let error: string | null = null;
  if (pending?.kind === "prompt") {
    const { minLength = 0, maxLength, optional } = pending.options;
    const length = text.trim().length;
    if (!(optional && length === 0)) {
      if (length < Math.max(minLength, optional ? 0 : 1)) {
        error = minLength > 1 ? `Informe pelo menos ${minLength} caracteres.` : "Campo obrigatório.";
      } else if (maxLength && length > maxLength) {
        error = `Use no máximo ${maxLength} caracteres.`;
      }
    }
  }

  const options = pending?.options;

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <Dialog
        open={pending !== null}
        title={options?.title ?? ""}
        description={options?.description}
        onClose={() => close("cancel")}
      >
        {pending?.kind === "prompt" && (
          <form
            id={`${inputId}-form`}
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (!error) close("ok");
            }}
          >
            <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
              {pending.options.label}
            </label>
            {pending.options.choices ? (
              <select
                id={inputId}
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {pending.options.choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            ) : pending.options.multiline ? (
              <textarea
                id={inputId}
                autoFocus
                rows={3}
                value={text}
                maxLength={pending.options.maxLength}
                aria-invalid={touched && error ? true : undefined}
                aria-describedby={touched && error ? errorId : undefined}
                onChange={(event) => setText(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            ) : (
              <input
                id={inputId}
                autoFocus
                value={text}
                maxLength={pending.options.maxLength}
                aria-invalid={touched && error ? true : undefined}
                aria-describedby={touched && error ? errorId : undefined}
                onChange={(event) => setText(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            )}
            {touched && error && (
              <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-700">
                {error}
              </p>
            )}
          </form>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => close("cancel")}>
            {options?.cancelLabel ?? "Voltar"}
          </Button>
          {pending?.kind === "prompt" ? (
            <Button type="submit" form={`${inputId}-form`} variant={options?.danger ? "danger" : "primary"}>
              {options?.confirmLabel ?? "Confirmar"}
            </Button>
          ) : (
            <Button
              type="button"
              autoFocus
              variant={options?.danger ? "danger" : "primary"}
              onClick={() => close("ok")}
            >
              {options?.confirmLabel ?? "Confirmar"}
            </Button>
          )}
        </div>
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialog precisa estar dentro de <DialogProvider>");
  return context;
}
