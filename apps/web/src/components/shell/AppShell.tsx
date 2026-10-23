"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "./Header";
import { AccessBanner } from "./AccessBanner";
import { fetchSession, type Session } from "@/lib/session";
import { api } from "@/lib/api";
import { isRetailRoute } from "@/lib/features";
import type { CompanyModuleDto } from "@/lib/types";

/** Rotas sem sessão e sem menu: autenticação, páginas legais e de perfil (Fase 4). */
const AUTH_ROUTES = [
  "/login",
  "/cadastro",
  "/redefinir-senha",
  "/confirmar-email",
  "/termos",
  "/privacidade",
  "/para",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [disabledModules, setDisabledModules] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const isAuthRoute = AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );

  useEffect(() => {
    if (isAuthRoute) {
      setSession(null);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const s = await fetchSession();
      if (cancelled) return;
      if (!s) {
        router.replace("/login");
        return;
      }
      setSession(s);
      try {
        const mods = await api<CompanyModuleDto[]>("/api/company-modules");
        if (!cancelled) {
          const disabled = new Set(
            // Kits (Fase 8b): não contratado também some do menu
            mods.filter((m) => m.status === "DISABLED" || m.entitled === false).map((m) => m.module),
          );
          setDisabledModules(disabled);
        }
      } catch {
        // silencioso — menu mostra tudo se API falhar
      }
      if (!cancelled) setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, isAuthRoute, router]);

  const handleLogout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignora
    }
    router.replace("/login");
  }, [router]);

  // Rotas de auth: layout limpo, sem chrome
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Aguardando sessão: shell vazio (evita flash)
  if (!loaded || !session) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen">
      <Header
        userName={session.user.name}
        userRole={session.user.role}
        isPlatformAdmin={session.user.isPlatformAdmin === true}
        disabledModules={disabledModules}
        onLogout={handleLogout}
      />
      <AccessBanner pathname={pathname} />
      <main id="conteudo" className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6 md:py-8 xl:px-10">
        {isRetailRoute(pathname) ? <RetailRouteDisabled /> : children}
      </main>
    </div>
  );
}

/** Tela de loja desligada (transformação 2026-10-23): dados e API preservados. */
function RetailRouteDisabled() {
  return (
    <section className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Tela desligada</h1>
      <p className="mt-2 text-sm text-slate-500">
        O Akylla agora controla clientes e serviços digitais. As telas de loja (PDV, vendas,
        estoque e afins) foram desligadas; os dados continuam guardados.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Voltar ao início
      </Link>
    </section>
  );
}
