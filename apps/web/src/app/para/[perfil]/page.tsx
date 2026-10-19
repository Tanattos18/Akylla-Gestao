import Link from "next/link";
import { notFound } from "next/navigation";

const perfis = {
  comercio: {
    title: "Akylla para comércio",
    lead: "Para lojas, mercadinhos, adegas, papelarias e conveniência.",
    items: [
      "PDV rápido com leitor de código de barras e controle de caixa",
      "Estoque com alerta de mínimo e histórico de movimentações",
      "Crediário com parcelas, limite por cliente e controle de vencidas",
      "Comissão por vendedor, produto ou categoria",
      "Nota fiscal (NFC-e e NF-e) por integradora autorizada",
      "Lembretes e cobranças pelo WhatsApp",
    ],
  },
  servicos: {
    title: "Akylla para serviços",
    lead: "Para salões, clínicas, oficinas e assistências técnicas.",
    items: [
      "Agenda de atendimentos com lembrete no WhatsApp",
      "Catálogo de serviços com preço e duração",
      "Ordem de serviço com orçamento, aprovação, fotos e anexos",
      "Comissão por profissional, calculada automaticamente",
      "Financeiro e caixa integrados",
    ],
  },
  hibrido: {
    title: "Akylla para comércio e serviços",
    lead: "Para oficinas com loja, estúdios, clínicas e assistências que também vendem produtos.",
    items: [
      "Tudo do perfil de serviços: agenda, OS e comissões",
      "PDV e estoque para a parte de loja",
      "Crediário para vender a prazo",
      "WhatsApp para lembretes e relacionamento",
    ],
  },
} as const;

type Perfil = keyof typeof perfis;

function isPerfil(value: string): value is Perfil {
  return Object.hasOwn(perfis, value);
}

export function generateStaticParams() {
  return Object.keys(perfis).map((perfil) => ({ perfil }));
}

export async function generateMetadata({ params }: { params: Promise<{ perfil: string }> }) {
  const { perfil } = await params;
  return { title: isPerfil(perfil) ? `${perfis[perfil].title} — Akylla Gestão` : "Akylla Gestão" };
}

/** Páginas públicas por perfil (Fase 4). */
export default async function PerfilPage({ params }: { params: Promise<{ perfil: string }> }) {
  const { perfil } = await params;
  if (!isPerfil(perfil)) notFound();
  const data = perfis[perfil];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-medium text-primary-700">Akylla Gestão</p>
      <h1 className="mt-1 text-3xl font-semibold text-slate-900">{data.title}</h1>
      <p className="mt-3 text-lg text-slate-600">{data.lead}</p>
      <ul className="mt-8 space-y-3">
        {data.items.map((item) => (
          <li key={item} className="flex gap-3 text-slate-800">
            <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-700" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/cadastro"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Criar conta
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Já tenho conta
        </Link>
      </div>
      <nav className="mt-12 flex flex-wrap gap-4 text-sm text-slate-600" aria-label="Outros perfis">
        {(Object.keys(perfis) as Perfil[])
          .filter((p) => p !== perfil)
          .map((p) => (
            <Link key={p} href={`/para/${p}`} className="hover:underline">
              {perfis[p].title}
            </Link>
          ))}
      </nav>
    </main>
  );
}
