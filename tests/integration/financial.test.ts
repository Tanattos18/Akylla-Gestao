import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;

let clientAId: string;
let supplierAId: string;
let cashSessionId: string;

interface CreatedEntry {
  id: string;
  direction: "PAYABLE" | "RECEIVABLE";
  status: "OPEN" | "PAID" | "CANCELLED";
  amount: string;
  dueDate: string;
  description: string;
  paidAt: string | null;
  cancelReason: string | null;
  clientId: string | null;
  cashMovementId: string | null;
  createdBy: { name: string } | null;
  client: { name: string } | null;
  supplier: { name: string } | null;
}

async function createCompany(slug: string) {
  return prisma.company.create({ data: { name: `Empresa ${slug}`, slug } });
}

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

async function createEntry(
  cookie: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: CreatedEntry }> {
  const response = await request(app.getHttpServer())
    .post("/api/financial")
    .set("Cookie", cookie)
    .send(body);
  if (response.status !== 201) {
    throw new Error(
      `Criação de título falhou: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return { status: response.status, body: response.body };
}

async function cashSummary(cookie: string) {
  const response = await request(app.getHttpServer())
    .get("/api/cash/summary")
    .set("Cookie", cookie);
  if (response.status !== 200) {
    throw new Error(`Resumo de caixa falhou: ${response.status}`);
  }
  return response.body as { totalIn: string; totalOut: string; net: string };
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("fin-a");
  const companyB = await createCompany("fin-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin Financeiro",
    email: "admin@fin-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro Financeiro",
    email: "membro@fin-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B Financeiro",
    email: "admin@fin-b.test",
    role: "ADMIN",
  });

  adminACookie = await login("admin@fin-a.test");
  memberACookie = await login("membro@fin-a.test");
  adminBCookie = await login("admin@fin-b.test");

  const client = await request(app.getHttpServer())
    .post("/api/clients")
    .set("Cookie", adminACookie)
    .send({ name: "Cliente Título" });
  if (client.status !== 201) {
    throw new Error(`Criação de cliente falhou: ${client.status}`);
  }
  clientAId = client.body.id;

  const supplier = await request(app.getHttpServer())
    .post("/api/suppliers")
    .set("Cookie", adminACookie)
    .send({ name: "Fornecedor Título" });
  if (supplier.status !== 201) {
    throw new Error(`Criação de fornecedor falhou: ${supplier.status}`);
  }
  supplierAId = supplier.body.id;

  const session = await request(app.getHttpServer())
    .post("/api/cash/sessions")
    .set("Cookie", adminACookie)
    .send({ initialAmount: "300.00" });
  if (session.status !== 201) {
    throw new Error(`Abertura de caixa falhou: ${session.status}`);
  }
  cashSessionId = session.body.id;
});

afterAll(async () => {
  await app?.close();
});

describe("Criação e validações", () => {
  it("cria título a receber vinculado ao cliente", async () => {
    const { body } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Mensalidade do cliente",
      amount: "120.00",
      dueDate: "2026-10-20",
      clientId: clientAId,
    });

    expect(body.direction).toBe("RECEIVABLE");
    expect(body.status).toBe("OPEN");
    expect(body.amount).toBe("120.00");
    expect(body.clientId).toBe(clientAId);
    expect(body.client?.name).toBe("Cliente Título");
    expect(body.paidAt).toBeNull();
    expect(body.cashMovementId).toBeNull();
    expect(body.createdBy?.name).toBe("Admin Financeiro");
  });

  it("cria título a pagar vinculado ao fornecedor", async () => {
    const { body } = await createEntry(adminACookie, {
      direction: "PAYABLE",
      description: "Nota de compra de ração",
      amount: "45.90",
      dueDate: "2026-10-25",
      supplierId: supplierAId,
    });

    expect(body.direction).toBe("PAYABLE");
    expect(body.status).toBe("OPEN");
    expect(body.amount).toBe("45.90");
    expect(body.supplier?.name).toBe("Fornecedor Título");
  });

  it("rejeita valor com mais de 2 casas decimais (400)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", adminACookie)
      .send({
        direction: "PAYABLE",
        description: "Valor com 3 casas",
        amount: "10.999",
        dueDate: "2026-10-20",
      });

    expect(response.status).toBe(400);
  });

  it("rejeita valor zero e negativo (400)", async () => {
    const zero = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", adminACookie)
      .send({
        direction: "RECEIVABLE",
        description: "Valor zero",
        amount: "0",
        dueDate: "2026-10-20",
      });
    expect(zero.status).toBe(400);

    const negative = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", adminACookie)
      .send({
        direction: "RECEIVABLE",
        description: "Valor negativo",
        amount: "-5.00",
        dueDate: "2026-10-20",
      });
    expect(negative.status).toBe(400);
  });

  it("rejeita vencimento fora do formato YYYY-MM-DD (400)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", adminACookie)
      .send({
        direction: "PAYABLE",
        description: "Data inválida",
        amount: "10.00",
        dueDate: "20/10/2026",
      });

    expect(response.status).toBe(400);
  });

  it("rejeita cliente inexistente ou de outra empresa (400)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", adminACookie)
      .send({
        direction: "RECEIVABLE",
        description: "Cliente inválido",
        amount: "10.00",
        dueDate: "2026-10-20",
        clientId: "cliente-que-nao-existe",
      });

    expect(response.status).toBe(400);
  });

  it("reenvio com o mesmo clientRequestId retorna 409 (idempotência)", async () => {
    const payload = {
      direction: "PAYABLE",
      description: "Título idempotente",
      amount: "33.30",
      dueDate: "2026-10-30",
      clientRequestId: "fin-req-idempotente-01",
    };

    const first = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", adminACookie)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", adminACookie)
      .send(payload);
    expect(second.status).toBe(409);
  });
});

describe("Liquidação e saldos", () => {
  it("líquida título a receber e soma no total de entradas do caixa", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Recebimento de teste",
      amount: "100.00",
      dueDate: "2026-10-18",
    });

    const before = await cashSummary(adminACookie);

    const pay = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});
    expect(pay.status).toBe(201);
    expect(pay.body.status).toBe("PAID");
    expect(pay.body.paidAt).toBeTruthy();
    expect(pay.body.cashMovementId).toBeTruthy();

    const after = await cashSummary(adminACookie);
    expect(Number(after.totalIn) - Number(before.totalIn)).toBe(100);

    const movement = await prisma.cashMovement.findUnique({
      where: { id: pay.body.cashMovementId },
    });
    expect(movement).not.toBeNull();
    expect(movement?.origin).toBe("ACCOUNT");
    expect(movement?.type).toBe("IN");
    expect(movement?.inCash).toBe(true);
    expect(movement?.amount.toFixed(2)).toBe("100.00");
  });

  it("líquida título a pagar como saída do caixa", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "PAYABLE",
      description: "Pagamento de teste",
      amount: "40.00",
      dueDate: "2026-10-18",
    });

    const before = await cashSummary(adminACookie);

    const pay = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});
    expect(pay.status).toBe(201);
    expect(pay.body.status).toBe("PAID");

    const after = await cashSummary(adminACookie);
    expect(Number(after.totalOut) - Number(before.totalOut)).toBe(40);

    const movement = await prisma.cashMovement.findUnique({
      where: { id: pay.body.cashMovementId },
    });
    expect(movement?.origin).toBe("ACCOUNT");
    expect(movement?.type).toBe("OUT");
  });

  it("membro comum não lança nem liquida títulos (auditoria bloco 3)", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", memberACookie)
      .send({ direction: "PAYABLE", description: "Pagamento por membro", amount: "10.00", dueDate: "2026-10-18" });
    expect(created.status).toBe(403);

    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Liquidação por membro",
      amount: "10.00",
      dueDate: "2026-10-18",
    });
    const pay = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", memberACookie)
      .send({});
    expect(pay.status).toBe(403);
  });

  it("Pix e boleto não entram na gaveta; dinheiro entra (inCash pela forma)", async () => {
    const balance = async () =>
      Number(
        (await request(app.getHttpServer()).get("/api/cash/sessions/current").set("Cookie", adminACookie)).body
          .expectedBalance,
      );
    const before = await balance();

    const { body: pix } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Recebido por Pix",
      amount: "50,00",
      dueDate: "2026-10-18",
    });
    const paidPix = await request(app.getHttpServer())
      .post(`/api/financial/${pix.id}/pay`)
      .set("Cookie", adminACookie)
      .send({ paymentMethod: "PIX" });
    expect(paidPix.status).toBe(201);
    const pixMovement = await prisma.cashMovement.findFirstOrThrow({ where: { id: paidPix.body.cashMovementId } });
    expect(pixMovement.inCash).toBe(false);
    expect(pixMovement.description).toContain("Pix");
    expect(await balance()).toBe(before);

    const { body: cash } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Recebido em dinheiro",
      amount: "20,00",
      dueDate: "2026-10-18",
    });
    await request(app.getHttpServer()).post(`/api/financial/${cash.id}/pay`).set("Cookie", adminACookie).send({}).expect(201);
    expect(await balance()).toBe(before + 20);

    const bad = await request(app.getHttpServer())
      .post(`/api/financial/${cash.id}/pay`)
      .set("Cookie", adminACookie)
      .send({ paymentMethod: "CHEQUE" });
    expect(bad.status).toBe(400);
  });

  it("segunda liquidação do mesmo título retorna 409", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Título para dupla liquidação",
      amount: "20.00",
      dueDate: "2026-10-18",
    });

    const first = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});
    expect(second.status).toBe(409);
  });

  it("liquidação com o caixa fechado retorna 409", async () => {
    const close = await request(app.getHttpServer())
      .post(`/api/cash/sessions/${cashSessionId}/close`)
      .set("Cookie", adminACookie)
      .send({ countedAmount: "300.00" });
    expect(close.status).toBe(201);

    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Título com caixa fechado",
      amount: "15.00",
      dueDate: "2026-10-18",
    });

    const pay = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});
    expect(pay.status).toBe(409);

    const reopen = await request(app.getHttpServer())
      .post("/api/cash/sessions")
      .set("Cookie", adminACookie)
      .send({ initialAmount: "300.00" });
    expect(reopen.status).toBe(201);
    cashSessionId = reopen.body.id;
  });
});

describe("Cancelamento e estorno auditáveis", () => {
  it("cancela título em aberto com motivo registrado", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "PAYABLE",
      description: "Título para cancelar",
      amount: "55.00",
      dueDate: "2026-10-22",
    });

    const cancel = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Lançamento duplicado" });

    expect(cancel.status).toBe(201);
    expect(cancel.body.status).toBe("CANCELLED");
    expect(cancel.body.cancelReason).toBe("Lançamento duplicado");

    const stored = await prisma.financialEntry.findUnique({ where: { id: entry.id } });
    expect(stored?.status).toBe("CANCELLED");
  });

  it("cancelamento sem motivo é rejeitado (400)", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "PAYABLE",
      description: "Título sem motivo",
      amount: "10.00",
      dueDate: "2026-10-22",
    });

    const response = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "ab" });

    expect(response.status).toBe(400);
  });

  it("membro comum não pode cancelar (403)", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "PAYABLE",
      description: "Título protegido de cancelamento",
      amount: "12.00",
      dueDate: "2026-10-22",
    });

    const response = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/cancel`)
      .set("Cookie", memberACookie)
      .send({ reason: "Motivo de membro" });

    expect(response.status).toBe(403);
  });

  it("cancelar título já liquidado retorna 409", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Título pago para cancelar",
      amount: "70.00",
      dueDate: "2026-10-22",
    });

    await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});

    const cancel = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/cancel`)
      .set("Cookie", adminACookie)
      .send({ reason: "Tentativa após pagamento" });

    expect(cancel.status).toBe(409);
  });

  it("estorna liquidação e devolve o valor do caixa com lançamento compensatório", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Recebimento para estornar",
      amount: "80.00",
      dueDate: "2026-10-19",
    });

    const pay = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});
    expect(pay.status).toBe(201);

    const before = await cashSummary(adminACookie);

    const reverse = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/reverse`)
      .set("Cookie", adminACookie)
      .send({ reason: "Cobrança contestada" });

    expect(reverse.status).toBe(201);
    expect(reverse.body.status).toBe("OPEN");
    expect(reverse.body.paidAt).toBeNull();
    expect(reverse.body.cashMovementId).toBeNull();

    const after = await cashSummary(adminACookie);
    expect(Number(after.net) - Number(before.net)).toBe(-80);

    const summary = await request(app.getHttpServer())
      .get("/api/financial/summary")
      .set("Cookie", adminACookie);
    expect(summary.status).toBe(200);
    expect(Number(summary.body.paidInTotal)).toBeGreaterThan(0);
    expect(summary.body.openReceivablesCount).toBeGreaterThan(0);

    const original = await prisma.cashMovement.findUnique({
      where: { id: pay.body.cashMovementId },
    });
    expect(original?.reversedAt).not.toBeNull();
    expect(original?.reversalReason).toBe("Cobrança contestada");

    const compensatory = await prisma.cashMovement.findFirst({
      where: { reversalOfId: pay.body.cashMovementId },
    });
    expect(compensatory).not.toBeNull();
    expect(compensatory?.origin).toBe("REVERSAL");
    expect(compensatory?.type).toBe("OUT");
    expect(compensatory?.amount.toFixed(2)).toBe("80.00");
    expect(compensatory?.justification).toBe("Cobrança contestada");
  });

  it("estorno sem motivo é rejeitado (400)", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Estorno sem motivo",
      amount: "25.00",
      dueDate: "2026-10-19",
    });

    await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});

    const response = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/reverse`)
      .set("Cookie", adminACookie)
      .send({ reason: "x" });

    expect(response.status).toBe(400);
  });

  it("membro comum não pode estornar (403)", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Estorno restrito",
      amount: "35.00",
      dueDate: "2026-10-19",
    });

    await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});

    const response = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/reverse`)
      .set("Cookie", memberACookie)
      .send({ reason: "Tentativa de membro" });

    expect(response.status).toBe(403);
  });

  it("segundo estorno do mesmo título retorna 409", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Duplo estorno",
      amount: "44.00",
      dueDate: "2026-10-19",
    });

    await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminACookie)
      .send({});

    const first = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/reverse`)
      .set("Cookie", adminACookie)
      .send({ reason: "Primeiro estorno" });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/reverse`)
      .set("Cookie", adminACookie)
      .send({ reason: "Segundo estorno" });
    expect(second.status).toBe(409);
  });
});

