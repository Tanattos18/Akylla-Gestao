"use client";

import { Dialog } from "./Dialog";
import { useToast } from "./Toast";

/**
 * Mostra uma senha provisória UMA vez (Fase 8), com a mensagem pronta para
 * enviar à pessoa pelo WhatsApp.
 */
export function TemporaryPasswordDialog({
  data,
  onClose,
}: {
  data: { name?: string | null; email: string; password: string } | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const message = data
    ? `Olá${data.name ? `, ${data.name}` : ""}! Sua senha do Akylla Gestão foi redefinida.\n\n` +
      `Endereço: ${origin}/login\nLogin: ${data.email}\nSenha provisória: ${data.password}\n\n` +
      `Ao entrar, troque a senha em Minha conta (clique no seu nome, no canto superior direito).`
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <Dialog
      open={data !== null}
      title="Senha provisória gerada"
      description="Ela aparece só agora. As sessões abertas dessa pessoa foram encerradas."
      onClose={onClose}
    >
      <textarea
        readOnly
        aria-label="Mensagem com a senha provisória"
        value={message}
        rows={7}
        className="w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => void copy()} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800">
          Copiar mensagem
        </button>
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Fechar
        </button>
      </div>
    </Dialog>
  );
}
