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
let categoryBId: string;
let supplierBId: string;
let companyAId: string;

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

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("catalogo-a");
  const companyB = await createCompany("catalogo-b");
  companyAId = companyA.id;

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@catalogo-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@catalogo-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@catalogo-b.test",
    role: "ADMIN",
  });

  const categoryB = await prisma.category.create({
    data: { companyId: companyB.id, name: "Rações", nameKey: "rações" },
  });
  categoryBId = categoryB.id;
  const supplierB = await prisma.supplier.create({
    data: { companyId: companyB.id, name: "Fornecedor B" },
  });
  supplierBId = supplierB.id;

  adminACookie = await login("admin@catalogo-a.test");
  memberACookie = await login("membro@catalogo-a.test");
  adminBCookie = await login("admin@catalogo-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("Categorias — CRUD e validação", () => {
  let categoryAId: string;

  it("cria categoria normalizando o nome para unicidade", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminACookie)
      .send({ name: "  Ração Premium ", description: "Rações premium" });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Ração Premium");
    categoryAId = response.body.id;
  });

  it("rejeita nome duplicado na mesma empresa (case-insensitive)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminACookie)
      .send({ name: "RAÇÃO PREMIUM" });

    expect(response.status).toBe(409);
  });

  it("permite o mesmo nome de categoria em outra empresa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminBCookie)
      .send({ name: "Ração Premium" });

    expect(response.status).toBe(201);
  });

  it("rejeita criação sem permissão administrativa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", memberACookie)
      .send({ name: "Membro Não Pode" });

    expect(response.status).toBe(403);
  });

  it("lista apenas categorias da empresa autenticada", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/categories")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    const names = response.body.items.map((item: { name: string }) => item.name);
    expect(names).toContain("Ração Premium");
    expect(response.body.items.every((item: { id: string }) => item.id !== categoryBId)).toBe(
      true,
    );
  });

  it("rejeita payload inválido (nome curto)", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Cookie", adminACookie)
      .send({ name: "A" });

    expect(response.status).toBe(400);
  });

  it("edita categoria e inativa com status", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/categories/${categoryAId}`)
      .set("Cookie", adminACookie)
      .send({ description: "Atualizada" });
    expect(updated.status).toBe(200);
    expect(updated.body.description).toBe("Atualizada");

    const inactive = await request(app.getHttpServer())
      .patch(`/api/categories/${categoryAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });
    expect(inactive.status).toBe(200);
    expect(inactive.body.status).toBe("INACTIVE");
  });

  it("não permite acessar categoria de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/categories/${categoryBId}`)
      .set("Cookie", adminACookie);

    expect(response.status).toBe(404);
  });

  it("exige autenticação", async () => {
    const response = await request(app.getHttpServer()).get("/api/categories");
    expect(response.status).toBe(401);
  });
});

describe("Fornecedores — CRUD e isolamento", () => {
  let supplierAId: string;

  it("cria fornecedor com dados opcionais vazios como null", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/suppliers")
      .set("Cookie", adminACookie)
      .send({ name: "Pet Distribuidora", document: "", phone: "(11) 99999-0000" });

    expect(response.status).toBe(201);
    expect(response.body.document).toBeNull();
    expect(response.body.phone).toBe("(11) 99999-0000");
    supplierAId = response.body.id;
  });

  it("rejeita criação sem permissão administrativa", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/suppliers")
      .set("Cookie", memberACookie)
      .send({ name: "Não Pode" });

    expect(response.status).toBe(403);
  });

  it("edita e inativa fornecedor", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/suppliers/${supplierAId}`)
      .set("Cookie", adminACookie)
      .send({ email: "contato@petdist.com" });
    expect(updated.status).toBe(200);
    expect(updated.body.email).toBe("contato@petdist.com");

    const inactive = await request(app.getHttpServer())
      .patch(`/api/suppliers/${supplierAId}/status`)
      .set("Cookie", adminACookie)
      .send({ status: "INACTIVE" });
    expect(inactive.status).toBe(200);
    expect(inactive.body.status).toBe("INACTIVE");
  });

  it("lista apenas fornecedores da empresa autenticada", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/suppliers")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(
      response.body.items.every((item: { id: string }) => item.id !== supplierBId),
    ).toBe(true);
  });

  it("não permite editar fornecedor de outra empresa (404)", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/suppliers/${supplierBId}`)
      .set("Cookie", adminACookie)
      .send({ name: "Tentativa" });

    expect(response.status).toBe(404);
  });

  it("cria fornecedor somente com nome — documento, email e telefone opcionais", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/suppliers")
      .set("Cookie", adminACookie)
      .send({ name: "Distribuidora Só Nome" });

    expect(response.status).toBe(201);
    expect(response.body.document).toBeNull();
    expect(response.body.email).toBeNull();
    expect(response.body.phone).toBeNull();
  });

  it("busca fornecedor por nome, email, telefone ou documento", async () => {
    const withDocument = await request(app.getHttpServer())
      .post("/api/suppliers")
      .set("Cookie", adminACookie)
      .send({ name: "Fornecedor Com Documento", document: "12345678000190" });
    expect(withDocument.status).toBe(201);

    const byEmail = await request(app.getHttpServer())
      .get("/api/suppliers")
      .query({ search: "petdist" })
      .set("Cookie", adminACookie);
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.items.some((item: { id: string }) => item.id === supplierAId)).toBe(true);

    const byPhone = await request(app.getHttpServer())
      .get("/api/suppliers")
      .query({ search: "99999-0000" })
      .set("Cookie", adminACookie);
    expect(byPhone.status).toBe(200);
    expect(byPhone.body.items.some((item: { id: string }) => item.id === supplierAId)).toBe(true);

    const byDocument = await request(app.getHttpServer())
      .get("/api/suppliers")
      .query({ search: "12345678000190" })
      .set("Cookie", adminACookie);
    expect(byDocument.status).toBe(200);
    expect(
      byDocument.body.items.some((item: { id: string }) => item.id === withDocument.body.id),
    ).toBe(true);
  });

  it("pagina a listagem de fornecedores", async () => {
    const page1 = await request(app.getHttpServer())
      .get("/api/suppliers")
      .query({ page: 1, pageSize: 1 })
      .set("Cookie", adminACookie);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(1);
    expect(page1.body.page).toBe(1);
    expect(page1.body.total).toBeGreaterThanOrEqual(3);

    const page2 = await request(app.getHttpServer())
      .get("/api/suppliers")
      .query({ page: 2, pageSize: 1 })
      .set("Cookie", adminACookie);
    expect(page2.status).toBe(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.page).toBe(2);
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
  });

  it("inativar fornecedor preserva produtos vinculados e histórico", async () => {
    const product = await prisma.product.create({
      data: {
        companyId: companyAId,
        name: "Produto com Fornecedor Inativo",
        sku: "FOR-INAT-01",
        salePrice: "9.90",
        stockQuantity: 3,
        supplierId: supplierAId,
      },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/products/${product.id}`)
      .set("Cookie", adminACookie);
    expect(detail.status).toBe(200);
    expect(detail.body.supplier.id).toBe(supplierAId);

    const supplier = await request(app.getHttpServer())
      .get(`/api/suppliers/${supplierAId}`)
      .set("Cookie", adminACookie);
    expect(supplier.status).toBe(200);
    expect(supplier.body.status).toBe("INACTIVE");
  });
});
