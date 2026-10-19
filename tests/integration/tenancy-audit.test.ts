import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

/**
 * Etapa 3 — Auditoria multiempresa e permissões (Akylla Gestão).
 *
 * Cenários nomeados Empresa Alfa (A) × Empresa Bravo (B): identificação do
 * tenant, injeção de companyId (corpo/query/cabeçalho), leitura e escrita
 * cruzada por ID, referências cruzadas, relatórios/CSV e perfis ADMIN×MEMBER.
 * Apenas ambiente de testes (petflow_test) e dados sintéticos.
 */

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;

let companyAId: string;
let companyBId: string;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;

// registros da empresa B (alvos de tentativas cruzadas)
let bCategoryId: string;
let bSupplierId: string;
let bProductId: string;
let bClientId: string;
let bServiceId: string;
let bAppointmentId: string;
let bSaleReceipt: string;
let bPlanId: string;
let bSubscriptionId: string;
let bCashSessionId: string;
let bTemplateId: string;

// registros da empresa A
let aCategoryId: string;
let aProductId: string;
let aClientId: string;
let aServiceId: string;
let aSaleReceipt: string;

const today = new Date().toISOString().slice(0, 10);

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

function get(url: string, cookie: string) {
  return request(app.getHttpServer()).get(url).set("Cookie", cookie);
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await prisma.company.create({
    data: { name: "Empresa Alfa", slug: "auditoria-a" },
  });
  const companyB = await prisma.company.create({
    data: { name: "Empresa Bravo", slug: "auditoria-b" },
  });
  companyAId = companyA.id;
  companyBId = companyB.id;

  const adminA = await createUser({
    companyId: companyA.id,
    name: "Admin Alfa",
    email: "admin@auditoria-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro Alfa",
    email: "membro@auditoria-a.test",
  });
  const adminB = await createUser({
    companyId: companyB.id,
    name: "Admin Bravo",
    email: "admin@auditoria-b.test",
    role: "ADMIN",
  });

  // --- registros da empresa B (dados sintéticos) ---
  const bCategory = await prisma.category.create({
    data: { companyId: companyB.id, name: "Categoria Sigilosa B", nameKey: "categoria sigilosa b" },
  });
  bCategoryId = bCategory.id;

  const bSupplier = await prisma.supplier.create({
    data: { companyId: companyB.id, name: "Fornecedor Sigiloso B" },
  });
  bSupplierId = bSupplier.id;

  const bProduct = await prisma.product.create({
    data: {
      companyId: companyB.id,
      name: "Produto Sigiloso B",
      sku: "AUD-B-1",
      salePrice: "50.00",
      stockQuantity: "5.000",
    },
  });
  bProductId = bProduct.id;

  const bClient = await prisma.client.create({
    data: {
      companyId: companyB.id,
      name: "Cliente Sigiloso B",
      nameKey: "cliente sigiloso b",
      phone: "11911112222",
    },
  });
  bClientId = bClient.id;

  const bService = await prisma.service.create({
    data: {
      companyId: companyB.id,
      name: "Serviço Sigiloso B",
      nameKey: "servico sigiloso b",
      price: "80.00",
    },
  });
  bServiceId = bService.id;

  const bAppointment = await prisma.appointment.create({
    data: {
      companyId: companyB.id,
      clientId: bClient.id,
      serviceId: bService.id,
      startAt: new Date("2026-11-20T13:00:00.000Z"),
      endAt: new Date("2026-11-20T14:00:00.000Z"),
      startLocal: "2026-11-20T10:00",
      durationMinutes: 60,
      createdByUserId: adminB.id,
    },
  });
  bAppointmentId = bAppointment.id;

  bSaleReceipt = "PF-AUDB01";
  await prisma.sale.create({
    data: {
      companyId: companyB.id,
      receiptCode: bSaleReceipt,
      status: "COMPLETED",
      subtotal: "100.00",
      discount: "0.00",
      total: "100.00",
      paymentMethod: "CARD",
      createdByUserId: adminB.id,
      createdAt: new Date(`${today}T15:00:00.000Z`),
    },
  });

  const bPlan = await prisma.subscriptionPlan.create({
    data: {
      companyId: companyB.id,
      name: "Plano Sigiloso B",
      nameKey: "plano sigiloso b",
      price: "199.00",
      durationDays: 30,
      createdByUserId: adminB.id,
    },
  });
  bPlanId = bPlan.id;

  const bSubscription = await prisma.subscription.create({
    data: {
      companyId: companyB.id,
      clientId: bClient.id,
      planId: bPlan.id,
      startAt: new Date(),
      endAt: new Date(Date.now() + 30 * 24 * 3600_000),
      createdByUserId: adminB.id,
    },
  });
  bSubscriptionId = bSubscription.id;

  const bCashSession = await prisma.cashSession.create({
    data: {
      companyId: companyB.id,
      status: "CLOSED",
      initialAmount: "0.00",
      openedByUserId: adminB.id,
      closedByUserId: adminB.id,
      closedAt: new Date(),
    },
  });
  bCashSessionId = bCashSession.id;

  const bTemplate = await prisma.whatsAppTemplate.create({
    data: {
      companyId: companyB.id,
      name: "Tpl Sigiloso B",
      nameKey: "tpl sigiloso b",
      body: "Olá {{1}}, agendamento {{2}} em {{3}}.",
      approval: "APPROVED",
      createdByUserId: adminB.id,
    },
  });
  bTemplateId = bTemplate.id;

  // --- registros da empresa A ---
  const aCategory = await prisma.category.create({
    data: { companyId: companyA.id, name: "Categoria Interna A", nameKey: "categoria interna a" },
  });
  aCategoryId = aCategory.id;

  const aProduct = await prisma.product.create({
    data: {
      companyId: companyA.id,
      name: "Produto Interno A",
      sku: "AUD-A-1",
      salePrice: "30.00",
      stockQuantity: "10.000",
    },
  });
  aProductId = aProduct.id;

  const aClient = await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "Cliente Interno A",
      nameKey: "cliente interno a",
      phone: "11933334444",
    },
  });
  aClientId = aClient.id;

  const aService = await prisma.service.create({
    data: {
      companyId: companyA.id,
      name: "Serviço Interno A",
      nameKey: "servico interno a",
      price: "60.00",
    },
  });
  aServiceId = aService.id;

  aSaleReceipt = "PF-AUDA01";
  await prisma.sale.create({
    data: {
      companyId: companyA.id,
      receiptCode: aSaleReceipt,
      status: "COMPLETED",
      subtotal: "50.00",
      discount: "0.00",
      total: "50.00",
      paymentMethod: "PIX",
      createdByUserId: adminA.id,
      createdAt: new Date(`${today}T10:00:00.000Z`),
    },
  });

  adminACookie = await login("admin@auditoria-a.test");
  memberACookie = await login("membro@auditoria-a.test");
  adminBCookie = await login("admin@auditoria-b.test");

  // sessão de caixa aberta para A (necessária para criação de venda)
  const cash = await request(app.getHttpServer())
    .post("/api/cash/sessions")
    .set("Cookie", adminACookie)
    .send({ initialAmount: "50" });
  if (cash.status !== 201) {
    throw new Error(`Abertura de caixa falhou: ${cash.status}`);
  }
});

