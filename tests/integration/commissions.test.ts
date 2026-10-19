import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { calculateCommission } from "../../apps/api/src/commissions/commission-calculator";

/** Fase 2 · 2.1 — Comissões (profissionais, regras, cálculo, pagamento, estorno). */

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;
let adminA: string;
let memberA: string;
let adminB: string;
let companyAId: string;
let categoryRacao: string;
let productRacao: string; // categoria Materiais, R$ 100,00
let productBola: string; // sem categoria, R$ 50,00
let productB: string; // empresa B
let professionalAna: string; // padrão 10%
let professionalBeto: string; // sem padrão
let cashSessionA: string;

function http() {
  return request(app.getHttpServer());
}

async function login(email: string): Promise<string> {
  const response = await http().post("/api/auth/login").send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`login ${email}: ${response.status}`);
  return sessionCookieFrom(response);
}

async function sale(body: Record<string, unknown>, cookie = adminA) {
  return http().post("/api/sales").set("Cookie", cookie).send({ paymentMethod: "CASH", ...body });
}

async function commissionOfSale(saleId: string) {
  return prisma.commission.findFirst({ where: { saleId } });
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;
  await resetDatabase(prisma);

  const a = await prisma.company.create({ data: { name: "Salão A", slug: "comissao-a" } });
  const b = await prisma.company.create({ data: { name: "Salão B", slug: "comissao-b" } });
  companyAId = a.id;
  const hash = await bcrypt.hash(PASSWORD, 4);
  await prisma.user.createMany({
    data: [
      { companyId: a.id, name: "Admin A", email: "admin@comissao-a.test", passwordHash: hash, role: "ADMIN" },
      { companyId: a.id, name: "Membro A", email: "membro@comissao-a.test", passwordHash: hash, role: "MEMBER" },
      { companyId: b.id, name: "Admin B", email: "admin@comissao-b.test", passwordHash: hash, role: "ADMIN" },
    ],
  });
  const category = await prisma.category.create({ data: { companyId: a.id, name: "Materiais", nameKey: "materiais" } });
  categoryRacao = category.id;
  productRacao = (await prisma.product.create({
    data: { companyId: a.id, name: "Cimento 50kg", sku: "RAC", salePrice: "100.00", stockQuantity: 100, categoryId: category.id },
  })).id;
  productBola = (await prisma.product.create({
    data: { companyId: a.id, name: "Bola", sku: "BOLA", salePrice: "50.00", stockQuantity: 100 },
  })).id;
  productB = (await prisma.product.create({
    data: { companyId: b.id, name: "Produto B", sku: "PB", salePrice: "10.00", stockQuantity: 10 },
  })).id;

  adminA = await login("admin@comissao-a.test");
  memberA = await login("membro@comissao-a.test");
  adminB = await login("admin@comissao-b.test");

  const cash = await http().post("/api/cash/sessions").set("Cookie", adminA).send({ initialAmount: "500.00" });
  if (cash.status !== 201) throw new Error(`caixa: ${cash.status}`);
  cashSessionA = cash.body.id;
});

afterAll(async () => {
  await app.close();
});

describe("Profissionais", () => {
  it("ADMIN cadastra; nome duplicado → 409; MEMBER lista mas não cadastra", async () => {
    const ana = await http().post("/api/professionals").set("Cookie", adminA).send({ name: "Ana Vendedora", commissionDefault: "10" });
    expect(ana.status).toBe(201);
    expect(ana.body.commissionDefault).toBe("10.00");
    professionalAna = ana.body.id;

    const beto = await http().post("/api/professionals").set("Cookie", adminA).send({ name: "Beto Vendedor" });
    professionalBeto = beto.body.id;

    const dup = await http().post("/api/professionals").set("Cookie", adminA).send({ name: "  ana   vendedora " });
    expect(dup.status).toBe(409);

    expect((await http().post("/api/professionals").set("Cookie", memberA).send({ name: "X" })).status).toBe(403);
    const list = await http().get("/api/professionals").set("Cookie", memberA);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);
  });

  it("percentual acima de 100 é recusado (400)", async () => {
    const response = await http().post("/api/professionals").set("Cookie", adminA).send({ name: "Caio", commissionDefault: "150" });
    expect(response.status).toBe(400);
  });

  it("isolamento: empresa B não vê o profissional de A (404) nem o lista", async () => {
    expect((await http().get(`/api/professionals/${professionalAna}`).set("Cookie", adminB)).status).toBe(404);
    const list = await http().get("/api/professionals").set("Cookie", adminB);
    expect(list.body.total).toBe(0);
  });
});

