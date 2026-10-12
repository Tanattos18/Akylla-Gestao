"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routeLabels: Record<string, string> = {
  dashboard: "Visão geral",
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
};

function formatDate(): string {
  const now = new Date();
  return now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function Header({
  userName,
  userInitials,
}: {
  userName: string;
  userInitials: string;
}) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link
          href="/dashboard"
          className="text-slate-400 transition-colors hover:text-slate-600"
        >
          Akylla
        </Link>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const label = routeLabels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
          const href = "/" + segments.slice(0, i + 1).join("/");
          return (
            <span key={seg} className="flex items-center gap-1.5">
              <span className="text-slate-300">›</span>
              {isLast ? (
                <span className="font-medium text-slate-900">{label}</span>
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

      {/* Data + avatar */}
      <div className="flex items-center gap-4">
        <span className="hidden text-xs capitalize text-slate-400 md:block">
          {formatDate()}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800"
          title={userName}
        >
          {userInitials}
        </div>
      </div>
    </header>
  );
}
