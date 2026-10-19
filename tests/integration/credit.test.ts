import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { buildInstallmentPlan } from "../../apps/api/src/credit/installment-plan";

/** Fase 2 · 2.2 — Crediário (venda a prazo, parcelas, limite, baixa, cancelamento). */

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;
let adminA: string;
let memberA: string;
let adminB: string;
let companyAId: string;
let clientAna: string;
let clientBia: string;
let clientB: string;
let product: string; // R$ 100,00

function http() {
  return request(app.getHttpServer());
}

async function login(email: string): Promise<string> {
  const response = await http().post("/api/auth/login").send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`login ${email}: ${response.status}`);
  return sessionCookieFrom(response);
}

function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function creditSale(clientId: string, quantity: string, installments: number, extra: Record<string, unknown> = {}) {
  return http()
    .post("/api/sales")
    .set("Cookie", adminA)
    .send({
      items: [{ productId: product, quantity }],
      paymentMethod: "CREDIARIO",
      clientId,
      credit: { installments, firstDueDate: isoDaysFromToday(30) },
      ...extra,
    });
}

async function account(clientId: string) {
  return prisma.creditAccount.findFirstOrThrow({ where: { clientId } });
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;
  await resetDatabase(prisma);

  const a = await prisma.company.create({ data: { name: "Loja A", slug: "credito-a" } });
  const b = await prisma.company.create({ data: { name: "Loja B", slug: "credito-b" } });
  companyAId = a.id;
  const hash = await bcrypt.hash(PASSWORD, 4);
  await prisma.user.createMany({
    data: [
      { companyId: a.id, name: "Admin A", email: "admin@credito-a.test", passwordHash: hash, role: "ADMIN" },
      { companyId: a.id, name: "Membro A", email: "membro@credito-a.test", passwordHash: hash, role: "MEMBER" },
      { companyId: b.id, name: "Admin B", email: "admin@credito-b.test", passwordHash: hash, role: "ADMIN" },
    ],
  });
  clientAna = (await prisma.client.create({ data: { companyId: a.id, name: "Ana Cliente", nameKey: "ana cliente" } })).id;
  clientBia = (await prisma.client.create({ data: { companyId: a.id, name: "Bia Cliente", nameKey: "bia cliente" } })).id;
  clientB = (await prisma.client.create({ data: { companyId: b.id, name: "Cliente B", nameKey: "cliente b" } })).id;
  product = (await prisma.product.create({
    data: { companyId: a.id, name: "Bicicleta", sku: "BIKE", salePrice: "100.00", stockQuantity: 100 },
  })).id;

  adminA = await login("admin@credito-a.test");
  memberA = await login("membro@credito-a.test");
  adminB = await login("admin@credito-b.test");
  const cash = await http().post("/api/cash/sessions").set("Cookie", adminA).send({ initialAmount: "0.00" });
  if (cash.status !== 201) throw new Error(`caixa: ${cash.status}`);
});

afterAll(async () => {
  await app.close();
});

describe("Validação do pedido", () => {
  it("crediário exige cliente e parcelas; parcelas com outra forma de pagamento → 400", async () => {
    const noClient = await http().post("/api/sales").set("Cookie", adminA)
      .send({ items: [{ productId: product, quantity: "1" }], paymentMethod: "CREDIARIO", credit: { installments: 2, firstDueDate: isoDaysFromToday(30) } });
    expect(noClient.status).toBe(400);
    const noPlan = await http().post("/api/sales").set("Cookie", adminA)
      .send({ items: [{ productId: product, quantity: "1" }], paymentMethod: "CREDIARIO", clientId: clientAna });
    expect(noPlan.status).toBe(400);
    const planWithCash = await http().post("/api/sales").set("Cookie", adminA)
      .send({ items: [{ productId: product, quantity: "1" }], paymentMethod: "CASH", credit: { installments: 2, firstDueDate: isoDaysFromToday(30) } });
    expect(planWithCash.status).toBe(400);
    expect((await creditSale(clientAna, "1", 25)).status).toBe(400); // máx. 24
  });

  it("cliente sem crediário aprovado → 403 e nada é gravado", async () => {
    const before = await prisma.sale.count({ where: { companyId: companyAId } });
    const response = await creditSale(clientAna, "1", 2);
    expect(response.status).toBe(403);
    expect(response.body.message).toContain("sem crediário aprovado");
    expect(await prisma.sale.count({ where: { companyId: companyAId } })).toBe(before);
  });
});