describe("Regras", () => {
  it("produto E categoria na mesma regra → 400; alvo de outra empresa → 400", async () => {
    const both = await http().post("/api/commission-rules").set("Cookie", adminA)
      .send({ productId: productRacao, categoryId: categoryRacao, percentage: "5" });
    expect(both.status).toBe(400);
    const foreign = await http().post("/api/commission-rules").set("Cookie", adminA)
      .send({ productId: productB, percentage: "5" });
    expect(foreign.status).toBe(400);
    expect((await http().get("/api/commission-rules").set("Cookie", memberA)).status).toBe(403);
  });
});

describe("Cálculo na venda", () => {
  it("sem regras, usa o padrão do profissional (10%): comissão liberada + conta a pagar", async () => {
    const response = await sale({ items: [{ productId: productRacao, quantity: "1" }], professionalId: professionalAna });
    expect(response.status).toBe(201);
    expect(response.body.professional).toEqual({ id: professionalAna, name: "Ana Vendedora" });

    const c = await commissionOfSale(response.body.id);
    expect(c?.status).toBe("RELEASED");
    expect(c?.amount.toFixed(2)).toBe("10.00");
    expect(c?.baseAmount.toFixed(2)).toBe("100.00");

    const entry = await prisma.financialEntry.findFirst({ where: { origin: "COMMISSION", originId: c?.id } });
    expect(entry).toMatchObject({ direction: "PAYABLE", status: "OPEN", companyId: companyAId });
    expect(entry?.amount.toFixed(2)).toBe("10.00");
    expect(c?.financialEntryId).toBe(entry?.id);
  });

  it("sem regra e sem padrão → nenhuma comissão", async () => {
    const response = await sale({ items: [{ productId: productBola, quantity: "1" }], professionalId: professionalBeto });
    expect(response.status).toBe(201);
    expect(await commissionOfSale(response.body.id)).toBeNull();
  });

  it("precedência: produto > categoria > regra do profissional > padrão; desconto rateado", async () => {
    const rules = [
      { categoryId: categoryRacao, percentage: "8" },
      { professionalId: professionalAna, percentage: "12" },
    ];
    for (const rule of rules) {
      expect((await http().post("/api/commission-rules").set("Cookie", adminA).send(rule)).status).toBe(201);
    }
    // Cimento (cat. 8%) + Bola (regra da Ana 12%); subtotal 150, desconto 15 → total 135
    const response = await sale({
      items: [{ productId: productRacao, quantity: "1" }, { productId: productBola, quantity: "1" }],
      discount: "15",
      professionalId: professionalAna,
    });
    expect(response.status).toBe(201);
    const c = await commissionOfSale(response.body.id);
    const lines = c?.lines as Array<{ productName: string; base: string; percentage: string; amount: string; source: string }>;
    const racao = lines.find((l) => l.productName === "Cimento 50kg");
    const bola = lines.find((l) => l.productName === "Bola");
    expect(racao).toMatchObject({ base: "90.00", percentage: "8.00", amount: "7.20", source: "CATEGORY" });
    expect(bola).toMatchObject({ base: "45.00", percentage: "12.00", amount: "5.40", source: "PROFESSIONAL_RULE" });
    expect(c?.baseAmount.toFixed(2)).toBe("135.00");
    expect(c?.amount.toFixed(2)).toBe("12.60");

    // regra de produto vence a de categoria; a do profissional vence a geral
    await http().post("/api/commission-rules").set("Cookie", adminA).send({ productId: productRacao, percentage: "5" });
    await http().post("/api/commission-rules").set("Cookie", adminA)
      .send({ productId: productRacao, professionalId: professionalAna, percentage: "6" });
    const second = await sale({ items: [{ productId: productRacao, quantity: "1" }], professionalId: professionalAna });
    const c2 = await commissionOfSale(second.body.id);
    expect((c2?.lines as Array<{ source: string; percentage: string }>)[0]).toMatchObject({ source: "PRODUCT_PROFESSIONAL", percentage: "6.00" });
    const third = await sale({ items: [{ productId: productRacao, quantity: "1" }], professionalId: professionalBeto });
    const c3 = await commissionOfSale(third.body.id);
    expect((c3?.lines as Array<{ source: string; percentage: string }>)[0]).toMatchObject({ source: "PRODUCT", percentage: "5.00" });
  });

  it("profissional inativo → 400; de outra empresa → 400 (venda não é criada)", async () => {
    await http().patch(`/api/professionals/${professionalBeto}/status`).set("Cookie", adminA).send({ status: "INACTIVE" });
    const before = await prisma.sale.count({ where: { companyId: companyAId } });
    expect((await sale({ items: [{ productId: productBola, quantity: "1" }], professionalId: professionalBeto })).status).toBe(400);
    const foreign = await http().post("/api/professionals").set("Cookie", adminB).send({ name: "Prof B" });
    expect((await sale({ items: [{ productId: productBola, quantity: "1" }], professionalId: foreign.body.id })).status).toBe(400);
    expect(await prisma.sale.count({ where: { companyId: companyAId } })).toBe(before);
    await http().patch(`/api/professionals/${professionalBeto}/status`).set("Cookie", adminA).send({ status: "ACTIVE" });
  });
});

