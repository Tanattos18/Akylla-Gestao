import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { contractBillingMessage, contractReceivableOriginId, parseContractReceivableOriginId } from "@petflow/shared";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { systemDatabaseUrl } from "../../apps/api/src/common/tenant/rls.extension";
import {
  generateContractReceivables,
  originIdFor,
  queueContractReminders,
} from "../../apps/worker/src/billing/contract-billing";

/** 2026-10-24: cobrança automática dos contratos, lembretes e relatórios. */

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;

let app: INestApplication;
let prisma: PrismaService;
let system: PrismaClient;

let companyId: string;
let adminId: string;
let admin: string;
let planId: string;
let anaId: string;

function http() {
  return request(app.getHttpServer());
}

async function client(name: string, extra: Record<string, unknown> = {}) {
  return prisma.client.create({ data: { companyId, name, nameKey: name.toLowerCase(), mobile: "11987654321", ...extra } });
}

async function contract(clientId: string, endInDays: number, extra: Record<string, unknown> = {}) {
  return prisma.subscription.create({
    data: {
      companyId,
      clientId,
      planId,
      startAt: new Date(Date.now() - (30 - endInDays) * DAY_MS),
      endAt: new Date(Date.now() + endInDays * DAY_MS),
      lastPaymentAt: new Date(),
      createdByUserId: adminId,
      ...extra,
    },
  });
}

async function receivablesOf(subscriptionId: string) {
  return system.financialEntry.findMany({
    where: { origin: "SUBSCRIPTION", originId: { startsWith: `${subscriptionId}:` } },
    orderBy: { dueDate: "asc" },
  });
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  system = new PrismaClient({ datasources: { db: { url: systemDatabaseUrl(process.env.DATABASE_URL as string) } } });
  await resetDatabase(prisma);

  const company = await prisma.company.create({ data: { name: "Agência Cobrança", slug: "cobranca-a", pixKey: "pix@agencia.test" } });
  companyId = company.id;
  adminId = (
    await prisma.user.create({
      data: { companyId, name: "Admin", email: "admin@cobranca.test", role: "ADMIN", passwordHash: await bcrypt.hash(PASSWORD, 4) },
    })
  ).id;
  const login = await http().post("/api/auth/login").send({ email: "admin@cobranca.test", password: PASSWORD });
  admin = sessionCookieFrom(login);
  planId = (
    await prisma.subscriptionPlan.create({
      data: { companyId, name: "Site mensal", nameKey: "site mensal", price: "150.00", durationDays: 30, createdByUserId: adminId },
    })
  ).id;
  anaId = (await client("Ana Cobrança")).id;
});

afterAll(async () => {
  await system.$disconnect();
  await app.close();
});

describe("formato do título do contrato", () => {
  it("originId vai e volta igual na API e no worker", () => {
    const due = new Date("2026-11-05T15:00:00Z");
    expect(originIdFor("sub1", "renovacao", due)).toBe(contractReceivableOriginId("sub1", "renovacao", due));
    expect(parseContractReceivableOriginId("sub1:renovacao:2026-11-05")).toEqual({ subscriptionId: "sub1", kind: "renovacao", day: "2026-11-05" });
    expect(parseContractReceivableOriginId("venda:123")).toBeNull();
  });

  it("mensagem para copiar traz valor, vencimento e Pix", () => {
    const text = contractBillingMessage({ clientName: "Ana Souza", contract: "Site mensal", amount: "R$ 150,00", dueDate: "05/11/2026", pixKey: "pix@x", overdue: false });
    expect(text).toContain("Olá, Ana!");
    expect(text).toContain("R$ 150,00");
    expect(text).toContain("Pix: pix@x");
  });
});

