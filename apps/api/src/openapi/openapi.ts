import type { INestApplication } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum";
import { ModulesContainer } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";
import { REQUIRE_MODULE_KEY } from "../common/decorators/require-module.decorator";
import { AdminGuard } from "../common/guards/admin.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

/**
 * OpenAPI gerado do próprio código (Fase 6 · 6.3). O Swagger descobre as
 * rotas; os corpos e filtros vêm dos schemas Zod que as rotas já usam
 * (`ZodValidationPipe`), então a documentação não diverge da validação.
 */

const COOKIE_AUTH = "session";

const VERBS: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.GET]: "get",
  [RequestMethod.POST]: "post",
  [RequestMethod.PUT]: "put",
  [RequestMethod.PATCH]: "patch",
  [RequestMethod.DELETE]: "delete",
};

type Operation = {
  tags?: string[];
  summary?: string;
  description?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
};

interface RouteArg {
  index: number;
  data?: unknown;
  pipes?: unknown[];
}

function toJsonSchema(schema: ZodType): Record<string, unknown> {
  // Assinatura simplificada: a inferência genérica do zod-to-json-schema
  // estoura a profundidade de tipos do TypeScript com os schemas do projeto.
  const convert = zodToJsonSchema as unknown as (s: unknown, o: object) => Record<string, unknown>;
  const json = convert(schema, { target: "openApi3", $refStrategy: "none" });
  delete json.$schema;
  return json;
}

function zodOf(arg: RouteArg): ZodType | undefined {
  const pipe = arg.pipes?.find((p): p is ZodValidationPipe => p instanceof ZodValidationPipe);
  return pipe?.schema;
}

function joinPath(...parts: string[]): string {
  const joined = "/" + parts.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
  return joined.replace(/:(\w+)/g, "{$1}");
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [value === undefined ? "" : String(value)];
}

function enrich(app: INestApplication, document: OpenAPIObject): void {
  const modules = app.get(ModulesContainer);
  for (const moduleRef of modules.values()) {
    for (const wrapper of moduleRef.controllers.values()) {
      const controller = wrapper.metatype as (new (...args: never[]) => unknown) | null;
      if (!controller) continue;
      const prototype = controller.prototype as Record<string, unknown>;
      const controllerPaths = asArray(Reflect.getMetadata(PATH_METADATA, controller));
      const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true;
      const classModule = Reflect.getMetadata(REQUIRE_MODULE_KEY, controller) as string | undefined;
      const classGuards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];

      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === "constructor") continue;
        const handler = prototype[name];
        if (typeof handler !== "function") continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (method === undefined) continue;
        const verb = VERBS[method];
        if (!verb) continue;

        const isPublic = classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
        const guards = [...classGuards, ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[])];
        const adminOnly = guards.includes(AdminGuard);
        const module = (Reflect.getMetadata(REQUIRE_MODULE_KEY, handler) as string | undefined) ?? classModule;
        const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) ?? {}) as Record<string, RouteArg>;

        for (const controllerPath of controllerPaths) {
          for (const methodPath of asArray(Reflect.getMetadata(PATH_METADATA, handler))) {
            const routePath = joinPath(controllerPath, methodPath);
            const fullPath = routePath.startsWith("/health") ? routePath : joinPath("api", routePath);
            const operation = (document.paths[fullPath] as Record<string, Operation> | undefined)?.[verb];
            if (!operation) continue;

            operation.tags = [controllerPath.split("/")[0] || "health"];
            operation.security = isPublic ? [] : [{ [COOKIE_AUTH]: [] }];
            const notes = [
              isPublic ? "Pública." : "Requer sessão.",
              adminOnly ? "Somente ADMIN." : "",
              module ? `Módulo opcional: ${module}.` : "",
            ].filter(Boolean);
            operation.description = notes.join(" ");

            for (const [key, arg] of Object.entries(args)) {
              const type = Number(key.split(":")[0]);
              const schema = zodOf(arg);
              if (!schema) continue;
              const json = toJsonSchema(schema);
              if (type === RouteParamtypes.BODY) {
                operation.requestBody = { required: true, content: { "application/json": { schema: json } } };
              } else if (type === RouteParamtypes.QUERY && arg.data === undefined) {
                const properties = (json.properties ?? {}) as Record<string, unknown>;
                const required = new Set((json.required ?? []) as string[]);
                const existing = new Set((operation.parameters ?? []).map((p) => `${String(p.in)}:${String(p.name)}`));
                operation.parameters = [
                  ...(operation.parameters ?? []),
                  ...Object.entries(properties)
                    .filter(([prop]) => !existing.has(`query:${prop}`))
                    .map(([prop, propSchema]) => ({ name: prop, in: "query", required: required.has(prop), schema: propSchema })),
                ];
              }
            }
          }
        }
      }
    }
  }
}

export function buildOpenApiDocument(app: INestApplication, cookieName: string): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Akylla Gestão API")
    .setDescription(
      "API do Akylla Gestão. Autenticação por cookie HttpOnly de sessão (POST /api/auth/login). " +
        "Erros: `{ statusCode, message, issues? }`. Valores monetários são strings decimais.",
    )
    .setVersion("1.0")
    .addCookieAuth(cookieName, { type: "apiKey", in: "cookie", name: cookieName }, COOKIE_AUTH)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  enrich(app, document);
  return document;
}

/** Swagger UI em /api/docs e o JSON em /api/docs/openapi.json. */
export function setupOpenApi(app: INestApplication, cookieName: string): OpenAPIObject {
  const document = buildOpenApiDocument(app, cookieName);
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "api/docs/openapi.json",
    customSiteTitle: "Akylla Gestão API",
  });
  return document;
}
