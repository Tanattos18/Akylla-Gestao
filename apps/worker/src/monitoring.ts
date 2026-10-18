import * as Sentry from "@sentry/node";
import { workerEnv } from "./env";

/**
 * Monitoramento do worker (Fase 1 · 1B) — mesmo padrão da API
 * (apps/api/src/monitoring/sentry.ts): desligado sem SENTRY_DSN, sem PII.
 * O worker não recebe requisições HTTP; os eventos carregam só a mensagem
 * de erro, a etapa (tag `stage`) e contadores.
 */

let enabled = false;

export function initWorkerMonitoring(): boolean {
  if (!workerEnv.SENTRY_DSN) return false;
  Sentry.init({
    dsn: workerEnv.SENTRY_DSN,
    environment: workerEnv.SENTRY_ENVIRONMENT ?? workerEnv.NODE_ENV,
    release: workerEnv.SENTRY_RELEASE,
    tracesSampleRate: 0,
    // SDK v11: coleta mínima (LGPD); o worker não envia corpo nem cabeçalhos
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "content-type", "accept"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
    },
    initialScope: { tags: { service: "petflow-worker" } },
    beforeBreadcrumb: (crumb) => {
      // Breadcrumbs de HTTP podem conter o token da Meta na URL
      if (crumb.category === "http" && crumb.data && typeof crumb.data.url === "string") {
        crumb.data.url = crumb.data.url.split("?")[0];
      }
      return crumb;
    },
  });
  enabled = true;
  return true;
}

export function captureWorkerError(error: unknown, stage: string): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag("stage", stage);
    Sentry.captureException(error);
  });
}

export async function flushWorkerMonitoring(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  await Sentry.flush(timeoutMs);
}
