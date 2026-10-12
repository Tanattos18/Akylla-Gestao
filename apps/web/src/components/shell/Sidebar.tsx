"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Wallet,
  TrendingUp,
  Scissors,
  Calendar,
  Package,
  Tags,
  Truck,
  Users,
  PawPrint,
  MessageCircle,
  Repeat,
  BarChart3,
  UserCog,
  CreditCard,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  X,
  LifeBuoy,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import type { BusinessModule } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  module?: BusinessModule;
  adminOnly?: boolean;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Início", href: "/", icon: Home },
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Operação",
    items: [
      { label: "PDV", href: "/pdv", icon: ShoppingCart },
      { label: "Vendas", href: "/vendas", icon: Receipt },
      { label: "Caixa", href: "/caixa", icon: Wallet },
      { label: "Financeiro", href: "/financeiro", icon: TrendingUp },
      { label: "Serviços", href: "/servicos", icon: Scissors, module: "SERVICES" },
      { label: "Agenda", href: "/agenda", icon: Calendar, module: "APPOINTMENTS" },
    ],
  },
  {
    title: "Estoque e compras",
    items: [
      { label: "Produtos", href: "/produtos", icon: Package },
      { label: "Categorias", href: "/categorias", icon: Tags },
      { label: "Fornecedores", href: "/fornecedores", icon: Truck },
    ],
  },
  {
    title: "Relacionamento",
    items: [
      { label: "Clientes", href: "/clientes", icon: Users },
      { label: "Pets", href: "/pets", icon: PawPrint },
      { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, module: "WHATSAPP" },
      { label: "Assinaturas", href: "/assinaturas", icon: Repeat, module: "SUBSCRIPTIONS" },
    ],
  },
  {
    title: "Gestão",
    items: [{ label: "Relatórios", href: "/relatorios", icon: BarChart3 }],
  },
  {
    title: "Administração",
    items: [
      { label: "Usuários", href: "/usuarios", icon: UserCog, adminOnly: true },
      { label: "Faturamento", href: "/faturamento", icon: CreditCard, adminOnly: true },
      { label: "Planos", href: "/planos", icon: ClipboardList, adminOnly: true },
    ],
  },
];

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

function NavSection({
  group,
  collapsed,
  disabledModules,
  isAdmin,
  onNavigate,
}: {
  group: NavGroup;
  collapsed: boolean;
  disabledModules: Set<string>;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const visible = group.items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.module && disabledModules.has(item.module)) return false;
    return true;
  });

  if (visible.length === 0) return null;

  return (
    <div className="mb-2">
      {group.title && !collapsed && (
        <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {group.title}
        </p>
      )}
      {group.title && collapsed && (
        <div className="mx-4 mb-1 border-t border-white/10" />
      )}
      {visible.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              collapsed ? "justify-center px-3" : ""
            } ${
              active
                ? "bg-white/10 text-white"
                : "text-sidebar-text hover:bg-white/5 hover:text-white"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary-500" />
            )}
            <Icon
              className="h-[18px] w-[18px] shrink-0"
              strokeWidth={active ? 2 : 1.5}
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({
  companyName,
  userName,
  userRole,
  disabledModules,
  onLogout,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  companyName: string;
  userName: string;
  userRole: string;
  disabledModules: Set<string>;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const isAdmin = userRole === "ADMIN";
  const width = collapsed ? "lg:w-[72px]" : "lg:w-[260px]";

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sidebar transition-transform duration-200 lg:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${width}`}
      >
        {/* Logo */}
        <div
          className={`flex items-center px-5 pb-4 pt-5 ${
            collapsed ? "lg:justify-center lg:px-3" : "gap-2.5"
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-sm font-bold text-white">
            a
          </div>
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight text-white">
              Akylla Gestão
            </span>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Empresa */}
        {!collapsed && (
          <div className="mx-3 mb-4 rounded-lg bg-white/5 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/20 text-xs font-semibold text-primary-400">
                {initials(companyName)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Empresa ativa
                </p>
                <p className="truncate text-sm font-medium text-white">{companyName}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navegação */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-2">
          {navGroups.map((group, i) => (
            <NavSection
              key={group.title ?? `group-${i}`}
              group={group}
              collapsed={collapsed}
              disabledModules={disabledModules}
              isAdmin={isAdmin}
              onNavigate={onCloseMobile}
            />
          ))}
        </nav>

        {/* Recolher (desktop) */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden items-center gap-2 border-t border-white/5 px-4 py-2.5 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white lg:flex"
        >
          {collapsed ? (
            <ChevronsRight className="mx-auto h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Recolher menu</span>
            </>
          )}
        </button>

        {/* Ajuda + usuário */}
        <div className="border-t border-white/5 p-3">
          {!collapsed && (
            <a
              href="https://wa.me/5500000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 flex items-start gap-3 rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
            >
              <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" />
              <div>
                <p className="text-xs font-medium text-white">Precisa de ajuda?</p>
                <p className="text-[11px] text-slate-400">Fale com a gente →</p>
              </div>
            </a>
          )}

          <div
            className={`flex items-center rounded-lg px-1 py-1.5 ${
              collapsed ? "lg:justify-center" : "justify-between"
            }`}
          >
            <div className={`flex items-center ${collapsed ? "" : "gap-2.5"}`}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-[11px] font-semibold text-primary-400">
                {initials(userName)}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">{userName}</p>
                  <p className="text-[10px] text-slate-500">
                    {isAdmin ? "Proprietário" : "Membro"}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={onLogout}
              title="Sair"
              aria-label="Sair"
              className={`rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
