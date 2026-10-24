import { PrismaClient } from "@prisma/client";
import { createWhatsAppProvider } from "@petflow/whatsapp";
import { workerEnv } from "./env";
import { captureWorkerError, flushWorkerMonitoring, initWorkerMonitoring } from "./monitoring";
import { processDueMessages } from "./whatsapp/processor";
import { checkSites, SITE_MONITOR_INTERVAL_MS, type FetchLike } from "./monitor/site-monitor";

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Mesmo contrato de `systemDatabaseUrl` da API (apps/api/src/common/tenant/
 * rls.extension.ts): fixa `app.rls_bypass=on` na sessão via `options`.
 */
function systemDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const current = url.searchParams.get("options");
  const flag = "-c app.rls_bypass=on";
  url.searchParams.set("options", current ? `${current} ${flag}` : flag);
  return url.toString();
}

function log(message: string) {
  console.log(`[petflow-worker] ${new Date().toISOString()} ${message}`);
}

async function main() {
  const monitoring = initWorkerMonitoring();
  // Processo de sistema: conexão com bypass da RLS (Fase 1 · 1E) — o worker
  // atende todas as empresas e não tem sessão de usuário
  const prisma = new PrismaClient({
    datasources: { db: { url: systemDatabaseUrl(workerEnv.DATABASE_URL) } },
  });

  let provider;
  try {
    provider = createWhatsAppProvider({
      provider: workerEnv.WHATSAPP_PROVIDER,
      accessToken: workerEnv.WHATSAPP_ACCESS_TOKEN,
      apiVersion: workerEnv.WHATSAPP_API_VERSION,
    });
  } catch (error) {
    log(
      `falha ao criar o provedor: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    );
    captureWorkerError(error, "provider");
    await flushWorkerMonitoring();
    process.exit(1);
  }

  log(
    `worker iniciado (fila WhatsApp, provedor=${provider.name}, poll=${workerEnv.WORKER_POLL_INTERVAL_MS}ms, máx=${workerEnv.WHATSAPP_SEND_MAX_PER_CYCLE}/ciclo, intervalo=${workerEnv.WHATSAPP_SEND_INTERVAL_MS}ms, monitoramento=${monitoring ? "sentry" : "desligado"}, sites=${workerEnv.SITE_MONITOR_ENABLED ? "a cada 5 min" : "desligado"})`,
  );

  let running = false;

  const cycle = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processDueMessages({
        prisma,
        provider,
        maxPerCycle: workerEnv.WHATSAPP_SEND_MAX_PER_CYCLE,
        intervalMs: workerEnv.WHATSAPP_SEND_INTERVAL_MS,
      });
      if (result.claimed > 0) {
        log(
          `ciclo: devidas=${result.due} reivindicadas=${result.claimed} aceitas=${result.accepted} reagendadas=${result.retried} falhas=${result.failed} canceladas=${result.cancelled}`,
        );
      }
    } catch (error) {
      log(`erro no ciclo: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      captureWorkerError(error, "cycle");
    } finally {
      running = false;
    }
  };

  let checkingSites = false;
  const monitorCycle = async () => {
    if (checkingSites) return;
    checkingSites = true;
    try {
      const result = await checkSites({ prisma, fetchImpl: fetch as unknown as FetchLike });
      log(`monitor: ${result.checked} site(s), no ar=${result.up}, fora=${result.down}, histórico limpo=${result.purged}`);
    } catch (error) {
      log(`erro no monitor: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      captureWorkerError(error, "site-monitor");
    } finally {
      checkingSites = false;
    }
  };

  const poll = setInterval(() => void cycle(), workerEnv.WORKER_POLL_INTERVAL_MS);
  const monitorPoll = workerEnv.SITE_MONITOR_ENABLED
    ? setInterval(() => void monitorCycle(), SITE_MONITOR_INTERVAL_MS)
    : null;
  const heartbeat = setInterval(() => log("heartbeat"), HEARTBEAT_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    log(`sinal ${signal} recebido, encerrando`);
    clearInterval(poll);
    if (monitorPoll) clearInterval(monitorPoll);
    clearInterval(heartbeat);
    await prisma.$disconnect();
    await flushWorkerMonitoring();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await cycle();
  if (workerEnv.SITE_MONITOR_ENABLED) void monitorCycle();
}

main().catch(async (error) => {
  log(`falha ao iniciar: ${error instanceof Error ? error.message : "erro desconhecido"}`);
  captureWorkerError(error, "boot");
  await flushWorkerMonitoring();
  process.exit(1);
});
