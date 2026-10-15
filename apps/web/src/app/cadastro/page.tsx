"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";

export default function CadastroPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const issues: Record<string, string> = {};
    if (companyName.trim().length < 2)
      issues.companyName = "Informe o nome da empresa (mínimo 2 caracteres)";
    if (name.trim().length < 2) issues.name = "Informe seu nome";
    if (!email.trim()) issues.email = "Informe o email";
    if (password.length < 8) issues.password = "Senha deve ter ao menos 8 caracteres";
    else if (password.length > 72) issues.password = "Senha deve ter no máximo 72 caracteres";
    if (confirm !== password) issues.confirm = "As senhas não coincidem";
    if (!acceptTerms) issues.acceptTerms = "É necessário aceitar os Termos e a Política de Privacidade";
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          companyName: companyName.trim(),
          name: name.trim(),
          email: email.trim(),
          password,
          acceptTerms,
          termsVersion: "1.0",
        }),
      });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setError(err.message);
      } else {
        setError("Não foi possível conectar ao servidor");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold text-slate-900">
          Criar conta no Akylla Gestão
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          Crie a empresa e o usuário administrador. Você entra automaticamente
          após o cadastro.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="companyName">
            Nome da empresa
          </label>
          <input
            id="companyName"
            type="text"
            autoComplete="organization"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-invalid={Boolean(fieldErrors.companyName)}
          />
          {fieldErrors.companyName && (
            <p className="mb-3 text-xs text-red-600">{fieldErrors.companyName}</p>
          )}
          {!fieldErrors.companyName && <div className="mb-3" />}

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
            Seu nome
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name && (
            <p className="mb-3 text-xs text-red-600">{fieldErrors.name}</p>
          )}
          {!fieldErrors.name && <div className="mb-3" />}

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && (
            <p className="mb-3 text-xs text-red-600">{fieldErrors.email}</p>
          )}
          {!fieldErrors.email && <div className="mb-3" />}

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password && (
            <p className="mb-3 text-xs text-red-600">{fieldErrors.password}</p>
          )}
          {!fieldErrors.password && <div className="mb-3" />}

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="confirm">
            Confirmar senha
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-invalid={Boolean(fieldErrors.confirm)}
          />
          {fieldErrors.confirm && (
            <p className="mb-3 text-xs text-red-600">{fieldErrors.confirm}</p>
          )}
          {!fieldErrors.confirm && <div className="mb-5" />}

          <div className="mb-5">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                aria-invalid={Boolean(fieldErrors.acceptTerms)}
              />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" className="text-primary-700 hover:underline" target="_blank">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" className="text-primary-700 hover:underline" target="_blank">
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
            {fieldErrors.acceptTerms && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.acceptTerms}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary-700 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
