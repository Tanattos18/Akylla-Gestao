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

  const companyA = await prisma.company.create({
    data: { name: "Empresa Export A", slug: "export-a" },
  });
  const companyB = await prisma.company.create({
    data: { name: "Empresa Export B", slug: "export-b" },
  });

  for (const [companyId, prefix, role] of [
    [companyA.id, "export-a", "ADMIN"],
    [companyA.id, "membro-export-a", "MEMBER"],
    [companyB.id, "export-b", "ADMIN"],
  ] as const) {
    await prisma.user.create({
      data: {
        companyId,
        name: `User ${prefix}`,
        email: `user@${prefix}.test`,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role: role as "ADMIN" | "MEMBER",
      },
    });
  }

  await prisma.client.create({
    data: { companyId: companyA.id, name: "Cliente Só de A", nameKey: "cliente so de a" },
  });

  adminACookie = await login("user@export-a.test");
  memberACookie = await login("user@membro-export-a.test");
  adminBCookie = await login("user@export-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/company/export — portabilidade (N3)", () => {
  it("admin exporta todos os dados da própria empresa, sem segredos", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/company/export")
      .set("Cookie", adminACookie);

    expect(res.status).toBe(200);
    expect(res.body.company.slug).toBe("export-a");
    expect(res.body.exportedAt).toBeTruthy();
    expect(res.body.clients.map((c: { name: string }) => c.name)).toContain("Cliente Só de A");

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain("tokenHash");
  });

  it("não vaza dados de outra empresa", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/company/export")
      .set("Cookie", adminBCookie);

    expect(res.status).toBe(200);
    expect(res.body.company.slug).toBe("export-b");
    expect(res.body.clients).toHaveLength(0);
  });

  it("membro não exporta (403)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/company/export")
      .set("Cookie", memberACookie);

    expect(res.status).toBe(403);
  });

  it("exige sessão (401)", async () => {
    const res = await request(app.getHttpServer()).get("/api/company/export");
    expect(res.status).toBe(401);
  });
});
