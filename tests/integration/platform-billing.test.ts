import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { computeAccess } from "../../apps/api/src/billing/access";

/**
 * Fase 8 — cobrança do SaaS: teste grátis, tolerância, somente leitura,
 * isenção, suspensão e painel do dono da plataforma.
 */

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;
const OWNER_EMAIL = "dono@akylla.test"; // PLATFORM_ADMIN_EMAILS nos testes

let app: INestApplication;
let prisma: PrismaService;
const http = () => request(app.getHttpServer());

async function company(slug: string, data: { trialEndsAt?: Date | null; billingExempt?: boolean } = {}) {
  const created = await prisma.company.create({ data: { name: `Empresa ${slug}`, slug, ...data } });
  for (const role of ["ADMIN", "MEMBER"] as const) {
    await prisma.user.create({
      data: {
        companyId: created.id,
        name: `${role} ${slug}`,
        email: `${role.toLowerCase()}@${slug}.test`,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role,
      },
    });
  }
  return created.id;
}

async function login(email: string) {
  const res = await http().post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return sessionCookieFrom(res);
}

const createClient = (cookie: string, name: string) =>
  http().post("/api/clients").set("Cookie", cookie).send({ name, mobile: "11987654321" });

let ownerCookie: string;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  await resetDatabase(prisma);
  const ownerCompany = await prisma.company.create({ data: { name: "Akylla", slug: "akylla" } });
  await prisma.user.create({
    data: {
      companyId: ownerCompany.id,
      name: "Dono",
      email: OWNER_EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: "ADMIN",
    },
  });
  ownerCookie = await login(OWNER_EMAIL);
});

afterAll(async () => {
  await resetDatabase(prisma);
  await app.close();
});

describe("regra de acesso (pura)", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  const days = (n: number) => new Date(now.getTime() + n * DAY_MS);
  const sub = (end: Date, status: "ACTIVE" | "EXPIRED" | "CANCELLED" = "ACTIVE") => ({
    status,
    currentPeriodEnd: end,
    billingCycle: "MONTHLY" as const,
    planName: "Essencial",
  });

  it("isenta, teste, ativa, tolerância, somente leitura e suspensa", () => {
    const base = { companyStatus: "ACTIVE", billingExempt: false };
    expect(computeAccess({ ...base, trialEndsAt: null, subscription: null }, now).status).toBe("EXEMPT");
    expect(computeAccess({ ...base, billingExempt: true, trialEndsAt: days(-30), subscription: null }, now).status).toBe("EXEMPT");
    const trial = computeAccess({ ...base, trialEndsAt: days(3), subscription: null }, now);
    expect(trial).toMatchObject({ status: "TRIAL", daysLeft: 3, readOnly: false });
    expect(computeAccess({ ...base, trialEndsAt: null, subscription: sub(days(20)) }, now).status).toBe("ACTIVE");
    const grace = computeAccess({ ...base, trialEndsAt: days(-2), subscription: null }, now);
    expect(grace).toMatchObject({ status: "GRACE", daysLeft: 3, readOnly: false });
    expect(computeAccess({ ...base, trialEndsAt: days(-6), subscription: null }, now)).toMatchObject({
      status: "READ_ONLY",
      readOnly: true,
    });
    expect(computeAccess({ ...base, trialEndsAt: null, subscription: sub(days(-10), "EXPIRED") }, now).status).toBe("READ_ONLY");
    // Cancelada continua valendo até o fim do período pago
    expect(computeAccess({ ...base, trialEndsAt: null, subscription: sub(days(10), "CANCELLED") }, now).status).toBe("ACTIVE");
    expect(computeAccess({ companyStatus: "INACTIVE", billingExempt: false, trialEndsAt: null, subscription: null }, now).status).toBe(
      "SUSPENDED",
    );
  });
});

