import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "./lib/sentry-options";

/** Navegador (Fase 1 · 1B). Sem replay de sessão (privacidade). No-op sem DSN. */
if (baseSentryOptions.enabled) {
  Sentry.init(baseSentryOptions);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
