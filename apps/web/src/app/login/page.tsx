"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { ResendVerification } from "../../components/auth/ResendVerification";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  // Fase 1 · 1D: conta criada pelo cadastro e ainda sem e-mail confirmado
  const [pendingVerification, setPendingVerification] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setPendingVerification(false);

    const issues: Record<string, string> = {};
    if (!email.trim()) issues.email = "Informe o email";
    if (!password) issues.password = "Informe a senha";
    if (Object.keys(issues).length > 0) {
      setFieldErrors(issues);
      return;
    }

    setLoading(true);
    try {
      const data = (await api<{ requiresTwoFactor?: boolean; challengeId?: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
          redirectOnUnauthorized: false,
        },
      )) as { requiresTwoFactor?: boolean; challengeId?: string };
      if (data?.requiresTwoFactor && data.challengeId) {
        setChallengeId(data.challengeId);
        setTotp("");
        return;
      }
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setError(err.message);
        setPendingVerification(err.code === "EMAIL_NOT_VERIFIED");
      } else {
        setError("Não foi possível conectar ao servidor");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!/^\d{6}$/.test(totp.trim())) {
      setFieldErrors({ totp: "Informe o código de 6 dígitos" });
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId, token: totp.trim() }),
        redirectOnUnauthorized: false,
      });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
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
      {challengeId ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-xl font-semibold text-slate-900">Verificação em duas etapas</h2>
          <p className="mb-6 text-sm text-slate-500">
            Informe o código de 6 dígitos do seu aplicativo autenticador.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleTotpSubmit} noValidate>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="totp">
              Código de verificação
            </label>
            <input
              id="totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totp}
              onChange={(event) => setTotp(event.target.value)}
              className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              aria-invalid={Boolean(fieldErrors.totp)}
            />
            {fieldErrors.totp && (
              <p className="mb-3 text-xs text-red-700">{fieldErrors.totp}</p>
            )}
            {!fieldErrors.totp && <div className="mb-5" />}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verificando..." : "Verificar"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            <button
              type="button"
              onClick={() => {
                setChallengeId(null);
                setTotp("");
                setError(null);
              }}
              className="text-primary-700 hover:underline"
            >
              Voltar ao login
            </button>
          </p>
        </div>
      ) : (
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold text-slate-900">Entrar no Akylla Gestão</h2>
        <p className="mb-6 text-sm text-slate-500">
          Use o email e a senha do seu usuário administrador.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {pendingVerification && <ResendVerification email={email} />}

        <form onSubmit={handleSubmit} noValidate>
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
          {fieldErrors.email && <p className="mb-3 text-xs text-red-700">{fieldErrors.email}</p>}
          {!fieldErrors.email && <div className="mb-3" />}

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password && (
            <p className="mb-3 text-xs text-red-700">{fieldErrors.password}</p>
          )}
          {!fieldErrors.password && <div className="mb-5" />}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link
            href="/redefinir-senha"
            className="text-primary-700 hover:underline"
          >
            Não consegue entrar? Defina sua senha
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          Não tem conta?{" "}
          <Link href="/cadastro" className="text-primary-700 hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
      )}
    </div>
  );
}
