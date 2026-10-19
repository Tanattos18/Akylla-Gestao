import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import {
  createTestApp,
  resetDatabase,
  sessionCookieFrom,
} from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { env } from "../../apps/api/src/config/env";
import { MAIL_PROVIDER, type MailProvider } from "../../apps/api/src/mail/mail.module";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;
/** Links de confirmação "enviados" (MailProvider de log, capturado). */
const sentLinks = new Map<string, string>();

function register(payload: {
  companyName: string;
  name: string;
  email: string;
  password: string;
}) {
  return request(app.getHttpServer())
    .post("/api/auth/register")
    .send({ ...payload, acceptTerms: true, termsVersion: "1.0" });
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  const mail = app.get<MailProvider>(MAIL_PROVIDER);
  const original = mail.sendEmailVerification.bind(mail);
  mail.sendEmailVerification = async (email, name, url) => {
    sentLinks.set(email, url);
    await original(email, name, url);
  };

  await resetDatabase(prisma);

  const company = await prisma.company.create({
    data: { name: "Empresa Registro", slug: "empresa-registro" },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Existente",
      email: "existe@registro.test",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/auth/register", () => {
  it("cria empresa pendente + administrador, exige confirmar o e-mail e só então entra (Fase 1 · 1D)", async () => {
    const response = await register({
      companyName: "Loja Registro",
      name: "Dono Registro",
      email: "dono@registro.test",
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ status: "PENDING_VERIFICATION", email: "dono@registro.test" });
    // Sem sessão antes da confirmação
    expect(response.headers["set-cookie"]).toBeUndefined();

    const company = await prisma.company.findFirst({ where: { slug: "loja-registro" } });
    expect(company?.status).toBe("PENDING_VERIFICATION");
    const user = await prisma.user.findFirst({ where: { email: "dono@registro.test" } });
    expect(user?.role).toBe("ADMIN");
    expect(user?.emailVerifiedAt).toBeNull();

    const blocked = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "dono@registro.test", password: PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("EMAIL_NOT_VERIFIED");

    const link = sentLinks.get("dono@registro.test");
    expect(link).toMatch(/\/confirmar-email\?token=/);
    const token = new URL(link as string).searchParams.get("token");

    const verified = await request(app.getHttpServer())
      .post("/api/auth/verify-email")
      .send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.user.email).toBe("dono@registro.test");
    expect(verified.body.company.slug).toBe("loja-registro");

    const cookie = sessionCookieFrom(verified);
    const me = await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe("ADMIN");

    const login = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "dono@registro.test", password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.company.slug).toBe("loja-registro");

    const active = await prisma.company.findFirst({ where: { slug: "loja-registro" } });
    expect(active?.status).toBe("ACTIVE");
  });

  it("gera slug único quando já existe empresa com o mesmo nome", async () => {
    const response = await register({
      companyName: "Loja Registro",
      name: "Segundo Dono",
      email: "dono2@registro.test",
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    const company = await prisma.company.findFirst({
      where: { users: { some: { email: "dono2@registro.test" } } },
    });
    expect(company?.slug).toBe("loja-registro-2");
  });

  it("responde 409 para email já cadastrado", async () => {
    const response = await register({
      companyName: "Outra Empresa",
      name: "Tentativa",
      email: "existe@registro.test",
      password: PASSWORD,
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Este email já está cadastrado");
  });

  it("valida a política de senha (mínimo de 8 caracteres)", async () => {
    const response = await register({
      companyName: "Empresa Validacao",
      name: "Validacao",
      email: "valida@registro.test",
      password: "123",
    });

    expect(response.status).toBe(400);
    expect(
      response.body.issues?.some((i: { path: string }) => i.path === "password"),
    ).toBe(true);
  });

  it("responde 404 quando o recurso está desabilitado", async () => {
    const original = env.REGISTRATION_ENABLED;
    env.REGISTRATION_ENABLED = false;
    try {
      const response = await register({
        companyName: "Empresa Desligada",
        name: "Desligada",
        email: "desligada@registro.test",
        password: PASSWORD,
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Recurso indisponível");
    } finally {
      env.REGISTRATION_ENABLED = original;
    }
  });

  it("aplica rate limit de cadastro por IP (limite dedicado; conta também os cadastros com sucesso)", async () => {
    const original = env.REGISTER_RATE_LIMIT_MAX;
    env.REGISTER_RATE_LIMIT_MAX = 2;
    try {
      const attempts = [];
      for (let i = 0; i < 4; i += 1) {
        attempts.push(
          await register({
            companyName: "Empresa Rate",
            name: "Rate",
            email: "existe@registro.test",
            password: PASSWORD,
          }),
        );
      }
      expect(attempts.some((r) => r.status === 429)).toBe(true);
    } finally {
      env.REGISTER_RATE_LIMIT_MAX = original;
    }
  });
});
