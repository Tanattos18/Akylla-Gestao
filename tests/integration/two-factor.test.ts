import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { generateSync } from "otplib";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;

let adminCookie: string;

async function login(email: string, password: string) {
  return request(app.getHttpServer()).post("/api/auth/login").send({ email, password });
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const company = await prisma.company.create({
    data: { name: "Empresa 2FA", slug: "dois-fa" },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Admin 2FA",
      email: "admin@doisfa.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: "ADMIN",
    },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Membro 2FA",
      email: "membro@doisfa.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: "MEMBER",
    },
  });

  const logged = await login("admin@doisfa.test", PASSWORD);
  adminCookie = sessionCookieFrom(logged);
});

afterAll(async () => {
  await app.close();
});

describe("2FA/TOTP para ADMIN (N4)", () => {
  it("setup gera segredo + otpauth; enable ativa com código válido", async () => {
    const setup = await request(app.getHttpServer())
      .post("/api/auth/2fa/setup")
      .set("Cookie", adminCookie);
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toBeTruthy();
    expect(setup.body.otpauthUrl).toContain("otpauth://");

    const token = generateSync({ secret: setup.body.secret });
    const enabled = await request(app.getHttpServer())
      .post("/api/auth/2fa/enable")
      .set("Cookie", adminCookie)
      .send({ token });
    expect(enabled.status).toBe(200);
  });

  it("enable com código errado é rejeitado", async () => {
    const setup = await request(app.getHttpServer())
      .post("/api/auth/2fa/setup")
      .set("Cookie", adminCookie);
    expect(setup.status).toBe(200);

    const enabled = await request(app.getHttpServer())
      .post("/api/auth/2fa/enable")
      .set("Cookie", adminCookie)
      .send({ token: "000000" });
    expect(enabled.status).toBe(401);

    // Reativa para os próximos testes (setup desliga até o enable)
    const reenabled = await request(app.getHttpServer())
      .post("/api/auth/2fa/enable")
      .set("Cookie", adminCookie)
      .send({ token: generateSync({ secret: setup.body.secret }) });
    expect(reenabled.status).toBe(200);
  });

  it("login com 2FA ativo retorna desafio 202; verify libera a sessão", async () => {
    const challenged = await login("admin@doisfa.test", PASSWORD);
    expect(challenged.status).toBe(202);
    expect(challenged.body.requiresTwoFactor).toBe(true);
    expect(challenged.body.challengeId).toBeTruthy();
    expect(challenged.headers["set-cookie"]).toBeUndefined();

    const user = await prisma.user.findFirstOrThrow({
      where: { email: "admin@doisfa.test" },
      select: { twoFactorSecret: true },
    });
    const verified = await request(app.getHttpServer())
      .post("/api/auth/2fa/verify")
      .send({
        challengeId: challenged.body.challengeId,
        token: generateSync({ secret: user.twoFactorSecret! }),
      });
    expect(verified.status).toBe(200);
    expect(verified.body.user.email).toBe("admin@doisfa.test");
    expect(sessionCookieFrom(verified)).toContain("petflow_session=");
  });

  it("verify com código errado ou desafio inválido é rejeitado", async () => {
    const challenged = await login("admin@doisfa.test", PASSWORD);
    const badCode = await request(app.getHttpServer())
      .post("/api/auth/2fa/verify")
      .send({ challengeId: challenged.body.challengeId, token: "000000" });
    expect(badCode.status).toBe(401);

    const badChallenge = await request(app.getHttpServer())
      .post("/api/auth/2fa/verify")
      .send({ challengeId: "desafio-inexistente", token: "123456" });
    expect(badChallenge.status).toBe(401);
  });

  it("MEMBER não configura 2FA (403)", async () => {
    const logged = await login("membro@doisfa.test", PASSWORD);
    const memberCookie = sessionCookieFrom(logged);

    const setup = await request(app.getHttpServer())
      .post("/api/auth/2fa/setup")
      .set("Cookie", memberCookie);
    expect(setup.status).toBe(403);
  });

  it("disable com senha correta desativa e o login volta a ser direto", async () => {
    const disabled = await request(app.getHttpServer())
      .post("/api/auth/2fa/disable")
      .set("Cookie", adminCookie)
      .send({ password: PASSWORD });
    expect(disabled.status).toBe(200);

    const direct = await login("admin@doisfa.test", PASSWORD);
    expect(direct.status).toBe(200);
    expect(sessionCookieFrom(direct)).toContain("petflow_session=");
  });

  it("disable com senha errada é rejeitado", async () => {
    const disabled = await request(app.getHttpServer())
      .post("/api/auth/2fa/disable")
      .set("Cookie", adminCookie)
      .send({ password: "senha-errada" });
    expect(disabled.status).toBe(401);
  });
});