describe("Aprovação do crediário", () => {
  it("ADMIN aprova com limite; MEMBER não pode (403); cliente de outra empresa → 404", async () => {
    expect((await http().patch(`/api/credit-accounts/${clientAna}`).set("Cookie", memberA).send({ creditLimit: "500" })).status).toBe(403);
    expect((await http().patch(`/api/credit-accounts/${clientB}`).set("Cookie", adminA).send({ creditLimit: "500" })).status).toBe(404);
    expect((await http().patch(`/api/credit-accounts/${clientAna}`).set("Cookie", adminA).send({ status: "ACTIVE" })).status).toBe(400);
    const approved = await http().patch(`/api/credit-accounts/${clientAna}`).set("Cookie", adminA).send({ creditLimit: "500" });
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ creditLimit: "500.00", balance: "0.00", available: "500.00", status: "ACTIVE" });
  });
});

describe("Venda no crediário", () => {
  let saleId: string;

  it("3x de R$ 100: parcelas 33,33/33,33/33,34 mensais, a receber por parcela, saldo +100 e SEM entrada no caixa", async () => {
    const response = await creditSale(clientAna, "1", 3);
    expect(response.status).toBe(201);
    expect(response.body.paymentMethod).toBe("CREDIARIO");
    saleId = response.body.id;

    const installments = await prisma.creditInstallment.findMany({ where: { saleId }, orderBy: { number: "asc" } });
    expect(installments.map((i) => i.amount.toFixed(2))).toEqual(["33.33", "33.33", "33.34"]);
    expect(installments.every((i) => i.totalInstallments === 3 && i.status === "OPEN")).toBe(true);
    const months = installments.map((i) => i.dueDate.getUTCMonth());
    expect((months[1]! - months[0]! + 12) % 12).toBe(1);
    expect((months[2]! - months[1]! + 12) % 12).toBe(1);

    const entries = await prisma.financialEntry.findMany({ where: { origin: "CREDIT_SALE", originId: { in: installments.map((i) => i.id) } } });
    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.direction === "RECEIVABLE" && e.clientId === clientAna && e.status === "OPEN")).toBe(true);

    expect((await account(clientAna)).balance.toFixed(2)).toBe("100.00");
    expect(await prisma.cashMovement.count({ where: { saleId } })).toBe(0);
  });

  it("limite excedido (100 em aberto + 500 > 500) → 403 e estoque intacto", async () => {
    const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: product } })).stockQuantity.toFixed(3);
    // produto em UNIDADE: quantidade inteira (auditoria bloco 7)
    const response = await creditSale(clientAna, "5", 1);
    expect(response.status).toBe(403);
    expect(response.body.message).toContain("Limite de crédito excedido");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product } })).stockQuantity.toFixed(3)).toBe(stockBefore);
    expect((await account(clientAna)).balance.toFixed(2)).toBe("100.00");
  });

  it("crediário bloqueado → 403; 1º vencimento no passado → 400", async () => {
    await http().patch(`/api/credit-accounts/${clientBia}`).set("Cookie", adminA).send({ creditLimit: "1000", status: "BLOCKED" });
    expect((await creditSale(clientBia, "1", 1)).status).toBe(403);
    await http().patch(`/api/credit-accounts/${clientBia}`).set("Cookie", adminA).send({ status: "ACTIVE" });
    const past = await creditSale(clientBia, "1", 1, { credit: { installments: 1, firstDueDate: isoDaysFromToday(-5) } });
    expect(past.status).toBe(400);
  });

  it("vencimento marcado na leitura: parcela com data passada vira OVERDUE na listagem e no total vencido", async () => {
    const first = await prisma.creditInstallment.findFirstOrThrow({ where: { saleId, number: 1 } });
    await prisma.creditInstallment.update({ where: { id: first.id }, data: { dueDate: new Date(Date.now() - 3 * 86400000) } });
    const list = await http().get(`/api/credit-installments?clientId=${clientAna}`).set("Cookie", memberA);
    expect(list.status).toBe(200);
    expect(list.body.items.find((i: { id: string }) => i.id === first.id).status).toBe("OVERDUE");
    const accounts = await http().get("/api/credit-accounts").set("Cookie", memberA);
    const ana = accounts.body.items.find((a: { client: { id: string } }) => a.client.id === clientAna);
    expect(ana.overdue).toBe("33.33");
    expect(accounts.body.totals).toMatchObject({ receivable: "100.00", overdue: "33.33", overdueCount: 1 });
  });

  it("receber parcela: MEMBER 403; ADMIN paga (vencida) → PAID, saldo −33,33, entrada no caixa; de novo → 409", async () => {
    const first = await prisma.creditInstallment.findFirstOrThrow({ where: { saleId, number: 1 } });
    expect((await http().post(`/api/credit-installments/${first.id}/pay`).set("Cookie", memberA)).status).toBe(403);
    const paid = await http().post(`/api/credit-installments/${first.id}/pay`).set("Cookie", adminA);
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe("PAID");
    expect((await account(clientAna)).balance.toFixed(2)).toBe("66.67");
    const entry = await prisma.financialEntry.findUniqueOrThrow({ where: { id: first.financialEntryId as string } });
    expect(entry.status).toBe("PAID");
    const movement = await prisma.cashMovement.findUniqueOrThrow({ where: { id: entry.cashMovementId as string } });
    expect(movement).toMatchObject({ type: "IN" });
    expect(movement.amount.toFixed(2)).toBe("33.33");
    expect((await http().post(`/api/credit-installments/${first.id}/pay`).set("Cookie", adminA)).status).toBe(409);
  });

  it("estorno do recebimento pelo financeiro devolve a parcela e o saldo; editar/cancelar o título → 409", async () => {
    const first = await prisma.creditInstallment.findFirstOrThrow({ where: { saleId, number: 1 } });
    const entryId = first.financialEntryId as string;
    const reversed = await http().post(`/api/financial/${entryId}/reverse`).set("Cookie", adminA).send({ reason: "recebido errado" });
    expect(reversed.status).toBe(201);
    expect((await prisma.creditInstallment.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("OPEN");
    expect((await account(clientAna)).balance.toFixed(2)).toBe("100.00");
    expect((await http().patch(`/api/financial/${entryId}`).set("Cookie", adminA).send({ amount: "1.00" })).status).toBe(409);
    expect((await http().post(`/api/financial/${entryId}/cancel`).set("Cookie", adminA).send({ reason: "teste de cancelamento" })).status).toBe(409);
    // volta a receber para os próximos testes
    expect((await http().post(`/api/credit-installments/${first.id}/pay`).set("Cookie", adminA)).status).toBe(200);
  });

  it("cancelar a venda: parcelas em aberto canceladas, saldo zerado e devolução SÓ do que foi pago", async () => {
    const response = await http().post(`/api/sales/${saleId}/cancel`).set("Cookie", adminA).send({ reason: "cliente devolveu" });
    expect(response.status).toBe(201);
    const installments = await prisma.creditInstallment.findMany({ where: { saleId }, orderBy: { number: "asc" } });
    // Auditoria (bloco 4): a parcela paga foi devolvida → REFUNDED
    expect(installments.map((i) => i.status)).toEqual(["REFUNDED", "CANCELLED", "CANCELLED"]);
    expect(installments[0]!.refundedAt).not.toBeNull();
    const entries = await prisma.financialEntry.findMany({ where: { id: { in: installments.slice(1).map((i) => i.financialEntryId as string) } } });
    expect(entries.every((e) => e.status === "CANCELLED")).toBe(true);
    expect((await account(clientAna)).balance.toFixed(2)).toBe("0.00");
    const refund = await prisma.cashMovement.findFirstOrThrow({ where: { saleId, origin: "SALE_CANCELMENT" } });
    expect(refund).toMatchObject({ type: "OUT" });
    expect(refund.amount.toFixed(2)).toBe("33.33");

    // Estornar depois o recebimento da parcela devolvida seria devolver em dobro → 409
    const refundedEntry = installments[0]!.financialEntryId as string;
    const again = await http().post(`/api/financial/${refundedEntry}/reverse`).set("Cookie", adminA).send({ reason: "estorno em dobro" });
    expect(again.status).toBe(409);
    expect(again.body.message).toContain("já foi devolvida");
    expect((await prisma.financialEntry.findUniqueOrThrow({ where: { id: refundedEntry } })).status).toBe("PAID");
  });
});

