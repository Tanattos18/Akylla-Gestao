import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { createTestApp, resetDatabase, sessionCookieFrom } from "./helpers/app";
import { MercadoPagoService } from "../apps/api/src/billing/mercadopago.service";
import { MockMercadoPagoProvider } from "../apps/api/src/billing/mercadopago-provider";
import type { PrismaService } from "../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;
let mpService: MercadoPagoService;
let mockProvider: MockMercadoPagoProvider;

let adminCookie: string;
let memberCookie: string;
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

function signedHeaders(dataId: string, secret: string, ts = "1728734400"): Record<string, string> {
  const manifest = `id:${dataId};request-id:test-req;ts:${ts};`;
  const v1 = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return {
    "x-signature": `ts=${ts},v1=${v1}`,
    "x-request-id": "test-req",
  };
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;
  mpService = app.get(MercadoPagoService);

  await resetDatabase(prisma);

  const company = await prisma.company.create({
    data: { name: "Empresa MP", slug: "mp-co" },
  });
  companyId = company.id;

  await createUser(companyId, "admin@mp.test", "ADMIN");
  await createUser(companyId, "member@mp.test", "MEMBER");
  adminCookie = await login("admin@mp.test");
  memberCookie = await login("member@mp.test");

  mockProvider = new MockMercadoPagoProvider();
  mpService.setProvider(mockProvider);
  mpService.setWebhookSecret("test-webhook-secret");
});

afterAll(async () => {
  await app.close();
});

describe("Mercado Pago — checkout", () => {
  it("membro não pode criar checkout (403)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/billing/checkout")
      .set("Cookie", memberCookie)
      .send({ planId: "tenantplan_essencial", payerEmail: "pagador@mp.test" });
    expect(response.status).toBe(403);
  });

  it("exige sessão (401)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/billing/checkout")
      .send({ planId: "tenantplan_essencial", payerEmail: "pagador@mp.test" });
    expect(response.status).toBe(401);
  });

  it("admin cria checkout no sandbox e recebe URL + id do gateway", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/billing/checkout")
      .set("Cookie", adminCookie)
      .send({ planId: "tenantplan_essencial", payerEmail: "pagador@mp.test" });

    expect(response.status).toBe(201);
    expect(response.body.checkoutUrl).toContain("sandbox.mp.example");
    expect(response.body.gatewaySubscriptionId).toBe("mp_preapp_mock_1");

    // Assinatura criada com gateway e status EXPIRED (aguardando pagamento)
    const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
    expect(sub).toBeTruthy();
    expect(sub!.gateway).toBe("MERCADO_PAGO");
    expect(sub!.gatewaySubscriptionId).toBe("mp_preapp_mock_1");
    expect(sub!.status).toBe("EXPIRED");
  });

  it("revalida plano inexistente (400)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/billing/checkout")
      .set("Cookie", adminCookie)
      .send({ planId: "plano-inexistente", payerEmail: "pagador@mp.test" });
    expect(response.status).toBe(400);
  });

  it("sem credenciais reais o provedor real falha com erro explícito", async () => {
    mpService.setProvider(null);
    const response = await request(app.getHttpServer())
      .post("/api/billing/checkout")
      .set("Cookie", adminCookie)
      .send({ planId: "tenantplan_essencial", payerEmail: "pagador@mp.test" });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("MERCADOPAGO_ACCESS_TOKEN");

    // Restaura mock para os próximos testes
    mpService.setProvider(mockProvider);
  });
});

