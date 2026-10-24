import type { PrismaClient } from "@prisma/client";

/**
 * Monitor de sites das entregas (2026-10-23). SOMENTE LEITURA: faz HEAD e,
 * se o servidor recusar HEAD, um GET cujo corpo é descartado. Nunca envia
 * POST, formulário, cookie ou credencial — não altera nada nos sites.
 *
 * Mesmos valores de SITE_MONITOR_* em @petflow/shared (o worker não depende
 * do pacote shared).
 */
export const SITE_MONITOR_INTERVAL_MS = 5 * 60 * 1000;
export const SITE_MONITOR_TIMEOUT_MS = 10_000;
export const SITE_CHECK_RETENTION_DAYS = 30;
const USER_AGENT = "AkyllaMonitor/1.0 (+https://akyllagestao.com.br; somente leitura)";
const CONCURRENCY = 4;

export type FetchLike = (url: string, init: { method: "HEAD" | "GET"; redirect: "follow"; signal: AbortSignal; headers: Record<string, string> }) => Promise<{
  status: number;
  body?: { cancel: () => Promise<void> } | null;
}>;

export interface ProbeResult {
  ok: boolean;
  httpStatus: number | null;
  responseMs: number;
  error: string | null;
}

async function request(fetchImpl: FetchLike, url: string, method: "HEAD" | "GET", timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    });
    // Corpo nunca é lido: só o status interessa
    await response.body?.cancel().catch(() => undefined);
    return response.status;
  } finally {
    clearTimeout(timer);
  }
}

/** HEAD; se vier erro HTTP (alguns servidores recusam HEAD), confirma com GET. */
export async function probeSite(url: string, fetchImpl: FetchLike, timeoutMs = SITE_MONITOR_TIMEOUT_MS): Promise<ProbeResult> {
  const started = Date.now();
  try {
    let status = await request(fetchImpl, url, "HEAD", timeoutMs);
    if (status >= 400) status = await request(fetchImpl, url, "GET", timeoutMs);
    return { ok: status < 400, httpStatus: status, responseMs: Date.now() - started, error: status < 400 ? null : `HTTP ${status}` };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      httpStatus: null,
      responseMs: Date.now() - started,
      error: aborted ? `sem resposta em ${Math.round(timeoutMs / 1000)}s` : (error instanceof Error ? error.message : "falha de conexão").slice(0, 200),
    };
  }
}

/** Checa todas as entregas no ar com site e monitor ligado; grava status e histórico. */
export async function checkSites(params: {
  prisma: PrismaClient;
  fetchImpl: FetchLike;
  now?: () => Date;
  timeoutMs?: number;
}): Promise<{ checked: number; up: number; down: number; purged: number }> {
  const { prisma, fetchImpl } = params;
  const now = params.now ?? (() => new Date());
  const deliveries = await prisma.clientDelivery.findMany({
    where: { monitorEnabled: true, status: "ACTIVE", siteUrl: { not: null } },
    select: { id: true, companyId: true, siteUrl: true, monitorStatus: true, monitorDownSince: true },
  });

  let up = 0;
  let down = 0;
  for (let i = 0; i < deliveries.length; i += CONCURRENCY) {
    const batch = deliveries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (delivery) => {
        const url = delivery.siteUrl as string;
        const result = await probeSite(url, fetchImpl, params.timeoutMs);
        const checkedAt = now();
        if (result.ok) up += 1;
        else down += 1;
        await prisma.$transaction([
          prisma.clientDelivery.update({
            where: { id: delivery.id },
            data: {
              monitorStatus: result.ok ? "UP" : "DOWN",
              monitorHttpStatus: result.httpStatus,
              monitorResponseMs: result.responseMs,
              monitorCheckedAt: checkedAt,
              // Mantém o início da queda enquanto continuar fora do ar
              monitorDownSince: result.ok ? null : (delivery.monitorStatus === "DOWN" ? delivery.monitorDownSince : null) ?? checkedAt,
            },
          }),
          prisma.siteCheck.create({
            data: {
              companyId: delivery.companyId,
              deliveryId: delivery.id,
              url,
              ok: result.ok,
              httpStatus: result.httpStatus,
              responseMs: result.responseMs,
              error: result.error,
              checkedAt,
            },
          }),
        ]);
      }),
    );
  }

  const cutoff = new Date(now().getTime() - SITE_CHECK_RETENTION_DAYS * 86_400_000);
  const purged = await prisma.siteCheck.deleteMany({ where: { checkedAt: { lt: cutoff } } });

  return { checked: deliveries.length, up, down, purged: purged.count };
}
