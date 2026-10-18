"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Package,
  Users,
  Receipt,
  AlertTriangle,
  CalendarClock,
  PawPrint,
  Scissors,
  Percent,
  HandCoins,
  BadgeCheck,
  Home,
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Calendar,
  Tags,
  Truck,
  MessageCircle,
  Repeat,
  BarChart3,
  UserCog,
  CreditCard,
  ClipboardList,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatBrl } from "@/lib/format";
import type {
  BusinessModule,
  ClientDto,
  DashboardSummaryDto,
  FinancialSummaryDto,
  Paginated,
  PetDto,
  ProductDto,
  SaleDto,
  ServiceDto,
} from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  module?: BusinessModule;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const directItems: NavItem[] = [
  { label: "Início", href: "/", icon: Home },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

const navGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { label: "PDV", href: "/pdv", icon: ShoppingCart },
      { label: "Vendas", href: "/vendas", icon: Receipt },
      { label: "Caixa", href: "/caixa", icon: Wallet },
      { label: "Financeiro", href: "/financeiro", icon: TrendingUp },
      { label: "Serviços", href: "/servicos", icon: Scissors, module: "SERVICES" },
      { label: "Agenda", href: "/agenda", icon: Calendar, module: "APPOINTMENTS" },
      { label: "Comissões", href: "/comissoes", icon: Percent, module: "COMMISSIONS" },
      { label: "Crediário", href: "/crediario", icon: HandCoins, module: "CREDIT" },
      { label: "Profissionais", href: "/profissionais", icon: BadgeCheck, module: "COMMISSIONS" },
    ],
  },
  {
    label: "Estoque",
    items: [
      { label: "Produtos", href: "/produtos", icon: Package },
      { label: "Categorias", href: "/categorias", icon: Tags },
      { label: "Fornecedores", href: "/fornecedores", icon: Truck },
    ],
  },
  {
    label: "Relacionamento",
    items: [
      { label: "Clientes", href: "/clientes", icon: Users },
      { label: "Pets", href: "/pets", icon: PawPrint },
      { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, module: "WHATSAPP" },
      { label: "Assinaturas", href: "/assinaturas", icon: Repeat, module: "SUBSCRIPTIONS" },
    ],
  },
  {
    label: "Gestão",
    items: [{ label: "Relatórios", href: "/relatorios", icon: BarChart3 }],
  },
  {
    label: "Administração",
    items: [
      { label: "Usuários", href: "/usuarios", icon: UserCog, adminOnly: true },
      { label: "Faturamento", href: "/faturamento", icon: CreditCard, adminOnly: true },
      { label: "Planos", href: "/planos", icon: ClipboardList, adminOnly: true },
      { label: "Importações", href: "/importacoes", icon: FileSpreadsheet, adminOnly: true },
    ],
  },
];

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
  comissoes: "Comissões",
  crediario: "Crediário",
  regras: "Regras",
  profissionais: "Profissionais",
  planos: "Planos",
  usuarios: "Usuários",
  faturamento: "Faturamento",
  relatorios: "Relatórios",
  importacoes: "Importações",
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
  pets: PetDto[];
  services: ServiceDto[];
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

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function filterItems(items: NavItem[], disabledModules: Set<string>, isAdmin: boolean) {
  return items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.module && disabledModules.has(item.module)) return false;
    return true;
  });
}

