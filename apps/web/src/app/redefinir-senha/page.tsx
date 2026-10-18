"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { useAuthOptions, whatsappLink } from "../../lib/auth-options";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

/**
 * Recuperação de senha (Fase 8, auditoria):
 * - com `?token=` (link do e-mail): define a nova senha;
 * - sem token e com e-mail configurado: pede o link;
 * - sem e-mail configurado: orienta a falar com o suporte (o dono gera uma
 *   senha provisória no painel da plataforma).
 */
function RedefinirSenha() {
  const params = useSearchParams();
  const tokenRef = useRef<string | null>(params.get("token"));
  const token = tokenRef.current;
  const options = useAuthOptions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Tira o token da barra de endereço/histórico assim que for lido
    if (token) window.history.replaceState(null, "", "/redefinir-senha");
  }, [token]);

  async function requestLink(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) return setError("Informe o e-mail do seu usuário.");
    setLoading(true);
    try {
      await api("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
        redirectOnUnauthorized: false,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function setNewPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha precisa ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    try {
      await api("/api/auth/confirm-password-reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
        redirectOnUnauthorized: false,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  const support = (
    <a
      href={whatsappLink("Olá! Preciso de ajuda para acessar o Akylla Gestão (esqueci a senha).")}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full rounded-md bg-primary-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-800"
    >
      Falar com o suporte no WhatsApp
    </a>
  );

  let body;
  if (token) {
    body = done ? (
      <div className="space-y-4">
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Senha redefinida. As sessões abertas foram encerradas; entre com a nova senha.
        </p>
        <Link href="/login" className="block w-full rounded-md bg-primary-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-800">
          Ir para o login
        </Link>
      </div>
    ) : (
      <form onSubmit={(event) => void setNewPassword(event)} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">Escolha a nova senha. O link vale por pouco tempo e só uma vez.</p>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm text-slate-700">Nova senha (mín. 8 caracteres)</label>
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm text-slate-700">Repita a nova senha</label>
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    );
  } else if (!options) {
    body = <p className="text-sm text-slate-600">Carregando…</p>;
  } else if (!options.emailEnabled) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Para redefinir a senha, fale com o suporte da Akylla. Geramos uma senha provisória para você e, no
          primeiro acesso, você troca em <strong className="font-medium">Minha conta</strong>.
        </p>
        <p className="text-sm text-slate-700">
          Se você é da equipe de uma empresa, o administrador dela também pode redefinir o seu acesso.
        </p>
        {support}
      </div>
    );
  } else {
    body = done ? (
      <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Se houver uma conta com esse e-mail, enviamos um link para criar a nova senha. Confira também a caixa de spam.
      </p>
    ) : (
      <form onSubmit={(event) => void requestLink(event)} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">Informe o e-mail do seu usuário. Enviaremos um link para criar uma nova senha.</p>
        <div>
          <label htmlFor="reset-email" className="mb-1 block text-sm text-slate-700">E-mail</label>
          <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60">
          {loading ? "Enviando..." : "Enviar link"}
        </button>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">{token ? "Criar nova senha" : "Esqueci minha senha"}</h2>
        {body}
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary-700 hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenha />
    </Suspense>
  );
}