describe("geração automática dos títulos (worker)", () => {
  it("contrato vencendo em até 30 dias ganha o título de renovação, sem duplicar", async () => {
    const sub = await contract(anaId, 10);
    const first = await generateContractReceivables({ prisma: system });
    expect(first.created).toBeGreaterThanOrEqual(1);
    await generateContractReceivables({ prisma: system });
    const entries = await receivablesOf(sub.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ direction: "RECEIVABLE", status: "OPEN", clientId: anaId });
    expect(entries[0]!.amount.toFixed(2)).toBe("150.00");
    expect(entries[0]!.originId).toBe(originIdFor(sub.id, "renovacao", sub.endAt));
  });

  it("contrato novo sem pagamento ganha o título do primeiro período; longe do fim, só ele", async () => {
    const beto = await client("Beto Novo");
    const sub = await contract(beto.id, 60, { lastPaymentAt: null, startAt: new Date() });
    await generateContractReceivables({ prisma: system });
    const entries = await receivablesOf(sub.id);
    expect(entries.map((e) => parseContractReceivableOriginId(e.originId!)?.kind)).toEqual(["inicio"]);
  });

  it("cancelado e empresa inativa não geram nada", async () => {
    const cris = await client("Cris Cancelada");
    const cancelled = await contract(cris.id, 5, { status: "CANCELLED", cancelledAt: new Date() });
    const other = await prisma.company.create({ data: { name: "Demo parada", slug: "demo-parada", status: "INACTIVE" } });
    const otherClient = await prisma.client.create({ data: { companyId: other.id, name: "X", nameKey: "x" } });
    const otherPlan = await prisma.subscriptionPlan.create({
      data: { companyId: other.id, name: "P", nameKey: "p", price: "10", durationDays: 30, createdByUserId: adminId },
    });
    const otherSub = await prisma.subscription.create({
      data: { companyId: other.id, clientId: otherClient.id, planId: otherPlan.id, startAt: new Date(), endAt: new Date(Date.now() + 5 * DAY_MS), createdByUserId: adminId },
    });
    await generateContractReceivables({ prisma: system });
    expect(await receivablesOf(cancelled.id)).toHaveLength(0);
    expect(await receivablesOf(otherSub.id)).toHaveLength(0);
  });
});

describe("pagar o título renova o contrato", () => {
  it("liquidar no Financeiro renova; o próximo ciclo gera o título do novo fim", async () => {
    const dani = await client("Dani Paga");
    const sub = await contract(dani.id, 3);
    await generateContractReceivables({ prisma: system });
    const [entry] = await receivablesOf(sub.id);

    await http().post("/api/cash/sessions").set("Cookie", admin).send({ initialAmount: "0" }).expect(201);
    await http().post(`/api/financial/${entry!.id}/pay`).set("Cookie", admin).send({ paymentMethod: "PIX" }).expect(201);

    const renewed = await system.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(renewed.renewalCount).toBe(1);
    expect(renewed.status).toBe("ACTIVE");
    expect(renewed.endAt.getTime()).toBe(sub.endAt.getTime() + 30 * DAY_MS);

    // Novo fim está a 33 dias: fora da janela de 30 — nada novo ainda
    await generateContractReceivables({ prisma: system });
    expect(await receivablesOf(sub.id)).toHaveLength(1);
    await generateContractReceivables({ prisma: system, now: new Date(Date.now() + 5 * DAY_MS) });
    const entries = await receivablesOf(sub.id);
    expect(entries).toHaveLength(2);
    expect(entries[1]!.originId).toBe(originIdFor(sub.id, "renovacao", renewed.endAt));
  });

  it("renovar pelo caixa quita o título já gerado (sem cobrar duas vezes)", async () => {
    const eva = await client("Eva Caixa");
    const sub = await contract(eva.id, 4);
    await generateContractReceivables({ prisma: system });
    await http().post(`/api/subscriptions/${sub.id}/renew`).set("Cookie", admin).expect(201);
    const [entry] = await receivablesOf(sub.id);
    expect(entry!.status).toBe("PAID");
    expect(entry!.cashMovementId).not.toBeNull();

    const detail = await http().get(`/api/subscriptions/${sub.id}`).set("Cookie", admin);
    expect(detail.body.receivables).toEqual([expect.objectContaining({ kind: "renovacao", status: "PAID", amount: "150.00" })]);
  });
});