afterAll(async () => {
  await app.close();
});

describe("1. Identificação do tenant a partir do contexto confiável", () => {
  it("auth/me devolve a empresa do próprio usuário mesmo com companyId na query e x-company-id no cabeçalho", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", adminACookie)
      .set("x-company-id", companyBId)
      .query({ companyId: companyBId });

    expect(response.status).toBe(200);
    expect(response.body.company.id).toBe(companyAId);
    expect(response.body.user.email).toBe("admin@auditoria-a.test");
  });

  it("leitura de recurso sem sessão é negada (401)", async () => {
    const response = await request(app.getHttpServer()).get("/api/clients");
    expect(response.status).toBe(401);
  });
});

describe("2. Injeção de companyId no corpo, na query e no cabeçalho", () => {
  it("POST /api/categories com companyId de B no corpo cria a categoria na empresa A", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminACookie)
      .send({ name: "Categoria Injetada", companyId: companyBId });

    expect(response.status).toBe(201);
    const row = await prisma.category.findUnique({ where: { id: response.body.id } });
    expect(row?.companyId).toBe(companyAId);
  });

  it("POST /api/clients com companyId de B no corpo cria o cliente na empresa A", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", adminACookie)
      .send({ name: "Cliente Injetado", phone: "11955556666", companyId: companyBId });

    expect(response.status).toBe(201);
    const row = await prisma.client.findUnique({ where: { id: response.body.id } });
    expect(row?.companyId).toBe(companyAId);
  });

  it("POST /api/users com companyId de B no corpo cria o usuário na empresa A", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/users")
      .set("Cookie", adminACookie)
      .send({
        name: "Usuário Novo",
        email: "novo.usuario@auditoria-a.test",
        password: PASSWORD,
        role: "MEMBER",
        companyId: companyBId,
      });

    expect(response.status).toBe(201);
    const row = await prisma.user.findUnique({ where: { id: response.body.id } });
    expect(row?.companyId).toBe(companyAId);
  });

  it("POST /api/sales com companyId de B no corpo cria a venda na empresa A", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", adminACookie)
      .send({
        items: [{ productId: aProductId, quantity: "1" }],
        paymentMethod: "CASH",
        companyId: companyBId,
      });

    expect(response.status).toBe(201);
    const row = await prisma.sale.findUnique({ where: { id: response.body.id } });
    expect(row?.companyId).toBe(companyAId);
  });

  it("GET /api/clients?companyId=B lista apenas clientes da empresa A", async () => {
    const response = await get(`/api/clients?companyId=${companyBId}`, adminACookie);

    expect(response.status).toBe(200);
    const ids = (response.body.items as Array<{ id: string }>).map((c) => c.id);
    expect(ids).not.toContain(bClientId);
    expect(JSON.stringify(response.body)).not.toContain("Sigiloso");
  });

  it("GET /api/categories?companyId=B lista apenas categorias da empresa A", async () => {
    const response = await get(`/api/categories?companyId=${companyBId}`, adminACookie);

    expect(response.status).toBe(200);
    const ids = (response.body.items as Array<{ id: string }>).map((c) => c.id);
    expect(ids).not.toContain(bCategoryId);
    expect(ids).toContain(aCategoryId);
  });

  it("cabeçalho x-company-id de B não altera a listagem de clientes de A", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/clients")
      .set("Cookie", adminACookie)
      .set("x-company-id", companyBId);

    expect(response.status).toBe(200);
    const ids = (response.body.items as Array<{ id: string }>).map((c) => c.id);
    expect(ids).not.toContain(bClientId);
    expect(JSON.stringify(response.body)).not.toContain("Sigiloso");
  });
});