describe("Pagamento e sincronia com o financeiro", () => {
  let saleId: string;
  let commissionId: string;

  it("MEMBER não paga (403); ADMIN paga → comissão PAID, título PAID e saída no caixa", async () => {
    const response = await sale({ items: [{ productId: productBola, quantity: "2" }], professionalId: professionalAna });
    saleId = response.body.id;
    commissionId = (await commissionOfSale(saleId))?.id as string;

    expect((await http().post(`/api/commissions/${commissionId}/pay`).set("Cookie", memberA)).status).toBe(403);
    const paid = await http().post(`/api/commissions/${commissionId}/pay`).set("Cookie", adminA);
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe("PAID");

    const entry = await prisma.financialEntry.findFirst({ where: { origin: "COMMISSION", originId: commissionId } });
    expect(entry?.status).toBe("PAID");
    const out = await prisma.cashMovement.findFirst({ where: { id: entry?.cashMovementId ?? "" } });
    expect(out).toMatchObject({ type: "OUT", cashSessionId: cashSessionA });
    expect((await http().post(`/api/commissions/${commissionId}/pay`).set("Cookie", adminA)).status).toBe(409);
  });

  it("estorno do pagamento pelo financeiro devolve a comissão para RELEASED; pagar pelo financeiro marca PAID", async () => {
    const entry = await prisma.financialEntry.findFirstOrThrow({ where: { origin: "COMMISSION", originId: commissionId } });
    const reversed = await http().post(`/api/financial/${entry.id}/reverse`).set("Cookie", adminA).send({ reason: "pago errado" });
    expect(reversed.status).toBe(201);
    expect((await prisma.commission.findUnique({ where: { id: commissionId } }))?.status).toBe("RELEASED");

    expect((await http().post(`/api/financial/${entry.id}/pay`).set("Cookie", adminA)).status).toBe(201);
    expect((await prisma.commission.findUnique({ where: { id: commissionId } }))?.status).toBe("PAID");
  });

  it("título de comissão não pode ser editado nem cancelado avulso no financeiro (409)", async () => {
    const response = await sale({ items: [{ productId: productBola, quantity: "1" }], professionalId: professionalAna });
    const c = await commissionOfSale(response.body.id);
    const entryId = c?.financialEntryId as string;
    expect((await http().patch(`/api/financial/${entryId}`).set("Cookie", adminA).send({ amount: "999.00" })).status).toBe(409);
    expect((await http().post(`/api/financial/${entryId}/cancel`).set("Cookie", adminA).send({ reason: "teste" })).status).toBe(409);
  });
});

