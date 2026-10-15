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

  const companyA = await createCompany("lgpd-a");
  const companyB = await createCompany("lgpd-b");

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@lgpd-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@lgpd-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@lgpd-b.test",
    role: "ADMIN",
  });

  adminACookie = await login("admin@lgpd-a.test");
  memberACookie = await login("membro@lgpd-a.test");
  adminBCookie = await login("admin@lgpd-b.test");

  const clientA = await prisma.client.create({
    data: {
      companyId: companyA.id,
      name: "Maria Oliveira",
      nameKey: "maria oliveira",
      phone: "11999998888",
      email: "maria@exemplo.com",
      cpf: "12345678901",
    },
  });
  clientAId = clientA.id;
});

afterAll(async () => {
  await app.close();
});

describe("LGPD — consentimento", () => {
  it("registra consentimento de TERMS para o usuário autenticado", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/lgpd/consent")
      .set("Cookie", adminACookie)
      .send({ type: "TERMS", version: "1.0", role: "USER" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: "TERMS", role: "USER", version: "1.0" });
    expect(res.body.id).toBeTruthy();
  });

  it("registra consentimento para um cliente (papel CLIENT)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/lgpd/consent")
      .set("Cookie", adminACookie)
      .send({ type: "DATA_PROCESSING", version: "1.0", role: "CLIENT", clientId: clientAId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: "DATA_PROCESSING", role: "CLIENT" });
  });

  it("não registra consentimento de cliente de outra empresa", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/lgpd/consent")
      .set("Cookie", adminBCookie)
      .send({ type: "TERMS", version: "1.0", role: "CLIENT", clientId: clientAId });

    expect(res.status).toBe(404);
  });
});

describe("LGPD — portabilidade (data-export)", () => {
  it("exporta os dados do cliente para o ADMIN da própria empresa", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/lgpd/clients/${clientAId}/data-export`)
      .set("Cookie", adminACookie);

    expect(res.status).toBe(200);
    expect(res.body.client).toMatchObject({ name: "Maria Oliveira", email: "maria@exemplo.com" });
    expect(Array.isArray(res.body.consents)).toBe(true);
  });

  it("bloqueia exportação para MEMBER", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/lgpd/clients/${clientAId}/data-export`)
      .set("Cookie", memberACookie);

    expect(res.status).toBe(403);
  });

  it("responde 404 para cliente de outra empresa", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/lgpd/clients/${clientAId}/data-export`)
      .set("Cookie", adminBCookie);

    expect(res.status).toBe(404);
  });
});

describe("LGPD — anonimização (direito ao esquecimento)", () => {
  it("anonimiza o cliente preservando registros financeiros e assinaturas", async () => {
    const entryRes = await request(app.getHttpServer())
      .post("/api/financial")
      .set("Cookie", adminACookie)
      .send({
        direction: "RECEIVABLE",
        description: "Parcela de serviço",
        amount: "100.00",
        dueDate: "2026-12-01",
        clientId: clientAId,
      });
    expect(entryRes.status).toBe(201);
    const financialId = entryRes.body.id;

    const res = await request(app.getHttpServer())
      .delete(`/api/lgpd/clients/${clientAId}/anonymize`)
      .set("Cookie", adminACookie);

    expect(res.status).toBe(200);
    expect(res.body.retained).toMatchObject({ sales: 0, financialEntries: 1 });

    const client = await prisma.client.findUnique({ where: { id: clientAId } });
    expect(client?.name).toBe("Cliente anonimizado");
    expect(client?.email).toBeNull();
    expect(client?.cpf).toBeNull();
    expect(client?.phone).toBeNull();
    expect(client?.status).toBe("INACTIVE");

    const retained = await prisma.financialEntry.findUnique({ where: { id: financialId } });
    expect(retained).toBeTruthy();
    expect(retained?.clientId).toBe(clientAId);
  });

  it("bloqueia anonimização para MEMBER", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/lgpd/clients/${clientAId}/anonymize`)
      .set("Cookie", memberACookie);

    expect(res.status).toBe(403);
  });

  it("responde 404 ao anonimizar cliente de outra empresa", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/lgpd/clients/${clientAId}/anonymize`)
      .set("Cookie", adminBCookie);

    expect(res.status).toBe(404);
  });
});