describe("Comissão na venda a prazo", () => {
  it("ON_PAYMENT fica PENDENTE até a última parcela; quitada → liberada com conta a pagar", async () => {
    const prof = await http().post("/api/professionals").set("Cookie", adminA).send({ name: "Vendedor Prazo" });
    await http().post("/api/commission-rules").set("Cookie", adminA)
      .send({ professionalId: prof.body.id, percentage: "10", releasePolicy: "ON_PAYMENT" });
    const sale = await creditSale(clientAna, "2", 2, { professionalId: prof.body.id });
    expect(sale.status).toBe(201);
    const commission = await prisma.commission.findFirstOrThrow({ where: { saleId: sale.body.id } });
    expect(commission.status).toBe("PENDING");
    expect(commission.financialEntryId).toBeNull();

    const installments = await prisma.creditInstallment.findMany({ where: { saleId: sale.body.id }, orderBy: { number: "asc" } });
    await http().post(`/api/credit-installments/${installments[0]!.id}/pay`).set("Cookie", adminA);
    expect((await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } })).status).toBe("PENDING");
    await http().post(`/api/credit-installments/${installments[1]!.id}/pay`).set("Cookie", adminA);
    const released = await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(released.status).toBe("RELEASED");
    expect(released.amount.toFixed(2)).toBe("20.00");
    const payable = await prisma.financialEntry.findFirstOrThrow({ where: { origin: "COMMISSION", originId: commission.id } });
    expect(payable.direction).toBe("PAYABLE");
  });

  it("estornar o recebimento de uma parcela da venda quitada devolve a comissão liberada para pendente (auditoria bloco 4)", async () => {
    const prof = await http().post("/api/professionals").set("Cookie", adminA).send({ name: "Vendedor Estorno" });
    await http().post("/api/commission-rules").set("Cookie", adminA)
      .send({ professionalId: prof.body.id, percentage: "10", releasePolicy: "ON_PAYMENT" });
    const sale = await creditSale(clientAna, "1", 2, { professionalId: prof.body.id });
    const installments = await prisma.creditInstallment.findMany({ where: { saleId: sale.body.id }, orderBy: { number: "asc" } });
    for (const i of installments) await http().post(`/api/credit-installments/${i.id}/pay`).set("Cookie", adminA);
    const commission = await prisma.commission.findFirstOrThrow({ where: { saleId: sale.body.id } });
    expect(commission.status).toBe("RELEASED");
    const payableId = commission.financialEntryId as string;

    const last = await prisma.creditInstallment.findUniqueOrThrow({ where: { id: installments[1]!.id } });
    const reversed = await http()
      .post(`/api/financial/${last.financialEntryId}/reverse`)
      .set("Cookie", adminA)
      .send({ reason: "pagamento devolvido pelo banco" });
    expect(reversed.status).toBe(201);
    const back = await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(back).toMatchObject({ status: "PENDING", financialEntryId: null, releasedAt: null });
    expect((await prisma.financialEntry.findUniqueOrThrow({ where: { id: payableId } })).status).toBe("CANCELLED");

    // recebendo de novo, libera outra vez
    const repaid = await http().post(`/api/credit-installments/${last.id}/pay`).set("Cookie", adminA);
    expect(repaid.status).toBe(200);
    expect((await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } })).status).toBe("RELEASED");
  });
});