describe("Cancelamento da venda", () => {
  it("comissão liberada → CANCELLED e conta a pagar cancelada", async () => {
    const response = await sale({ items: [{ productId: productRacao, quantity: "1" }], professionalId: professionalAna });
    const c = await commissionOfSale(response.body.id);
    const cancel = await http().post(`/api/sales/${response.body.id}/cancel`).set("Cookie", adminA).send({ reason: "cliente desistiu" });
    expect(cancel.status).toBe(201);
    const after = await prisma.commission.findUnique({ where: { id: c?.id } });
    expect(after?.status).toBe("CANCELLED");
    expect(after?.cancelReason).toContain("cliente desistiu");
    const entry = await prisma.financialEntry.findUnique({ where: { id: c?.financialEntryId as string } });
    expect(entry?.status).toBe("CANCELLED");
  });

  it("comissão já paga → CANCELLED + conta a RECEBER do profissional (estorno auditado)", async () => {
    const response = await sale({ items: [{ productId: productRacao, quantity: "1" }], professionalId: professionalAna });
    const c = await commissionOfSale(response.body.id);
    await http().post(`/api/commissions/${c?.id}/pay`).set("Cookie", adminA);
    await http().post(`/api/sales/${response.body.id}/cancel`).set("Cookie", adminA).send({ reason: "devolução" });

    const after = await prisma.commission.findUnique({ where: { id: c?.id } });
    expect(after?.status).toBe("CANCELLED");
    const reversal = await prisma.financialEntry.findFirst({ where: { origin: "COMMISSION_REVERSAL", originId: c?.id } });
    expect(reversal).toMatchObject({ direction: "RECEIVABLE", status: "OPEN" });
    expect(reversal?.amount.toFixed(2)).toBe(c?.amount.toFixed(2));
    expect(after?.reversalEntryId).toBe(reversal?.id);
    // o título original continua PAGO (histórico imutável)
    expect((await prisma.financialEntry.findUnique({ where: { id: c?.financialEntryId as string } }))?.status).toBe("PAID");
  });
});

describe("Consulta e liberação manual", () => {
  it("lista com filtro de status/profissional, totais e resumo por profissional", async () => {
    const list = await http().get(`/api/commissions?professionalId=${professionalAna}&status=PAID`).set("Cookie", memberA);
    expect(list.status).toBe(200);
    expect(list.body.items.every((c: { status: string; professional: { id: string } }) => c.status === "PAID" && c.professional.id === professionalAna)).toBe(true);
    expect(Number(list.body.totals.amount)).toBeGreaterThan(0);

    const summary = await http().get("/api/commissions/summary").set("Cookie", adminA);
    expect(summary.status).toBe(200);
    const ana = summary.body.items.find((i: { professionalId: string }) => i.professionalId === professionalAna);
    expect(ana.name).toBe("Ana Vendedora");
    const fromDb = await prisma.commission.aggregate({ where: { professionalId: professionalAna, status: "PAID" }, _sum: { amount: true } });
    expect(ana.paid).toBe(fromDb._sum.amount?.toFixed(2));
  });

  it("liberação manual: PENDING → RELEASED com conta a pagar; já liberada → 409; outra empresa → 404", async () => {
    const response = await sale({ items: [{ productId: productBola, quantity: "1" }], professionalId: professionalAna });
    const c = await commissionOfSale(response.body.id);
    // simula comissão pendente (venda a prazo virá com o crediário — Fase 2.2)
    await prisma.financialEntry.delete({ where: { id: c?.financialEntryId as string } });
    await prisma.commission.update({ where: { id: c?.id }, data: { status: "PENDING", releasedAt: null, financialEntryId: null } });

    expect((await http().post(`/api/commissions/${c?.id}/release`).set("Cookie", adminB)).status).toBe(404);
    const released = await http().post(`/api/commissions/${c?.id}/release`).set("Cookie", adminA);
    expect(released.status).toBe(200);
    expect(released.body.status).toBe("RELEASED");
    expect(released.body.financialEntryId).toBeTruthy();
    expect((await http().post(`/api/commissions/${c?.id}/release`).set("Cookie", adminA)).status).toBe(409);
  });

  it("isolamento: empresa B não vê comissões de A", async () => {
    const anyA = await prisma.commission.findFirstOrThrow({ where: { companyId: companyAId } });
    expect((await http().get(`/api/commissions/${anyA.id}`).set("Cookie", adminB)).status).toBe(404);
    expect((await http().get("/api/commissions").set("Cookie", adminB)).body.total).toBe(0);
  });
});

