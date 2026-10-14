import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createHmac } from "node:crypto";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";
const WEBHOOK_SECRET = "petflow-test-app-secret";

let app: INestApplication;
let prisma: PrismaService;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;

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

  const companyA = await createCompany("modules-a");
  const companyB = await createCompany("modules-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@modules-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@modules-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@modules-b.test",
    role: "ADMIN",
  });

  adminACookie = await login("admin@modules-a.test");
  memberACookie = await login("membro@modules-a.test");
  adminBCookie = await login("admin@modules-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("CompanyModules — listagem padrão", () => {
  it("lista os 5 módulos desativáveis, todos ACTIVE por padrão (ausência de linha)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/company-modules")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(5);
    expect(response.body.map((entry: { module: string }) => entry.module).sort()).toEqual([
      "APPOINTMENTS",
      "PETS",
      "SERVICES",
      "SUBSCRIPTIONS",
      "WHATSAPP",
    ]);
    for (const entry of response.body) {
      expect(entry.status).toBe("ACTIVE");
      expect(typeof entry.label).toBe("string");
    }
  });

  it("MEMBER pode listar os módulos da própria empresa", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/company-modules")
      .set("Cookie", memberACookie);
    expect(response.status).toBe(200);
  });
});

describe("CompanyModules — ativação/desativação (ADMIN)", () => {
  it("rejeita corpo com módulo inválido (400)", async () => {
    const response = await request(app.getHttpServer())
      .patch("/api/company-modules")
      .set("Cookie", adminACookie)
      .send({ module: "FINANCEIRO", status: "DISABLED" });

    expect(response.status).toBe(400);
  });

  it("MEMBER não pode alterar módulos (403)", async () => {
    const response = await request(app.getHttpServer())
      .patch("/api/company-modules")
      .set("Cookie", memberACookie)
      .send({ module: "PETS", status: "DISABLED" });

    expect(response.status).toBe(403);
  });

  it("ADMIN desabilita PETS e o upsert é idempotente ao reativar", async () => {
    const disable = await request(app.getHttpServer())
      .patch("/api/company-modules")
      .set("Cookie", adminACookie)
      .send({ module: "PETS", status: "DISABLED" });

    expect(disable.status).toBe(200);
    expect(disable.body).toMatchObject({ module: "PETS", status: "DISABLED" });

    const disableAgain = await request(app.getHttpServer())
      .patch("/api/company-modules")
      .set("Cookie", adminACookie)
      .send({ module: "PETS", status: "DISABLED" });
    expect(disableAgain.status).toBe(200);
    expect(disableAgain.body).toMatchObject({ module: "PETS", status: "DISABLED" });

    const enable = await request(app.getHttpServer())
      .patch("/api/company-modules")
      .set("Cookie", adminACookie)
      .send({ module: "PETS", status: "ACTIVE" });

    expect(enable.status).toBe(200);
    expect(enable.body).toMatchObject({ module: "PETS", status: "ACTIVE" });
  });
});

describe("ModuleGuard — bloqueio de rotas do módulo desativado", () => {
  beforeAll(async () => {
    const companyId = (await prisma.company.findUniqueOrThrow({ where: { slug: "modules-a" } })).id;
    await prisma.companyModule.upsert({
      where: { companyId_module: { companyId, module: "PETS" } },
      create: { companyId, module: "PETS", status: "DISABLED" },
      update: { status: "DISABLED" },
    });
  });

  it("GET /api/pets retorna 403 quando PETS está desativado", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/pets")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("Módulo desativado");
  });

  it("POST /api/pets também retorna 403", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/pets")
      .set("Cookie", memberACookie)
      .send({ clientId: "qualquer", name: "Rex", species: "DOG" });

    expect(response.status).toBe(403);
  });

  it("outras empresas não são afetadas (cross-tenant): admin B acessa /api/pets normalmente", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/pets")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
  });

  it("módulos sem @RequireModule nunca são bloqueados: /api/clients continua 200", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/clients")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
  });

  it("reativar PETS devolve acesso (200)", async () => {
    const companyId = (await prisma.company.findUniqueOrThrow({ where: { slug: "modules-a" } })).id;
    await prisma.companyModule.update({
      where: { companyId_module: { companyId, module: "PETS" } },
      data: { status: "ACTIVE" },
    });

    const response = await request(app.getHttpServer())
      .get("/api/pets")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
  });
});

describe("ModuleGuard — módulo WHATSAPP e webhook público", () => {
  beforeAll(async () => {
    const companyId = (await prisma.company.findUniqueOrThrow({ where: { slug: "modules-a" } })).id;
    await prisma.companyModule.upsert({
      where: { companyId_module: { companyId, module: "WHATSAPP" } },
      create: { companyId, module: "WHATSAPP", status: "DISABLED" },
      update: { status: "DISABLED" },
    });
  });

  afterAll(async () => {
    const companyId = (await prisma.company.findUniqueOrThrow({ where: { slug: "modules-a" } })).id;
    await prisma.companyModule.update({
      where: { companyId_module: { companyId, module: "WHATSAPP" } },
      data: { status: "ACTIVE" },
    });
  });

  it("rotas internas do WhatsApp retornam 403 com o módulo desativado", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/whatsapp/config")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(403);
  });

  it("webhook permanece público: não recebe 403 de módulo desativado", async () => {
    const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex")}`;

    const response = await request(app.getHttpServer())
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signature)
      .send(raw);

    expect(response.status).not.toBe(403);
  });

  it("agenda (APPOINTMENTS) permanece acessível com WHATSAPP desativado", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/appointments")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(200);
  });
});
