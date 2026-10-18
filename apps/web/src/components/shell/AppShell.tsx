"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "./Header";
import { fetchSession, type Session } from "@/lib/session";
import { api } from "@/lib/api";
import type { CompanyModuleDto } from "@/lib/types";

const AUTH_ROUTES = ["/login", "/cadastro", "/redefinir-senha", "/confirmar-email"];

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
            mods.filter((m) => m.status === "DISABLED").map((m) => m.module),
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
        disabledModules={disabledModules}
        onLogout={handleLogout}
      />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6 md:py-8 xl:px-10">
        {children}
      </main>
    </div>
  );
}
