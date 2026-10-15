import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import type { TenantContext } from "../../apps/api/src/common/tenant/tenant-context.service";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;
let tenantContext: TenantContext;

let companyAId: string;
let companyBId: string;
let clientAId: string;
let clientBId: string;

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
  const { TenantContext: TenantContextClass } = (await import(
    "../../apps/api/src/common/tenant/tenant-context.service"
  )) as { TenantContext: new () => TenantContext };
  tenantContext = app.get(TenantContextClass as never) as TenantContext;

  await resetDatabase(prisma);

  const companyA = await prisma.company.create({
    data: { name: "Empresa Guard A", slug: "guard-a" },
  });
  const companyB = await prisma.company.create({
    data: { name: "Empresa Guard B", slug: "guard-b" },
  });
  companyAId = companyA.id;
  companyBId = companyB.id;

  for (const [companyId, email, role] of [
    [companyA.id, "admin@guard-a.test", "ADMIN"],
    [companyB.id, "admin@guard-b.test", "ADMIN"],
  ] as const) {
    await prisma.user.create({
      data: {
        companyId,
        name: "Admin",
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role,
      },
    });
  }

  clientAId = (
    await prisma.client.create({
      data: { companyId: companyAId, name: "Cliente A", nameKey: "cliente a" },
    })
  ).id;
  clientBId = (
    await prisma.client.create({
      data: { companyId: companyBId, name: "Cliente B", nameKey: "cliente b" },
    })
  ).id;
});

afterAll(async () => {
  await app.close();
});

describe("Guard ORM de tenant (N4 — ADR-0001)", () => {
  it("injeta companyId em findMany sem where: só vê a empresa do contexto", async () => {
    const rows = await tenantContext.run({ companyId: companyAId, userId: "u" }, async () =>
      prisma.client.findMany({ select: { id: true } }),
    );
    expect(rows.map((r) => r.id)).toEqual([clientAId]);
  });

  it("findFirst por id de outra empresa retorna null (AND injetado)", async () => {
    const found = await tenantContext.run({ companyId: companyAId, userId: "u" }, async () =>
      prisma.client.findFirst({ where: { id: clientBId } }),
    );
    expect(found).toBeNull();

    const own = await tenantContext.run({ companyId: companyAId, userId: "u" }, async () =>
      prisma.client.findFirst({ where: { id: clientAId } }),
    );
    expect(own?.id).toBe(clientAId);
  });

  it("bloqueia leitura com companyId divergente no where (403)", async () => {
    await expect(
      tenantContext.run({ companyId: companyAId, userId: "u" }, async () =>
        prisma.client.findMany({ where: { companyId: companyBId } }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("bloqueia escrita com companyId divergente no data (403)", async () => {
    await expect(
      tenantContext.run({ companyId: companyAId, userId: "u" }, async () =>
        prisma.client.create({
          data: { companyId: companyBId, name: "Invasor", nameKey: "invasor" },
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("updateMany respeita a injeção: não altera linhas de outra empresa", async () => {
    const result = await tenantContext.run({ companyId: companyAId, userId: "u" }, async () =>
      prisma.client.updateMany({ data: { notes: "tocou" } }),
    );
    expect(result.count).toBe(1);

    const untouched = await prisma.client.findUniqueOrThrow({ where: { id: clientBId } });
    expect(untouched.notes).toBeNull();

    await prisma.client.updateMany({ data: { notes: null } });
  });

  it("sem contexto (fail-open) o guard é transparente", async () => {
    // Fora do tenantContext.run — mesmo comportamento do Prisma puro.
    const rows = await prisma.client.findMany({ select: { id: true } });
    expect(rows).toHaveLength(2);
  });

  it("modelo global (TenantPlan) não é filtrado mesmo com contexto", async () => {
    const plans = await tenantContext.run({ companyId: companyAId, userId: "u" }, () =>
      prisma.tenantPlan.findMany({ select: { id: true } }),
    );
    expect(plans.length).toBeGreaterThanOrEqual(3);
  });

  it("HTTP autenticado permanece funcionando (guard transparente na prática)", async () => {
    const cookie = await login("admin@guard-a.test");
    const res = await request(app.getHttpServer())
      .get("/api/clients")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.items.map((c: { id: string }) => c.id)).toEqual([clientAId]);
  });
});