describe("teste grátis e somente leitura", () => {
  it("cadastro novo ganha 14 dias de teste", async () => {
    const res = await http()
      .post("/api/auth/register")
      .send({
        companyName: "Loja Nova Fase 8",
        name: "Nova",
        email: "nova@fase8.test",
        password: PASSWORD,
        acceptTerms: true,
        acceptPrivacy: true,
      });
    expect(res.status).toBe(201);
    const created = await prisma.company.findFirstOrThrow({ where: { name: "Loja Nova Fase 8" } });
    const diffDays = (created.trialEndsAt!.getTime() - Date.now()) / DAY_MS;
    expect(diffDays).toBeGreaterThan(13.9);
    expect(diffDays).toBeLessThanOrEqual(14);
  });

  it("em teste: tudo liberado e /api/billing/access informa os dias", async () => {
    await company("teste", { trialEndsAt: new Date(Date.now() + 5 * DAY_MS) });
    const cookie = await login("admin@teste.test");
    const access = await http().get("/api/billing/access").set("Cookie", cookie);
    expect(access.body).toMatchObject({ status: "TRIAL", daysLeft: 5, readOnly: false });
    expect((await createClient(cookie, "Cliente em teste")).status).toBe(201);
  });

  it("na tolerância (vencido há 2 dias) continua liberado, com aviso", async () => {
    await company("tolerancia", { trialEndsAt: new Date(Date.now() - 2 * DAY_MS) });
    const cookie = await login("member@tolerancia.test");
    const access = await http().get("/api/billing/access").set("Cookie", cookie);
    expect(access.body).toMatchObject({ status: "GRACE", readOnly: false });
    expect((await createClient(cookie, "Cliente na tolerância")).status).toBe(201);
  });

  it("somente leitura: consulta liberada, alteração 402, saída e faturamento liberados", async () => {
    await company("vencida", { trialEndsAt: new Date(Date.now() - 10 * DAY_MS) });
    const cookie = await login("admin@vencida.test");
    const blocked = await createClient(cookie, "Não pode");
    expect(blocked.status).toBe(402);
    expect(blocked.body.code).toBe("SUBSCRIPTION_READ_ONLY");
    expect((await http().get("/api/clients").set("Cookie", cookie)).status).toBe(200);
    expect((await http().get("/api/billing/access").set("Cookie", cookie)).body.status).toBe("READ_ONLY");
    expect((await http().get("/api/company/export").set("Cookie", cookie)).status).toBe(200);
    expect((await http().post("/api/auth/logout").set("Cookie", cookie)).status).toBeLessThan(300);
  });

  it("isenta nunca bloqueia, mesmo com teste vencido", async () => {
    await company("isenta", { trialEndsAt: new Date(Date.now() - 30 * DAY_MS), billingExempt: true });
    const cookie = await login("admin@isenta.test");
    expect((await createClient(cookie, "Cliente isento")).status).toBe(201);
  });
});