describe("Mercado Pago — webhook", () => {
  it("webhook sem assinatura válida não processa (mas retorna 200)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/webhooks/mercadopago?type=preapproval&data.id=mp_preapp_mock_1")
      .set("x-signature", "ts=1728734400,v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
      .set("x-request-id", "test-req")
      .send({ type: "preapproval", data: { id: "mp_preapp_mock_1" } });

    expect(response.status).toBe(200);
    expect(response.body.processed).toBe(false);
    expect(response.body.reason).toBe("assinatura inválida");
  });

  it("webhook assinado corretamente ativa a assinatura", async () => {
    // Mock provider com getStatus para simular a consulta ao gateway
    const providerWithStatus = new MockMercadoPagoProvider();
    (providerWithStatus as unknown as { getStatus: (id: string) => Promise<string> }).getStatus =
      async () => "authorized";
    mpService.setProvider(providerWithStatus);

    const headers = signedHeaders("mp_preapp_mock_1", "test-webhook-secret");
    const response = await request(app.getHttpServer())
      .post("/api/webhooks/mercadopago?type=preapproval&data.id=mp_preapp_mock_1")
      .set(headers)
      .send({ type: "preapproval", data: { id: "mp_preapp_mock_1" } });

    expect(response.status).toBe(200);
    expect(response.body.processed).toBe(true);

    const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
    expect(sub!.status).toBe("ACTIVE");
  });

  it("webhook repetido é idempotente (não altera estado duas vezes)", async () => {
    // Agora o mock retorna "cancelled" — mas a assinatura já está ACTIVE.
    // O segundo webhook com "authorized" não deve mudar nada (já ACTIVE).
    const providerAuthorized = new MockMercadoPagoProvider();
    (providerAuthorized as unknown as { getStatus: (id: string) => Promise<string> }).getStatus =
      async () => "authorized";
    mpService.setProvider(providerAuthorized);

    const headers = signedHeaders("mp_preapp_mock_1", "test-webhook-secret");
    const response = await request(app.getHttpServer())
      .post("/api/webhooks/mercadopago?type=preapproval&data.id=mp_preapp_mock_1")
      .set(headers)
      .send({ type: "preapproval", data: { id: "mp_preapp_mock_1" } });

    expect(response.status).toBe(200);
    expect(response.body.processed).toBe(true);

    const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
    expect(sub!.status).toBe("ACTIVE");
  });

  it("webhook de cancelamento marca assinatura como CANCELLED", async () => {
    const providerCancelled = new MockMercadoPagoProvider();
    (providerCancelled as unknown as { getStatus: (id: string) => Promise<string> }).getStatus =
      async () => "cancelled";
    mpService.setProvider(providerCancelled);

    const headers = signedHeaders("mp_preapp_mock_1", "test-webhook-secret");
    const response = await request(app.getHttpServer())
      .post("/api/webhooks/mercadopago?type=preapproval&data.id=mp_preapp_mock_1")
      .set(headers)
      .send({ type: "preapproval", data: { id: "mp_preapp_mock_1" } });

    expect(response.status).toBe(200);
    expect(response.body.processed).toBe(true);

    const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
    expect(sub!.status).toBe("CANCELLED");
    expect(sub!.cancelledAt).toBeTruthy();
  });

  it("webhook de gateway desconhecido retorna processed=false", async () => {
    const provider = new MockMercadoPagoProvider();
    (provider as unknown as { getStatus: (id: string) => Promise<string> }).getStatus =
      async () => "authorized";
    mpService.setProvider(provider);

    const headers = signedHeaders("mp_desconhecido", "test-webhook-secret");
    const response = await request(app.getHttpServer())
      .post("/api/webhooks/mercadopago?type=preapproval&data.id=mp_desconhecido")
      .set(headers)
      .send({ type: "preapproval", data: { id: "mp_desconhecido" } });

    expect(response.status).toBe(200);
    expect(response.body.processed).toBe(false);
  });

  it("webhook de tipo diferente de preapproval é ignorado", async () => {
    const provider = new MockMercadoPagoProvider();
    (provider as unknown as { getStatus: (id: string) => Promise<string> }).getStatus =
      async () => "authorized";
    mpService.setProvider(provider);

    const headers = signedHeaders("mp_preapp_mock_1", "test-webhook-secret");
    const response = await request(app.getHttpServer())
      .post("/api/webhooks/mercadopago?type=payment&data.id=mp_preapp_mock_1")
      .set(headers)
      .send({ type: "payment", data: { id: "mp_preapp_mock_1" } });

    expect(response.status).toBe(200);
    expect(response.body.processed).toBe(false);
  });

  it("describe() expõe ambiente e presença de credenciais", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/billing/gateway")
      .set("Cookie", adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.env).toBe("sandbox");
    expect(typeof response.body.credentialsConfigured).toBe("boolean");
  });
});