describe("Módulo desativado", () => {
  it("COMMISSIONS DISABLED → rotas 403 e venda com profissional 403", async () => {
    const off = await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "COMMISSIONS", status: "DISABLED" });
    expect(off.status).toBe(200);
    try {
      expect((await http().get("/api/commissions").set("Cookie", adminA)).status).toBe(403);
      expect((await http().get("/api/professionals").set("Cookie", adminA)).status).toBe(403);
      expect((await sale({ items: [{ productId: productBola, quantity: "1" }], professionalId: professionalAna })).status).toBe(403);
      // venda sem profissional continua normal
      expect((await sale({ items: [{ productId: productBola, quantity: "1" }] })).status).toBe(201);
    } finally {
      await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "COMMISSIONS", status: "ACTIVE" });
    }
  });

  it("pagar comissão exige caixa aberto (409 com o caixa fechado)", async () => {
    const response = await sale({ items: [{ productId: productBola, quantity: "1" }], professionalId: professionalAna });
    const c = await commissionOfSale(response.body.id);
    const close = await http().post(`/api/cash/sessions/${cashSessionA}/close`).set("Cookie", adminA).send({ countedAmount: "0" });
    expect(close.status).toBe(201);
    const paid = await http().post(`/api/commissions/${c?.id}/pay`).set("Cookie", adminA);
    expect(paid.status).toBe(409);
    expect(paid.body.message).toContain("Caixa fechado");
  });
});

describe("Calculadora (unidade)", () => {
  it("rateio do desconto fecha exatamente no total, com centavos no último item", () => {
    const d = (v: string) => new Prisma.Decimal(v);
    const result = calculateCommission({
      lines: [
        { saleItemId: "1", productId: "a", categoryId: null, productName: "A", lineSubtotal: d("10.00") },
        { saleItemId: "2", productId: "b", categoryId: null, productName: "B", lineSubtotal: d("10.00") },
        { saleItemId: "3", productId: "c", categoryId: null, productName: "C", lineSubtotal: d("10.00") },
      ],
      saleSubtotal: d("30.00"),
      saleTotal: d("20.00"),
      professional: { id: "p", commissionDefault: d("10") },
      rules: [],
    });
    expect(result.lines.map((l) => l.base)).toEqual(["6.67", "6.67", "6.66"]);
    // 0,667 + 0,667 + 0,666 = 2,000 → total 2,00 (não 2,01 por arredondar linha a linha)
    expect(result.lines.map((l) => l.amount)).toEqual(["0.67", "0.67", "0.66"]);
    expect(result.baseAmount.toFixed(2)).toBe("20.00");
    expect(result.amount.toFixed(2)).toBe("2.00");
    expect(result.percentage.toFixed(2)).toBe("10.00");
  });
});
