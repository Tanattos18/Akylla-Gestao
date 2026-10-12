"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Bell,
  Menu,
  LogOut,
  ChevronDown,
  Package,
  Users,
  Receipt,
  AlertTriangle,
  CalendarClock,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatBrl } from "@/lib/format";
import type {
  DashboardSummaryDto,
  FinancialSummaryDto,
  Paginated,
  ProductDto,
  ClientDto,
  SaleDto,
} from "@/lib/types";

const routeLabels: Record<string, string> = {
  "": "Início",
  dashboard: "Dashboard",
  clientes: "Clientes",
  produtos: "Produtos",
  categorias: "Categorias",
  fornecedores: "Fornecedores",
  pdv: "PDV",
  vendas: "Vendas",
  caixa: "Caixa",
  financeiro: "Financeiro",
  pets: "Pets",
  servicos: "Serviços",
  whatsapp: "WhatsApp",
  agenda: "Agenda",
  assinaturas: "Assinaturas",
  planos: "Planos",
  usuarios: "Usuários",
  faturamento: "Faturamento",
  relatorios: "Relatórios",
  novo: "Novo",
  editar: "Editar",
  movimentos: "Movimentos",
  sessoes: "Sessões",
  fechar: "Fechar",
  mensagens: "Mensagens",
  templates: "Templates",
};

interface SearchResults {
  products: ProductDto[];
  clients: ClientDto[];
  sales: SaleDto[];
}

interface Notifications {
  lowStock: number;
  outOfStock: number;
  overdueReceivables: number;
  overduePayables: number;
  loaded: boolean;
}

