import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { env } from "../../apps/api/src/config/env";
import { accessKeyCheckDigit } from "../../apps/api/src/fiscal/fiscal-provider";
import { signFiscalWebhook } from "../../apps/api/src/fiscal/fiscal.controller";

/** Fase 3 — fiscal por integração (configuração, cifra, emissão, cancelamento, webhook). */

const PASSWORD = "SenhaForte123!";
const PFX = readFileSync(join(__dirname, "..", "fixtures", "fiscal", "certificado-teste.pfx"));
const PFX_PASSWORD = "senha-de-teste";

let app: INestApplication;
let prisma: PrismaService;
let adminA: string;
let memberA: string;
let adminB: string;
let companyAId: string;
let product: string;
let clientWithCpf: string;

function http() {
  return request(app.getHttpServer());
}

async function login(email: string): Promise<string> {
  const response = await http().post("/api/auth/login").send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`login ${email}: ${response.status}`);
  return sessionCookieFrom(response);
}

async function sale(body: Record<string, unknown> = {}) {
  const response = await http().post("/api/sales").set("Cookie", adminA)
    .send({ items: [{ productId: product, quantity: "1" }], paymentMethod: "PIX", ...body });
  if (response.status !== 201) throw new Error(`venda: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body.id as string;
}

function emit(body: Record<string, unknown>, cookie = adminA) {
  return http().post("/api/fiscal/documents").set("Cookie", cookie).send(body);
}

function config(body: Record<string, unknown>, cookie = adminA) {
  return http().put("/api/fiscal/config").set("Cookie", cookie).send(body);
}

function webhook(payload: Record<string, unknown>, opts: { timestamp?: number; secret?: string; signature?: string } = {}) {
  const raw = JSON.stringify(payload);
  const ts = String(opts.timestamp ?? Date.now());
  const signature = opts.signature ?? `sha256=${signFiscalWebhook(opts.secret ?? "fiscal-test-webhook-secret", ts, raw)}`;
  return http().post("/api/webhooks/fiscal")
    .set("Content-Type", "application/json")
    .set("x-fiscal-timestamp", ts)
    .set("x-fiscal-signature", signature)
    .send(raw);
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;
  await resetDatabase(prisma);

  const a = await prisma.company.create({ data: { name: "Loja Fiscal A", slug: "fiscal-a" } });
  const b = await prisma.company.create({ data: { name: "Loja Fiscal B", slug: "fiscal-b" } });
  companyAId = a.id;
  const hash = await bcrypt.hash(PASSWORD, 4);
  await prisma.user.createMany({
    data: [
      { companyId: a.id, name: "Admin A", email: "admin@fiscal-a.test", passwordHash: hash, role: "ADMIN" },
      { companyId: a.id, name: "Caixa A", email: "caixa@fiscal-a.test", passwordHash: hash, role: "MEMBER" },
      { companyId: b.id, name: "Admin B", email: "admin@fiscal-b.test", passwordHash: hash, role: "ADMIN" },
    ],
  });
  product = (await prisma.product.create({
    data: { companyId: a.id, name: "Camiseta", sku: "CAM", salePrice: "59.90", stockQuantity: 100 },
  })).id;
  clientWithCpf = (await prisma.client.create({
    data: { companyId: a.id, name: "Cliente CPF", nameKey: "cliente cpf", cpf: "52998224725" },
  })).id;

  adminA = await login("admin@fiscal-a.test");
  memberA = await login("caixa@fiscal-a.test");
  adminB = await login("admin@fiscal-b.test");
  const cash = await http().post("/api/cash/sessions").set("Cookie", adminA).send({ initialAmount: "0" });
  if (cash.status !== 201) throw new Error(`caixa: ${cash.status}`);
});

afterAll(async () => {
  await app.close();
});

describe("Configuração e segredos", () => {
  it("padrão: inativo e simulado; MEMBER não vê a configuração (403) mas vê o status", async () => {
    const response = await http().get("/api/fiscal/config").set("Cookie", adminA);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ active: false, provider: "mock", simulated: true, hasApiToken: false });
    expect((await http().get("/api/fiscal/config").set("Cookie", memberA)).status).toBe(403);
    expect((await http().get("/api/fiscal/status").set("Cookie", memberA)).body).toMatchObject({ active: false });
  });

  it("emitir sem configuração ativa → 400 explícito", async () => {
    const saleId = await sale();
    const response = await emit({ saleId, type: "NFCE" });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("não está configurada");
  });

  it("ativar exige CNPJ; integradora real exige token e certificado", async () => {
    expect((await config({ active: true })).status).toBe(400);
    expect((await config({ provider: "nfeio", cnpj: "11.222.333/0001-81", active: true })).status).toBe(400);
    const ok = await config({ provider: "mock", cnpj: "11.222.333/0001-81", active: true });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ active: true, cnpj: "11222333000181" });
  });

  it("token da emissora é cifrado (AES-256-GCM) e nunca devolvido", async () => {
    const response = await config({ apiToken: "token-super-secreto-123" });
    expect(response.body.hasApiToken).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("token-super-secreto-123");
    const row = await prisma.fiscalConfig.findFirstOrThrow({ where: { companyId: companyAId } });
    expect(row.apiTokenEncrypted).toMatch(/^v1:/);
    expect(row.apiTokenEncrypted).not.toContain("token-super-secreto-123");
  });

  it("sem FISCAL_ENCRYPTION_KEY o servidor recusa gravar segredo (503)", async () => {
    const original = env.FISCAL_ENCRYPTION_KEY;
    env.FISCAL_ENCRYPTION_KEY = undefined;
    try {
      expect((await config({ apiToken: "outro-token" })).status).toBe(503);
    } finally {
      env.FISCAL_ENCRYPTION_KEY = original;
    }
  });

  it("certificado A1: senha errada → 400; arquivo inválido → 400; válido → titular e validade, cifrado", async () => {
    const wrong = await http().post("/api/fiscal/config/certificate").set("Cookie", adminA)
      .field("password", "errada").attach("file", PFX, "cert.pfx");
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toContain("Senha do certificado incorreta");
    const junk = await http().post("/api/fiscal/config/certificate").set("Cookie", adminA)
      .field("password", "x").attach("file", Buffer.from("nao sou pfx"), "cert.pfx");
    expect(junk.status).toBe(400);

    const ok = await http().post("/api/fiscal/config/certificate").set("Cookie", adminA)
      .field("password", PFX_PASSWORD).attach("file", PFX, "cert.pfx");
    expect(ok.status).toBe(200);
    expect(ok.body.certificate.uploaded).toBe(true);
    expect(ok.body.certificate.subject).toContain("EMPRESA TESTE AKYLLA");
    expect(new Date(ok.body.certificate.validTo).getTime()).toBeGreaterThan(Date.now());
    expect(JSON.stringify(ok.body)).not.toContain(PFX_PASSWORD);
    const row = await prisma.fiscalConfig.findFirstOrThrow({ where: { companyId: companyAId } });
    expect(row.certificatePasswordEncrypted).not.toContain(PFX_PASSWORD);
    expect(Buffer.from(row.certificateEncrypted ?? "").includes(PFX.subarray(0, 64))).toBe(false);
  });
});

describe("Emissão (emissora simulada)", () => {
  let saleId: string;
  let documentId: string;

  it("NFC-e autorizada: chave de 44 dígitos com DV válido, XML simulado, numeração 1", async () => {
    saleId = await sale();
    const response = await emit({ saleId, type: "NFCE" });
    expect(response.status).toBe(201);
    documentId = response.body.id;
    expect(response.body).toMatchObject({ type: "NFCE", status: "AUTHORIZED", number: 1, series: 1, amount: "59.90", environment: "HOMOLOGATION", hasXml: true });
    const key: string = response.body.accessKey;
    expect(key).toMatch(/^\d{44}$/);
    expect(key.slice(20, 22)).toBe("65"); // modelo NFC-e
    expect(key.slice(6, 20)).toBe("11222333000181");
    expect(Number(key[43])).toBe(accessKeyCheckDigit(key.slice(0, 43)));

    const xml = await http().get(`/api/fiscal/documents/${documentId}/xml`).set("Cookie", memberA);
    expect(xml.status).toBe(200);
    expect(xml.headers["content-type"]).toContain("application/xml");
    expect(xml.text).toContain("SEM VALOR FISCAL");
    expect(xml.text).toContain(key);
  });

  it("segunda nota para a mesma venda/tipo → 409; MEMBER não emite (403)", async () => {
    expect((await emit({ saleId, type: "NFCE" })).status).toBe(409);
    expect((await emit({ saleId, type: "NFE" }, memberA)).status).toBe(403);
  });

  it("NF-e exige cliente com CPF; NFS-e não sai de venda; venda cancelada não emite", async () => {
    expect((await emit({ saleId, type: "NFE" })).status).toBe(400);
    const withCpf = await sale({ clientId: clientWithCpf });
    const nfe = await emit({ saleId: withCpf, type: "NFE" });
    expect(nfe.status).toBe(201);
    expect(nfe.body.accessKey.slice(20, 22)).toBe("55");
    expect((await emit({ saleId: withCpf, type: "NFSE" })).status).toBe(400);
    const cancelled = await sale();
    await http().post(`/api/sales/${cancelled}/cancel`).set("Cookie", adminA).send({ reason: "teste fiscal" });
    expect((await emit({ saleId: cancelled, type: "NFCE" })).status).toBe(400);
  });

  it("venda com NFC-e autorizada não pode ser cancelada antes da nota (409)", async () => {
    const response = await http().post(`/api/sales/${saleId}/cancel`).set("Cookie", adminA).send({ reason: "cliente desistiu" });
    expect(response.status).toBe(409);
    expect(response.body.message).toContain("NFC-e");
  });

  it("cancelar a nota: justificativa ≥ 15 caracteres; depois a venda cancela normalmente", async () => {
    expect((await http().post(`/api/fiscal/documents/${documentId}/cancel`).set("Cookie", adminA).send({ reason: "curta" })).status).toBe(400);
    const ok = await http().post(`/api/fiscal/documents/${documentId}/cancel`).set("Cookie", adminA)
      .send({ reason: "Cliente desistiu da compra no balcão" });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: "CANCELLED", cancellationReason: "Cliente desistiu da compra no balcão" });
    expect((await http().post(`/api/fiscal/documents/${documentId}/cancel`).set("Cookie", adminA).send({ reason: "Cliente desistiu da compra no balcão" })).status).toBe(409);
    expect((await http().post(`/api/sales/${saleId}/cancel`).set("Cookie", adminA).send({ reason: "cliente desistiu" })).status).toBe(201);
  });

  it("rejeição da emissora (mock-reject) fica registrada e permite nova tentativa", async () => {
    await config({ provider: "mock-reject" });
    const id = await sale();
    const rejected = await emit({ saleId: id, type: "NFCE" });
    expect(rejected.body).toMatchObject({ status: "REJECTED" });
    expect(rejected.body.rejectionReason).toContain("Rejeição simulada");
    await config({ provider: "mock" });
    const retry = await emit({ saleId: id, type: "NFCE" });
    expect(retry.body.status).toBe("AUTHORIZED");
    expect(retry.body.number).toBe(rejected.body.number + 1);
  });

  it("NFS-e a partir de OS concluída (sem chave de 44 dígitos)", async () => {
    const service = await prisma.service.create({ data: { companyId: companyAId, name: "Ajuste", nameKey: "ajuste", price: "40.00" } });
    const os = await http().post("/api/service-orders").set("Cookie", adminA)
      .send({ clientId: clientWithCpf, title: "Ajuste de barra", items: [{ serviceId: service.id, quantity: "1" }] });
    for (const status of ["QUOTE", "APPROVED", "IN_PROGRESS", "COMPLETED"]) {
      await http().patch(`/api/service-orders/${os.body.id}/status`).set("Cookie", adminA).send({ status });
    }
    const nfse = await emit({ serviceOrderId: os.body.id, type: "NFSE" });
    expect(nfse.status).toBe(201);
    expect(nfse.body).toMatchObject({ type: "NFSE", status: "AUTHORIZED", amount: "40.00", accessKey: null });
    expect((await emit({ serviceOrderId: os.body.id, type: "NFCE" })).status).toBe(400);
  });
});

describe("Webhook da emissora (fluxo assíncrono)", () => {
  let gatewayDocumentId: string;
  let documentId: string;

  beforeAll(async () => {
    await config({ provider: "mock-async" });
    const id = await sale();
    const pending = await emit({ saleId: id, type: "NFCE" });
    expect(pending.body.status).toBe("PENDING");
    documentId = pending.body.id;
    gatewayDocumentId = (await prisma.fiscalDocument.findUniqueOrThrow({ where: { id: documentId } })).gatewayDocumentId as string;
    await config({ provider: "mock" });
  });

  it("assinatura errada, timestamp velho ou sem segredo → 403", async () => {
    const payload = { gatewayDocumentId, status: "AUTHORIZED" };
    expect((await webhook(payload, { signature: "sha256=deadbeef" })).status).toBe(403);
    expect((await webhook(payload, { secret: "segredo-errado" })).status).toBe(403);
    expect((await webhook(payload, { timestamp: Date.now() - 10 * 60 * 1000 })).status).toBe(403);
    const original = env.FISCAL_WEBHOOK_SECRET;
    env.FISCAL_WEBHOOK_SECRET = undefined;
    try {
      expect((await webhook(payload)).status).toBe(403);
    } finally {
      env.FISCAL_WEBHOOK_SECRET = original;
    }
    expect((await prisma.fiscalDocument.findUniqueOrThrow({ where: { id: documentId } })).status).toBe("PENDING");
  });

  it("assinatura válida autoriza; repetir o mesmo evento é idempotente", async () => {
    const key = "35261011222333000181650010000009991123456781";
    const payload = { gatewayDocumentId, status: "AUTHORIZED", accessKey: key, protocol: "135260000000001", xml: "<nfe/>" };
    const first = await webhook(payload);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ applied: true });
    const doc = await prisma.fiscalDocument.findUniqueOrThrow({ where: { id: documentId } });
    expect(doc).toMatchObject({ status: "AUTHORIZED", accessKey: key, protocol: "135260000000001" });
    const again = await webhook(payload);
    expect(again.status).toBe(200);
    expect(again.body.applied).toBe(false);
    expect((await webhook({ gatewayDocumentId: "nao-existe", status: "AUTHORIZED" })).body.applied).toBe(false);
  });
});

describe("Isolamento e módulo", () => {
  it("empresa B não vê documentos de A (404) nem os lista", async () => {
    const any = await prisma.fiscalDocument.findFirstOrThrow({ where: { companyId: companyAId } });
    expect((await http().get(`/api/fiscal/documents/${any.id}`).set("Cookie", adminB)).status).toBe(404);
    expect((await http().get(`/api/fiscal/documents/${any.id}/xml`).set("Cookie", adminB)).status).toBe(404);
    expect((await http().get("/api/fiscal/documents").set("Cookie", adminB)).body.total).toBe(0);
  });

  it("FISCAL desativado → 403", async () => {
    await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "FISCAL", status: "DISABLED" });
    try {
      expect((await http().get("/api/fiscal/documents").set("Cookie", adminA)).status).toBe(403);
    } finally {
      await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "FISCAL", status: "ACTIVE" });
    }
  });
});
