import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

/** Fase 2 · 2.3 — Ordem de serviço (estados, itens, conclusão, anexos, comissão). */

const PASSWORD = "SenhaForte123!";
// PNG 1×1 válido (assinatura + IHDR/IDAT/IEND)
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

let app: INestApplication;
let prisma: PrismaService;
let uploadsDir: string;
let adminA: string;
let memberA: string;
let adminB: string;
let clientA: string;
let clientB: string;
let professional: string;
let serviceFormat: string; // R$ 120
let productSsd: string; // R$ 300, estoque 5
let orderId: string;

function http() {
  return request(app.getHttpServer());
}

async function login(email: string): Promise<string> {
  const response = await http().post("/api/auth/login").send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`login ${email}: ${response.status}`);
  return sessionCookieFrom(response);
}

function createOrder(body: Record<string, unknown>, cookie = adminA) {
  return http().post("/api/service-orders").set("Cookie", cookie).send(body);
}

function move(id: string, status: string, cookie = adminA) {
  return http().patch(`/api/service-orders/${id}/status`).set("Cookie", cookie).send({ status });
}

beforeAll(async () => {
  uploadsDir = mkdtempSync(join(tmpdir(), "akylla-uploads-"));
  process.env.UPLOADS_DIR = uploadsDir;
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;
  await resetDatabase(prisma);

  const a = await prisma.company.create({ data: { name: "Assistência A", slug: "os-a" } });
  const b = await prisma.company.create({ data: { name: "Assistência B", slug: "os-b" } });
  const hash = await bcrypt.hash(PASSWORD, 4);
  await prisma.user.createMany({
    data: [
      { companyId: a.id, name: "Admin A", email: "admin@os-a.test", passwordHash: hash, role: "ADMIN" },
      { companyId: a.id, name: "Técnico A", email: "tecnico@os-a.test", passwordHash: hash, role: "MEMBER" },
      { companyId: b.id, name: "Admin B", email: "admin@os-b.test", passwordHash: hash, role: "ADMIN" },
    ],
  });
  clientA = (await prisma.client.create({ data: { companyId: a.id, name: "Cliente OS", nameKey: "cliente os" } })).id;
  clientB = (await prisma.client.create({ data: { companyId: b.id, name: "Cliente B", nameKey: "cliente b" } })).id;
  professional = (await prisma.professional.create({
    data: { companyId: a.id, name: "Técnico João", nameKey: "técnico joão", commissionDefault: "10" },
  })).id;
  serviceFormat = (await prisma.service.create({
    data: { companyId: a.id, name: "Formatação", nameKey: "formatação", price: "120.00" },
  })).id;
  productSsd = (await prisma.product.create({
    data: { companyId: a.id, name: "SSD 480GB", sku: "SSD", salePrice: "300.00", stockQuantity: 5 },
  })).id;

  adminA = await login("admin@os-a.test");
  memberA = await login("tecnico@os-a.test");
  adminB = await login("admin@os-b.test");
});

afterAll(async () => {
  await app.close();
  rmSync(uploadsDir, { recursive: true, force: true });
  delete process.env.UPLOADS_DIR;
});

describe("Criação", () => {
  it("cliente obrigatório e da empresa; item livre exige valor; serviço+produto no mesmo item → 400", async () => {
    expect((await createOrder({ title: "Notebook não liga" })).status).toBe(400);
    expect((await createOrder({ clientId: clientB, title: "Notebook não liga" })).status).toBe(400);
    expect((await createOrder({ clientId: clientA, title: "Notebook", items: [{ description: "Mão de obra", quantity: "1" }] })).status).toBe(400);
    expect((await createOrder({ clientId: clientA, title: "Notebook", items: [{ serviceId: serviceFormat, productId: productSsd, quantity: "1" }] })).status).toBe(400);
  });

  it("preço de catálogo vence o informado; totais e número sequencial calculados no servidor", async () => {
    const response = await createOrder({
      clientId: clientA,
      professionalId: professional,
      title: "Notebook Dell — não liga",
      discount: "20",
      items: [
        { serviceId: serviceFormat, quantity: "1", unitPrice: "1.00" },
        { description: "Mão de obra", quantity: "2", unitPrice: "50.00" },
        { productId: productSsd, quantity: "1" },
      ],
    }, memberA);
    expect(response.status).toBe(201);
    orderId = response.body.id;
    expect(response.body).toMatchObject({ code: "OS-00001", number: 1, status: "DRAFT", subtotal: "520.00", discount: "20.00", total: "500.00" });
    expect(response.body.items.map((i: { unitPrice: string }) => i.unitPrice)).toEqual(["120.00", "50.00", "300.00"]);
    expect((await createOrder({ clientId: clientA, title: "Impressora" })).body.number).toBe(2);
    expect((await createOrder({ clientId: clientB, title: "Outra empresa" }, adminB)).body.number).toBe(1);
  });

  it("desconto maior que o subtotal → 400", async () => {
    expect((await createOrder({ clientId: clientA, title: "Teste", discount: "10", items: [{ description: "Peça", quantity: "1", unitPrice: "5" }] })).status).toBe(400);
  });
});

