import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_BILLING_TEXTS, renderBillingText } from "@petflow/shared";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { systemDatabaseUrl } from "../../apps/api/src/common/tenant/rls.extension";
import { computeBillingStatus } from "../../apps/api/src/digital/billing-state";
import { autoPauseOverdue, queueContractReminders } from "../../apps/worker/src/billing/contract-billing";

/** 2026-10-27: pausa dos sites vendidos, prazo combinado, estados e script público. */

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;

let app: INestApplication;
let prisma: PrismaService;
let system: PrismaClient;

let companyId: string;
let adminId: string;
let admin: string;
let member: string;
let otherAdmin: string;
let planId: string;

function http() {
  return request(app.getHttpServer());
}

function day(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * DAY_MS - 3 * 3600_000);
  return d.toISOString().slice(0, 10);
}

async function user(company: string, email: string, role: "ADMIN" | "MEMBER") {
  const u = await prisma.user.create({
    data: { companyId: company, name: email.split("@")[0]!, email, role, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
  const res = await http().post("/api/auth/login").send({ email, password: PASSWORD });
  return { id: u.id, cookie: sessionCookieFrom(res) };
}

/** Cliente + entrega + contrato com título vencido há `overdueDays` dias. */
async function scenario(name: string, opts: { overdueDays?: number; neverPause?: boolean; banner?: boolean; consent?: boolean } = {}) {
  const client = await prisma.client.create({ data: { companyId, name, nameKey: name.toLowerCase(), mobile: "11912345678" } });
  if (opts.consent) {
    await prisma.whatsAppConsent.create({ data: { companyId, clientId: client.id, status: "OPTED_IN", source: "MANUAL" } });
  }
  const delivery = await prisma.clientDelivery.create({
    data: {
      companyId,
      clientId: client.id,
      name: `Site ${name}`,
      type: "SITE",
      siteUrl: "https://exemplo.test/",
      neverPause: opts.neverPause ?? false,
      showWarningBanner: opts.banner ?? false,
    },
  });
  const subscription = await prisma.subscription.create({
    data: {
      companyId,
      clientId: client.id,
      planId,
      deliveryId: delivery.id,
      startAt: new Date(Date.now() - 40 * DAY_MS),
      endAt: new Date(Date.now() - (opts.overdueDays ?? 0) * DAY_MS),
      lastPaymentAt: new Date(Date.now() - 40 * DAY_MS),
      createdByUserId: adminId,
    },
  });
  let entryId: string | null = null;
  if (opts.overdueDays !== undefined) {
    const due = new Date(Date.now() - opts.overdueDays * DAY_MS);
    entryId = (
      await prisma.financialEntry.create({
        data: {
          companyId,
          clientId: client.id,
          direction: "RECEIVABLE",
          description: `Contrato ${name}`,
          amount: "200.00",
          dueDate: due,
          origin: "SUBSCRIPTION",
          originId: `${subscription.id}:renovacao:${due.toISOString().slice(0, 10)}`,
          createdByUserId: adminId,
        },
      })
    ).id;
  }
  return { client, delivery, subscription, entryId };
}

async function publicKeyOf(deliveryId: string) {
  const res = await http().get(`/api/deliveries/${deliveryId}/install-code`).set("Cookie", admin);
  expect(res.status).toBe(200);
  return res.body.publicKey as string;
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  system = new PrismaClient({ datasources: { db: { url: systemDatabaseUrl(process.env.DATABASE_URL as string) } } });
  await resetDatabase(prisma);
  companyId = (await prisma.company.create({ data: { name: "Agência Pausa", slug: "pausa-a", pixKey: "pix@pausa" } })).id;
  const other = await prisma.company.create({ data: { name: "Outra", slug: "pausa-b" } });
  const a = await user(companyId, "admin@pausa.test", "ADMIN");
  adminId = a.id;
  admin = a.cookie;
  member = (await user(companyId, "membro@pausa.test", "MEMBER")).cookie;
  otherAdmin = (await user(other.id, "admin@outra.test", "ADMIN")).cookie;
  planId = (
    await prisma.subscriptionPlan.create({
      data: { companyId, name: "Site mensal", nameKey: "site mensal", price: "200.00", durationDays: 30, createdByUserId: adminId },
    })
  ).id;
});

afterAll(async () => {
  await system.$disconnect();
  await app.close();
});

describe("situação de cobrança (cálculo no servidor)", () => {
  const now = new Date("2026-10-27T15:00:00Z");
  const due = (days: number) => [{ dueDate: new Date(now.getTime() + days * DAY_MS), amount: new Prisma.Decimal("100") }];
  const base = { contractStatus: "ACTIVE" as const, deliveryStatus: "ACTIVE" as const, endAt: new Date(now.getTime() + 20 * DAY_MS), graceUntil: null };

  it("em dia, vence em breve, vencido, em débito (dia 10), pausado, inativo", () => {
    expect(computeBillingStatus({ ...base, openDues: [] }, 10, now).state).toBe("EM_DIA");
    expect(computeBillingStatus({ ...base, openDues: due(5) }, 10, now)).toMatchObject({ state: "VENCE_EM", daysToDue: 5 });
    expect(computeBillingStatus({ ...base, openDues: due(-1) }, 10, now)).toMatchObject({ state: "VENCIDO", daysToDue: -1 });
    expect(computeBillingStatus({ ...base, openDues: due(-9) }, 10, now).state).toBe("VENCIDO");
    expect(computeBillingStatus({ ...base, openDues: due(-10) }, 10, now).state).toBe("EM_DEBITO");
    expect(computeBillingStatus({ ...base, deliveryStatus: "PAUSED", openDues: due(-30) }, 10, now).state).toBe("PAUSADO");
    expect(computeBillingStatus({ ...base, deliveryStatus: "CANCELLED", openDues: [] }, 10, now).state).toBe("INATIVO");
  });

  it("prazo combinado: em acordo até a data; depois, em débito com acordo descumprido", () => {
    const inGrace = computeBillingStatus({ ...base, openDues: due(-20), graceUntil: new Date(now.getTime() + 3 * DAY_MS) }, 10, now);
    expect(inGrace.state).toBe("EM_ACORDO");
    const broken = computeBillingStatus({ ...base, openDues: due(-3), graceUntil: new Date(now.getTime() - 1 * DAY_MS) }, 10, now);
    expect(broken).toMatchObject({ state: "EM_DEBITO", agreementBroken: true });
  });
});

describe("nunca pausar é bloqueado no servidor", () => {
  it("pausar, inativar e editar status → 409; endpoint público sempre ativo", async () => {
    const { delivery } = await scenario("Akylla Próprio", { neverPause: true, overdueDays: 30, banner: true });
    expect((await http().post(`/api/deliveries/${delivery.id}/pause`).set("Cookie", admin).send({ reason: "teste de bloqueio" })).status).toBe(409);
    expect((await http().post(`/api/deliveries/${delivery.id}/deactivate`).set("Cookie", admin).send({ reason: "teste de bloqueio" })).status).toBe(409);
    expect((await http().patch(`/api/deliveries/${delivery.id}`).set("Cookie", admin).send({ status: "PAUSED" })).status).toBe(409);
    expect((await http().patch(`/api/deliveries/${delivery.id}`).set("Cookie", admin).send({ status: "CANCELLED" })).status).toBe(409);
    expect((await http().get(`/api/deliveries/${delivery.id}/install-code`).set("Cookie", admin)).status).toBe(409);

    // Mesmo que o banco fosse alterado à mão, o endpoint responde ativo
    await system.clientDelivery.update({ where: { id: delivery.id }, data: { publicKey: "chave-nunca-pausar-0001", status: "PAUSED" } });
    const res = await http().get("/api/public/site-status/chave-nunca-pausar-0001");
    expect(res.body).toEqual({ status: "ativo", message: null });

    // Pausa automática ligada também não toca
    await system.clientDelivery.update({ where: { id: delivery.id }, data: { status: "ACTIVE" } });
    await system.company.update({ where: { id: companyId }, data: { autoPauseEnabled: true, autoPauseDays: 5 } });
    await autoPauseOverdue({ prisma: system });
    expect((await system.clientDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe("ACTIVE");
    await system.company.update({ where: { id: companyId }, data: { autoPauseEnabled: false } });
  });
});

describe("controle manual: pausar, ativar, inativar, reativar (só ADMIN, com histórico)", () => {
  it("transições refletem no endpoint público e ficam no histórico", async () => {
    const { delivery, client } = await scenario("Cliente Manual", { overdueDays: 12 });
    const key = await publicKeyOf(delivery.id);
    expect(await publicKeyOf(delivery.id)).toBe(key); // mesma chave na 2ª vez

    expect((await http().post(`/api/deliveries/${delivery.id}/pause`).set("Cookie", member).send({ reason: "membro tentando" })).status).toBe(403);
    expect((await http().post(`/api/deliveries/${delivery.id}/pause`).set("Cookie", otherAdmin).send({ reason: "outra empresa" })).status).toBe(404);
    expect((await http().post(`/api/deliveries/${delivery.id}/pause`).set("Cookie", admin).send({ reason: "" })).status).toBe(400);

    const pause = await http().post(`/api/deliveries/${delivery.id}/pause`).set("Cookie", admin).send({ reason: "Mensalidade de outubro em aberto" });
    expect(pause.status).toBe(201);
    let pub = await http().get(`/api/public/site-status/${key}`);
    expect(pub.status).toBe(200);
    expect(pub.headers["access-control-allow-origin"]).toBe("*");
    expect(pub.body).toEqual({ status: "pausado", message: DEFAULT_BILLING_TEXTS.siteSuspendedText });

    expect((await http().post(`/api/deliveries/${delivery.id}/pause`).set("Cookie", admin).send({ reason: "de novo" })).status).toBe(409);
    await http().post(`/api/deliveries/${delivery.id}/activate`).set("Cookie", admin).send({}).expect(201);
    pub = await http().get(`/api/public/site-status/${key}`);
    expect(pub.body.status).toBe("ativo");

    await http().post(`/api/deliveries/${delivery.id}/deactivate`).set("Cookie", admin).send({ reason: "Cliente desistiu" }).expect(201);
    expect((await http().get(`/api/public/site-status/${key}`)).body.status).toBe("inativo");
    await http().post(`/api/deliveries/${delivery.id}/activate`).set("Cookie", admin).send({ reason: "Voltou a contratar" }).expect(201);

    const history = await http().get(`/api/deliveries/${delivery.id}/billing-actions`).set("Cookie", admin);
    expect(history.body.map((h: { action: string }) => h.action)).toEqual(["REACTIVATE", "DEACTIVATE", "ACTIVATE", "PAUSE"]);
    expect(history.body[3]).toMatchObject({ reason: "Mensalidade de outubro em aberto", userName: "admin" });

    const clientHistory = await http().get(`/api/clients/${client.id}/history`).set("Cookie", member);
    expect(clientHistory.body.filter((i: { kind: string }) => i.kind === "BILLING_ACTION")).toHaveLength(4);
  });

  it("endpoint público: chave inválida/desconhecida → 404; sem dados pessoais", async () => {
    expect((await http().get("/api/public/site-status/x")).status).toBe(404);
    expect((await http().get("/api/public/site-status/chave-que-nao-existe-123")).status).toBe(404);
    const { delivery } = await scenario("Cliente Privado", { overdueDays: 2 });
    const res = await http().get(`/api/public/site-status/${await publicKeyOf(delivery.id)}`);
    expect(Object.keys(res.body).sort()).toEqual(["message", "status"]);
    expect(JSON.stringify(res.body)).not.toContain("Cliente Privado");
  });
});

describe("faixa de pendência, prazo combinado e volta ao ar com o pagamento", () => {
  it("vencido com faixa ligada → aviso; com prazo → ativo; prazo no passado → 400", async () => {
    const { delivery, subscription } = await scenario("Cliente Faixa", { overdueDays: 3, banner: true });
    const key = await publicKeyOf(delivery.id);
    expect((await http().get(`/api/public/site-status/${key}`)).body).toEqual({ status: "aviso", message: DEFAULT_BILLING_TEXTS.siteWarningText });

    expect((await http().post(`/api/subscriptions/${subscription.id}/grace`).set("Cookie", admin).send({ until: day(-2), note: "prazo velho" })).status).toBe(400);
    const grace = await http().post(`/api/subscriptions/${subscription.id}/grace`).set("Cookie", admin).send({ until: day(5), note: "Pediu até sexta" });
    expect(grace.status).toBe(201);
    expect((await http().get(`/api/public/site-status/${key}`)).body.status).toBe("ativo");

    const detail = await http().get(`/api/subscriptions/${subscription.id}`).set("Cookie", admin);
    expect(detail.body).toMatchObject({ graceNote: "Pediu até sexta", billing: { state: "EM_ACORDO" } });
  });

  it("pagar o título reativa o site pausado por débito e encerra o prazo; inativado não volta", async () => {
    const paused = await scenario("Cliente Paga", { overdueDays: 15 });
    const quit = await scenario("Cliente Desistiu", { overdueDays: 15 });
    await http().post(`/api/deliveries/${paused.delivery.id}/pause`).set("Cookie", admin).send({ reason: "15 dias em atraso" }).expect(201);
    await http().post(`/api/deliveries/${quit.delivery.id}/deactivate`).set("Cookie", admin).send({ reason: "Desistiu" }).expect(201);
    await http().post(`/api/subscriptions/${paused.subscription.id}/grace`).set("Cookie", admin).send({ until: day(3), note: "acordo" }).expect(201);

    await http().post("/api/cash/sessions").set("Cookie", admin).send({ initialAmount: "0" }).expect(201);
    await http().post(`/api/financial/${paused.entryId}/pay`).set("Cookie", admin).send({ paymentMethod: "PIX" }).expect(201);
    await http().post(`/api/financial/${quit.entryId}/pay`).set("Cookie", admin).send({ paymentMethod: "PIX" }).expect(201);

    const resumed = await system.clientDelivery.findUniqueOrThrow({ where: { id: paused.delivery.id } });
    expect(resumed).toMatchObject({ status: "ACTIVE", pausedForDebt: false });
    expect((await system.subscription.findUniqueOrThrow({ where: { id: paused.subscription.id } })).graceUntil).toBeNull();
    const log = await system.billingActionLog.findFirst({ where: { deliveryId: paused.delivery.id, action: "AUTO_RESUME" } });
    expect(log).not.toBeNull();
    expect((await system.clientDelivery.findUniqueOrThrow({ where: { id: quit.delivery.id } })).status).toBe("CANCELLED");
  });
});

describe("pausa automática (desligada por padrão) e alertas", () => {
  it("desligada não pausa; ligada pausa só quem passou do limite e está fora de prazo", async () => {
    const late = await scenario("Cliente Atrasado Auto", { overdueDays: 20 });
    const withGrace = await scenario("Cliente Com Prazo Auto", { overdueDays: 20 });
    const recent = await scenario("Cliente Recente Auto", { overdueDays: 2 });
    await system.subscription.update({ where: { id: withGrace.subscription.id }, data: { graceUntil: new Date(Date.now() + 3 * DAY_MS) } });

    expect((await autoPauseOverdue({ prisma: system })).paused).toBe(0);

    await http().put("/api/billing-settings").set("Cookie", admin).send({ autoPauseEnabled: true, autoPauseDays: 15 }).expect(200);
    await autoPauseOverdue({ prisma: system });
    const statusOf = async (id: string) => (await system.clientDelivery.findUniqueOrThrow({ where: { id } })).status;
    expect(await statusOf(late.delivery.id)).toBe("PAUSED");
    expect(await statusOf(withGrace.delivery.id)).toBe("ACTIVE");
    expect(await statusOf(recent.delivery.id)).toBe("ACTIVE");
    expect(await system.billingActionLog.count({ where: { deliveryId: late.delivery.id, action: "AUTO_PAUSE", userId: null } })).toBe(1);
    await autoPauseOverdue({ prisma: system });
    expect(await system.billingActionLog.count({ where: { deliveryId: late.delivery.id, action: "AUTO_PAUSE" } })).toBe(1);
    await http().put("/api/billing-settings").set("Cookie", admin).send({ autoPauseEnabled: false }).expect(200);
  });

  it("aviso de atraso espera o prazo; acordo descumprido avisa de novo uma vez", async () => {
    await prisma.whatsAppConfig.create({ data: { companyId, phoneNumberId: "999", status: "ACTIVE" } });
    await prisma.whatsAppTemplate.create({
      data: { companyId, name: "cobranca_atraso", nameKey: "cobranca_atraso", body: "{{1}} {{2}} {{3}} {{4}} {{5}}", approval: "APPROVED" },
    });
    const { client, subscription } = await scenario("Cliente Alerta", { overdueDays: 2, consent: true });
    await system.subscription.update({ where: { id: subscription.id }, data: { graceUntil: new Date(Date.now() + 2 * DAY_MS) } });
    await queueContractReminders({ prisma: system, countryCode: "55" });
    expect(await system.whatsAppMessage.count({ where: { clientId: client.id } })).toBe(0);

    await system.subscription.update({ where: { id: subscription.id }, data: { graceUntil: new Date(Date.now() - 1 * DAY_MS) } });
    await queueContractReminders({ prisma: system, countryCode: "55" });
    await queueContractReminders({ prisma: system, countryCode: "55" });
    const msgs = await system.whatsAppMessage.findMany({ where: { clientId: client.id } });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.templateNameSnapshot).toBe("cobranca_atraso");
  });
});

describe("Início, filtros e configurações", () => {
  it("clientes em débito no Início e filtros por situação", async () => {
    const overview = await http().get("/api/digital/overview").set("Cookie", member);
    const states = overview.body.debtors.map((d: { state: string }) => d.state);
    expect(states).toContain("EM_DEBITO");
    expect(overview.body.debtors[0].state).toBe("EM_DEBITO");

    const clients = await http().get("/api/clients?billingState=EM_DEBITO").set("Cookie", member);
    expect(clients.body.total).toBeGreaterThan(0);
    expect(clients.body.items.every((c: { billing: { state: string } }) => c.billing.state === "EM_DEBITO")).toBe(true);
    const deliveries = await http().get("/api/deliveries?billingState=PAUSADO").set("Cookie", member);
    expect(deliveries.body.items.every((d: { status: string }) => d.status === "PAUSED")).toBe(true);
  });

  it("textos editáveis: padrão, personalizado e volta ao padrão com vazio", async () => {
    const initial = await http().get("/api/billing-settings").set("Cookie", member);
    expect(initial.body).toMatchObject({ autoPauseEnabled: false, texts: DEFAULT_BILLING_TEXTS });
    expect((await http().put("/api/billing-settings").set("Cookie", member).send({ billingTextBefore: "x" })).status).toBe(403);
    const custom = await http().put("/api/billing-settings").set("Cookie", admin).send({ billingTextBefore: "Oi {cliente}, vence em {dias} dias." });
    expect(custom.body).toMatchObject({ texts: { billingTextBefore: "Oi {cliente}, vence em {dias} dias." }, customized: { billingTextBefore: true } });
    expect(renderBillingText(custom.body.texts.billingTextBefore, { cliente: "Ana", dias: 3 })).toBe("Oi Ana, vence em 3 dias.");
    const reset = await http().put("/api/billing-settings").set("Cookie", admin).send({ billingTextBefore: "" });
    expect(reset.body.texts.billingTextBefore).toBe(DEFAULT_BILLING_TEXTS.billingTextBefore);
  });
});
