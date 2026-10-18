import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import request from "supertest";
import nodemailer from "nodemailer";
import { createTestApp, resetDatabase } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { AuthController } from "../../apps/api/src/auth/auth.controller";
import { AuthService } from "../../apps/api/src/auth/auth.service";
import {
  DisabledCaptchaVerifier,
  TURNSTILE_VERIFY_URL,
  TurnstileCaptchaVerifier,
  type CaptchaVerifier,
} from "../../apps/api/src/auth/captcha";
import { SmtpMailProvider } from "../../apps/api/src/mail/mail.module";

/** Fase 1 · 1D — verificação de e-mail, captcha opcional e envio SMTP. */

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;
let authService: AuthService;

function register(email: string, extra: Record<string, unknown> = {}) {
  return request(app.getHttpServer())
    .post("/api/auth/register")
    .send({
      companyName: `Empresa ${email}`,
      name: "Dona Teste",
      email,
      password: PASSWORD,
      acceptTerms: true,
      termsVersion: "1.0",
      ...extra,
    });
}

function setCaptcha(verifier: CaptchaVerifier) {
  (app.get(AuthController) as unknown as { captcha: CaptchaVerifier }).captcha = verifier;
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  authService = app.get(AuthService);
  await resetDatabase(prisma);
});

afterAll(async () => {
  await app.close();
});

describe("Token de confirmação", () => {
  it("é de uso único: o segundo uso responde 400", async () => {
    expect((await register("unico@verif.test")).status).toBe(201);
    const { token } = await authService.resendEmailVerification({ email: "unico@verif.test" });

    const first = await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });
    expect(first.status).toBe(200);
    const second = await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });
    expect(second.status).toBe(400);
    expect(second.body.message).toBe("Link de confirmação inválido ou expirado");
  });

  it("guarda só o hash SHA-256 (o token bruto não está no banco)", async () => {
    await register("hash@verif.test");
    const { token } = await authService.resendEmailVerification({ email: "hash@verif.test" });
    const rows = await prisma.emailVerificationToken.findMany({
      where: { user: { email: "hash@verif.test" } },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.tokenHash).not.toBe(token);
  });

  it("expirado responde 400 e a empresa continua pendente", async () => {
    await register("expirado@verif.test");
    const { token } = await authService.resendEmailVerification({ email: "expirado@verif.test" });
    await prisma.emailVerificationToken.updateMany({
      where: { user: { email: "expirado@verif.test" } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token });
    expect(response.status).toBe(400);
    const company = await prisma.company.findFirst({
      where: { users: { some: { email: "expirado@verif.test" } } },
    });
    expect(company?.status).toBe("PENDING_VERIFICATION");
  });

  it("token inexistente responde 400", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/verify-email")
      .send({ token: "x".repeat(43) });
    expect(response.status).toBe(400);
  });

  it("reenviar invalida o link anterior", async () => {
    await register("reenvio@verif.test");
    const { token: antigo } = await authService.resendEmailVerification({ email: "reenvio@verif.test" });
    const { token: novo } = await authService.resendEmailVerification({ email: "reenvio@verif.test" });

    const old = await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token: antigo });
    expect(old.status).toBe(400);
    const ok = await request(app.getHttpServer()).post("/api/auth/verify-email").send({ token: novo });
    expect(ok.status).toBe(200);
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("responde igual para conta pendente, já ativa e inexistente (não revela contas)", async () => {
    await register("pendente@verif.test");
    const pendente = await request(app.getHttpServer())
      .post("/api/auth/resend-verification")
      .send({ email: "pendente@verif.test" });
    const inexistente = await request(app.getHttpServer())
      .post("/api/auth/resend-verification")
      .send({ email: "ninguem@verif.test" });
    const ativa = await request(app.getHttpServer())
      .post("/api/auth/resend-verification")
      .send({ email: "unico@verif.test" });

    for (const r of [pendente, inexistente, ativa]) {
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true });
    }
  });
});