describe("Máquina de estados", () => {
  it("pular etapa → 400; orçamento sem itens → 400", async () => {
    expect((await move(orderId, "APPROVED")).status).toBe(400);
    const empty = await createOrder({ clientId: clientA, title: "Vazia" });
    expect((await move(empty.body.id, "QUOTE")).status).toBe(400);
  });

  it("rascunho → orçamento: itens ainda editáveis e recalculados", async () => {
    const quoted = await move(orderId, "QUOTE");
    expect(quoted.status).toBe(200);
    expect(quoted.body.status).toBe("QUOTE");
    expect(quoted.body.quotedAt).toBeTruthy();
    const replaced = await http().put(`/api/service-orders/${orderId}/items`).set("Cookie", adminA).send({
      items: [
        { serviceId: serviceFormat, quantity: "1" },
        { productId: productSsd, quantity: "1" },
      ],
    });
    expect(replaced.status).toBe(200);
    expect(replaced.body).toMatchObject({ subtotal: "420.00", discount: "20.00", total: "400.00" });
  });

  it("após aprovar: itens e desconto travados (409); observações ainda editáveis", async () => {
    expect((await move(orderId, "APPROVED")).body.status).toBe("APPROVED");
    expect((await http().put(`/api/service-orders/${orderId}/items`).set("Cookie", adminA).send({ items: [] })).status).toBe(409);
    expect((await http().patch(`/api/service-orders/${orderId}`).set("Cookie", adminA).send({ discount: "0" })).status).toBe(409);
    const notes = await http().patch(`/api/service-orders/${orderId}`).set("Cookie", adminA).send({ notes: "Cliente autorizou por telefone" });
    expect(notes.status).toBe(200);
    expect(notes.body.notes).toBe("Cliente autorizou por telefone");
  });
});

describe("Anexos", () => {
  it("PNG e PDF aceitos (tipo pelos bytes), nome saneado; arquivo disfarçado → 400", async () => {
    const png = await http().post(`/api/service-orders/${orderId}/attachments`).set("Cookie", memberA)
      .attach("file", PNG, { filename: "../../foto antes.png", contentType: "image/png" });
    expect(png.status).toBe(201);
    expect(png.body).toMatchObject({ mimeType: "image/png", filename: "foto antes.png" });

    const pdf = await http().post(`/api/service-orders/${orderId}/attachments`).set("Cookie", adminA)
      .attach("file", PDF, { filename: "laudo.pdf", contentType: "application/pdf" });
    expect(pdf.status).toBe(201);

    const fake = await http().post(`/api/service-orders/${orderId}/attachments`).set("Cookie", adminA)
      .attach("file", Buffer.from("isto é texto"), { filename: "virus.png", contentType: "image/png" });
    expect(fake.status).toBe(400);

    // arquivos gravados só dentro de UPLOADS_DIR/service-orders/<empresa>/<os>/
    const companyDirs = readdirSync(join(uploadsDir, "service-orders"));
    expect(companyDirs).toHaveLength(1);
  });

  it("arquivo acima de 5 MB → 413", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const response = await http().post(`/api/service-orders/${orderId}/attachments`).set("Cookie", adminA)
      .attach("file", big, { filename: "grande.png", contentType: "image/png" });
    expect(response.status).toBe(413);
  });

  it("download devolve os mesmos bytes; outra empresa → 404; remover funciona antes de concluir", async () => {
    const order = await http().get(`/api/service-orders/${orderId}`).set("Cookie", adminA);
    const png = order.body.attachments.find((a: { mimeType: string }) => a.mimeType === "image/png");
    const download = await http().get(`/api/service-orders/${orderId}/attachments/${png.id}`).set("Cookie", adminA).buffer(true);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(download.body as Buffer, PNG)).toBe(0);
    expect((await http().get(`/api/service-orders/${orderId}/attachments/${png.id}`).set("Cookie", adminB)).status).toBe(404);

    const pdf = order.body.attachments.find((a: { mimeType: string }) => a.mimeType === "application/pdf");
    expect((await http().delete(`/api/service-orders/${orderId}/attachments/${pdf.id}`).set("Cookie", adminA)).status).toBe(200);
  });
});

