"use client";

import { useToast } from "../ui/Toast";

/**
 * Pagamento por Pix (Fase 8b): chave de recebimento da Akylla no Mercado
 * Pago. Chave Pix é dado público de recebimento (não é segredo); pode ser
 * trocada por variável de ambiente sem mexer no código.
 */
export const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || "7dda9a3c-400d-45de-906b-f22b2615f1d5";
export const PIX_RECEIVER = process.env.NEXT_PUBLIC_PIX_RECEIVER || "Joás Santana Nascimento";

export function PixCard({ receiptLink }: { receiptLink: string }) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      toast.success("Chave Pix copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione a chave e copie manualmente.");
    }
  }

  return (
    <section
      id="pagar-com-pix"
      aria-labelledby="pix-titulo"
      className="scroll-mt-24 rounded-lg border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm"
    >
      <h3 id="pix-titulo" className="text-sm font-semibold uppercase tracking-wide text-emerald-900">
        Pagar com Pix
      </h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Monte seu plano acima e confira o valor.</li>
        <li>No app do seu banco, pague por Pix com a chave aleatória abaixo.</li>
        <li>Envie o comprovante pelo WhatsApp. Liberamos o acesso assim que o pagamento é confirmado.</li>
      </ol>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase text-slate-600">Chave Pix (aleatória)</p>
          <p className="break-all font-mono text-sm font-medium text-slate-900">{PIX_KEY}</p>
          <p className="mt-1 text-xs text-slate-600">
            Favorecido: <strong className="font-medium text-slate-800">{PIX_RECEIVER}</strong> · Mercado Pago
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            Copiar chave Pix
          </button>
          <a
            href={receiptLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-primary-600 bg-white px-4 py-2 text-sm font-medium text-primary-800 hover:bg-primary-50"
          >
            Enviar comprovante
          </a>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Confira o nome do favorecido antes de confirmar o Pix.
      </p>
    </section>
  );
}
