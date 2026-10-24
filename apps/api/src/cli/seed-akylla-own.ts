import "dotenv/config";
import { PrismaClient, type DigitalProductType } from "@prisma/client";
import { systemDatabaseUrl } from "../common/tenant/rls.extension";

/**
 * Transformação 2026-10-23 — cadastra os produtos do próprio Akylla como
 * entregas na empresa da plataforma. Idempotente: pode rodar várias vezes
 * (busca por nome antes de criar; nada é apagado nem sobrescrito).
 *
 * Uso:
 *   npm run db:seed:akylla                          # empresa slug "akylla-gestao"
 *   npm run db:seed:akylla -- --company=<slug>
 *   npm run db:seed:akylla -- --desativar-demos     # também suspende as demos "demo-*"
 *   npm run db:seed:akylla -- --reativar-demos      # desfaz a suspensão das demos
 *   npm run db:seed:akylla -- --simular             # só mostra o que faria
 *   npm run db:seed:akylla -- --pix=<chave>         # chave Pix das cobranças
 *
 * Chave Pix: se a empresa ainda não tem, grava --pix, ou NEXT_PUBLIC_PIX_KEY,
 * ou a mesma chave padrão do Faturamento (apps/web/src/components/billing/PixCard.tsx).
 *
 * Demos: suspender = status INACTIVE + sessões revogadas, igual ao botão
 * "Suspender" do painel /plataforma. Os dados das demos são mantidos.
 */

// Processo de sistema: conexão com bypass da RLS (Fase 1 · 1E)
const prisma = new PrismaClient({
  datasources: { db: { url: systemDatabaseUrl(process.env.DATABASE_URL ?? "") } },
});

const DEMO_SLUG_PREFIX = "demo-";
/** Mesma chave padrão de apps/web/src/components/billing/PixCard.tsx. */
const DEFAULT_PIX_KEY = "7dda9a3c-400d-45de-906b-f22b2615f1d5";
const DEMO_REASON = "Demonstração de comércio desligada na transformação para produtos digitais (dados mantidos)";

interface DeliverySeed {
  name: string;
  type: DigitalProductType;
  siteUrl?: string;
  adminUrl?: string;
  repositoryUrl?: string;
  domain?: string;
  notes?: string;
}

interface ClientSeed {
  name: string;
  notes: string;
  deliveries: DeliverySeed[];
}

const CATALOG: Array<{ name: string; type: DigitalProductType; billingPeriod: "MONTHLY" | "YEARLY" }> = [
  { name: "Site institucional", type: "SITE", billingPeriod: "MONTHLY" },
  { name: "Perfil profissional", type: "PROFESSIONAL_PROFILE", billingPeriod: "MONTHLY" },
  { name: "Sistema sob medida", type: "SYSTEM", billingPeriod: "MONTHLY" },
  { name: "Loja virtual", type: "ONLINE_STORE", billingPeriod: "MONTHLY" },
  { name: "Hospedagem", type: "HOSTING", billingPeriod: "MONTHLY" },
  { name: "Domínio", type: "DOMAIN", billingPeriod: "YEARLY" },
  { name: "Manutenção", type: "MAINTENANCE", billingPeriod: "MONTHLY" },
];

const CLIENTS: ClientSeed[] = [
  {
    name: "Akylla (próprio)",
    notes: "Produtos próprios do Akylla. Nunca pausar.",
    deliveries: [
      {
        name: "Akylla Gestão (app)",
        type: "SYSTEM",
        siteUrl: "https://app.akyllagestao.com.br/",
        repositoryUrl: "https://github.com/Tanattos18/Akylla-Gestao",
        domain: "app.akyllagestao.com.br",
        notes: "VPS Hostinger (Ubuntu 24.04). Atualizar com scripts/deploy/vps/update.sh.",
      },
      {
        name: "Site Akylla Gestão",
        type: "SITE",
        siteUrl: "https://akyllagestao.com.br/",
        domain: "akyllagestao.com.br",
      },
      {
        name: "Akylla Shop",
        type: "ONLINE_STORE",
        siteUrl: "https://akyllashop.com/",
        adminUrl: "https://akyllashop.com/admin/",
        domain: "akyllashop.com",
      },
      {
        name: "Akylla Studio",
        type: "SITE",
        siteUrl: "https://akyllastudio.github.io/#inicio",
        notes: "Página de links: https://akyllastudio.github.io/links.html",
      },
    ],
  },
  {
    name: "Akylla Studio (teste)",
    notes: "Cliente de teste para validar entregas, contratos e avisos. Nunca pausar.",
    deliveries: [
      {
        name: "Akylla Studio",
        type: "SITE",
        siteUrl: "https://akyllastudio.github.io/#inicio",
        notes: "Página de links: https://akyllastudio.github.io/links.html",
      },
    ],
  },
];

