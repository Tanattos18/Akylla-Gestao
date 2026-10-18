import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ArgumentsHost } from "@nestjs/common";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import * as Sentry from "@sentry/node";
import { createTestApp } from "../helpers/app";
import { AllExceptionsFilter } from "../../apps/api/src/common/filters/all-exceptions.filter";
import { HealthController } from "../../apps/api/src/health/health.controller";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import {
  captureServerError,
  flushSentry,
  initSentry,
  isSentryEnabled,
  scrubEvent,
} from "../../apps/api/src/monitoring/sentry";

/** Fase 1 · 1B — monitoramento (Sentry) e readiness para o uptime. */

let app: INestApplication;

beforeAll(async () => {
  ({ app } = await createTestApp());
});

afterAll(async () => {
  await Sentry.close(1000);
  await app.close();
});

function fakeHost(req: Record<string, unknown>) {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe("Sentry desligado (sem SENTRY_DSN)", () => {
  it("initSentry não liga nada e captureServerError é no-op", () => {
    expect(initSentry({ dsn: "" })).toBe(false);
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureServerError(new Error("x"), { method: "GET", url: "/api/x" })).not.toThrow();
  });
});

describe("scrubEvent (LGPD)", () => {
  it("remove cookies, corpo, query string, cabeçalhos sensíveis e PII do usuário", () => {
    const event = scrubEvent({
      request: {
        url: "https://app/redefinir-senha?token=segredo123",
        query_string: "token=segredo123",
        cookies: { petflow_session: "abc" },
        data: { password: "SenhaForte123!" },
        headers: {
          Cookie: "petflow_session=abc",
          Authorization: "Bearer xyz",
          "x-hub-signature-256": "sha256=...",
          "user-agent": "vitest",
        },
      },
      user: { id: "u1", email: "dono@empresa.com", ip_address: "10.0.0.1", username: "Dono" },
      breadcrumbs: [{ data: { url: "https://graph.facebook.com/v21.0/x?access_token=tok" } }],
    });

    const serialized = JSON.stringify(event);
    for (const secret of ["segredo123", "abc", "SenhaForte123!", "Bearer xyz", "dono@empresa.com", "10.0.0.1", "access_token=tok"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(event.request?.url).toBe("https://app/redefinir-senha");
    expect(event.request?.headers?.["user-agent"]).toBe("vitest");
    expect(event.user).toEqual({ id: "u1" });
  });
});

describe("AllExceptionsFilter → reporter", () => {
  it("erro 5xx é reportado com método, rota e auth (sem PII)", () => {
    const reporter = vi.fn();
    const filter = new AllExceptionsFilter(reporter);
    const { host, res } = fakeHost({
      method: "POST",
      url: "/api/sales",
      auth: { userId: "u1", companyId: "c1" },
    });

    filter.catch(new Error("falha inesperada"), host);

    expect(res.statusCode).toBe(500);
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0]?.[1]).toEqual({
      method: "POST",
      url: "/api/sales",
      auth: { userId: "u1", companyId: "c1" },
    });
  });

  it("erro 4xx (regra de negócio) não é reportado", () => {
    const reporter = vi.fn();
    const filter = new AllExceptionsFilter(reporter);
    const { host, res } = fakeHost({ method: "POST", url: "/api/sales" });

    filter.catch(new BadRequestException("Caixa fechado"), host);

    expect(res.statusCode).toBe(400);
    expect(reporter).not.toHaveBeenCalled();
  });
});

describe("Sentry ligado (transporte falso, nada sai da máquina)", () => {
  it("envia o erro com tags de tenant, sem query string nem e-mail", async () => {
    const envelopes: string[] = [];
    const ok = initSentry({
      dsn: "https://public@o0.ingest.sentry.io/0",
      transport: (options) =>
        Sentry.createTransport(options, async (req) => {
          envelopes.push(typeof req.body === "string" ? req.body : new TextDecoder().decode(req.body));
          return { statusCode: 200 };
        }),
    });
    expect(ok).toBe(true);
    expect(isSentryEnabled()).toBe(true);

    // Segredo montado em tempo de execução: não aparece no trecho de código
    // que o SDK anexa ao evento (context lines), só nos dados da requisição
    const secret = ["seg", "redo", String(400 + 56)].join("");
    captureServerError(new Error("boom-monitoramento"), {
      method: "GET",
      url: `/api/reports?token=${secret}`,
      auth: { userId: "u9", companyId: "empresa-9" },
    });
    await flushSentry(5000);

    const sent = envelopes.join("\n");
    expect(sent).toContain("boom-monitoramento");
    expect(sent).toContain("empresa-9");
    expect(sent).toContain("/api/reports");
    expect(sent).not.toContain(secret);
    expect(sent).not.toContain('"vars":'); // sem variáveis locais nos frames
  });
});

describe("Readiness (/health/ready) para o UptimeRobot", () => {
  it("200 com banco ok, fora do prefixo /api e sem sessão", async () => {
    const response = await request(app.getHttpServer()).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "petflow-api", database: "ok" });
    expect(typeof response.body.databaseLatencyMs).toBe("number");
  });

  it("503 sem detalhes internos quando o banco não responde", async () => {
    const prisma = {
      $queryRaw: () => Promise.reject(new Error("connection refused em 10.0.0.5:5432")),
    } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    const error = await controller.getReady().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = (error as ServiceUnavailableException).getResponse();
    expect(body).toEqual({ status: "unavailable", database: "down" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });

  it("/health (liveness) continua inalterado", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "petflow-api" });
  });
});
