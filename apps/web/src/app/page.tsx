"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
  Globe,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Layers,
  Receipt,
  Repeat,
  Users,
  Wallet,
  Wrench,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { fetchSession, type Session } from "../lib/session";
import { DigitalOverview } from "../components/digital/DigitalOverview";
import type { BusinessModule, CompanyModuleDto, OnboardingStatusDto } from "../lib/types";

type Tone = "amber" | "emerald" | "sky" | "violet" | "rose" | "slate";

interface HomeModule {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: Tone;
  module?: BusinessModule;
}

interface HomeGroup {
  title: string;
  subtitle: string;
  items: HomeModule[];
}

/** Módulos da tela inicial, agrupados pelo dia a dia: clientes, entregas e contratos. */
const groups: HomeGroup[] = [
  {
    title: "Clientes e entregas",
    subtitle: "Quem atendemos e o que entregamos",
    items: [
      { name: "Clientes", description: "Ficha com entregas, contratos e histórico", href: "/clientes", icon: Users, tone: "emerald" },
      { name: "Entregas", description: "Sites, sistemas, lojas virtuais, domínios e hospedagens", href: "/entregas", icon: Globe, tone: "emerald" },
      { name: "Catálogo digital", description: "Produtos digitais com preço e periodicidade", href: "/catalogo", icon: Layers, tone: "emerald" },
      { name: "Contratos", description: "Planos recorrentes vinculados às entregas", href: "/assinaturas", icon: Repeat, tone: "emerald", module: "SUBSCRIPTIONS" },
    ],
  },
  {
    title: "Atender e cobrar",
    subtitle: "Agenda, comunicação e dinheiro",
    items: [
      { name: "Financeiro", description: "Contas a pagar e a receber", href: "/financeiro", icon: Wallet, tone: "amber" },
      { name: "Agendamentos", description: "Agenda com conflito de horário e lembretes", href: "/agenda", icon: CalendarDays, tone: "amber", module: "APPOINTMENTS" },
      { name: "Automação WhatsApp", description: "Templates, consentimento e envios automáticos", href: "/whatsapp", icon: MessageCircle, tone: "amber", module: "WHATSAPP" },
    ],
  },
  {
    title: "Prestar serviços",
    subtitle: "Do orçamento à entrega",
    items: [
      { name: "Serviços", description: "Catálogo com preço e duração", href: "/servicos", icon: Scissors, tone: "sky", module: "SERVICES" },
      { name: "Ordens de serviço", description: "Orçamento, aprovação, execução, fotos e anexos", href: "/os", icon: Wrench, tone: "sky", module: "SERVICE_ORDERS" },
      { name: "Nota fiscal", description: "NFS-e e notas por integradora autorizada", href: "/fiscal", icon: Receipt, tone: "sky", module: "FISCAL" },
    ],
  },
  {
    title: "Acompanhar resultados",
    subtitle: "Números para decidir melhor",
    items: [
      { name: "Dashboard", description: "Clientes, financeiro e contratos num só lugar", href: "/dashboard", icon: LayoutDashboard, tone: "violet" },
      { name: "Relatórios", description: "Por período, com exportação e impressão", href: "/relatorios", icon: BarChart3, tone: "violet" },
      { name: "Faturamento", description: "Seu plano no Akylla Gestão e pagamentos", href: "/faturamento", icon: CreditCard, tone: "violet" },
    ],
  },
];

const toneClass: Record<Tone, { icon: string; glow: string }> = {
  amber: { icon: "bg-gradient-to-br from-amber-400 to-orange-500 text-white", glow: "group-hover:border-amber-300" },
  emerald: { icon: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white", glow: "group-hover:border-emerald-300" },
  sky: { icon: "bg-gradient-to-br from-sky-400 to-blue-600 text-white", glow: "group-hover:border-sky-300" },
  violet: { icon: "bg-gradient-to-br from-violet-400 to-indigo-600 text-white", glow: "group-hover:border-violet-300" },
  rose: { icon: "bg-gradient-to-br from-rose-400 to-pink-600 text-white", glow: "group-hover:border-rose-300" },
  slate: { icon: "bg-slate-200 text-slate-600", glow: "" },
};

const quickActions: Array<{ label: string; href: string; icon: LucideIcon; adminOnly?: boolean }> = [
  { label: "Novo cliente", href: "/clientes", icon: Users },
  { label: "Entregas", href: "/entregas", icon: Globe },
  { label: "Contratos", href: "/assinaturas", icon: Repeat },
  { label: "Relatórios", href: "/relatorios", icon: FileText },
];

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [companyModules, setCompanyModules] = useState<CompanyModuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingStatusDto | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    api<OnboardingStatusDto>("/api/onboarding/status")
      .then(setOnboarding)
      .catch(() => setOnboarding(null));
    api<CompanyModuleDto[]>("/api/company-modules")
      .then(setCompanyModules)
      .catch(() => setCompanyModules([]));
  }, []);

  const byModule = useMemo(() => new Map(companyModules.map((entry) => [entry.module, entry])), [companyModules]);

  /** Desligado pela empresa: some. Fora do plano: aparece bloqueado (contratar). */
  const view = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items
            .filter((item) => !item.module || byModule.get(item.module)?.status !== "DISABLED")
            .map((item) => ({ ...item, locked: item.module ? byModule.get(item.module)?.entitled === false : false })),
        }))
        .filter((group) => group.items.length > 0),
    [byModule],
  );

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando sessão...</p>;
  }

  const firstName = session.user.name.split(" ")[0];
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="space-y-10">
      {onboarding && !onboarding.completed && isAdmin && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <strong className="font-medium">Configure o Akylla para o seu negócio.</strong> Escolha o perfil e o
            sistema liga os módulos certos para você.
          </p>
          <Link href="/onboarding" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Escolher perfil
          </Link>
        </section>
      )}

      <section className="relative overflow-hidden rounded-2xl bg-sidebar px-6 py-8 text-white shadow-lg sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary-500/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium text-primary-400">
            {now
              ? now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
              : " "}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {now ? greeting(now) : "Olá"}, {firstName}!
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/75">
            {session.company.name} · {isAdmin ? "administrador" : "equipe"}. O que vamos fazer agora?
          </p>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Atalhos">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className={
                      index === 0
                        ? "inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-sidebar shadow hover:bg-primary-400"
                        : "inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {action.label}
                  </Link>
                </li>
              );
            })}
            {isAdmin && (
              <li>
                <Link
                  href="/usuarios"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Equipe
                </Link>
              </li>
            )}
          </ul>
        </div>
      </section>

      <DigitalOverview />

      {view.map((group) => (
        <section key={group.title} aria-labelledby={`grupo-${group.title}`}>
          <div className="mb-4 flex items-baseline gap-3">
            <h3 id={`grupo-${group.title}`} className="text-lg font-semibold text-slate-900">
              {group.title}
            </h3>
            <span className="text-sm text-slate-500">{group.subtitle}</span>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              const tone = toneClass[item.locked ? "slate" : item.tone];
              return (
                <li key={item.href}>
                  <Link
                    href={item.locked ? "/faturamento#monte-seu-plano" : item.href}
                    className={`group flex h-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${tone.glow}`}
                  >
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${tone.icon}`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`font-semibold ${item.locked ? "text-slate-500" : "text-slate-900"}`}>{item.name}</span>
                        {item.locked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            <Lock className="h-3 w-3" aria-hidden="true" /> Contratar
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">{item.description}</span>
                    </span>
                    <ArrowRight
                      className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