describe("Isolamento e módulo", () => {
  it("empresa B não vê crediário de A (404) nem parcelas", async () => {
    expect((await http().get(`/api/credit-accounts/${clientAna}`).set("Cookie", adminB)).status).toBe(404);
    expect((await http().get("/api/credit-installments").set("Cookie", adminB)).body.total).toBe(0);
    expect((await http().get("/api/credit-accounts").set("Cookie", adminB)).body.total).toBe(0);
  });

  it("CREDIT desativado → rotas 403 e venda no crediário 403", async () => {
    await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "CREDIT", status: "DISABLED" });
    try {
      expect((await http().get("/api/credit-accounts").set("Cookie", adminA)).status).toBe(403);
      expect((await creditSale(clientAna, "1", 1)).status).toBe(403);
    } finally {
      await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "CREDIT", status: "ACTIVE" });
    }
  });
});

describe("Plano de parcelas (unidade)", () => {
  it("soma = total com centavos na última; dia 31 vira o último dia dos meses curtos", () => {
    const plan = buildInstallmentPlan(new Prisma.Decimal("100.00"), 3, "2027-01-31");
    expect(plan.map((p) => p.amount.toFixed(2))).toEqual(["33.33", "33.33", "33.34"]);
    expect(plan.map((p) => p.dueDate.toISOString().slice(0, 10))).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
    const one = buildInstallmentPlan(new Prisma.Decimal("0.05"), 4, "2027-05-10");
    expect(one.map((p) => p.amount.toFixed(2))).toEqual(["0.01", "0.01", "0.01", "0.02"]);
  });
});
