import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

/** Fase 7 · 7.1 (dados da empresa) e 7.3 (busca global). */

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;
let companyAId: string;
let adminA: string;
let memberA: string;
let adminB: string;

async function setup(slug: string) {
  const company = await prisma.company.create({ data: { name: `Empresa ${slug}`, slug } });
  for (const role of ["ADMIN", "MEMBER"] as const) {
    await prisma.user.create({
      data: {
        companyId: company.id,
        name: `${role} ${slug}`,
        email: `${role.toLowerCase()}-${slug}@exemplo.test`,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role,
      },
    });
  }
  return company.id;
}

async function login(email: string) {
  const res = await request(app.getHttpServer()).post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return sessionCookieFrom(res);
}

const http = () => request(app.getHttpServer());

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  await resetDatabase(prisma);
  companyAId = await setup("perfil-a");
  const companyBId = await setup("perfil-b");
  adminA = await login("admin-perfil-a@exemplo.test");
  memberA = await login("member-perfil-a@exemplo.test");
  adminB = await login("admin-perfil-b@exemplo.test");

  // Dados para a busca: empresa A e B com nomes parecidos
  for (const [companyId, suffix] of [[companyAId, "A"], [companyBId, "B"]] as const) {
    await prisma.client.create({
      data: { companyId, name: `Joana Busca ${suffix}`, nameKey: `joana busca ${suffix.toLowerCase()}`, mobile: "11987654321" },
    });
    await prisma.product.create({
      data: { companyId, name: `Caneta Busca ${suffix}`, sku: `CAN-${suffix}`, salePrice: "3.50" },
    });
    await prisma.service.create({
      data: { companyId, name: `Corte Busca ${suffix}`, nameKey: `corte busca ${suffix.toLowerCase()}`, price: "40.00", durationMinutes: 30 },
    });
  }
});

afterAll(async () => {
  await resetDatabase(prisma);
  await app.close();
});

describe("dados da empresa (Fase 7 · 7.1)", () => {
  it("qualquer usuário lê o perfil; só ADMIN altera", async () => {
    const res = await http().get("/api/company").set("Cookie", memberA);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: companyAId, name: "Empresa perfil-a", slug: "perfil-a", document: null });
    expect((await http().patch("/api/company").set("Cookie", memberA).send({ name: "X Y" })).status).toBe(403);
  });

  it("ADMIN grava nome, CNPJ (só dígitos), telefone e endereço; a sessão devolve os dados", async () => {
    const res = await http()
      .patch("/api/company")
      .set("Cookie", adminA)
      .send({ name: "Empório Central", document: "11.222.333/0001-81", phone: "(11) 3333-4444", address: "Rua A, 10 - Centro" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Empório Central", document: "11222333000181", phone: "(11) 3333-4444" });
    const me = await http().get("/api/auth/me").set("Cookie", adminA);
    expect(me.body.company).toMatchObject({ name: "Empório Central", document: "11222333000181", address: "Rua A, 10 - Centro" });
  });

  it("documento inválido → 400; vazio remove", async () => {
    const bad = await http().patch("/api/company").set("Cookie", adminA).send({ document: "123" });
    expect(bad.status).toBe(400);
    expect(bad.body.issues[0].path).toBe("document");
    const cleared = await http().patch("/api/company").set("Cookie", adminA).send({ document: "" });
    expect(cleared.body.document).toBeNull();
    expect((await http().patch("/api/company").set("Cookie", adminA).send({})).status).toBe(400);
  });

  it("identificador: formato validado e único entre empresas (409)", async () => {
    expect((await http().patch("/api/company/slug").set("Cookie", adminA).send({ slug: "Com Espaço" })).status).toBe(400);
    expect((await http().patch("/api/company/slug").set("Cookie", adminA).send({ slug: "perfil-b" })).status).toBe(409);
    const ok = await http().patch("/api/company/slug").set("Cookie", adminA).send({ slug: "emporio-central" });
    expect(ok.status).toBe(200);
    expect(ok.body.slug).toBe("emporio-central");
    expect((await http().patch("/api/company/slug").set("Cookie", memberA).send({ slug: "outro" })).status).toBe(403);
  });
});

describe("busca global (Fase 7 · 7.3)", () => {
  it("exige sessão e ao menos 2 caracteres", async () => {
    expect((await http().get("/api/search?q=jo")).status).toBe(401);
    expect((await http().get("/api/search?q=j").set("Cookie", memberA)).status).toBe(400);
  });

  it("agrupa por tipo e só traz dados da própria empresa", async () => {
    const res = await http().get("/api/search?q=busca").set("Cookie", memberA);
    expect(res.status).toBe(200);
    const kinds = res.body.groups.map((g: { kind: string }) => g.kind);
    expect(kinds).toEqual(expect.arrayContaining(["client", "product", "service"]));
    const titles = res.body.groups.flatMap((g: { items: Array<{ title: string }> }) => g.items.map((i) => i.title));
    expect(titles.every((t: string) => t.endsWith(" A"))).toBe(true);
    const client = res.body.groups.find((g: { kind: string }) => g.kind === "client").items[0];
    expect(client.href).toMatch(/^\/clientes\//);
  });

  it("busca cliente pelo celular e produto pelo SKU", async () => {
    const phone = await http().get("/api/search?q=98765").set("Cookie", adminA);
    expect(phone.body.groups.find((g: { kind: string }) => g.kind === "client")?.items).toHaveLength(1);
    const sku = await http().get("/api/search?q=can-a").set("Cookie", adminA);
    expect(sku.body.groups.find((g: { kind: string }) => g.kind === "product")?.items[0].title).toBe("Caneta Busca A");
  });

  it("não traz tipos de módulos desligados", async () => {
    await http().patch("/api/company-modules").set("Cookie", adminB).send({ module: "SERVICES", status: "DISABLED" });
    const res = await http().get("/api/search?q=busca").set("Cookie", adminB);
    const kinds = res.body.groups.map((g: { kind: string }) => g.kind);
    expect(kinds).not.toContain("service");
    expect(kinds).toContain("product");
  });
});