describe("lembretes de cobrança pelo WhatsApp (sem pausar nada)", () => {
  const body = "Olá, {{1}}! {{2}} no valor de {{3}} vence em {{4}}. Pix: {{5}}.";

  beforeAll(async () => {
    await prisma.whatsAppConfig.create({ data: { companyId, phoneNumberId: "123", status: "ACTIVE" } });
    for (const name of ["cobranca_lembrete", "cobranca_vencimento", "cobranca_atraso"]) {
      await prisma.whatsAppTemplate.create({ data: { companyId, name, nameKey: name, body, approval: "APPROVED" } });
    }
  });

  async function receivable(clientId: string, dueInDays: number) {
    return prisma.financialEntry.create({
      data: {
        companyId,
        clientId,
        direction: "RECEIVABLE",
        description: "Contrato teste",
        amount: "150.00",
        dueDate: new Date(Date.now() + dueInDays * DAY_MS),
        origin: "SUBSCRIPTION",
        originId: `sub-${clientId}:renovacao:2099-01-0${Math.abs(dueInDays) % 9}`,
        createdByUserId: adminId,
      },
    });
  }

  async function messagesFor(clientId: string) {
    return system.whatsAppMessage.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });
  }

  async function optedIn(name: string, extra: Record<string, unknown> = {}) {
    const c = await client(name, extra);
    await prisma.whatsAppConsent.create({ data: { companyId, clientId: c.id, status: "OPTED_IN", source: "MANUAL" } });
    return c;
  }

  it("3 dias antes: enfileira uma vez, com Pix da empresa; respeita consentimento", async () => {
    const fabi = await optedIn("Fabi Lembrete");
    const semConsentimento = await client("Gil Sem Consentimento");
    await receivable(fabi.id, 2);
    await receivable(semConsentimento.id, 2);

    await queueContractReminders({ prisma: system, countryCode: "55" });
    await queueContractReminders({ prisma: system, countryCode: "55" });

    const msgs = await messagesFor(fabi.id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ origin: "CONTRACT_BILLING", status: "PENDING", templateNameSnapshot: "cobranca_lembrete", toPhone: "5511987654321" });
    expect(msgs[0]!.variables).toEqual(expect.arrayContaining(["Fabi Lembrete", "R$ 150,00", "pix@agencia.test"]));
    expect(await messagesFor(semConsentimento.id)).toHaveLength(0);
  });

  it("nunca cobra cliente com entrega 'nunca pausar'", async () => {
    const proprio = await optedIn("Akylla Próprio");
    await prisma.clientDelivery.create({ data: { companyId, clientId: proprio.id, name: "App", type: "SYSTEM", neverPause: true } });
    await receivable(proprio.id, 0);
    await queueContractReminders({ prisma: system, countryCode: "55" });
    expect(await messagesFor(proprio.id)).toHaveLength(0);
  });

  it("no dia e no atraso (dia 1); depois do dia da pausa não insiste e não pausa nada", async () => {
    const hoje = await optedIn("Hugo Hoje");
    const atrasado = await optedIn("Iris Atrasada");
    const muitoAtrasado = await optedIn("Jair Muito Atrasado");
    await receivable(hoje.id, 0);
    await receivable(atrasado.id, -2);
    await receivable(muitoAtrasado.id, -12);
    await queueContractReminders({ prisma: system, countryCode: "55" });
    expect((await messagesFor(hoje.id)).map((m) => m.templateNameSnapshot)).toEqual(["cobranca_vencimento"]);
    expect((await messagesFor(atrasado.id)).map((m) => m.templateNameSnapshot)).toEqual(["cobranca_atraso"]);
    expect(await messagesFor(muitoAtrasado.id)).toHaveLength(0);
    // Nenhuma entrega foi pausada
    expect(await system.clientDelivery.count({ where: { status: "PAUSED" } })).toBe(0);
  });
});

describe("relatórios, avisos de renovação e chave Pix", () => {
  it("relatórios: receita recorrente, por produto, inadimplência e clientes por status", async () => {
    const res = await http().get("/api/digital/reports?months=3").set("Cookie", admin);
    expect(res.status).toBe(200);
    expect(res.body.months).toHaveLength(3);
    const current = res.body.months[2];
    expect(Number(current.monthlyRecurringRevenue)).toBeGreaterThan(0);
    expect(Number(current.received)).toBeGreaterThanOrEqual(300);
    expect(res.body.revenueByProduct[0]).toMatchObject({ product: "Sem entrega vinculada" });
    expect(res.body.delinquency.overdueCount).toBeGreaterThanOrEqual(2);
    expect(res.body.delinquency.rate).toBeGreaterThan(0);
    expect(res.body.clientsByStatus.active).toBeGreaterThan(0);
    expect((await http().get("/api/digital/reports?months=99").set("Cookie", admin)).status).toBe(400);
  });

  it("vencimentos trazem os dias restantes (avisos de 30, 7 e 1 dia)", async () => {
    const kira = await client("Kira Domínio");
    const in7 = new Date(Date.now() + 7 * DAY_MS);
    await prisma.clientDelivery.create({
      data: {
        companyId,
        clientId: kira.id,
        name: "Site da Kira",
        type: "SITE",
        domain: "kira.test",
        domainRenewalAt: new Date(Date.UTC(in7.getUTCFullYear(), in7.getUTCMonth(), in7.getUTCDate())),
      },
    });
    const res = await http().get("/api/digital/overview").set("Cookie", admin);
    const domain = res.body.upcoming.find((u: { kind: string }) => u.kind === "DOMAIN");
    expect(domain).toMatchObject({ daysLeft: 7, clientName: "Kira Domínio" });
  });

  it("chave Pix configurável (vazio apaga)", async () => {
    const set = await http().put("/api/overdue-policy").set("Cookie", admin).send({ warnDays: 1, pauseDays: 10, pixKey: "nova@pix" });
    expect(set.body.pixKey).toBe("nova@pix");
    const keep = await http().put("/api/overdue-policy").set("Cookie", admin).send({ warnDays: 1, pauseDays: 10 });
    expect(keep.body.pixKey).toBe("nova@pix");
    const clear = await http().put("/api/overdue-policy").set("Cookie", admin).send({ warnDays: 1, pauseDays: 10, pixKey: "" });
    expect(clear.body.pixKey).toBeNull();
  });
});