export function Header({
  userName,
  userRole,
  disabledModules,
  onLogout,
}: {
  userName: string;
  userRole: string;
  disabledModules: Set<string>;
  onLogout: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const isAdmin = userRole === "ADMIN";

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);

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
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alertCount =
    notif.lowStock + notif.outOfStock + notif.overdueReceivables + notif.overduePayables;

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const [summary, fin] = await Promise.all([
        api<DashboardSummaryDto>("/api/reports/summary", { redirectOnUnauthorized: false }),
        api<FinancialSummaryDto>("/api/financial/summary", {
          redirectOnUnauthorized: false,
        }).catch(() => null),
      ]);
      setNotif({
        lowStock: summary.stock.lowStockCount,
        outOfStock: summary.stock.outOfStockCount,
        overdueReceivables: fin?.overdueReceivablesCount ?? 0,
        overduePayables: fin?.overduePayablesCount ?? 0,
        loaded: true,
      });
    } catch {
      setNotif((n) => ({ ...n, loaded: true }));
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const runSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const enc = encodeURIComponent(q);
    const [products, clients, pets, services, sales] = await Promise.all([
      api<Paginated<ProductDto>>(`/api/products?status=ACTIVE&pageSize=4&search=${enc}`, {
        redirectOnUnauthorized: false,
      }).catch(() => ({ items: [] as ProductDto[] })),
      api<Paginated<ClientDto>>(`/api/clients?status=ACTIVE&pageSize=4&search=${enc}`, {
        redirectOnUnauthorized: false,
      }).catch(() => ({ items: [] as ClientDto[] })),
      api<Paginated<PetDto>>(`/api/pets?status=ACTIVE&pageSize=4&search=${enc}`, {
        redirectOnUnauthorized: false,
      }).catch(() => ({ items: [] as PetDto[] })),
      api<Paginated<ServiceDto>>(`/api/services?status=ACTIVE&pageSize=4&search=${enc}`, {
        redirectOnUnauthorized: false,
      }).catch(() => ({ items: [] as ServiceDto[] })),
      api<Paginated<SaleDto>>(`/api/sales?pageSize=3&search=${enc}`, {
        redirectOnUnauthorized: false,
      }).catch(() => ({ items: [] as SaleDto[] })),
    ]);
    setSearchResults({
      products: products.items,
      clients: clients.items,
      pets: pets.items,
      services: services.items,
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
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
      if (groupRef.current && !groupRef.current.contains(e.target as Node))
        setOpenGroup(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  function toggleNotif() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) void loadNotifications();
  }

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
      searchResults.pets.length > 0 ||
      searchResults.services.length > 0 ||
      searchResults.sales.length > 0);

  const searchInputClass =
    "w-52 rounded-lg border border-white/10 bg-white/10 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-400 focus:border-primary-400/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-primary-500/30 xl:w-64";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-sidebar">
        <div className="flex h-14 items-center gap-2 px-4 md:px-6">
          {/* Hamburger mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 pr-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-sm font-bold text-white">
              a
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
              Akylla Gestão
            </span>
          </Link>

          {/* Nav desktop */}
          <nav ref={groupRef} className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
            {directItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {navGroups.map((group) => {
              const items = filterItems(group.items, disabledModules, isAdmin);
              if (items.length === 0) return null;
              const groupActive = items.some((i) => isActive(pathname, i.href));
              const open = openGroup === group.label;
              return (
                <div key={group.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.label)}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      open || groupActive
                        ? "bg-white/10 text-white"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {group.label}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div
                      role="menu"
                      className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-sidebar py-1 shadow-2xl"
                    >
                      {items.map((item) => {
                        const active = isActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            role="menuitem"
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                              active
                                ? "bg-primary-500/15 text-white"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Ações à direita */}
          <div className="ml-auto flex items-center gap-1.5">
            {/* Busca */}
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
                placeholder="Buscar…"
                aria-label="Busca global"
                className={searchInputClass}
              />
              {searchOpen && searchTerm.trim().length >= 2 && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                  {searching && (
                    <p className="px-4 py-3 text-sm text-slate-400">Buscando…</p>
                  )}
                  {!searching && !hasResults && (
                    <p className="px-4 py-3 text-sm text-slate-400">
                      Nenhum resultado para “{searchTerm.trim()}”.
                    </p>
                  )}
                  {!searching && hasResults && (
                    <div className="max-h-96 overflow-y-auto py-1 text-slate-700">
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
                              <span className="truncate">{p.name}</span>
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
                              <span className="truncate">{c.name}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {searchResults!.pets.length > 0 && (
                        <div>
                          <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Pets
                          </p>
                          {searchResults!.pets.map((pet) => (
                            <Link
                              key={pet.id}
                              href="/pets"
                              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                            >
                              <PawPrint className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="truncate">
                                {pet.name}
                                {pet.client ? ` · ${pet.client.name}` : ""}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {searchResults!.services.length > 0 && (
                        <div>
                          <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Serviços
                          </p>
                          {searchResults!.services.map((s) => (
                            <Link
                              key={s.id}
                              href="/servicos"
                              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                            >
                              <Scissors className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="truncate">{s.name}</span>
                              <span className="ml-auto shrink-0 text-xs text-slate-400">
                                {formatBrl(s.price)}
                              </span>
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
                              <span className="font-mono text-xs">{s.receiptCode}</span>
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
                onClick={toggleNotif}
                aria-label={`Notificações${alertCount > 0 ? ` (${alertCount})` : ""}`}
                aria-expanded={notifOpen}
                className="relative rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Bell className="h-5 w-5" />
                {alertCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
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
                  {notifLoading && !notif.loaded ? (
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
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
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
                          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
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
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 hover:bg-white/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/20 text-xs font-semibold text-primary-400">
                  {initials(userName)}
                </span>
                <span className="hidden text-sm font-medium text-slate-200 md:block">
                  {userName.split(" ")[0]}
                </span>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                    <p className="text-xs text-slate-400">
                      {isAdmin ? "Proprietário" : "Membro"}
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

            {/* Data (xl+) */}
            <span className="ml-2 hidden text-xs capitalize text-slate-400 xl:block">
              {formatDate()}
            </span>
          </div>
        </div>

        {/* Breadcrumb sutil abaixo da topbar (desktop) */}
        {segments.length > 0 && (
          <div className="hidden border-t border-white/5 px-6 py-1.5 lg:block">
            <nav className="flex items-center gap-1.5 text-xs text-slate-400" aria-label="Breadcrumb">
              <Link href="/dashboard" className="hover:text-slate-200">
                Akylla
              </Link>
              {segments.map((seg, i) => {
                const isLast = i === segments.length - 1;
                const label = routeLabels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
                const href = "/" + segments.slice(0, i + 1).join("/");
                return (
                  <span key={seg + i} className="flex items-center gap-1.5">
                    <span className="text-slate-600">›</span>
                    {isLast ? (
                      <span className="font-medium text-slate-200">{label}</span>
                    ) : (
                      <Link href={href} className="hover:text-slate-200">
                        {label}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-14 z-30 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-white/10 bg-sidebar px-4 py-4 lg:hidden">
          <nav className="space-y-1" aria-label="Menu mobile">
            {directItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}

            {navGroups.map((group) => {
              const items = filterItems(group.items, disabledModules, isAdmin);
              if (items.length === 0) return null;
              const groupActive = items.some((i) => isActive(pathname, i.href));
              const open = mobileGroup === group.label;
              return (
                <div key={group.label}>
                  <button
                    type="button"
                    onClick={() => setMobileGroup(open ? null : group.label)}
                    aria-expanded={open}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                      groupActive || open
                        ? "bg-white/10 text-white"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {group.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                      {items.map((item) => {
                        const active = isActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                              active
                                ? "bg-primary-500/15 text-white"
                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
