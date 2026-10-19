import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;
let companyAId: string;
let companyBId: string;
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

async function modules(cookie: string): Promise<Record<string, string>> {
  const res = await request(app.getHttpServer()).get("/api/company-modules").set("Cookie", cookie);
  expect(res.status).toBe(200);
  return Object.fromEntries(res.body.map((m: { module: string; status: string }) => [m.module, m.status]));
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  await resetDatabase(prisma);
  companyAId = await setup("onb-a");
  companyBId = await setup("onb-b");
  adminA = await login("admin-onb-a@exemplo.test");
  memberA = await login("member-onb-a@exemplo.test");
  adminB = await login("admin-onb-b@exemplo.test");
});

afterAll(async () => {
  await resetDatabase(prisma);
  await app.close();
});

describe("onboarding por perfil (Fase 4)", () => {
  it("lista os 4 perfis em ordem", async () => {
    const res = await request(app.getHttpServer()).get("/api/onboarding/presets").set("Cookie", memberA);
    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual(["COMERCIO", "SERVICOS", "HIBRIDO", "PERSONALIZADO"]);
  });

  it("exige sessão", async () => {
    expect((await request(app.getHttpServer()).get("/api/onboarding/presets")).status).toBe(401);
    expect((await request(app.getHttpServer()).post("/api/onboarding/apply").send({ slug: "COMERCIO" })).status).toBe(401);
  });

  it("empresa nova começa sem onboarding", async () => {
    const res = await request(app.getHttpServer()).get("/api/onboarding/status").set("Cookie", memberA);
    expect(res.body).toEqual({ segment: null, completed: false, completedAt: null });
  });

  it("MEMBER não aplica perfil (403) e slug inválido → 400", async () => {
    expect((await request(app.getHttpServer()).post("/api/onboarding/apply").set("Cookie", memberA).send({ slug: "COMERCIO" })).status).toBe(403);
    expect((await request(app.getHttpServer()).post("/api/onboarding/apply").set("Cookie", adminA).send({ slug: "XPTO" })).status).toBe(400);
  });

  it("Comércio liga os módulos do perfil, desliga os demais e prepara o fiscal", async () => {
    const res = await request(app.getHttpServer()).post("/api/onboarding/apply").set("Cookie", adminA).send({ slug: "COMERCIO" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ segment: "COMERCIO", completed: true });
    const m = await modules(adminA);
    expect(m).toMatchObject({ FISCAL: "ACTIVE", COMMISSIONS: "ACTIVE", CREDIT: "ACTIVE", WHATSAPP: "ACTIVE", SERVICES: "DISABLED", APPOINTMENTS: "DISABLED", SERVICE_ORDERS: "DISABLED" });
    const fiscal = await prisma.fiscalConfig.findUnique({ where: { companyId: companyAId } });
    expect(fiscal).toMatchObject({ provider: "mock", active: false });
    // módulo desligado bloqueia a rota
    expect((await request(app.getHttpServer()).get("/api/service-orders").set("Cookie", adminA)).status).toBe(403);
  });

  it("é idempotente e permite trocar de perfil", async () => {
    await request(app.getHttpServer()).post("/api/onboarding/apply").set("Cookie", adminA).send({ slug: "COMERCIO" }).expect(200);
    expect(await prisma.fiscalConfig.count({ where: { companyId: companyAId } })).toBe(1);
    await request(app.getHttpServer()).post("/api/onboarding/apply").set("Cookie", adminA).send({ slug: "SERVICOS" }).expect(200);
    const m = await modules(adminA);
    expect(m).toMatchObject({ SERVICES: "ACTIVE", APPOINTMENTS: "ACTIVE", SERVICE_ORDERS: "ACTIVE", FISCAL: "DISABLED", CREDIT: "DISABLED" });
    expect((await request(app.getHttpServer()).get("/api/service-orders").set("Cookie", adminA)).status).toBe(200);
  });

  it("Personalizado conclui sem mexer nos módulos", async () => {
    const before = await modules(adminA);
    const res = await request(app.getHttpServer()).post("/api/onboarding/apply").set("Cookie", adminA).send({ slug: "PERSONALIZADO" });
    expect(res.body).toMatchObject({ segment: "PERSONALIZADO", completed: true });
    expect(await modules(adminA)).toEqual(before);
  });

  it("não afeta outra empresa", async () => {
    const res = await request(app.getHttpServer()).get("/api/onboarding/status").set("Cookie", adminB);
    expect(res.body.completed).toBe(false);
    expect(await prisma.companyModule.count({ where: { companyId: companyBId } })).toBe(0);
    expect(await prisma.fiscalConfig.count({ where: { companyId: companyBId } })).toBe(0);
  });
});
