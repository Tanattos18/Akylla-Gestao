"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { fetchSession, type Session } from "@/lib/session";
import { api } from "@/lib/api";
import type { CompanyModuleDto } from "@/lib/types";

const AUTH_ROUTES = ["/login", "/cadastro", "/redefinir-senha"];
const SIDEBAR_KEY = "akylla:sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [disabledModules, setDisabledModules] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthRoute = AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      // localStorage indisponível — padrão expandido
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // ignora
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
        // silencioso — sidebar mostra tudo se API falhar
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

  // Rotas de auth: layout limpo, sem sidebar
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Aguardando sessão: shell vazio (evita flash)
  if (!loaded || !session) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        companyName={session.company.name}
        userName={session.user.name}
        userRole={session.user.role}
        disabledModules={disabledModules}
        onLogout={handleLogout}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        className={`min-h-screen transition-[padding] duration-200 ${
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
        }`}
      >
        <Header
          userName={session.user.name}
          userRole={session.user.role}
          onOpenMobile={() => setMobileOpen(true)}
          onLogout={handleLogout}
        />
        <main className="px-4 py-6 md:px-6 md:py-8 xl:px-8">{children}</main>
      </div>
    </div>
  );
}