describe("Conclusão", () => {
  it("estoque insuficiente → 400 e a OS continua em execução (nada é gravado)", async () => {
    const other = await createOrder({ clientId: clientA, title: "Upgrade", items: [{ productId: productSsd, quantity: "50" }] });
    for (const status of ["QUOTE", "APPROVED", "IN_PROGRESS"]) await move(other.body.id, status);
    const done = await move(other.body.id, "COMPLETED");
    expect(done.status).toBe(400);
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: other.body.id } })).status).toBe("IN_PROGRESS");
    expect(await prisma.financialEntry.count({ where: { origin: "SERVICE_ORDER", originId: other.body.id } })).toBe(0);
  });

  it("concluir: baixa de estoque, conta a receber e comissão do técnico (10% de 400)", async () => {
    expect((await move(orderId, "IN_PROGRESS")).body.status).toBe("IN_PROGRESS");
    const done = await move(orderId, "COMPLETED");
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("COMPLETED");

    expect((await prisma.product.findUniqueOrThrow({ where: { id: productSsd } })).stockQuantity.toFixed(3)).toBe("4.000");
    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { productId: productSsd, reference: "OS-00001" } });
    expect(movement.type).toBe("OUT");

    const entry = await prisma.financialEntry.findFirstOrThrow({ where: { origin: "SERVICE_ORDER", originId: orderId } });
    expect(entry).toMatchObject({ direction: "RECEIVABLE", clientId: clientA, status: "OPEN" });
    expect(entry.amount.toFixed(2)).toBe("400.00");
    expect(done.body.financialEntryId).toBe(entry.id);

    const commission = await prisma.commission.findFirstOrThrow({ where: { serviceOrderId: orderId } });
    expect(commission.status).toBe("RELEASED");
    expect(commission.amount.toFixed(2)).toBe("40.00");
  });

  it("OS concluída: sem próximo passo (409), não cancela (409), anexos viram histórico (409 ao remover)", async () => {
    expect((await move(orderId, "COMPLETED")).status).toBe(409);
    expect((await http().post(`/api/service-orders/${orderId}/cancel`).set("Cookie", adminA).send({ reason: "desistiu" })).status).toBe(409);
    const order = await http().get(`/api/service-orders/${orderId}`).set("Cookie", adminA);
    const att = order.body.attachments[0];
    expect((await http().delete(`/api/service-orders/${orderId}/attachments/${att.id}`).set("Cookie", adminA)).status).toBe(409);
    const entry = await prisma.financialEntry.findFirstOrThrow({ where: { origin: "SERVICE_ORDER", originId: orderId } });
    expect((await http().patch(`/api/financial/${entry.id}`).set("Cookie", adminA).send({ amount: "1.00" })).status).toBe(409);
  });

  it("comissão ON_PAYMENT fica pendente até a conta da OS ser recebida", async () => {
    const prof = await prisma.professional.create({
      data: { companyId: (await prisma.client.findUniqueOrThrow({ where: { id: clientA } })).companyId, name: "Técnico Prazo", nameKey: "técnico prazo" },
    });
    await http().post("/api/commission-rules").set("Cookie", adminA).send({ professionalId: prof.id, percentage: "15", releasePolicy: "ON_PAYMENT" });
    const order = await createOrder({ clientId: clientA, professionalId: prof.id, title: "Limpeza", items: [{ serviceId: serviceFormat, quantity: "1" }] });
    for (const status of ["QUOTE", "APPROVED", "IN_PROGRESS", "COMPLETED"]) await move(order.body.id, status);
    const commission = await prisma.commission.findFirstOrThrow({ where: { serviceOrderId: order.body.id } });
    expect(commission.status).toBe("PENDING");
    expect(commission.amount.toFixed(2)).toBe("18.00");

    await http().post("/api/cash/sessions").set("Cookie", adminA).send({ initialAmount: "0" });
    const entry = await prisma.financialEntry.findFirstOrThrow({ where: { origin: "SERVICE_ORDER", originId: order.body.id } });
    expect((await http().post(`/api/financial/${entry.id}/pay`).set("Cookie", adminA)).status).toBe(201);
    expect((await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } })).status).toBe("RELEASED");
  });
});

