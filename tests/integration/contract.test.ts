import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import { createTestApp } from "../helpers/app";
import { buildOpenApiDocument } from "../../apps/api/src/openapi/openapi";

/**
 * Contrato (Fase 6 · 6.4): as rotas do código, o OpenAPI gerado e a tabela
 * de rotas de `docs/architecture/API.md` precisam bater. Rota nova sem
 * documentação (ou documentação de rota que não existe) quebra o teste.
 */

const VERBS = ["get", "post", "put", "patch", "delete"] as const;

let app: INestApplication;
let document: OpenAPIObject;

function normalize(path: string): string {
  return path.replace(/\{(\w+)\}/g, ":$1").replace(/:\w+/g, ":param");
}

function codeRoutes(): Set<string> {
  const routes = new Set<string>();
  for (const [path, item] of Object.entries(document.paths)) {
    for (const verb of VERBS) {
      if ((item as Record<string, unknown>)[verb]) routes.add(`${verb.toUpperCase()} ${normalize(path)}`);
    }
  }
  return routes;
}

function documentedRoutes(): Set<string> {
  const markdown = readFileSync(resolve(__dirname, "../../docs/architecture/API.md"), "utf8");
  const routes = new Set<string>();
  // Dois formatos de tabela: "| GET | `/api/x` |" e "| `GET /api/x` |"
  const rows = [
    /^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`/gm,
    /^\|\s*`(GET|POST|PUT|PATCH|DELETE) ([^`]+)`/gm,
  ];
  for (const row of rows) {
    for (const match of markdown.matchAll(row)) {
      const path = match[2]!.split("?")[0]!.trim();
      routes.add(`${match[1]} ${normalize(path)}`);
    }
  }
  return routes;
}

beforeAll(async () => {
  ({ app } = await createTestApp());
  document = buildOpenApiDocument(app, "petflow_session");
});

afterAll(async () => {
  await app.close();
});

describe("contrato da API (Fase 6 · 6.4)", () => {
  it("toda rota do código está documentada em API.md", () => {
    const documented = documentedRoutes();
    const missing = [...codeRoutes()].filter((route) => !documented.has(route)).sort();
    expect(missing).toEqual([]);
  });

  it("API.md não documenta rota que não existe", () => {
    const code = codeRoutes();
    const stale = [...documentedRoutes()].filter((route) => !code.has(route)).sort();
    expect(stale).toEqual([]);
  });

  it("toda operação recebeu segurança e descrição do código", () => {
    const missing: string[] = [];
    for (const [path, item] of Object.entries(document.paths)) {
      for (const verb of VERBS) {
        const op = (item as Record<string, { security?: unknown; description?: string } | undefined>)[verb];
        if (op && (!op.security || !op.description)) missing.push(`${verb.toUpperCase()} ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("corpo do login vem do schema Zod", () => {
    const login = document.paths["/api/auth/login"]?.post;
    expect(login?.security).toEqual([]);
    const schema = (login?.requestBody as { content: Record<string, { schema: { properties: Record<string, unknown>; required: string[] } }> })
      .content["application/json"]!.schema;
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(["email", "password"]));
    expect(schema.required).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("rotas protegidas exigem a sessão e marcam ADMIN", () => {
    const apply = document.paths["/api/onboarding/apply"]?.post;
    expect(apply?.security).toEqual([{ session: [] }]);
    expect(apply?.description).toContain("Somente ADMIN");
    const presets = document.paths["/api/onboarding/presets"]?.get;
    expect(presets?.description).not.toContain("ADMIN");
  });
});
