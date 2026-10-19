import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { systemDatabaseUrl } from "../common/tenant/rls.extension";
import { ALIMENTACAO, COMERCIO, SERVICOS, type SeedDataset } from "./seed-datasets";

// Processo de sistema: conexão com bypass da RLS (Fase 1 · 1E)
const prisma = new PrismaClient({
  datasources: { db: { url: systemDatabaseUrl(process.env.DATABASE_URL ?? "") } },
});
const BCRYPT_ROUNDS = 12;
/** Senha do membro de demonstração: fixa no desenvolvimento, aleatória em produção. */
const MEMBER_PASSWORD =
  process.env.NODE_ENV === "production" ? `Demo-${randomBytes(9).toString("base64url")}` : "SenhaForte123!";
const OFFSET_MIN = -180;
const RECEIPT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const PRESETS = ["comercio", "servicos", "alimentacao"] as const;
type Preset = (typeof PRESETS)[number];

function parseArgs(): { company: string | null; preset: Preset } {
  const args = process.argv.slice(2);
  let company: string | null = process.env.SEED_COMPANY ?? null;
  let preset: string = process.env.SEED_PRESET ?? "comercio";
  for (const arg of args) {
    if (arg.startsWith("--company=")) company = arg.slice("--company=".length);
    if (arg.startsWith("--preset=")) preset = arg.slice("--preset=".length);
  }
  if (!(PRESETS as readonly string[]).includes(preset)) {
    console.error(`Preset inválido: ${preset}. Use: ${PRESETS.join(", ")}`);
    process.exit(1);
  }
  return { company, preset: preset as Preset };
}

