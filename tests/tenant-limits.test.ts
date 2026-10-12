import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "./helpers/app";
import type { PrismaService } from "../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;

let app: INestApplication;
let prisma: PrismaService;

let adminCookie: string;
let companyId: string;

async function createUser(companyId: string, email: string, role: "ADMIN" | "MEMBER" = "MEMBER") {
  return prisma.user.create({
    data: {
      companyId,
      name: `User ${email}`,
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role,
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

  const company = await prisma.company.create({
    data: { name: "Empresa Limits", slug: "limits-co" },
  });
  companyId = company.id;

  await createUser(companyId, "admin@limits.test", "ADMIN");
  adminCookie = await login("admin@limits.test");
});

afterAll(async () => {
  await app.close();
});

describe("TenantLimits — regra D3: enforcement só com assinatura ACTIVE", () => {
  it("sem assinatura: cria usuários, clientes e produtos sem limite", async () => {
    const users = await request(app.getHttpServer())
      .get("/api/users")
      .set("Cookie", adminCookie);
    expect(users.status).toBe(200);

    const userRes = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "Novo User", email: "novo@limits.test", password: PASSWORD, role: "MEMBER" });
    expect(userRes.status).toBe(201);

    const clientRes = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminCookie)
      .send({ name: "Cliente Sem Limite" });
    expect(clientRes.status).toBe(201);

    const productRes = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminCookie)
      .send({
        name: "Produto Sem Limite",
        unit: "UNIDADE",
        costPrice: "10.00",
        salePrice: "20.00",
        minimumStock: "0",
      });
    expect(productRes.status).toBe(201);
  });

  it("assinatura ACTIVE no Essencial (limites 3/200/100) bloqueia 4º usuário", async () => {
    // Sobe a assinatura para ACTIVE com plano Essencial
    await prisma.tenantSubscription.upsert({
      where: { companyId },
      create: {
        companyId,
        planId: "tenantplan_essencial",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
      },
      update: {
        planId: "tenantplan_essencial",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
      },
    });

    // Já temos 2 usuários (admin + novo). Essencial permite 3.
    const third = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "Terceiro", email: "terceiro@limits.test", password: PASSWORD, role: "MEMBER" });
    expect(third.status).toBe(201);

    // 4º deve falhar com 403
    const fourth = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "Quarto", email: "quarto@limits.test", password: PASSWORD, role: "MEMBER" });
    expect(fourth.status).toBe(403);
    expect(fourth.body.message).toContain("Limite do plano Essencial");
  });

  it("assinatura ACTIVE no Essencial: cliente limite 200 — não testa 200, mas valida presença do limite", async () => {
    // O limite de clientes do Essencial é 200; para validar a trava sem criar
    // 200 registros, ajustamos o plano para um limite baixo no teste.
    await prisma.tenantPlan.update({
      where: { id: "tenantplan_essencial" },
      data: { clientLimit: 1 },
    });

    // Já existe 1 cliente. O próximo deve falhar.
    const client = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminCookie)
      .send({ name: "Cliente Bloqueado" });
    expect(client.status).toBe(403);
    expect(client.body.message).toContain("Limite do plano Essencial");

    // Restaura o limite para não afetar outros testes no mesmo arquivo
    await prisma.tenantPlan.update({
      where: { id: "tenantplan_essencial" },
      data: { clientLimit: 200 },
    });
  });

  it("assinatura ACTIVE no Completo (limites null): não aplica trava", async () => {
    await prisma.tenantSubscription.update({
      where: { companyId },
      data: { planId: "tenantplan_completo" },
    });

    const product = await request(app.getHttpServer())
      .post("/api/products")
      .set("Cookie", adminCookie)
      .send({
        name: "Produto Completo",
        unit: "UNIDADE",
        costPrice: "5.00",
        salePrice: "15.00",
        minimumStock: "0",
      });
    expect(product.status).toBe(201);
  });

  it("assinatura EXPIRED: não aplica trava (status quo)", async () => {
    await prisma.tenantSubscription.update({
      where: { companyId },
      data: { planId: "tenantplan_essencial", status: "EXPIRED" },
    });

    const user = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "User Expired", email: "expired@limits.test", password: PASSWORD, role: "MEMBER" });
    expect(user.status).toBe(201);
  });

  it("assinatura CANCELLED: não aplica trava (status quo)", async () => {
    await prisma.tenantSubscription.update({
      where: { companyId },
      data: { status: "CANCELLED" },
    });

    const user = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "User Cancelled", email: "cancelled@limits.test", password: PASSWORD, role: "MEMBER" });
    expect(user.status).toBe(201);
  });

  it("isola limites por empresa: assinatura de uma não afeta outra", async () => {
    const companyB = await prisma.company.create({
      data: { name: "Empresa Limits B", slug: "limits-co-b" },
    });
    await createUser(companyB.id, "admin@limits-b.test", "ADMIN");
    const cookieB = await login("admin@limits-b.test");

    // Empresa B com plano Essencial ACTIVE (limite 3 usuários)
    await prisma.tenantSubscription.create({
      data: {
        companyId: companyB.id,
        planId: "tenantplan_essencial",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
      },
    });

    // Empresa B já tem 1 usuário (admin). Pode criar mais 2, mas não mais.
    const ok = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", cookieB)
      .send({ name: "B User 2", email: "b2@limits-b.test", password: PASSWORD, role: "MEMBER" });
    expect(ok.status).toBe(201);

    await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", cookieB)
      .send({ name: "B User 3", email: "b3@limits-b.test", password: PASSWORD, role: "MEMBER" });

    const blocked = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", cookieB)
      .send({ name: "B User 4", email: "b4@limits-b.test", password: PASSWORD, role: "MEMBER" });
    expect(blocked.status).toBe(403);
  });
});