describe("3. Leitura cruzada por ID — empresa A lê registros de B (404)", () => {
  it("categoria de B: GET /api/categories/:id → 404", async () => {
    expect((await get(`/api/categories/${bCategoryId}`, adminACookie)).status).toBe(404);
  });

  it("fornecedor de B: GET /api/suppliers/:id → 404", async () => {
    expect((await get(`/api/suppliers/${bSupplierId}`, adminACookie)).status).toBe(404);
  });

  it("produto de B: GET /api/products/:id → 404", async () => {
    expect((await get(`/api/products/${bProductId}`, adminACookie)).status).toBe(404);
  });

  it("cliente de B: GET /api/clients/:id → 404", async () => {
    expect((await get(`/api/clients/${bClientId}`, adminACookie)).status).toBe(404);
  });

  it("serviço de B: GET /api/services/:id → 404", async () => {
    expect((await get(`/api/services/${bServiceId}`, adminACookie)).status).toBe(404);
  });

  it("agendamento de B: GET /api/appointments/:id → 404", async () => {
    expect((await get(`/api/appointments/${bAppointmentId}`, adminACookie)).status).toBe(404);
  });

  it("venda de B: GET /api/sales/:id → 404", async () => {
    const list = await get("/api/sales", adminBCookie);
    expect(list.status).toBe(200);
    const bSaleId = (list.body.items as Array<{ id: string }>)[0]?.id;
    expect(bSaleId).toBeTruthy();
    expect((await get(`/api/sales/${bSaleId}`, adminACookie)).status).toBe(404);
  });

  it("plano de assinatura de B: GET /api/subscription-plans/:id → 404", async () => {
    expect((await get(`/api/subscription-plans/${bPlanId}`, adminACookie)).status).toBe(404);
  });

  it("assinatura de B: GET /api/subscriptions/:id → 404", async () => {
    expect((await get(`/api/subscriptions/${bSubscriptionId}`, adminACookie)).status).toBe(404);
  });

  it("template de WhatsApp de B: GET /api/whatsapp/templates/:id → 404", async () => {
    expect((await get(`/api/whatsapp/templates/${bTemplateId}`, adminACookie)).status).toBe(404);
  });

  it("sessão de caixa de B: GET /api/cash/sessions/:id/summary → 404", async () => {
    expect((await get(`/api/cash/sessions/${bCashSessionId}/summary`, adminACookie)).status).toBe(404);
  });

  it("saldo do produto de B: GET /api/stock/balance/:productId → 404", async () => {
    expect((await get(`/api/stock/balance/${bProductId}`, adminACookie)).status).toBe(404);
  });

  it("consentimento do cliente de B: GET /api/whatsapp/consents/:clientId não retorna dados de B", async () => {
    const response = await get(`/api/whatsapp/consents/${bClientId}`, adminACookie);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body ?? {})).not.toContain("Sigiloso");
  });

  it("simetria: empresa B não lê clientes nem produtos da empresa A", async () => {
    expect((await get(`/api/clients/${aClientId}`, adminBCookie)).status).toBe(404);
    expect((await get(`/api/products/${aProductId}`, adminBCookie)).status).toBe(404);
  });
});