function key(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function receiptCode(used: Set<string>): string {
  for (;;) {
    let suffix = "";
    for (let i = 0; i < 8; i += 1) {
      suffix += RECEIPT_ALPHABET[Math.floor(Math.random() * RECEIPT_ALPHABET.length)];
    }
    const code = `PF-${suffix}`;
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }
}

function dayBase(dayOffset: number): Date {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(midnight + dayOffset * 86_400_000 - OFFSET_MIN * 60_000);
}

function at(dayOffset: number, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(dayBase(dayOffset).getTime() + h * 3_600_000 + m * 60_000);
}

function wall(date: Date): string {
  const shifted = new Date(date.getTime() + OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function money(cents: number): number {
  return cents / 100;
}

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

let lcg = 42;
function rnd(): number {
  lcg = (lcg * 1103515245 + 12345) % 2147483648;
  return lcg / 2147483648;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

type ProductRow = {
  name: string;
  category: string;
  supplier: string;
  unit: "UNIDADE" | "KG" | "PACOTE" | "L" | "ML" | "CAIXA";
  cost: number;
  price: number;
  final: number;
  min: number;
  description: string | null;
};

type ClientRow = { name: string; mobile: string; email: string | null; city: string };

const CLIENTS: ClientRow[] = [
  { name: "Ana Beatriz Lima", mobile: "(11) 98765-4321", email: "ana.lima@email.com", city: "São Paulo" },
  { name: "Carlos Eduardo Santos", mobile: "(11) 99876-1234", email: "cadu.santos@email.com", city: "São Paulo" },
  { name: "Fernanda Oliveira", mobile: "(11) 98123-4567", email: "fe.oliveira@email.com", city: "Guarulhos" },
  { name: "João Pedro Almeida", mobile: "(11) 99111-2233", email: null, city: "São Paulo" },
  { name: "Mariana Costa", mobile: "(11) 98222-3344", email: "mari.costa@email.com", city: "Santo André" },
  { name: "Ricardo Souza", mobile: "(11) 99333-4455", email: "ricardo@email.com", city: "São Paulo" },
  { name: "Juliana Pereira", mobile: "(11) 98444-5566", email: "ju.pereira@email.com", city: "São Paulo" },
  { name: "Bruno Ferreira", mobile: "(11) 99555-6677", email: null, city: "Osasco" },
  { name: "Camila Rodrigues", mobile: "(11) 98555-6677", email: "camila.rodrigues@email.com", city: "São Paulo" },
  { name: "Diego Martins", mobile: "(11) 99666-7788", email: "diego.martins@email.com", city: "Guarulhos" },
  { name: "Larissa Gomes", mobile: "(11) 98666-7788", email: "lari.gomes@email.com", city: "São Paulo" },
  { name: "Thiago Ribeiro", mobile: "(11) 99777-8899", email: null, city: "São Paulo" },
  { name: "Patrícia Alves", mobile: "(11) 98777-8899", email: "patricia.alves@email.com", city: "Diadema" },
  { name: "Felipe Barbosa", mobile: "(11) 99888-9900", email: "felipe.barbosa@email.com", city: "São Paulo" },
  { name: "Letícia Carvalho", mobile: "(11) 98888-9900", email: "leticia@email.com", city: "São Paulo" },
  { name: "Gustavo Araújo", mobile: "(11) 99999-0011", email: null, city: "Mauá" },
  { name: "Isabela Nunes", mobile: "(11) 98999-0011", email: "isa.nunes@email.com", city: "São Paulo" },
  { name: "André Melo", mobile: "(11) 99000-1122", email: "andre.melo@email.com", city: "São Paulo" },
  { name: "Beatriz Correia", mobile: "(11) 98000-1122", email: null, city: "Guarulhos" },
  { name: "Marcelo Dias", mobile: "(11) 99122-3344", email: "marcelo.dias@email.com", city: "São Paulo" },
  { name: "Vanessa Monteiro", mobile: "(11) 98233-4455", email: "vanessa.m@email.com", city: "Santo André" },
  { name: "Paulo Henrique Ramos", mobile: "(11) 99344-5566", email: null, city: "São Paulo" },
  { name: "Sabrina Pinto", mobile: "(11) 98455-6677", email: "sabrina.pinto@email.com", city: "Osasco" },
  { name: "Otávio Cardoso", mobile: "(11) 99566-7788", email: "otavio.cardoso@email.com", city: "São Paulo" },
];

const DATASETS: Record<Preset, SeedDataset> = { comercio: COMERCIO, servicos: SERVICOS, alimentacao: ALIMENTACAO };

// Dados ativos: definidos em main() pelo --preset (Fase 7 · 7.5)
let DATA: SeedDataset = COMERCIO;
let CATEGORIES = DATA.categories;
let SUPPLIERS = DATA.suppliers;
let PRODUCTS: ProductRow[] = DATA.products;
let SERVICES = DATA.services;
let PLAN_ROWS = DATA.plans;

function useDataset(preset: Preset): void {
  DATA = DATASETS[preset];
  CATEGORIES = DATA.categories;
  SUPPLIERS = DATA.suppliers;
  PRODUCTS = DATA.products;
  SERVICES = DATA.services;
  PLAN_ROWS = DATA.plans;
}

type SalePlan = {
  day: number;
  time: string;
  clientIndex: number | null;
  items: Array<{ productIndex: number; qty: number }>;
  method: "CASH" | "CARD" | "PIX";
  discount: number;
  cancelled?: { time: string; reason: string };
};

function buildSalePlans(): SalePlan[] {
  const days = [-26, -21, -17, -13, -9, -6, -3];
  const plans: SalePlan[] = [];
  for (const day of days) {
    const count = randInt(5, 7);
    for (let i = 0; i < count; i += 1) {
      const itemLines = randInt(1, 3);
      const items: Array<{ productIndex: number; qty: number }> = [];
      for (let l = 0; l < itemLines; l += 1) {
        const productIndex = randInt(0, PRODUCTS.length - 1);
        if (items.some((it) => it.productIndex === productIndex)) continue;
        items.push({ productIndex, qty: PRODUCTS[productIndex].price < 20 ? randInt(1, 3) : randInt(1, 2) });
      }
      const roll = rnd();
      const method: SalePlan["method"] = roll < 0.42 ? "CASH" : roll < 0.72 ? "CARD" : "PIX";
      const minutes = 570 + (i * 47) % 510;
      const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      plans.push({
        day,
        time,
        clientIndex: i % 3 === 2 ? null : randInt(0, CLIENTS.length - 1),
        items,
        method,
        discount: i === 4 ? 5 : 0,
      });
    }
  }
  plans.push({
    day: 0,
    time: "14:20",
    clientIndex: 1,
    items: [{ productIndex: 0, qty: 1 }],
    method: "CASH",
    discount: 0,
  });
  plans.push({
    day: 0,
    time: "15:40",
    clientIndex: 6,
    items: [
      { productIndex: 7, qty: 2 },
      { productIndex: 12, qty: 1 },
    ],
    method: "PIX",
    discount: 0,
  });

  plans[4].cancelled = { time: "16:10", reason: "Cliente desistiu — produto trocado" };
  plans[31].cancelled = { time: "17:05", reason: "Pagamento não confirmado" };
  return plans;
}

type SessionPlan = { day: number; initial: number; countedDelta: number | null };

const SESSION_PLANS: SessionPlan[] = [
  { day: -26, initial: 150, countedDelta: null },
  { day: -21, initial: 200, countedDelta: null },
  { day: -17, initial: 180, countedDelta: 3 },
  { day: -13, initial: 150, countedDelta: null },
  { day: -9, initial: 220, countedDelta: null },
  { day: -6, initial: 160, countedDelta: -5 },
  { day: -3, initial: 180, countedDelta: null },
];

async function main() {
  const { company: companyArg, preset } = parseArgs();
  useDataset(preset);

  if (!companyArg) {
    console.error("Uso: npm run db:seed:demo -- --company=<slug|id|email-do-admin> [--preset=comercio|servicos|alimentacao]");
    process.exit(1);
  }

  let companyId: string | null = null;
  if (companyArg.includes("@")) {
    const user = await prisma.user.findFirst({ where: { email: companyArg.toLowerCase() } });
    companyId = user?.companyId ?? null;
  } else {
    const byId = await prisma.company.findUnique({ where: { id: companyArg } });
    if (byId) companyId = byId.id;
    else {
      const bySlug = await prisma.company.findFirst({ where: { slug: companyArg } });
      companyId = bySlug?.id ?? null;
    }
  }

  if (!companyId) {
    console.error(`Empresa não encontrada: ${companyArg}`);
    process.exit(1);
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    console.error("Empresa não encontrada.");
    process.exit(1);
  }

  const [existingProducts, existingClients, admin] = await Promise.all([
    prisma.product.count({ where: { companyId } }),
    prisma.client.count({ where: { companyId } }),
    prisma.user.findFirst({
      where: { companyId, role: "ADMIN", status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!admin) {
    console.error("Nenhum administrador ativo encontrado na empresa.");
    process.exit(1);
  }

  if (existingProducts > 0 || existingClients > 0) {
    console.error(
      `A empresa "${company.name}" já possui dados (${existingProducts} produtos, ${existingClients} clientes). ` +
        "O seed de demonstração só roda em empresa vazia.",
    );
    process.exit(1);
  }

  const usedReceipts = new Set<string>();

  console.log(`Seed de demonstração (${preset}: ${DATA.brand}) → ${company.name} (${company.slug})`);
  console.log(`Administrador: ${admin.email}`);

  // Fase 7 · 7.5: perfil do segmento e onboarding concluído (sem sobrescrever escolha já feita)
  await prisma.company.update({
    where: { id: companyId },
    data: {
      segment: company.segment ?? DATA.segment,
      onboardingCompletedAt: company.onboardingCompletedAt ?? new Date(),
      // Fase 8: empresa de demonstração nunca vence nem entra em somente leitura
      billingExempt: true,
    },
  });

  const result = await prisma.$transaction(
    async (tx) => {
      const counts: Record<string, number> = {};

      const categoryIds = new Map<string, string>();
      for (const row of CATEGORIES) {
        const created = await tx.category.create({
          data: {
            companyId,
            name: row.name,
            nameKey: row.name.toLowerCase(),
            description: row.description,
          },
        });
        categoryIds.set(row.name, created.id);
      }
      counts.categories = CATEGORIES.length;

      const supplierIds = new Map<string, string>();
      for (const row of SUPPLIERS) {
        const created = await tx.supplier.create({
          data: { companyId, ...row },
        });
        supplierIds.set(row.name, created.id);
      }
      counts.suppliers = SUPPLIERS.length;

      const salePlans = buildSalePlans();
      const soldNet = new Array<number>(PRODUCTS.length).fill(0);
      for (const plan of salePlans) {
        for (const item of plan.items) {
          soldNet[item.productIndex] += item.qty;
        }
        if (plan.cancelled) {
          for (const item of plan.items) {
            soldNet[item.productIndex] -= item.qty;
          }
        }
      }

      const productIds: string[] = [];
      for (let i = 0; i < PRODUCTS.length; i += 1) {
        const row = PRODUCTS[i];
        const initial = row.final + soldNet[i];
        const created = await tx.product.create({
          data: {
            companyId,
            categoryId: categoryIds.get(row.category) ?? null,
            supplierId: supplierIds.get(row.supplier) ?? null,
            name: row.name,
            description: row.description,
            sku: `SKU-${String(i + 1).padStart(3, "0")}`,
            barcode: `7891000000${String(i + 1).padStart(4, "0")}`,
            unit: row.unit,
            costPrice: row.cost,
            salePrice: row.price,
            stockQuantity: 0,
            minimumStock: row.min,
          },
        });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: created.id,
            type: "IN",
            quantity: initial,
            notes: "Estoque inicial (dados de demonstração)",
            reference: "SEED-DEMO",
            createdByUserId: admin.id,
          },
        });
        await tx.product.update({
          where: { id: created.id },
          data: { stockQuantity: initial },
        });
        productIds.push(created.id);
      }
      counts.products = PRODUCTS.length;

      const clientIds: string[] = [];
      for (const row of CLIENTS) {
        const created = await tx.client.create({
          data: {
            companyId,
            name: row.name,
            nameKey: key(row.name),
            mobile: row.mobile,
            phone: rnd() < 0.4 ? row.mobile : null,
            email: row.email,
            city: row.city,
            state: "SP",
          },
        });
        clientIds.push(created.id);
      }
      counts.clients = CLIENTS.length;

      const serviceIds: string[] = [];
      for (const row of SERVICES) {
        const created = await tx.service.create({
          data: {
            companyId,
            name: row.name,
            nameKey: key(row.name),
            description: row.description,
            durationMinutes: row.durationMinutes,
            price: row.price,
          },
        });
        serviceIds.push(created.id);
      }
      counts.services = SERVICES.length;

      const planIds: string[] = [];
      for (const row of PLAN_ROWS) {
        const created = await tx.subscriptionPlan.create({
          data: {
            companyId,
            name: row.name,
            nameKey: key(row.name),
            description: row.description,
            price: row.price,
            durationDays: row.durationDays,
            createdByUserId: admin.id,
          },
        });
        planIds.push(created.id);
      }
      counts.subscriptionPlans = PLAN_ROWS.length;

      const memberPassword = await bcrypt.hash(MEMBER_PASSWORD, BCRYPT_ROUNDS);
      const member = await tx.user.create({
        data: {
          companyId,
          name: "Ana Atendente",
          email: DATA.memberEmail,
          passwordHash: memberPassword,
          role: "MEMBER",
        },
      });
      counts.users = 1;

      let openSession = await tx.cashSession.findFirst({
        where: { companyId, status: "OPEN" },
      });
      if (!openSession) {
        openSession = await tx.cashSession.create({
          data: {
            companyId,
            status: "OPEN",
            initialAmount: 100,
            openedByUserId: admin.id,
            openedAt: at(0, "13:26"),
          },
        });
      }

      const sessionByDay = new Map<number, string>();
      for (const plan of SESSION_PLANS) {
        const session = await tx.cashSession.create({
          data: {
            companyId,
            status: "OPEN",
            initialAmount: plan.initial,
            openingNotes: "Abertura do caixa (demonstração)",
            openedByUserId: admin.id,
            openedAt: at(plan.day, "09:00"),
          },
        });
        sessionByDay.set(plan.day, session.id);
      }

      const netCentsBySession = new Map<string, { inCents: number; outCents: number }>();
      const bump = (sessionId: string, type: "IN" | "OUT", cents: number) => {
        const current = netCentsBySession.get(sessionId) ?? { inCents: 0, outCents: 0 };
        if (type === "IN") current.inCents += cents;
        else current.outCents += cents;
        netCentsBySession.set(sessionId, current);
      };

      for (const plan of SESSION_PLANS) {
        const sessionId = sessionByDay.get(plan.day)!;
        await tx.cashMovement.create({
          data: {
            companyId,
            cashSessionId: sessionId,
            type: "IN",
            origin: "MANUAL",
            inCash: true,
            amount: 50,
            description: "Aporte de troco",
            createdByUserId: admin.id,
            createdAt: at(plan.day, "09:10"),
          },
        });
        bump(sessionId, "IN", 5000);

        await tx.cashMovement.create({
          data: {
            companyId,
            cashSessionId: sessionId,
            type: "OUT",
            origin: "MANUAL",
            inCash: true,
            amount: 90,
            description: "Saque para pagamento de fornecedor",
            justification: "Pagamento à vista com desconto",
            createdByUserId: admin.id,
            createdAt: at(plan.day, "11:30"),
          },
        });
        bump(sessionId, "OUT", 9000);
      }

      let saleCount = 0;
      for (const plan of salePlans) {
        const sessionId = plan.day === 0 ? openSession.id : sessionByDay.get(plan.day)!;
        if (!sessionId) continue;

        const subtotalCents = plan.items.reduce((sum, item) => {
          return sum + Math.round(PRODUCTS[item.productIndex].price * 100) * item.qty;
        }, 0);
        const discountCents = Math.round(plan.discount * 100);
        const totalCents = subtotalCents - discountCents;
        const saleAt = at(plan.day, plan.time);

        const sale = await tx.sale.create({
          data: {
            companyId,
            receiptCode: receiptCode(usedReceipts),
            clientId: plan.clientIndex === null ? null : clientIds[plan.clientIndex],
            subtotal: money(subtotalCents),
            discount: money(discountCents),
            total: money(totalCents),
            paymentMethod: plan.method,
            createdByUserId: rnd() < 0.3 ? member.id : admin.id,
            cashSessionId: sessionId,
            createdAt: saleAt,
            ...(plan.cancelled
              ? {
                  status: "CANCELLED" as const,
                  cancelledAt: at(plan.day, plan.cancelled.time),
                  cancelledByUserId: admin.id,
                  cancelReason: plan.cancelled.reason,
                }
              : {}),
            items: {
              create: plan.items.map((item) => ({
                productId: productIds[item.productIndex],
                productName: PRODUCTS[item.productIndex].name,
                productSku: `SKU-${String(item.productIndex + 1).padStart(3, "0")}`,
                unit: PRODUCTS[item.productIndex].unit,
                unitPrice: PRODUCTS[item.productIndex].price,
                quantity: item.qty,
                subtotal: money(Math.round(PRODUCTS[item.productIndex].price * 100) * item.qty),
              })),
            },
          },
        });
        saleCount += 1;

        for (const item of plan.items) {
          await tx.product.update({
            where: { id: productIds[item.productIndex] },
            data: { stockQuantity: { decrement: item.qty } },
          });
          await tx.stockMovement.create({
            data: {
              companyId,
              productId: productIds[item.productIndex],
              type: "OUT",
              quantity: item.qty,
              notes: `Venda ${sale.receiptCode}`,
              reference: sale.receiptCode,
              createdByUserId: admin.id,
              createdAt: saleAt,
            },
          });
        }

        await tx.cashMovement.create({
          data: {
            companyId,
            cashSessionId: sessionId,
            type: "IN",
            origin: "SALE",
            inCash: plan.method === "CASH",
            amount: money(totalCents),
            description: `Venda ${sale.receiptCode}`,
            saleId: sale.id,
            createdByUserId: admin.id,
            createdAt: saleAt,
          },
        });
        if (plan.method === "CASH") bump(sessionId, "IN", totalCents);

        if (plan.cancelled) {
          for (const item of plan.items) {
            await tx.product.update({
              where: { id: productIds[item.productIndex] },
              data: { stockQuantity: { increment: item.qty } },
            });
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: productIds[item.productIndex],
                type: "IN",
                quantity: item.qty,
                notes: `Cancelamento da venda ${sale.receiptCode}: ${plan.cancelled.reason}`,
                reference: sale.receiptCode,
                createdByUserId: admin.id,
                createdAt: at(plan.day, plan.cancelled.time),
              },
            });
          }
          await tx.cashMovement.create({
            data: {
              companyId,
              cashSessionId: sessionId,
              type: "OUT",
              origin: "SALE_CANCELMENT",
              inCash: plan.method === "CASH",
              amount: money(totalCents),
              description: `Cancelamento da venda ${sale.receiptCode}`,
              saleId: sale.id,
              createdByUserId: admin.id,
              createdAt: at(plan.day, plan.cancelled.time),
            },
          });
          if (plan.method === "CASH") bump(sessionId, "OUT", totalCents);
        }
      }
      counts.sales = saleCount;

      const appointmentSpecs: Array<{
        day: number;
        time: string;
        clientIndex: number;
        serviceIndex: number;
        status: "COMPLETED" | "SCHEDULED" | "CONFIRMED" | "CANCELLED" | "NO_SHOW";
        notes?: string;
        cancelReason?: string;
      }> = [
        { day: -14, time: "09:00", clientIndex: 0, serviceIndex: 1, status: "COMPLETED" },
        { day: -13, time: "10:30", clientIndex: 4, serviceIndex: 0, status: "COMPLETED", notes: "Cliente pediu atenção especial" },
        { day: -12, time: "14:00", clientIndex: 7, serviceIndex: 4, status: "COMPLETED" },
        { day: -10, time: "11:00", clientIndex: 11, serviceIndex: 3, status: "COMPLETED" },
        { day: -8, time: "09:30", clientIndex: 14, serviceIndex: 0, status: "NO_SHOW" },
        { day: -7, time: "15:00", clientIndex: 9, serviceIndex: 5, status: "CANCELLED", cancelReason: "Cliente adiou por viagem" },
        { day: -5, time: "10:00", clientIndex: 19, serviceIndex: 6, status: "COMPLETED" },
        { day: -4, time: "13:30", clientIndex: 2, serviceIndex: 1, status: "COMPLETED" },
        { day: -2, time: "09:00", clientIndex: 5, serviceIndex: 2, status: "COMPLETED" },
        { day: -1, time: "16:00", clientIndex: 8, serviceIndex: 0, status: "COMPLETED" },
        { day: 0, time: "17:00", clientIndex: 12, serviceIndex: 1, status: "CONFIRMED", notes: "Chegar 10 min antes" },
        { day: 1, time: "09:00", clientIndex: 1, serviceIndex: 0, status: "SCHEDULED" },
        { day: 1, time: "11:00", clientIndex: 16, serviceIndex: 3, status: "SCHEDULED" },
        { day: 2, time: "10:00", clientIndex: 20, serviceIndex: 7, status: "CONFIRMED", notes: "Combinado por telefone" },
        { day: 3, time: "14:30", clientIndex: 3, serviceIndex: 1, status: "SCHEDULED" },
        { day: 4, time: "09:30", clientIndex: 6, serviceIndex: 0, status: "SCHEDULED" },
        { day: 5, time: "15:30", clientIndex: 23, serviceIndex: 4, status: "SCHEDULED" },
        { day: 7, time: "10:30", clientIndex: 10, serviceIndex: 0, status: "SCHEDULED" },
        { day: 9, time: "11:30", clientIndex: 22, serviceIndex: 5, status: "SCHEDULED" },
        { day: 11, time: "09:00", clientIndex: 17, serviceIndex: 6, status: "SCHEDULED" },
      ];

      for (const spec of appointmentSpecs) {
        const clientId = clientIds[spec.clientIndex];
        const service = SERVICES[spec.serviceIndex];
        const start = at(spec.day, spec.time);
        const end = new Date(start.getTime() + service.durationMinutes * 60_000);
        await tx.appointment.create({
          data: {
            companyId,
            clientId,
            serviceId: serviceIds[spec.serviceIndex],
            startAt: start,
            endAt: end,
            startLocal: wall(start),
            durationMinutes: service.durationMinutes,
            status: spec.status,
            notes: spec.notes ?? null,
            cancelReason: spec.cancelReason ?? null,
            cancelledAt: spec.cancelReason ? at(spec.day, spec.time) : null,
            cancelledByUserId: spec.cancelReason ? admin.id : null,
            createdByUserId: admin.id,
          },
        });
      }
      counts.appointments = appointmentSpecs.length;

      const subSpecs: Array<{
        clientIndex: number;
        planIndex: number;
        startDay: number;
        status: "ACTIVE" | "EXPIRED" | "CANCELLED";
        paymentDay: number;
        renewalCount: number;
        cancelDay?: number;
        cancelReason?: string;
      }> = [
        { clientIndex: 0, planIndex: 0, startDay: -21, status: "ACTIVE", paymentDay: -21, renewalCount: 0 },
        { clientIndex: 4, planIndex: 1, startDay: -17, status: "ACTIVE", paymentDay: -17, renewalCount: 0 },
        { clientIndex: 7, planIndex: 2, startDay: -13, status: "ACTIVE", paymentDay: -13, renewalCount: 0 },
        { clientIndex: 12, planIndex: 3, startDay: -9, status: "ACTIVE", paymentDay: -9, renewalCount: 0 },
        { clientIndex: 16, planIndex: 0, startDay: -6, status: "ACTIVE", paymentDay: -6, renewalCount: 0 },
        { clientIndex: 21, planIndex: 1, startDay: -3, status: "ACTIVE", paymentDay: -3, renewalCount: 0 },
        { clientIndex: 14, planIndex: 0, startDay: -45, status: "EXPIRED", paymentDay: -26, renewalCount: 1 },
        { clientIndex: 9, planIndex: 3, startDay: -24, status: "CANCELLED", paymentDay: -26, renewalCount: 0, cancelDay: -10, cancelReason: DATA.subscriptionCancelReason },
      ];

      let subscriptionCount = 0;
      for (const spec of subSpecs) {
        const plan = PLAN_ROWS[spec.planIndex];
        const startAt = dayBase(spec.startDay);
        const endAt = new Date(startAt.getTime() + plan.durationDays * 86_400_000);
        const created = await tx.subscription.create({
          data: {
            companyId,
            clientId: clientIds[spec.clientIndex],
            planId: planIds[spec.planIndex],
            startAt,
            endAt,
            status: spec.status,
            renewalCount: spec.renewalCount,
            lastPaymentAt: at(spec.paymentDay, "10:00"),
            createdByUserId: admin.id,
            cancelReason: spec.cancelReason ?? null,
            cancelledAt: spec.cancelDay ? at(spec.cancelDay, "16:00") : null,
            cancelledByUserId: spec.cancelDay ? admin.id : null,
          },
        });
        subscriptionCount += 1;

        const paymentSessionId = sessionByDay.get(spec.paymentDay) ?? openSession.id;
        await tx.cashMovement.create({
          data: {
            companyId,
            cashSessionId: paymentSessionId,
            type: "IN",
            origin: "MANUAL",
            inCash: true,
            amount: plan.price,
            description: `Pagamento de assinatura: ${CLIENTS[spec.clientIndex].name} — ${plan.name}`,
            subscriptionId: created.id,
            createdByUserId: admin.id,
            createdAt: at(spec.paymentDay, "10:00"),
          },
        });
        bump(paymentSessionId, "IN", Math.round(plan.price * 100));
      }
      counts.subscriptions = subscriptionCount;

      for (const plan of SESSION_PLANS) {
        const sessionId = sessionByDay.get(plan.day)!;
        const cardCents = salePlans
          .filter((s) => s.day === plan.day && s.method === "CARD" && !s.cancelled)
          .reduce((sum, s) => {
            const subtotalCents = s.items.reduce(
              (acc, item) => acc + Math.round(PRODUCTS[item.productIndex].price * 100) * item.qty,
              0,
            );
            return sum + subtotalCents - Math.round(s.discount * 100);
          }, 0);
        const feeCents = Math.round(cardCents * 0.03);
        if (feeCents > 0) {
          await tx.cashMovement.create({
            data: {
              companyId,
              cashSessionId: sessionId,
              type: "OUT",
              origin: "MANUAL",
              inCash: false,
              amount: money(feeCents),
              description: "Taxa de maquininha (cartões)",
              createdByUserId: admin.id,
              createdAt: at(plan.day, "18:40"),
            },
          });
        }

        const initialCents = Math.round(plan.initial * 100);
        const net = netCentsBySession.get(sessionId) ?? { inCents: 0, outCents: 0 };
        const expectedCents = initialCents + net.inCents - net.outCents;
        const deltaCents = plan.countedDelta === null ? 0 : Math.round(plan.countedDelta * 100);

        await tx.cashSession.update({
          where: { id: sessionId },
          data: {
            status: "CLOSED",
            openedAt: at(plan.day, "09:00"),
            closedAt: at(plan.day, "19:00"),
            closedByUserId: admin.id,
            closingNotes: "Fechamento de caixa (demonstração)",
            expectedAmount: money(expectedCents),
            countedAmount: money(expectedCents + deltaCents),
            difference: money(deltaCents),
          },
        });
      }
      counts.cashSessions = SESSION_PLANS.length + 1;

      const tenantPlan = await tx.tenantPlan.findUnique({ where: { nameKey: "profissional" } });
      if (tenantPlan) {
        const periodStart = dayBase(-10);
        const periodEnd = new Date(periodStart.getTime() + 30 * 86_400_000);
        await tx.tenantSubscription.create({
          data: {
            companyId,
            planId: tenantPlan.id,
            status: "ACTIVE",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            changedByUserId: admin.id,
          },
        });
        counts.tenantSubscription = 1;
      }

      const templateRows = [
        {
          name: "lembrete_de_consulta",
          category: "UTILITY" as const,
          approval: "APPROVED" as const,
          body: DATA.reminderBody,
        },
        {
          name: DATA.promo.name,
          category: "MARKETING" as const,
          approval: "APPROVED" as const,
          body: DATA.promo.body,
        },
        {
          name: "confirmacao_agendamento",
          category: "UTILITY" as const,
          approval: "PENDING_APPROVAL" as const,
          body: "Olá {{1}}! Seu agendamento de {{2}} está confirmado. Responda SIM para confirmar presença.",
        },
      ];
      const templateIds: string[] = [];
      for (const row of templateRows) {
        const created = await tx.whatsAppTemplate.create({
          data: {
            companyId,
            name: row.name,
            nameKey: key(row.name),
            category: row.category,
            approval: row.approval,
            body: row.body,
            createdByUserId: admin.id,
          },
        });
        templateIds.push(created.id);
      }
      counts.whatsAppTemplates = templateRows.length;

      const consentClientIndexes = [0, 1, 2, 4, 5, 6, 7, 9, 12, 14, 16, 19, 21, 23];
      const optedOut = new Set([9, 23]);
      const consentIds = new Map<number, string>();
      for (const clientIndex of consentClientIndexes) {
        const created = await tx.whatsAppConsent.create({
          data: {
            companyId,
            clientId: clientIds[clientIndex],
            status: optedOut.has(clientIndex) ? "OPTED_OUT" : "OPTED_IN",
            source: clientIndex % 3 === 0 ? "REPLY" : "MANUAL",
            phone: CLIENTS[clientIndex].mobile,
            notes: optedOut.has(clientIndex) ? "Saiu da lista pelo reply SAIR" : null,
            updatedByUserId: admin.id,
            changedAt: at(-20 + (clientIndex % 10), "10:00"),
          },
        });
        consentIds.set(clientIndex, created.id);
      }
      counts.whatsAppConsents = consentClientIndexes.length;

      type MessageSpec = {
        clientIndex: number;
        templateIndex: number;
        day: number;
        time: string;
        status: "SENT" | "DELIVERED" | "READ" | "FAILED" | "CANCELLED" | "PENDING";
        origin: "MANUAL" | "SERVICE_REMINDER";
        failureReason?: string;
        failureDetail?: string;
      };
      const messageSpecs: MessageSpec[] = [
        { clientIndex: 0, templateIndex: 0, day: -2, time: "18:00", status: "READ", origin: "SERVICE_REMINDER" },
        { clientIndex: 1, templateIndex: 0, day: -2, time: "18:00", status: "DELIVERED", origin: "SERVICE_REMINDER" },
        { clientIndex: 4, templateIndex: 1, day: -5, time: "10:15", status: "READ", origin: "MANUAL" },
        { clientIndex: 5, templateIndex: 1, day: -5, time: "10:15", status: "SENT", origin: "MANUAL" },
        { clientIndex: 6, templateIndex: 1, day: -5, time: "10:15", status: "DELIVERED", origin: "MANUAL" },
        { clientIndex: 2, templateIndex: 0, day: -1, time: "19:30", status: "FAILED", origin: "SERVICE_REMINDER", failureReason: "Número inválido", failureDetail: "WhatsApp retornou erro 410 (gone)" },
        { clientIndex: 12, templateIndex: 0, day: -1, time: "19:30", status: "FAILED", origin: "SERVICE_REMINDER", failureReason: "Conta não está no WhatsApp", failureDetail: "WhatsApp retornou erro 404" },
        { clientIndex: 16, templateIndex: 0, day: -3, time: "18:30", status: "CANCELLED", origin: "SERVICE_REMINDER" },
        { clientIndex: 7, templateIndex: 1, day: -4, time: "11:00", status: "READ", origin: "MANUAL" },
        { clientIndex: 19, templateIndex: 1, day: -4, time: "11:00", status: "DELIVERED", origin: "MANUAL" },
        { clientIndex: 14, templateIndex: 0, day: -1, time: "19:30", status: "SENT", origin: "SERVICE_REMINDER" },
        { clientIndex: 21, templateIndex: 0, day: 0, time: "18:00", status: "PENDING", origin: "SERVICE_REMINDER" },
      ];

      let messageCount = 0;
      for (const spec of messageSpecs) {
        const client = CLIENTS[spec.clientIndex];
        const template = templateRows[spec.templateIndex];
        const createdAt = at(spec.day, spec.time);
        const attempts = spec.status === "FAILED" ? 2 : spec.status === "PENDING" ? 0 : 1;
        const created = await tx.whatsAppMessage.create({
          data: {
            companyId,
            clientId: clientIds[spec.clientIndex],
            templateId: templateIds[spec.templateIndex],
            consentId: consentIds.get(spec.clientIndex) ?? null,
            toPhone: `+55${phoneDigits(client.mobile)}`,
            templateNameSnapshot: template.name,
            templateLanguageSnapshot: "pt_BR",
            templateBodySnapshot: template.body,
            status: spec.status,
            origin: spec.origin,
            attempts,
            nextAttemptAt: spec.status === "PENDING" ? at(1, "18:00") : null,
            lastAttemptAt: attempts > 0 ? createdAt : null,
            failureReason: spec.failureReason ?? null,
            failureDetail: spec.failureDetail ?? null,
            cancelReason: spec.status === "CANCELLED" ? "Agendamento remarcado" : null,
            cancelledByUserId: spec.status === "CANCELLED" ? admin.id : null,
            createdByUserId: spec.origin === "SERVICE_REMINDER" ? null : admin.id,
            createdAt,
          },
        });
        messageCount += 1;

        if (spec.status === "FAILED") {
          await tx.whatsAppMessageAttempt.create({
            data: {
              messageId: created.id,
              attemptNumber: 1,
              outcome: "TRANSIENT_ERROR",
              errorCode: "500",
              errorMessage: "Erro temporário do provedor",
              httpStatus: 500,
              startedAt: createdAt,
              finishedAt: new Date(createdAt.getTime() + 2_000),
            },
          });
          await tx.whatsAppMessageAttempt.create({
            data: {
              messageId: created.id,
              attemptNumber: 2,
              outcome: "PERMANENT_ERROR",
              errorCode: spec.failureReason === "Número inválido" ? "410" : "404",
              errorMessage: spec.failureDetail ?? null,
              httpStatus: 404,
              startedAt: new Date(createdAt.getTime() + 60_000),
              finishedAt: new Date(createdAt.getTime() + 62_000),
            },
          });
        }
      }
      counts.whatsAppMessages = messageCount;

      await tx.whatsAppConfig.upsert({
        where: { companyId },
        update: { reminderTemplateId: templateIds[0], reminderLeadMinutes: 1440 },
        create: {
          companyId,
          status: "ACTIVE",
          phoneNumberId: "102938475610293",
          wabaId: "998877665544332211",
          displayName: DATA.brand,
          reminderTemplateId: templateIds[0],
          reminderLeadMinutes: 1440,
          lastHealthAt: new Date(),
        },
      });
      counts.whatsAppConfig = 1;

      return counts;
    },
    { timeout: 180_000, maxWait: 10_000 },
  );

  console.log("Concluído. Registros criados:");
  for (const [name, count] of Object.entries(result)) {
    console.log(`  - ${name}: ${count}`);
  }
  console.log("");
  console.log("Contas de demonstração:");
  console.log(`  Admin:   ${admin.email} (senha: a já usada)`);
  console.log(`  Membro:  ${DATA.memberEmail} / ${MEMBER_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Falha no seed de demonstração:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
