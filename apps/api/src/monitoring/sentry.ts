import * as Sentry from "@sentry/node";
import type { ErrorEvent, Event, NodeOptions } from "@sentry/node";
import { env } from "../config/env";

/**
 * Monitoramento de erros (Fase 1 · 1B). Referência: guia oficial
 * docs.sentry.io/platforms/javascript/guides/node (upgrade/REFERENCIAS_GIT.md).
 *
 * - Desligado quando SENTRY_DSN está vazio (dev/teste/CI): nada é enviado.
 * - Só erros 5xx são reportados (4xx são regra de negócio, não falha).
 * - Antes do envio, `scrubEvent` remove cookies, tokens, corpo da requisição,
 *   query string e dados pessoais do usuário (LGPD).
 */

const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "x-hub-signature-256",
  "x-signature",
  "x-request-id",
  "x-fiscal-signature",
]);

const REMOVED = "[removido]";

function stripQuery(url: string): string {
  const index = url.indexOf("?");
  return index === -1 ? url : url.slice(0, index);
}

/** Remove dados sensíveis/pessoais de um evento antes de sair do servidor. */
export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    const request = event.request;
    delete request.cookies;
    delete request.query_string;
    if (request.data !== undefined) request.data = REMOVED;
    if (typeof request.url === "string") request.url = stripQuery(request.url);
    if (request.headers) {
      for (const name of Object.keys(request.headers)) {
        if (SENSITIVE_HEADERS.has(name.toLowerCase())) {
          request.headers[name] = REMOVED;
        }
      }
    }
  }
  if (event.user) {
    // Só identificadores internos; nunca e-mail, nome ou IP
    event.user = event.user.id !== undefined ? { id: event.user.id } : undefined;
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.data && typeof crumb.data.url === "string") {
        crumb.data.url = stripQuery(crumb.data.url);
      }
    }
  }
  return event;
}

let enabled = false;

export function isSentryEnabled(): boolean {
  return enabled;
}

/**
 * Inicializa o Sentry. Deve rodar antes de `NestFactory.create` (ver
 * `instrument.ts`). `overrides` existe para os testes (transporte falso).
 */
export function initSentry(overrides: Partial<NodeOptions> = {}): boolean {
  const dsn = overrides.dsn ?? env.SENTRY_DSN;
  if (!dsn) {
    enabled = false;
    return false;
  }

  const integrations: NonNullable<NodeOptions["integrations"]> = [];
  if (env.SENTRY_PROFILES_SAMPLE_RATE > 0) {
    // Carregado só quando ligado: o profiler usa binário nativo
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nodeProfilingIntegration } = require("@sentry/profiling-node") as typeof import("@sentry/profiling-node");
    integrations.push(nodeProfilingIntegration());
  }

  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.SENTRY_RELEASE,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    profileSessionSampleRate: env.SENTRY_PROFILES_SAMPLE_RATE,
    profileLifecycle: "trace",
    // SDK v11: coleta mínima por padrão do nosso lado (LGPD). O scrub do
    // beforeSend é a segunda camada.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "content-type", "accept"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
    },
    integrations,
    initialScope: { tags: { service: "petflow-api" } },
    // Variáveis locais podem conter senha/CPF: nunca anexar ao evento
    includeLocalVariables: false,
    beforeSend: (event: ErrorEvent) => scrubEvent(event),
    ...overrides,
  });
  enabled = true;
  return true;
}

export interface ErrorRequestContext {
  method?: string;
  url?: string;
  /** `request.auth` preenchido pelo AuthGuard (ausente em rotas públicas). */
  auth?: { userId?: string; companyId?: string };
}

/** Reporta um erro 5xx com contexto mínimo (sem PII). */
export function captureServerError(exception: unknown, request: ErrorRequestContext): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (request.method) scope.setTag("http.method", request.method);
    if (request.url) scope.setTag("http.route", stripQuery(request.url));
    if (request.auth?.companyId) scope.setTag("companyId", request.auth.companyId);
    if (request.auth?.userId) scope.setUser({ id: request.auth.userId });
    Sentry.captureException(exception);
  });
}

/** Envia o que estiver pendente (encerramento do processo). */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  await Sentry.flush(timeoutMs);
}
