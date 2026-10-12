"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Calendar,
  Scissors,
  MessageCircle,
  Repeat,
  UserCog,
  CreditCard,
  BarChart3,
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

const mainItems: NavItem[] = [
  { label: "Visão geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Produtos", href: "/produtos", icon: Package },
  { label: "Estoque", href: "/produtos", icon: Boxes },
  { label: "Vendas / PDV", href: "/pdv", icon: ShoppingCart },
  { label: "Caixa", href: "/caixa", icon: Wallet },
  { label: "Financeiro", href: "/financeiro", icon: TrendingUp },
];

const operationItems: NavItem[] = [
  { label: "Agenda", href: "/agenda", icon: Calendar, module: "APPOINTMENTS" },
  { label: "Serviços", href: "/servicos", icon: Scissors, module: "SERVICES" },
  {
    label: "WhatsApp",
    href: "/whatsapp",
    icon: MessageCircle,
    module: "WHATSAPP",
  },
  {
    label: "Assinaturas",
    href: "/assinaturas",
    icon: Repeat,
    module: "SUBSCRIPTIONS",
  },
];

const adminItems: NavItem[] = [
  { label: "Usuários", href: "/usuarios", icon: UserCog, adminOnly: true },
  { label: "Faturamento", href: "/faturamento", icon: CreditCard, adminOnly: true },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
];

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function NavSection({
  title,
  items,
  disabledModules,
  isAdmin,
}: {
  title?: string;
  items: NavItem[];
  disabledModules: Set<string>;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const visible = items.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.module && disabledModules.has(item.module)) return false;
    return true;
  });

  if (visible.length === 0) return null;

  return (
    <div className="mb-2">
      {title && (
        <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </p>
      )}
      {visible.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={`relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-sidebar-text hover:bg-white/5 hover:text-white"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary-500" />
            )}
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
            <span className="truncate">{item.label}</span>
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
}: {
  companyName: string;
  userName: string;
  userRole: string;
  disabledModules: Set<string>;
  onLogout: () => void;
}) {
  const isAdmin = userRole === "ADMIN";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-sm font-bold text-white">
          a
        </div>
        <span className="text-base font-semibold tracking-tight text-white">
          Akylla Gestão
        </span>
      </div>

      {/* Empresa */}
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

      {/* Navegação */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2">
        <NavSection items={mainItems} disabledModules={disabledModules} isAdmin={isAdmin} />
        <NavSection
          title="Operação"
          items={operationItems}
          disabledModules={disabledModules}
          isAdmin={isAdmin}
        />
        {isAdmin && (
          <NavSection
            title="Administração"
            items={adminItems}
            disabledModules={disabledModules}
            isAdmin={isAdmin}
          />
        )}
      </nav>

      {/* Ajuda + usuário */}
      <div className="border-t border-white/5 p-3">
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

        <div className="flex items-center justify-between rounded-lg px-1 py-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/20 text-[11px] font-semibold text-primary-400">
              {initials(userName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{userName}</p>
              <p className="text-[10px] text-slate-500">
                {isAdmin ? "Proprietário" : "Membro"}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sair"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