describe("4. Escrita cruzada — empresa A altera registros de B (404, nada muda)", () => {
  it("PATCH /api/categories/:id de B → 404 e nome inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/categories/${bCategoryId}`)
      .set("Cookie", adminACookie)
      .send({ name: "Categoria Hackeada" });

    expect(response.status).toBe(404);
    const row = await prisma.category.findUnique({ where: { id: bCategoryId } });
    expect(row?.name).toBe("Categoria Sigilosa B");
  });

  it("PATCH /api/categories/:id/status de B → 404 e status inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/categories/${bCategoryId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(404);
    const row = await prisma.category.findUnique({ where: { id: bCategoryId } });
    expect(row?.status).toBe("ACTIVE");
  });

  it("PATCH /api/services/:id de B → 404 e nome inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/services/${bServiceId}`)
      .set("Cookie", adminACookie)
      .send({ name: "Serviço Hackeado" });

    expect(response.status).toBe(404);
    const row = await prisma.service.findUnique({ where: { id: bServiceId } });
    expect(row?.name).toBe("Serviço Sigiloso B");
  });

  it("PATCH /api/services/:id/status de B → 404 e status inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/services/${bServiceId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(404);
    const row = await prisma.service.findUnique({ where: { id: bServiceId } });
    expect(row?.status).toBe("ACTIVE");
  });

  it("PATCH /api/clients/:id de B → 404 e notas inalteradas", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${bClientId}`)
      .set("Cookie", adminACookie)
      .send({ notes: "tentativa cruzada" });

    expect(response.status).toBe(404);
    const row = await prisma.client.findUnique({ where: { id: bClientId } });
    expect(row?.notes).toBeNull();
  });

  it("PATCH /api/clients/:id/status de B → 404 e status inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/clients/${bClientId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(404);
    const row = await prisma.client.findUnique({ where: { id: bClientId } });
    expect(row?.status).toBe("ACTIVE");
  });

  it("PATCH /api/appointments/:id de B → 404 e horário inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${bAppointmentId}`)
      .set("Cookie", adminACookie)
      .send({ startLocal: "2026-12-01T09:00", utcOffsetMinutes: -180, durationMinutes: 60 });

    expect(response.status).toBe(404);
    const row = await prisma.appointment.findUnique({ where: { id: bAppointmentId } });
    expect(row?.startLocal).toBe("2026-11-20T10:00");
  });

  it("PATCH /api/appointments/:id/status de B → 404 e status inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/appointments/${bAppointmentId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "CONFIRMED" });

    expect(response.status).toBe(404);
    const row = await prisma.appointment.findUnique({ where: { id: bAppointmentId } });
    expect(row?.status).toBe("SCHEDULED");
  });

  it("POST /api/appointments/:id/cancel de B → 404 e agendamento permanece ativo", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${bAppointmentId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "tentativa cruzada" });

    expect(response.status).toBe(404);
    const row = await prisma.appointment.findUnique({ where: { id: bAppointmentId } });
    expect(row?.status).toBe("SCHEDULED");
    expect(row?.cancelledAt).toBeNull();
  });

  it("PATCH /api/subscription-plans/:id de B → 404 e nome inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/subscription-plans/${bPlanId}`)
      .set("Cookie", adminACookie)
      .send({ name: "Plano Hackeado" });

    expect(response.status).toBe(404);
    const row = await prisma.subscriptionPlan.findUnique({ where: { id: bPlanId } });
    expect(row?.name).toBe("Plano Sigiloso B");
  });

  it("PATCH /api/subscription-plans/:id/status de B → 404 e status inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/subscription-plans/${bPlanId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(404);
    const row = await prisma.subscriptionPlan.findUnique({ where: { id: bPlanId } });
    expect(row?.status).toBe("ACTIVE");
  });

  it("POST /api/subscriptions/:id/renew de B → 404 e assinatura inalterada", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/subscriptions/${bSubscriptionId}/renew`)
      .set("Cookie", adminACookie);

    expect(response.status).toBe(404);
    const row = await prisma.subscription.findUnique({ where: { id: bSubscriptionId } });
    expect(row?.status).toBe("ACTIVE");
    expect(row?.renewalCount).toBe(0);
  });

  it("POST /api/subscriptions/:id/cancel de B → 404 e assinatura inalterada", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/subscriptions/${bSubscriptionId}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "tentativa cruzada" });

    expect(response.status).toBe(404);
    const row = await prisma.subscription.findUnique({ where: { id: bSubscriptionId } });
    expect(row?.status).toBe("ACTIVE");
    expect(row?.cancelledAt).toBeNull();
  });

  it("POST /api/stock/exits do produto de B → 404 e estoque inalterado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/exits")
      .set("Cookie", adminACookie)
      .send({ productId: bProductId, quantity: 1, notes: "tentativa cruzada" });

    expect(response.status).toBe(404);
    const row = await prisma.product.findUnique({ where: { id: bProductId } });
    expect(row?.stockQuantity.toFixed(3)).toBe("5.000");
  });

  it("POST /api/stock/adjustments do produto de B → 404 e estoque inalterado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/stock/adjustments")
      .set("Cookie", adminACookie)
      .send({
        productId: bProductId,
        type: "ADJUST_POSITIVE",
        quantity: 2,
        reason: "tentativa cruzada",
      });

    expect(response.status).toBe(404);
    const row = await prisma.product.findUnique({ where: { id: bProductId } });
    expect(row?.stockQuantity.toFixed(3)).toBe("5.000");
  });

  it("PATCH /api/whatsapp/templates/:id de B → 404 e status inalterado", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/whatsapp/templates/${bTemplateId}`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(404);
    const row = await prisma.whatsAppTemplate.findUnique({ where: { id: bTemplateId } });
    expect(row?.status).toBe("ACTIVE");
  });

  it("PUT /api/whatsapp/consents/:clientId do cliente de B → 404 e nenhum consentimento criado", async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/whatsapp/consents/${bClientId}`)
      .set("Cookie", adminACookie)
      .send({ status: "OPTED_IN", source: "MANUAL" });

    expect(response.status).toBe(404);
    const row = await prisma.whatsAppConsent.findFirst({ where: { clientId: bClientId } });
    expect(row).toBeNull();
  });
});

describe("5. Referências cruzadas em criação (FK de outra empresa rejeitada)", () => {
  it("agendamento com clientId de B → 400 'Cliente não encontrado'", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/appointments")
      .set("Cookie", adminACookie)
      .send({
        clientId: bClientId,
        serviceId: aServiceId,
        startLocal: "2026-11-20T10:00",
        utcOffsetMinutes: -180,
        durationMinutes: 60,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Cliente não encontrado");
  });

  it("agendamento com serviceId de B → 400 'Serviço não encontrado'", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/appointments")
      .set("Cookie", adminACookie)
      .send({
        clientId: aClientId,
        serviceId: bServiceId,
        startLocal: "2026-11-20T10:00",
        utcOffsetMinutes: -180,
        durationMinutes: 60,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Serviço não encontrado");
  });

});

describe("6. Listagens, relatórios e exportações por empresa", () => {
  it("resumo de A conta apenas vendas de A (2), não soma a venda de B", async () => {
    const response = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminACookie,
    );

    expect(response.status).toBe(200);
    expect(response.body.sales.completedCount).toBe(2);
  });

  it("resumo de B conta apenas a venda de B (1)", async () => {
    const response = await get(
      `/api/reports/summary?from=${today}&to=${today}`,
      adminBCookie,
    );

    expect(response.status).toBe(200);
    expect(response.body.sales.completedCount).toBe(1);
  });

  it("CSV de vendas de A não contém código de venda nem produto de B", async () => {
    const response = await get(
      `/api/reports/sales?from=${today}&to=${today}&format=csv`,
      adminACookie,
    );

    expect(response.status).toBe(200);
    expect(response.text).toContain(aSaleReceipt);
    expect(response.text).not.toContain(bSaleReceipt);
    expect(response.text).not.toContain("Produto Sigiloso B");
  });

  it("relatório de clientes de A não conta o cliente criado hoje na empresa B", async () => {
    const response = await get(
      `/api/reports/clients?from=${today}&to=${today}`,
      adminACookie,
    );

    expect(response.status).toBe(200);
    expect(response.body.newClients).toBe(2);
  });
});

describe("7. Permissões por perfil (ADMIN × MEMBER)", () => {
  it("MEMBER não pode editar catálogo (PATCH /api/categories de A) → 403", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/categories/${aCategoryId}`)
      .set("Cookie", memberACookie)
      .send({ name: "Categoria Editada" });

    expect(response.status).toBe(403);
    const row = await prisma.category.findUnique({ where: { id: aCategoryId } });
    expect(row?.name).toBe("Categoria Interna A");
  });

  it("MEMBER não pode editar produtos (PATCH /api/products de A) → 403", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/products/${aProductId}`)
      .set("Cookie", memberACookie)
      .send({ salePrice: "1.00" });

    expect(response.status).toBe(403);
    const row = await prisma.product.findUnique({ where: { id: aProductId } });
    expect(row?.salePrice.toFixed(2)).toBe("30.00");
  });

  it("MEMBER pode criar clientes (operação diária, intencional)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/clients")
      .set("Cookie", memberACookie)
      .send({ name: "Cliente Do Operador", phone: "11977778888" });

    expect(response.status).toBe(201);
  });

  it("MEMBER pode criar venda no PDV (operação diária, intencional)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/sales")
      .set("Cookie", memberACookie)
      .send({
        items: [{ productId: aProductId, quantity: "1" }],
        paymentMethod: "PIX",
      });

    expect(response.status).toBe(201);
    const row = await prisma.sale.findUnique({ where: { id: response.body.id } });
    expect(row?.companyId).toBe(companyAId);
  });

  it("MEMBER também está sujeito ao isolamento: não lê cliente de B", async () => {
    const response = await get(`/api/clients/${bClientId}`, memberACookie);
    expect(response.status).toBe(404);
  });
});

describe("8. Vazamento de dados de B em respostas de erro", () => {
  it("respostas de negação cruzada não contêm nomes, dados ou identificadores da empresa B", async () => {
    const responses = await Promise.all([
      get(`/api/categories/${bCategoryId}`, adminACookie),
      get(`/api/sales/nonexistent-id`, adminACookie),
      request(app.getHttpServer())
        .post("/api/appointments")
        .set("Cookie", adminACookie)
        .send({
          clientId: bClientId,
          serviceId: aServiceId,
          startLocal: "2026-11-20T10:00",
          utcOffsetMinutes: -180,
          durationMinutes: 60,
        }),
      request(app.getHttpServer())
        .put(`/api/whatsapp/consents/${bClientId}`)
        .set("Cookie", adminACookie)
        .send({ status: "OPTED_IN", source: "MANUAL" }),
      request(app.getHttpServer())
        .post("/api/stock/exits")
        .set("Cookie", adminACookie)
        .send({ productId: bProductId, quantity: 1 }),
      request(app.getHttpServer())
        .post(`/api/subscriptions/${bSubscriptionId}/renew`)
        .set("Cookie", adminACookie),
    ]);

    for (const response of responses) {
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      const body = JSON.stringify(response.body);
      expect(body).not.toContain("Sigiloso");
      expect(body).not.toContain("Empresa Bravo");
      expect(body).not.toContain(companyBId);
    }
  });
});
