import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;

let app: INestApplication;
let prisma: PrismaService;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;

async function createUser(params: {
  companyId: string;
  name: string;
  email: string;
  role?: "ADMIN" | "MEMBER";
}) {
  return prisma.user.create({
    data: {
      companyId: params.companyId,
      name: params.name,
      email: params.email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: params.role ?? "MEMBER",
    },
  });
}

async function login(email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  if (response.status !== 200) {
    throw new Error(`Login falhou para ${email}: ${response.status}`);
  }
  return sessionCookieFrom(response);
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await prisma.company.create({
    data: { name: "Empresa Billing A", slug: "billing-a" },
  });
  const companyB = await prisma.company.create({
    data: { name: "Empresa Billing B", slug: "billing-b" },
  });

  await createUser({
    companyId: companyA.id,
    name: "Admin Billing",
    email: "admin@billing-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro Billing",
    email: "membro@billing-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@billing-b.test",
    role: "ADMIN",
  });

  adminACookie = await login("admin@billing-a.test");
  memberACookie = await login("membro@billing-a.test");
  adminBCookie = await login("admin@billing-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Billing — catálogo de planos do SaaS", () => {
  it("lista planos globais ativos ordenados por preço", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/billing/plans")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThanOrEqual(3);
    expect(response.body.items[0].name).toBe("Básico");
    expect(response.body.items[0].priceMonthly).toBe("79.90");
    expect(
      response.body.items[response.body.items.length - 1].name,
    ).toBe("Avançado");
    expect(
      response.body.items.every((p: { active: boolean }) => p.active),
    ).toBe(true);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/billing/plans");
    expect(response.status).toBe(401);
  });
});

/** Fase 8: a assinatura só nasce pelo dono da plataforma ou pelo gateway. */
async function activate(slug: string, planId: string, days = 30) {
  const company = await prisma.company.findFirstOrThrow({ where: { slug } });
  const now = Date.now();
  return prisma.tenantSubscription.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      planId,
      status: "ACTIVE",
      currentPeriodStart: new Date(now),
      currentPeriodEnd: new Date(now + days * DAY_MS),
    },
    update: {
      planId,
      status: "ACTIVE",
      currentPeriodStart: new Date(now),
      currentPeriodEnd: new Date(now + days * DAY_MS),
      cancelReason: null,
      cancelledAt: null,
    },
  });
}

describe("Billing — assinatura da empresa", () => {
  it("404 antes de existir assinatura", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/billing/subscription")
      .set("Cookie", adminACookie);
    expect(response.status).toBe(404);
  });

  it("Fase 8: a empresa NÃO ativa nem renova o próprio plano (rotas removidas)", async () => {
    const put = await request(app.getHttpServer())
      .put("/api/billing/subscription")
      .set("Cookie", adminACookie)
      .send({ planId: "tenantplan_completo" });
    expect(put.status).toBe(404);
    const renew = await request(app.getHttpServer())
      .post("/api/billing/subscription/renew")
      .set("Cookie", adminACookie);
    expect(renew.status).toBe(404);
    expect(await prisma.tenantSubscription.count()).toBe(0);
  });

  it("mostra a assinatura ativada pelo dono, com ciclo e preços", async () => {
    await activate("billing-a", "tenantplan_profissional");
    const response = await request(app.getHttpServer())
      .get("/api/billing/subscription")
      .set("Cookie", memberACookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ACTIVE", billingCycle: "MONTHLY" });
    expect(response.body.plan).toMatchObject({ name: "Intermediário", priceMonthly: "149.90", priceYearly: "1499.00" });
  });

  it("isola a assinatura por empresa (404 para outra empresa)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/billing/subscription")
      .set("Cookie", adminBCookie);
    expect(response.status).toBe(404);
  });
});

describe("Billing — expiração e cancelamento", () => {
  it("expiração lazy marca período vencido", async () => {
    const company = await prisma.company.findFirstOrThrow({ where: { slug: "billing-a" } });
    await prisma.tenantSubscription.update({
      where: { companyId: company.id },
      data: {
        currentPeriodStart: new Date(Date.now() - 60 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() - DAY_MS),
      },
    });

    const expired = await request(app.getHttpServer())
      .get("/api/billing/subscription")
      .set("Cookie", adminACookie);
    expect(expired.status).toBe(200);
    expect(expired.body.status).toBe("EXPIRED");
  });

  it("admin cancela (201) e cancelar de novo dá 409; membro não cancela (403)", async () => {
    await activate("billing-a", "tenantplan_essencial");
    const member = await request(app.getHttpServer())
      .post("/api/billing/subscription/cancel")
      .set("Cookie", memberACookie)
      .send({});
    expect(member.status).toBe(403);

    const cancel = await request(app.getHttpServer())
      .post("/api/billing/subscription/cancel")
      .set("Cookie", adminACookie)
      .send({ reason: "Avaliar outro plano" });
    expect(cancel.status).toBe(201);
    expect(cancel.body).toMatchObject({ status: "CANCELLED", cancelReason: "Avaliar outro plano" });

    const again = await request(app.getHttpServer())
      .post("/api/billing/subscription/cancel")
      .set("Cookie", adminACookie)
      .send({ reason: "De novo" });
    expect(again.status).toBe(409);

    const anon = await request(app.getHttpServer()).get("/api/billing/subscription");
    expect(anon.status).toBe(401);
  });
});

describe("Billing — uso do plano (N3)", () => {
  it("expõe limites do plano e consumo atual da própria empresa", async () => {
    const company = await prisma.company.create({
      data: { name: "Empresa Uso", slug: "billing-uso" },
    });
    await prisma.user.create({
      data: {
        companyId: company.id,
        name: "Admin Uso",
        email: "admin@billing-uso.test",
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role: "ADMIN",
      },
    });
    await prisma.client.create({
      data: { companyId: company.id, name: "Cliente Uso", nameKey: "cliente uso" },
    });
    await prisma.product.create({
      data: { companyId: company.id, name: "Produto Uso", sku: "USO-1" },
    });

    const cookie = await login("admin@billing-uso.test");

    await activate("billing-uso", "tenantplan_essencial");

    const response = await request(app.getHttpServer())
      .get("/api/billing/usage")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.subscription.plan.userLimit).toBe(3);
    expect(response.body.subscription.plan.clientLimit).toBe(200);
    expect(response.body.subscription.plan.productLimit).toBe(100);
    expect(response.body.usage).toMatchObject({ users: 1, clients: 1, products: 1 });
  });

  it("sem assinatura retorna consumo com subscription null", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/billing/usage")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.subscription).toBeNull();
    expect(response.body.usage.users).toBe(1);
  });

  it("exige sessão (401)", async () => {
    const response = await request(app.getHttpServer()).get("/api/billing/usage");
    expect(response.status).toBe(401);
  });
});
