import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase } from "../helpers/app";
import { AuthService } from "../../apps/api/src/auth/auth.service";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";
const NEW_PASSWORD = "NovaSenha456!";

let app: INestApplication;
let prisma: PrismaService;
let authService: AuthService;

async function login(email: string, password: string): Promise<number> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password });
  return response.status;
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;
  authService = app.get(AuthService);

  await resetDatabase(prisma);

  const company = await prisma.company.create({
    data: { name: "Empresa Reset Token", slug: "reset-token" },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Usuário Reset",
      email: "reset@token.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/auth/request-password-reset + confirm (N4)", () => {
  it("fluxo completo: solicita, confirma com token e a nova senha funciona", async () => {
    const requested = await request(app.getHttpServer())
      .post("/api/auth/request-password-reset")
      .send({ email: "reset@token.test" });
    expect(requested.status).toBe(200);
    expect(requested.body).toMatchObject({ ok: true });

    // Token bruto vem do serviço (o HTTP nunca o expõe; o envio é pelo MailProvider)
    const { token } = await authService.requestPasswordReset({ email: "reset@token.test" });
    expect(token).toBeTruthy();

    const confirmed = await request(app.getHttpServer())
      .post("/api/auth/confirm-password-reset")
      .send({ token, password: NEW_PASSWORD });
    expect(confirmed.status).toBe(200);

    expect(await login("reset@token.test", NEW_PASSWORD)).toBe(200);
    expect(await login("reset@token.test", PASSWORD)).toBe(401);
  });

  it("token reutilizado é rejeitado (uso único)", async () => {
    const { token } = await authService.requestPasswordReset({ email: "reset@token.test" });

    const first = await request(app.getHttpServer())
      .post("/api/auth/confirm-password-reset")
      .send({ token, password: "OutraSenha789!" });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .post("/api/auth/confirm-password-reset")
      .send({ token, password: "MaisUmaSenha000!" });
    expect(second.status).toBe(400);
  });

  it("token inválido é rejeitado", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/confirm-password-reset")
      .send({ token: "token-que-nunca-existiu-1234567890", password: NEW_PASSWORD });
    expect(response.status).toBe(400);
  });

  it("token expirado é rejeitado", async () => {
    const { token } = await authService.requestPasswordReset({ email: "reset@token.test" });
    const tokenHash = createHash("sha256").update(token!).digest("hex");
    await prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app.getHttpServer())
      .post("/api/auth/confirm-password-reset")
      .send({ token, password: NEW_PASSWORD });
    expect(response.status).toBe(400);
  });

  it("e-mail desconhecido responde ok sem criar token (sem enumeração)", async () => {
    const before = await prisma.passwordResetToken.count();
    const response = await request(app.getHttpServer())
      .post("/api/auth/request-password-reset")
      .send({ email: "ninguem@existe.test" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
    expect(await prisma.passwordResetToken.count()).toBe(before);
  });

  it("senha fraca é rejeitada na confirmação", async () => {
    const { token } = await authService.requestPasswordReset({ email: "reset@token.test" });
    const response = await request(app.getHttpServer())
      .post("/api/auth/confirm-password-reset")
      .send({ token, password: "curta" });
    expect(response.status).toBe(400);
  });
});