describe("Login de conta pendente", () => {
  it("senha errada continua 401 genérico (não revela que a conta existe)", async () => {
    await register("senha@verif.test");
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "senha@verif.test", password: "OutraSenha999!" });
    expect(response.status).toBe(401);
    expect(response.body.code).toBeUndefined();
  });

  it("sem confirmar, nenhuma rota autenticada é acessível (empresa não ACTIVE)", async () => {
    await register("bloqueio@verif.test");
    const company = await prisma.company.findFirst({
      where: { users: { some: { email: "bloqueio@verif.test" } } },
    });
    expect(company?.status).toBe("PENDING_VERIFICATION");
    const sessions = await prisma.session.count({ where: { user: { email: "bloqueio@verif.test" } } });
    expect(sessions).toBe(0);
  });
});

describe("Captcha opcional (Turnstile)", () => {
  it("ligado: cadastro sem token responde 400 e não cria empresa", async () => {
    setCaptcha(new TurnstileCaptchaVerifier("segredo-teste", async () => ({ ok: true, json: async () => ({ success: true }) })));
    try {
      const response = await register("captcha-sem@verif.test");
      expect(response.status).toBe(400);
      expect(await prisma.user.count({ where: { email: "captcha-sem@verif.test" } })).toBe(0);
    } finally {
      setCaptcha(new DisabledCaptchaVerifier());
    }
  });

  it("ligado: token aprovado pelo Turnstile segue o cadastro; o segredo e o IP vão ao siteverify", async () => {
    const calls: Array<{ url: string; body: URLSearchParams }> = [];
    setCaptcha(
      new TurnstileCaptchaVerifier("segredo-teste", async (url, init) => {
        calls.push({ url, body: init.body });
        return { ok: true, json: async () => ({ success: init.body.get("response") === "token-bom" }) };
      }),
    );
    try {
      expect((await register("captcha-ruim@verif.test", { captchaToken: "token-ruim" })).status).toBe(400);
      expect((await register("captcha-bom@verif.test", { captchaToken: "token-bom" })).status).toBe(201);
      expect(calls[0]?.url).toBe(TURNSTILE_VERIFY_URL);
      expect(calls[0]?.body.get("secret")).toBe("segredo-teste");
      expect(calls[0]?.body.get("remoteip")).toBeTruthy();
    } finally {
      setCaptcha(new DisabledCaptchaVerifier());
    }
  });

  it("Turnstile fora do ar → falha fechada (400)", async () => {
    const verifier = new TurnstileCaptchaVerifier("s", async () => {
      throw new Error("ECONNRESET");
    });
    await expect(verifier.verify("qualquer", "1.1.1.1")).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("SmtpMailProvider (nodemailer)", () => {
  it("monta o e-mail de confirmação com link, remetente e HTML escapado", async () => {
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    const sent: string[] = [];
    const wrapped = {
      sendMail: async (options: Parameters<typeof transporter.sendMail>[0]) => {
        const info = await transporter.sendMail(options);
        sent.push(String((info as { message: string }).message));
        return info;
      },
    } as unknown as typeof transporter;
    const provider = new SmtpMailProvider(wrapped, "Akylla Gestão <no-reply@akyllagestao.com.br>");

    await provider.sendEmailVerification("dona@empresa.com", "Ana <script>", "http://localhost:3000/confirmar-email?token=abc");

    const message = JSON.parse(sent[0] as string) as {
      to: Array<{ address: string }>;
      from: { address: string };
      subject: string;
      text: string;
      html: string;
    };
    expect(message.to[0]?.address).toBe("dona@empresa.com");
    expect(message.from.address).toBe("no-reply@akyllagestao.com.br");
    expect(message.subject).toContain("Confirme seu e-mail");
    expect(message.text).toContain("http://localhost:3000/confirmar-email?token=abc");
    expect(message.html).toContain("Ana &lt;script&gt;");
    expect(message.html).not.toContain("<script>");
  });
});