describe("Filtros por período e status", () => {
  it("filtra por direção e status na listagem", async () => {
    const { body: openEntry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Filtro em aberto",
      amount: "11.00",
      dueDate: "2026-11-05",
    });

    const openList = await request(app.getHttpServer())
      .get("/api/financial?direction=RECEIVABLE&status=OPEN")
      .set("Cookie", adminACookie);
    expect(openList.status).toBe(200);
    expect(openList.body.items.length).toBeGreaterThan(0);
    expect(
      openList.body.items.every(
        (item: { direction: string; status: string }) =>
          item.direction === "RECEIVABLE" && item.status === "OPEN",
      ),
    ).toBe(true);
    expect(
      openList.body.items.some((item: { id: string }) => item.id === openEntry.id),
    ).toBe(true);

    const cancelledList = await request(app.getHttpServer())
      .get("/api/financial?status=CANCELLED")
      .set("Cookie", adminACookie);
    expect(cancelledList.status).toBe(200);
    expect(
      cancelledList.body.items.every(
        (item: { status: string }) => item.status === "CANCELLED",
      ),
    ).toBe(true);
  });

  it("filtra por período de vencimento", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/financial?from=2026-11-01&to=2026-11-30")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(
      response.body.items.every(
        (item: { dueDate: string }) =>
          item.dueDate.slice(0, 10) >= "2026-11-01" &&
          item.dueDate.slice(0, 10) <= "2026-11-30",
      ),
    ).toBe(true);
  });

  it("resumo por período futuro retorna zeros", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/financial/summary?from=2099-01-01&to=2099-12-31")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.body.openPayablesTotal).toBe("0.00");
    expect(response.body.openReceivablesTotal).toBe("0.00");
    expect(response.body.paidInTotal).toBe("0.00");
    expect(response.body.paidOutTotal).toBe("0.00");
    expect(response.body.overduePayablesTotal).toBe("0.00");
  });

  it("resumo reflete títulos liquidados no período (paidIn/paidOut)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/financial/summary")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(Number(response.body.paidInTotal)).toBeGreaterThan(0);
    expect(Number(response.body.paidOutTotal)).toBeGreaterThan(0);
    expect(response.body.paidInCount).toBeGreaterThan(0);
    expect(response.body.paidOutCount).toBeGreaterThan(0);
    expect(response.body.cancelledCount).toBeGreaterThan(0);
  });
});