function formatDate(): string {
  const now = new Date();
  return now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Header({
  userName,
  userRole,
  onOpenMobile,
  onLogout,
}: {
  userName: string;
  userRole: string;
  onOpenMobile: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notif, setNotif] = useState<Notifications>({
    lowStock: 0,
    outOfStock: 0,
    overdueReceivables: 0,
    overduePayables: 0,
    loaded: false,
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alertCount =
    notif.lowStock + notif.outOfStock + notif.overdueReceivables + notif.overduePayables;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<DashboardSummaryDto>("/api/reports/summary", { redirectOnUnauthorized: false }),
      api<FinancialSummaryDto>("/api/financial/summary", { redirectOnUnauthorized: false }).catch(
        () => null,
      ),
    ])
      .then(([summary, fin]) => {
        if (cancelled) return;
        setNotif({
          lowStock: summary.stock.lowStockCount,
          outOfStock: summary.stock.outOfStockCount,
          overdueReceivables: fin?.overdueReceivablesCount ?? 0,
          overduePayables: fin?.overduePayablesCount ?? 0,
          loaded: true,
        });
      })
      .catch(() => {
        if (!cancelled) setNotif((n) => ({ ...n, loaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const enc = encodeURIComponent(q);
    const [products, clients, sales] = await Promise.all([
      api<Paginated<ProductDto>>(`/api/products?status=ACTIVE&pageSize=4&search=${enc}`, {
        redirectOnUnauthorized: false,
      }).catch(() => ({ items: [] as ProductDto[] })),
      api<Paginated<ClientDto>>(`/api/clients?status=ACTIVE&pageSize=4&search=${enc}`, {
        redirectOnUnauthorized: false,
      }).catch(() => ({ items: [] as ClientDto[] })),
      api<Paginated<SaleDto>>(`/api/sales?pageSize=3&search=${enc}`, {
        redirectOnUnauthorized: false,
      }).catch(() => ({ items: [] as SaleDto[] })),
    ]);
    setSearchResults({
      products: products.items,
      clients: clients.items,
      sales: sales.items,
    });
    setSearching(false);
  }, []);

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    setSearchOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  function goSearch() {
    const q = searchTerm.trim();
    if (!q) return;
    setSearchOpen(false);
    router.push(`/produtos?search=${encodeURIComponent(q)}`);
  }

  const hasResults =
    searchResults &&
    (searchResults.products.length > 0 ||
      searchResults.clients.length > 0 ||
      searchResults.sales.length > 0);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur md:px-6 lg:px-8">
      {/* Hamburger mobile */}
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Abrir menu"
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb */}
      <nav className="hidden min-w-0 flex-1 items-center gap-1.5 text-sm md:flex">
        <Link
          href="/dashboard"
          className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
        >
          Akylla
        </Link>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const label = routeLabels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
          const href = "/" + segments.slice(0, i + 1).join("/");
          return (
            <span key={seg + i} className="flex items-center gap-1.5">
              <span className="text-slate-300">›</span>
              {isLast ? (
                <span className="truncate font-medium text-slate-900">{label}</span>
              ) : (
                <Link
                  href={href}
                  className="text-slate-400 transition-colors hover:text-slate-600"
                >
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
      <span className="truncate text-sm font-medium text-slate-900 md:hidden">
        {routeLabels[segments[0] ?? ""] ?? "Akylla"}
      </span>

      {/* Busca + notificações + perfil */}
      <div className="ml-auto flex items-center gap-2">
        {/* Busca global */}
        <div ref={searchRef} className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goSearch();
              if (e.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Buscar produtos, clientes, vendas…"
            aria-label="Busca global"
            className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 xl:w-72"
          />
          {searchOpen && searchTerm.trim().length >= 2 && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              {searching && (
                <p className="px-4 py-3 text-sm text-slate-400">Buscando…</p>
              )}
              {!searching && !hasResults && (
                <p className="px-4 py-3 text-sm text-slate-400">
                  Nenhum resultado para “{searchTerm.trim()}”.
                </p>
              )}
              {!searching && hasResults && (
                <div className="max-h-80 overflow-y-auto py-1">
                  {searchResults!.products.length > 0 && (
                    <div>
                      <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Produtos
                      </p>
                      {searchResults!.products.map((p) => (
                        <Link
                          key={p.id}
                          href={`/produtos/${p.id}`}
                          className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                        >
                          <Package className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate text-slate-700">{p.name}</span>
                          <span className="ml-auto shrink-0 text-xs text-slate-400">
                            {formatBrl(p.salePrice)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults!.clients.length > 0 && (
                    <div>
                      <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Clientes
                      </p>
                      {searchResults!.clients.map((c) => (
                        <Link
                          key={c.id}
                          href={`/clientes/${c.id}`}
                          className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                        >
                          <Users className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate text-slate-700">{c.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults!.sales.length > 0 && (
                    <div>
                      <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Vendas
                      </p>
                      {searchResults!.sales.map((s) => (
                        <Link
                          key={s.id}
                          href={`/vendas/${s.id}`}
                          className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                        >
                          <Receipt className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="font-mono text-xs text-slate-700">{s.receiptCode}</span>
                          <span className="ml-auto shrink-0 text-xs text-slate-500">
                            {formatBrl(s.total)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={goSearch}
                className="block w-full border-t border-slate-100 px-4 py-2 text-left text-xs text-primary-700 hover:bg-primary-50"
              >
                Ver todos os resultados em Produtos →
              </button>
            </div>
          )}
        </div>

        {/* Notificações */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label={`Notificações${alertCount > 0 ? ` (${alertCount})` : ""}`}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <p className="text-sm font-semibold text-slate-900">Notificações</p>
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Fechar"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {!notif.loaded ? (
                <p className="px-4 py-3 text-sm text-slate-400">Carregando…</p>
              ) : alertCount === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-400">
                  Nenhum alerta no momento. Tudo em ordem!
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notif.outOfStock > 0 && (
                    <Link
                      href="/produtos"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div>
                        <p className="text-sm text-slate-800">
                          {notif.outOfStock} produto(s) sem estoque
                        </p>
                        <p className="text-xs text-slate-400">Ver produtos →</p>
                      </div>
                    </Link>
                  )}
                  {notif.lowStock > 0 && (
                    <Link
                      href="/produtos"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-sm text-slate-800">
                          {notif.lowStock} produto(s) com estoque baixo
                        </p>
                        <p className="text-xs text-slate-400">Ver produtos →</p>
                      </div>
                    </Link>
                  )}
                  {notif.overdueReceivables > 0 && (
                    <Link
                      href="/financeiro"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div>
                        <p className="text-sm text-slate-800">
                          {notif.overdueReceivables} conta(s) a receber vencida(s)
                        </p>
                        <p className="text-xs text-slate-400">Ver financeiro →</p>
                      </div>
                    </Link>
                  )}
                  {notif.overduePayables > 0 && (
                    <Link
                      href="/financeiro"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-sm text-slate-800">
                          {notif.overduePayables} conta(s) a pagar vencida(s)
                        </p>
                        <p className="text-xs text-slate-400">Ver financeiro →</p>
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Perfil */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            aria-label="Menu do usuário"
            aria-expanded={profileOpen}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800">
              {initials(userName)}
            </span>
            <span className="hidden text-sm font-medium text-slate-700 lg:block">
              {userName.split(" ")[0]}
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 lg:block" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                <p className="text-xs text-slate-400">
                  {userRole === "ADMIN" ? "Proprietário" : "Membro"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4 text-slate-400" />
                Sair
              </button>
            </div>
          )}
        </div>

        {/* Data (desktop) */}
        <span className="hidden text-xs capitalize text-slate-400 xl:block">
          {formatDate()}
        </span>
      </div>
    </header>
  );
}