function key(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseArgs() {
  const args = process.argv.slice(2);
  let company = process.env.SEED_COMPANY ?? "akylla-gestao";
  let pix: string | null = null;
  for (const arg of args) {
    if (arg.startsWith("--company=")) company = arg.slice("--company=".length);
    if (arg.startsWith("--pix=")) pix = arg.slice("--pix=".length).trim() || null;
  }
  return {
    company,
    pix: pix ?? (process.env.NEXT_PUBLIC_PIX_KEY || DEFAULT_PIX_KEY),
    disableDemos: args.includes("--desativar-demos"),
    enableDemos: args.includes("--reativar-demos"),
    dryRun: args.includes("--simular"),
  };
}

async function seedOwnDeliveries(companyId: string, dryRun: boolean) {
  for (const item of CATALOG) {
    const nameKey = key(item.name);
    const existing = await prisma.digitalProduct.findUnique({ where: { companyId_nameKey: { companyId, nameKey } } });
    if (existing) {
      console.log(`  = catálogo: ${item.name}`);
      continue;
    }
    console.log(`  + catálogo: ${item.name} (preço 0,00 — ajuste na tela Catálogo digital)`);
    if (!dryRun) {
      await prisma.digitalProduct.create({
        data: { companyId, name: item.name, nameKey, type: item.type, billingPeriod: item.billingPeriod, defaultPrice: "0" },
      });
    }
  }

  for (const seed of CLIENTS) {
    const nameKey = key(seed.name);
    let client = await prisma.client.findFirst({ where: { companyId, nameKey } });
    if (client) {
      console.log(`  = cliente: ${seed.name}`);
    } else {
      console.log(`  + cliente: ${seed.name}`);
      if (!dryRun) {
        client = await prisma.client.create({ data: { companyId, name: seed.name, nameKey, notes: seed.notes } });
      }
    }

    for (const delivery of seed.deliveries) {
      const existing = client
        ? await prisma.clientDelivery.findFirst({ where: { companyId, clientId: client.id, name: delivery.name } })
        : null;
      if (existing) {
        console.log(`    = entrega: ${delivery.name}`);
        continue;
      }
      console.log(`    + entrega: ${delivery.name} (nunca pausar)`);
      if (!dryRun && client) {
        const product = await prisma.digitalProduct.findFirst({ where: { companyId, type: delivery.type } });
        await prisma.clientDelivery.create({
          data: {
            companyId,
            clientId: client.id,
            productId: product?.id ?? null,
            name: delivery.name,
            type: delivery.type,
            siteUrl: delivery.siteUrl ?? null,
            adminUrl: delivery.adminUrl ?? null,
            repositoryUrl: delivery.repositoryUrl ?? null,
            domain: delivery.domain ?? null,
            notes: delivery.notes ?? null,
            status: "ACTIVE",
            neverPause: true,
          },
        });
      }
    }
  }
}

async function toggleDemos(disable: boolean, dryRun: boolean) {
  const demos = await prisma.company.findMany({
    where: { slug: { startsWith: DEMO_SLUG_PREFIX } },
    select: { id: true, name: true, slug: true, status: true },
    orderBy: { slug: "asc" },
  });
  if (demos.length === 0) {
    console.log("  (nenhuma empresa demo-* encontrada)");
    return;
  }
  const now = new Date();
  for (const demo of demos) {
    const target = disable ? "INACTIVE" : "ACTIVE";
    if (demo.status === target) {
      console.log(`  = ${demo.slug}: já ${disable ? "suspensa" : "ativa"}`);
      continue;
    }
    console.log(`  ${disable ? "- suspender" : "+ reativar"}: ${demo.name} (${demo.slug}) — dados mantidos`);
    if (dryRun) continue;
    if (disable) {
      await prisma.$transaction([
        prisma.company.update({
          where: { id: demo.id },
          data: { status: "INACTIVE", suspendedAt: now, suspendedReason: DEMO_REASON },
        }),
        prisma.session.updateMany({ where: { user: { companyId: demo.id }, revokedAt: null }, data: { revokedAt: now } }),
      ]);
    } else {
      await prisma.company.update({
        where: { id: demo.id },
        data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
      });
    }
  }
}

async function main() {
  const { company: companyArg, pix, disableDemos, enableDemos, dryRun } = parseArgs();
  if (disableDemos && enableDemos) {
    throw new Error("Use --desativar-demos ou --reativar-demos, não os dois.");
  }

  const company = await prisma.company.findFirst({
    where: { OR: [{ slug: companyArg }, { id: companyArg }] },
    select: { id: true, name: true, slug: true, pixKey: true },
  });
  if (!company) {
    throw new Error(`Empresa não encontrada: ${companyArg}. Informe --company=<slug>.`);
  }
  if (company.slug.startsWith(DEMO_SLUG_PREFIX)) {
    throw new Error("A empresa da plataforma não pode ser uma demonstração (demo-*).");
  }

  console.log(`${dryRun ? "[SIMULAÇÃO] " : ""}Produtos próprios do Akylla → ${company.name} (${company.slug})`);
  await seedOwnDeliveries(company.id, dryRun);

  if (company.pixKey) {
    console.log("  = chave Pix da cobrança já cadastrada");
  } else {
    console.log(`  + chave Pix da cobrança: ${pix}`);
    if (!dryRun) await prisma.company.update({ where: { id: company.id }, data: { pixKey: pix } });
  }

  if (disableDemos || enableDemos) {
    console.log(`${dryRun ? "[SIMULAÇÃO] " : ""}Empresas de demonstração:`);
    await toggleDemos(disableDemos, dryRun);
  }
  console.log("Pronto.");
}

main()
  .catch((error) => {
    console.error("Falha ao cadastrar os produtos do Akylla:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
