import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

/**
 * Auditoria (bloco 5): listas paginadas com total e busca por digitação —
 * nada some depois do 100º cadastro (antes as telas pediam pageSize=100).
 */

const PASSWORD = "SenhaForte123!";
let app: INestApplication;
let prisma: PrismaService;
let cookie: string;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  await resetDatabase(prisma);
  const company = await prisma.company.create({ data: { name: "Loja Grande", slug: "loja-grande" } });
  await prisma.user.create({
    data: { companyId: company.id, name: "Admin", email: "admin@grande.test", passwordHash: await bcrypt.hash(PASSWORD, 4), role: "ADMIN" },
  });
  const names = Array.from({ length: 130 }, (_, i) => `Cliente ${String(i + 1).padStart(3, "0")}`);
  await prisma.client.createMany({
    data: names.map((name) => ({ companyId: company.id, name, nameKey: name.toLowerCase() })),
  });
  await prisma.supplier.createMany({
    data: Array.from({ length: 105 }, (_, i) => ({ companyId: company.id, name: `Fornecedor ${i + 1}` })),
  });
  cookie = sessionCookieFrom(await http().post("/api/auth/login").send({ email: "admin@grande.test", password: PASSWORD }));
});

afterAll(async () => {
  await resetDatabase(prisma);
  await app.close();
});

describe("listas paginadas", () => {
  it("clientes: total real, última página e busca acham o cliente 130", async () => {
    const first = await http().get("/api/clients?pageSize=20&page=1").set("Cookie", cookie);
    expect(first.body.total).toBe(130);
    expect(first.body.items).toHaveLength(20);

    const last = await http().get("/api/clients?pageSize=20&page=7").set("Cookie", cookie);
    expect(last.body.items).toHaveLength(10);
    expect(last.body.items.at(-1).name).toBe("Cliente 130");

    const search = await http().get("/api/clients?status=ACTIVE&pageSize=20&search=cliente%20130").set("Cookie", cookie);
    expect(search.body.total).toBe(1);
    expect(search.body.items[0].name).toBe("Cliente 130");
  });

  it("fornecedores: passa de 100 com página e total", async () => {
    const page6 = await http().get("/api/suppliers?pageSize=20&page=6").set("Cookie", cookie);
    expect(page6.body.total).toBe(105);
    expect(page6.body.items).toHaveLength(5);
  });

  it("pageSize acima de 100 é recusado (as telas paginam)", async () => {
    expect((await http().get("/api/clients?pageSize=500").set("Cookie", cookie)).status).toBe(400);
  });
});
