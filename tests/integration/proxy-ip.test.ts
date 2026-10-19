import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

/**
 * Auditoria (bloco 9): atrás do Caddy/Next (mesma máquina), o IP do cliente
 * vem do X-Forwarded-For — a conexão do teste é local (loopback), igual à do
 * proxy na VPS.
 */

const PASSWORD = "SenhaForte123!";
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  await resetDatabase(prisma);
  const company = await prisma.company.create({ data: { name: "Loja Proxy", slug: "loja-proxy" } });
  await prisma.user.create({
    data: { companyId: company.id, name: "Admin", email: "admin@proxy.test", passwordHash: await bcrypt.hash(PASSWORD, 4), role: "ADMIN" },
  });
});

afterAll(async () => {
  await resetDatabase(prisma);
  await app.close();
});

describe("IP real atrás do proxy local", () => {
  it("sessão grava o IP do cliente informado pelo proxy da própria máquina", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.9")
      .send({ email: "admin@proxy.test", password: PASSWORD });
    expect(res.status).toBe(200);
    const session = await prisma.session.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(session.ip).toBe("203.0.113.9");
  });
});
