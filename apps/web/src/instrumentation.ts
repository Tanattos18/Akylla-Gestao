import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "./lib/sentry-options";

/** Servidor/edge do Next (Fase 1 · 1B). No-op sem NEXT_PUBLIC_SENTRY_DSN. */
export function register() {
  if (!baseSentryOptions.enabled) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(baseSentryOptions);
  }
}

export const onRequestError = Sentry.captureRequestError;