describe("Cancelamento, histórico de WhatsApp, isolamento e módulo", () => {
  it("cancelar exige motivo (≥3); cancelada não recebe anexos", async () => {
    const order = await createOrder({ clientId: clientA, title: "Cancelar" });
    expect((await http().post(`/api/service-orders/${order.body.id}/cancel`).set("Cookie", adminA).send({ reason: "x" })).status).toBe(400);
    const cancelled = await http().post(`/api/service-orders/${order.body.id}/cancel`).set("Cookie", adminA).send({ reason: "cliente desistiu" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: "CANCELLED", cancelReason: "cliente desistiu" });
    const attach = await http().post(`/api/service-orders/${order.body.id}/attachments`).set("Cookie", adminA)
      .attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    expect(attach.status).toBe(409);
  });

  it("histórico de WhatsApp lista só as mensagens vinculadas à OS", async () => {
    const companyId = (await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).companyId;
    const base = {
      companyId,
      clientId: clientA,
      toPhone: "+5511999999999",
      templateNameSnapshot: "os_pronta",
      templateLanguageSnapshot: "pt_BR",
      templateBodySnapshot: "Sua OS está pronta",
    };
    await prisma.whatsAppMessage.create({ data: { ...base, origin: "SERVICE_ORDER", originId: orderId } });
    await prisma.whatsAppMessage.create({ data: { ...base, origin: "MANUAL" } });
    const messages = await http().get(`/api/service-orders/${orderId}/messages`).set("Cookie", memberA);
    expect(messages.status).toBe(200);
    expect(messages.body.items).toHaveLength(1);
    expect(messages.body.items[0].templateNameSnapshot).toBe("os_pronta");
  });

  it("isolamento: empresa B não vê nem movimenta a OS de A (404)", async () => {
    expect((await http().get(`/api/service-orders/${orderId}`).set("Cookie", adminB)).status).toBe(404);
    expect((await move(orderId, "COMPLETED", adminB)).status).toBe(404);
    const list = await http().get("/api/service-orders").set("Cookie", adminB);
    expect(list.body.items.every((o: { client: { id: string } }) => o.client.id === clientB)).toBe(true);
  });

  it("filtro por status e busca por número", async () => {
    const list = await http().get("/api/service-orders?status=COMPLETED").set("Cookie", adminA);
    expect(list.body.items.every((o: { status: string }) => o.status === "COMPLETED")).toBe(true);
    const byNumber = await http().get("/api/service-orders?search=OS-00001").set("Cookie", adminA);
    expect(byNumber.body.items.map((o: { code: string }) => o.code)).toContain("OS-00001");
    expect(list.body.countsByStatus.COMPLETED).toBeGreaterThanOrEqual(1);
  });

  it("SERVICE_ORDERS desativado → 403", async () => {
    await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "SERVICE_ORDERS", status: "DISABLED" });
    try {
      expect((await http().get("/api/service-orders").set("Cookie", adminA)).status).toBe(403);
      expect((await createOrder({ clientId: clientA, title: "Bloqueada" })).status).toBe(403);
    } finally {
      await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "SERVICE_ORDERS", status: "ACTIVE" });
    }
  });
});