describe("Isolamento entre empresas (A × B)", () => {
  it("admin B não lista títulos da empresa A", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/financial")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    expect(response.body.items).toHaveLength(0);
  });

  it("admin B não lê, edita nem liquida título da empresa A (404)", async () => {
    const { body: entry } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Título privado da A",
      amount: "99.00",
      dueDate: "2026-10-28",
    });

    const read = await request(app.getHttpServer())
      .get(`/api/financial/${entry.id}`)
      .set("Cookie", adminBCookie);
    expect(read.status).toBe(404);

    const update = await request(app.getHttpServer())
      .patch(`/api/financial/${entry.id}`)
      .set("Cookie", adminBCookie)
      .send({ description: "Invadindo" });
    expect(update.status).toBe(404);

    const pay = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/pay`)
      .set("Cookie", adminBCookie)
      .send({});
    expect(pay.status).toBe(404);

    const cancel = await request(app.getHttpServer())
      .post(`/api/financial/${entry.id}/cancel`)
      .set("Cookie", adminBCookie)
      .send({ reason: "Invasão cancelada" });
    expect(cancel.status).toBe(404);

    const stored = await prisma.financialEntry.findUnique({ where: { id: entry.id } });
    expect(stored?.status).toBe("OPEN");
    expect(stored?.description).toBe("Título privado da A");
  });

  it("admin B não enxerga títulos da A no resumo", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/financial/summary")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.openPayablesCount).toBe(0);
    expect(response.body.openReceivablesCount).toBe(0);
    expect(response.body.paidInCount).toBe(0);
    expect(response.body.cancelledCount).toBe(0);
  });
});

describe("Arredondamento e decimais", () => {
  it("preserva 2 casas decimais na gravação", async () => {
    const { body } = await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Valor com centavos",
      amount: "1999.99",
      dueDate: "2026-10-27",
    });

    expect(body.amount).toBe("1999.99");

    const stored = await prisma.financialEntry.findUnique({ where: { id: body.id } });
    expect(stored?.amount.toFixed(2)).toBe("1999.99");
  });

  it("normaliza 1 casa decimal para 2 casas", async () => {
    const { body } = await createEntry(adminACookie, {
      direction: "PAYABLE",
      description: "Valor com uma casa decimal",
      amount: "10.5",
      dueDate: "2026-10-27",
    });

    expect(body.amount).toBe("10.50");
  });

  it("resumo soma títulos em aberto com precisão decimal", async () => {
    await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Fracionado 1",
      amount: "0.05",
      dueDate: "2026-12-01",
    });
    await createEntry(adminACookie, {
      direction: "RECEIVABLE",
      description: "Fracionado 2",
      amount: "0.95",
      dueDate: "2026-12-01",
    });

    const list = await request(app.getHttpServer())
      .get("/api/financial?direction=RECEIVABLE&status=OPEN")
      .set("Cookie", adminACookie);
    expect(list.status).toBe(200);

    const listSum = list.body.items.reduce(
      (total: number, item: { amount: string }) => total + Number(item.amount),
      0,
    );

    const summary = await request(app.getHttpServer())
      .get("/api/financial/summary")
      .set("Cookie", adminACookie);
    expect(summary.status).toBe(200);
    expect(summary.body.openReceivablesCount).toBe(list.body.total);
    expect(Number(summary.body.openReceivablesTotal)).toBeCloseTo(listSum, 2);
    expect(summary.body.openReceivablesTotal).toMatch(/^\d+\.\d{2}$/);
  });
});
