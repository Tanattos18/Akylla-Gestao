#!/usr/bin/env node
/**
 * Alerta de teste do Sentry (Fase 1 · 1B — critério "alerta de teste recebido").
 *
 * Uso: npm run monitoring:test
 *
 * Envia UM evento de erro identificado como teste para o projeto do
 * SENTRY_DSN do .env e imprime o ID do evento. Confirme no painel do Sentry
 * (Issues) e no e-mail/canal de alerta configurado. Não envia dados de
 * clientes nem do banco.
 */
import "dotenv/config";
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (!dsn) {
  console.error("SENTRY_DSN não definido no .env — nada a testar.");
  process.exit(1);
}

Sentry.init({
  dsn,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0,
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  initialScope: { tags: { service: "petflow-api", alert_test: "true" } },
});

const eventId = Sentry.captureException(
  new Error(`[TESTE] Alerta de teste do Akylla Gestão — ${new Date().toISOString()}`),
);
const sent = await Sentry.flush(10_000);

if (!sent) {
  console.error("❌ Não foi possível enviar o evento (rede/DSN). Verifique o SENTRY_DSN.");
  process.exit(1);
}
console.log(`✅ Evento de teste enviado ao Sentry. ID: ${eventId}`);
console.log("   Confira em Issues no painel do Sentry e no canal de alerta.");