describe("painel do dono da plataforma", () => {
  it("só o dono entra (403 para outros admins, 401 sem sessão) e a sessão o identifica", async () => {
    await company("comum");
    const admin = await login("admin@comum.test");
    expect((await http().get("/api/platform/companies").set("Cookie", admin)).status).toBe(403);
    expect((await http().get("/api/platform/companies")).status).toBe(401);
    const me = await http().get("/api/auth/me").set("Cookie", ownerCookie);
    expect(me.body.user.isPlatformAdmin).toBe(true);
    const meAdmin = await http().get("/api/auth/me").set("Cookie", admin);
    expect(meAdmin.body.user.isPlatformAdmin).toBe(false);
  });

  it("lista todas as empresas (atravessa a RLS) com situação e uso", async () => {
    const res = await http().get("/api/platform/companies").set("Cookie", ownerCookie);
    expect(res.status).toBe(200);
    const slugs = res.body.items.map((c: { slug: string }) => c.slug);
    expect(slugs).toEqual(expect.arrayContaining(["vencida", "teste", "isenta", "comum"]));
    const vencida = res.body.items.find((c: { slug: string }) => c.slug === "vencida");
    expect(vencida).toMatchObject({ adminEmail: "admin@vencida.test", access: { status: "READ_ONLY" } });
    const filtered = await http().get("/api/platform/companies?status=READ_ONLY").set("Cookie", ownerCookie);
    expect(filtered.body.items.every((c: { access: { status: string } }) => c.access.status === "READ_ONLY")).toBe(true);
  });

  it("registrar pagamento ativa o plano, libera na hora e fica no histórico", async () => {
    const id = (await prisma.company.findFirstOrThrow({ where: { slug: "vencida" } })).id;
    const res = await http()
      .post(`/api/platform/companies/${id}/activate`)
      .set("Cookie", ownerCookie)
      .send({ planId: "tenantplan_essencial", cycle: "MONTHLY", method: "PIX", note: "Pix 18/10" });
    expect(res.status).toBe(200);
    expect(res.body.access).toMatchObject({ status: "ACTIVE", planName: "Essencial", cycle: "MONTHLY" });

    const cookie = await login("admin@vencida.test");
    expect((await createClient(cookie, "Agora pode")).status).toBe(201);

    const payments = await http().get(`/api/platform/companies/${id}/payments`).set("Cookie", ownerCookie);
    expect(payments.body.items).toHaveLength(1);
    expect(payments.body.items[0]).toMatchObject({ amount: "79.90", method: "PIX", recordedBy: OWNER_EMAIL, note: "Pix 18/10" });
  });

  it("renovação antecipada soma ao fim do período; anual vale 365 dias pelo preço anual", async () => {
    const id = (await prisma.company.findFirstOrThrow({ where: { slug: "vencida" } })).id;
    const before = await prisma.tenantSubscription.findUniqueOrThrow({ where: { companyId: id } });
    await http()
      .post(`/api/platform/companies/${id}/activate`)
      .set("Cookie", ownerCookie)
      .send({ planId: "tenantplan_essencial", cycle: "YEARLY", method: "BOLETO" })
      .expect(200);
    const after = await prisma.tenantSubscription.findUniqueOrThrow({ where: { companyId: id } });
    expect(after.currentPeriodStart.getTime()).toBe(before.currentPeriodEnd.getTime());
    expect(after.currentPeriodEnd.getTime() - after.currentPeriodStart.getTime()).toBe(365 * DAY_MS);
    expect(after.billingCycle).toBe("YEARLY");
    const payments = await http().get(`/api/platform/companies/${id}/payments`).set("Cookie", ownerCookie);
    expect(payments.body.items[0]).toMatchObject({ amount: "799.00", cycle: "YEARLY" });
    expect(
      (await http().post(`/api/platform/companies/${id}/activate`).set("Cookie", ownerCookie).send({ planId: "x", method: "PIX" })).status,
    ).toBe(404);
  });

  it("estende o teste e concede/remove isenção", async () => {
    const id = (await prisma.company.findFirstOrThrow({ where: { slug: "teste" } })).id;
    const extended = await http().post(`/api/platform/companies/${id}/trial`).set("Cookie", ownerCookie).send({ days: 7 });
    expect(extended.body.access.daysLeft).toBe(12);
    const exempt = await http().post(`/api/platform/companies/${id}/exempt`).set("Cookie", ownerCookie).send({ exempt: true });
    expect(exempt.body).toMatchObject({ billingExempt: true, access: { status: "EXEMPT" } });
    expect((await http().post(`/api/platform/companies/${id}/trial`).set("Cookie", ownerCookie).send({ days: 120 })).status).toBe(400);
  });

  it("suspender bloqueia login e derruba sessões; reativar libera", async () => {
    const id = (await prisma.company.findFirstOrThrow({ where: { slug: "comum" } })).id;
    const cookie = await login("admin@comum.test");
    const res = await http()
      .post(`/api/platform/companies/${id}/suspend`)
      .set("Cookie", ownerCookie)
      .send({ reason: "Inadimplência de 60 dias" });
    expect(res.body).toMatchObject({ suspendedReason: "Inadimplência de 60 dias", access: { status: "SUSPENDED" } });
    expect((await http().get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    expect((await http().post("/api/auth/login").send({ email: "admin@comum.test", password: PASSWORD })).status).not.toBe(200);

    const back = await http().post(`/api/platform/companies/${id}/reactivate`).set("Cookie", ownerCookie);
    expect(back.body.access.status).toBe("EXEMPT");
    expect((await http().post("/api/auth/login").send({ email: "admin@comum.test", password: PASSWORD })).status).toBe(200);
    expect((await http().post(`/api/platform/companies/${id}/reactivate`).set("Cookie", ownerCookie)).status).toBe(400);
  });
});
