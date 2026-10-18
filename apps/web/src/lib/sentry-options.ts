import type { BrowserOptions } from "@sentry/nextjs";

/**
 * Opções comuns do Sentry no web (Fase 1 · 1B). Referência: guia oficial
 * docs.sentry.io/platforms/javascript/guides/nextjs (upgrade/REFERENCIAS_GIT.md).
 *
 * Desligado sem NEXT_PUBLIC_SENTRY_DSN. Sem PII: a query string sai de
 * todas as URLs — o link de redefinição de senha leva o token nela.
 */
export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

function stripQuery(url: string): string {
  const index = url.indexOf("?");
  return index === -1 ? url : url.slice(0, index);
}

type ScrubbableEvent = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: Record<string, string> };
  user?: { id?: string | number } & Record<string, unknown>;
};

export function scrubWebEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    delete event.request.query_string;
    delete event.request.cookies;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (["cookie", "authorization"].includes(name.toLowerCase())) {
          event.request.headers[name] = "[removido]";
        }
      }
    }
  }
  if (event.user) event.user = event.user.id !== undefined ? { id: event.user.id } : undefined;
  return event;
}

export const baseSentryOptions = {
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
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
  beforeSend: (event) => scrubWebEvent(event),
  beforeBreadcrumb: (crumb) => {
    if (crumb.data && typeof crumb.data.url === "string") crumb.data.url = stripQuery(crumb.data.url);
    if (crumb.data && typeof crumb.data.to === "string") crumb.data.to = stripQuery(crumb.data.to);
    if (crumb.data && typeof crumb.data.from === "string") crumb.data.from = stripQuery(crumb.data.from);
    return crumb;
  },
} satisfies BrowserOptions;
