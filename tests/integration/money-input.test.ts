import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { normalizeDecimalInput, parseDecimalInput } from "@petflow/shared";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

/**
 * Auditoria (bloco 1): valores digitados no padrão brasileiro ("150,00",
 * "1.234,56", "R$ 12,50") são aceitos em caixa, PDV, financeiro, produto e
 * serviço.
 */

const PASSWORD = "SenhaForte123!";
let app: INestApplication;
let prisma: PrismaService;
let cookie: string;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  await resetDatabase(prisma);
  const company = await prisma.company.create({ data: { name: "Loja Vírgula", slug: "loja-virgula" } });
  await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Admin",
      email: "admin@virgula.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: "ADMIN",
    },
  });
  const res = await http().post("/api/auth/login").send({ email: "admin@virgula.test", password: PASSWORD });
  cookie = sessionCookieFrom(res);
});

afterAll(async () => {
  await resetDatabase(prisma);
  await app.close();
});

describe("normalização (pura)", () => {
  it("aceita vírgula decimal, milhar com ponto, R$ e ponto decimal", () => {
    expect(normalizeDecimalInput("150,00")).toBe("150.00");
    expect(normalizeDecimalInput("1.234,56")).toBe("1234.56");
    expect(normalizeDecimalInput("R$ 12,50")).toBe("12.50");
    expect(normalizeDecimalInput(" 99.90 ")).toBe("99.90");
    expect(normalizeDecimalInput("1.5")).toBe("1.5");
    expect(parseDecimalInput("2,5")).toBe(2.5);
    expect(parseDecimalInput("abc")).toBeNaN();
  });
});

describe("rotas aceitam valores com vírgula", () => {
  it("abre o caixa, lança movimento e fecha com vírgula", async () => {
    const open = await http().post("/api/cash/sessions").set("Cookie", cookie).send({ initialAmount: "150,00" });
    expect(open.status).toBe(201);
    expect(open.body.initialAmount).toBe("150.00");

    const movement = await http()
      .post("/api/cash/movements")
      .set("Cookie", cookie)
      .send({ type: "IN", amount: "R$ 10,50", description: "Reforço" });
    expect(movement.status).toBe(201);
    expect(movement.body.amount).toBe("10.50");
  });

  it("produto, serviço, venda com desconto e conta a pagar", async () => {
    const product = await http()
      .post("/api/products")
      .set("Cookie", cookie)
      .send({ name: "Caderno", costPrice: "8,40", salePrice: "1.234,56", unit: "UNIDADE" });
    expect(product.status).toBe(201);
    expect(product.body.salePrice).toBe("1234.56");
    expect(product.body.costPrice).toBe("8.40");

    const service = await http().post("/api/services").set("Cookie", cookie).send({ name: "Instalação", price: "80,00" });
    expect(service.status).toBe(201);
    expect(service.body.price).toBe("80.00");

    await prisma.product.update({ where: { id: product.body.id }, data: { stockQuantity: 5 } });
    const sale = await http()
      .post("/api/sales")
      .set("Cookie", cookie)
      .send({
        items: [{ productId: product.body.id, quantity: "1" }],
        discount: "34,56",
        paymentMethod: "CASH",
        clientRequestId: "venda-virgula-1",
      });
    expect(sale.status).toBe(201);
    expect(sale.body.discount).toBe("34.56");
    expect(sale.body.total).toBe("1200.00");

    const payable = await http()
      .post("/api/financial")
      .set("Cookie", cookie)
      .send({ direction: "PAYABLE", description: "Aluguel", amount: "2.500,00", dueDate: "2026-12-10" });
    expect(payable.status).toBe(201);
    expect(payable.body.amount).toBe("2500.00");
  });

  it("valor inválido continua 400", async () => {
    const bad = await http().post("/api/services").set("Cookie", cookie).send({ name: "Inválido", price: "12,3,4" });
    expect(bad.status).toBe(400);
  });
});
