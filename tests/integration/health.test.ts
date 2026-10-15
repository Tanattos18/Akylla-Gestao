import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "../helpers/app";

let app: INestApplication;

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
});

afterAll(async () => {
  await app.close();
});

describe("PetFlow API - health check", () => {
  it("GET /health retorna status ok", async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "petflow-api",
    });
    expect(typeof response.body.timestamp).toBe("string");
    expect(typeof response.body.uptimeSeconds).toBe("number");
  });

  it("GET inexistente retorna 404 tratado", async () => {
    const response = await request(app.getHttpServer()).get("/nao-existe");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404 });
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("respostas trazem cabeçalhos básicos de segurança (N4)", async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
  });
});
