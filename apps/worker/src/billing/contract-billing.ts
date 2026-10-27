import type { PrismaClient } from "@prisma/client";
import { toE164 } from "@petflow/whatsapp";

/**
 * Cobrança automática dos contratos (2026-10-24), rodada pelo worker:
 *
 * 1. `generateContractReceivables` — cada contrato ativo (ou vencido, sem
 *    cancelamento) de empresa ativa ganha o título a receber do período
 *    seguinte quando faltam 30 dias ou menos para o fim; contrato novo sem
 *    pagamento ganha o título do primeiro período. Idempotente pelo unique
 *    (companyId, origin, originId) — `createMany({ skipDuplicates })`.
 * 2. `queueContractReminders` — mensagens de WhatsApp de cobrança 3 dias
 *    antes, no dia e no aviso de atraso (dia `overdueWarnDays`). NÃO pausa
 *    nada. Respeita consentimento, telefone válido e integração ativa; com o
 *    provedor de simulação (sem token da Meta) o processador só registra.
 *    Nunca cobra clientes que têm entrega "nunca pausar".
 *
 * Formato do originId e nomes dos modelos repetem @petflow/shared
 * (`contractReceivableOriginId`, `CONTRACT_BILLING_TEMPLATES`): o worker não
 * depende do pacote shared.
 */

const DAY_MS = 86_400_000;
/** Brasil (UTC−3): o "dia" da cobrança é o dia local. */
const LOCAL_OFFSET_MS = -3 * 60 * 60 * 1000;
export const CONTRACT_BILLING_LEAD_DAYS = 30;
/** Primeiro período só é cobrado se começou há no máximo 60 dias. */
const FIRST_PERIOD_MAX_AGE_DAYS = 60;
export const CONTRACT_BILLING_INTERVAL_MS = 60 * 60 * 1000;

export const BILLING_TEMPLATES = {
  BEFORE: "cobranca_lembrete",
  DUE: "cobranca_vencimento",
  OVERDUE: "cobranca_atraso",
} as const;
export type ReminderKind = keyof typeof BILLING_TEMPLATES;
const TEMPLATE_VARIABLES = 5;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function originIdFor(subscriptionId: string, kind: "inicio" | "renovacao", due: Date): string {
  return `${subscriptionId}:${kind}:${isoDay(due)}`;
}

function localDayNumber(date: Date): number {
  return Math.floor((date.getTime() + LOCAL_OFFSET_MS) / DAY_MS);
}

function brl(value: { toFixed: (digits: number) => string }): string {
  const [int, cents] = value.toFixed(2).split(".");
  return `R$ ${int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}

function brDate(date: Date): string {
  const local = new Date(date.getTime() + LOCAL_OFFSET_MS);
  return `${String(local.getUTCDate()).padStart(2, "0")}/${String(local.getUTCMonth() + 1).padStart(2, "0")}/${local.getUTCFullYear()}`;
}

function variableCount(body: string): number {
  return new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;
}

export async function generateContractReceivables(params: {
  prisma: PrismaClient;
  now?: Date;
}): Promise<{ created: number }> {
  const { prisma } = params;
  const now = params.now ?? new Date();
  const lead = new Date(now.getTime() + CONTRACT_BILLING_LEAD_DAYS * DAY_MS);
  const firstPeriodCutoff = new Date(now.getTime() - FIRST_PERIOD_MAX_AGE_DAYS * DAY_MS);

  const contracts = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "EXPIRED"] }, company: { status: "ACTIVE" } },
    select: {
      id: true,
      companyId: true,
      clientId: true,
      startAt: true,
      endAt: true,
      renewalCount: true,
      lastPaymentAt: true,
      createdByUserId: true,
      plan: { select: { name: true, price: true } },
      client: { select: { name: true } },
      delivery: { select: { name: true } },
    },
  });

  const rows = [];
  for (const c of contracts) {
    const label = `${c.plan.name}${c.delivery ? ` — ${c.delivery.name}` : ""}`;
    const base = {
      companyId: c.companyId,
      direction: "RECEIVABLE" as const,
      amount: c.plan.price,
      clientId: c.clientId,
      origin: "SUBSCRIPTION" as const,
      createdByUserId: c.createdByUserId,
    };
    if (c.renewalCount === 0 && c.lastPaymentAt === null && c.startAt >= firstPeriodCutoff) {
      rows.push({
        ...base,
        description: `Contrato ${label} — ${c.client.name} (início em ${brDate(c.startAt)})`,
        dueDate: c.startAt,
        originId: originIdFor(c.id, "inicio", c.startAt),
      });
    }
    if (c.endAt <= lead) {
      rows.push({
        ...base,
        description: `Contrato ${label} — ${c.client.name} (renovação em ${brDate(c.endAt)})`,
        dueDate: c.endAt,
        originId: originIdFor(c.id, "renovacao", c.endAt),
      });
    }
  }
  if (rows.length === 0) return { created: 0 };
  const result = await prisma.financialEntry.createMany({ data: rows, skipDuplicates: true });
  return { created: result.count };
}

export async function queueContractReminders(params: {
  prisma: PrismaClient;
  countryCode: string;
  now?: Date;
}): Promise<{ queued: number; skipped: number }> {
  const { prisma } = params;
  const now = params.now ?? new Date();
  const today = localDayNumber(now);

  const entries = await prisma.financialEntry.findMany({
    where: {
      origin: "SUBSCRIPTION",
      direction: "RECEIVABLE",
      status: "OPEN",
      clientId: { not: null },
      // de 30 dias atrás (teto do aviso de atraso) até 4 dias à frente
      dueDate: { gte: new Date(now.getTime() - 31 * DAY_MS), lte: new Date(now.getTime() + 4 * DAY_MS) },
      company: { status: "ACTIVE" },
    },
    select: {
      id: true,
      companyId: true,
      amount: true,
      dueDate: true,
      originId: true,
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          mobile: true,
          whatsappConsent: { select: { id: true, status: true } },
          deliveries: { where: { neverPause: true }, select: { id: true }, take: 1 },
        },
      },
      company: { select: { pixKey: true, overdueWarnDays: true, overduePauseDays: true } },
    },
  });

  // Contrato (plano — entrega), status e prazo combinado pelo id no originId
  const subscriptionIds = [...new Set(entries.map((e) => (e.originId ?? "").split(":")[0]).filter(Boolean))] as string[];
  const contracts = new Map(
    (
      await prisma.subscription.findMany({
        where: { id: { in: subscriptionIds } },
        select: {
          id: true,
          status: true,
          graceUntil: true,
          plan: { select: { name: true } },
          delivery: { select: { name: true, status: true } },
        },
      })
    ).map((s) => [
      s.id,
      {
        label: `${s.plan.name}${s.delivery ? ` — ${s.delivery.name}` : ""}`,
        cancelled: s.status === "CANCELLED" || s.delivery?.status === "CANCELLED",
        graceUntil: s.graceUntil,
      },
    ]),
  );

  let queued = 0;
  let skipped = 0;
  const configCache = new Map<string, { phoneNumberId: string | null; status: string } | null>();
  const templateCache = new Map<string, { id: string; name: string; language: string; body: string } | null>();

  for (const entry of entries) {
    const client = entry.client;
    if (!client) continue;
    const info = contracts.get((entry.originId ?? "").split(":")[0] ?? "");
    // Contrato cancelado ou site inativado (cliente desistiu): não cobra
    if (info?.cancelled) continue;
    const daysUntil = localDayNumber(entry.dueDate) - today;
    const warnDays = entry.company.overdueWarnDays;
    const grace = info?.graceUntil ?? null;
    const graceActive = grace !== null && localDayNumber(grace) >= today;
    let kind: ReminderKind | null = null;
    if (daysUntil >= 1 && daysUntil <= 3) kind = "BEFORE";
    else if (daysUntil === 0) kind = "DUE";
    // Atraso: a partir do dia de aviso até o dia de débito; com prazo
    // combinado, espera o prazo e, se vencer sem pagamento, avisa de novo
    else if (daysUntil < 0 && !graceActive) {
      if (grace !== null || (-daysUntil >= Math.max(warnDays, 1) && -daysUntil < entry.company.overduePauseDays)) kind = "OVERDUE";
    }
    if (!kind) continue;

    // Produtos próprios / estratégicos: nunca cobrar automaticamente
    if (client.deliveries.length > 0) {
      skipped += 1;
      continue;
    }
    const consent = client.whatsappConsent;
    const toPhone = toE164(client.mobile || client.phone || "", params.countryCode);
    if (!consent || consent.status !== "OPTED_IN" || !toPhone) {
      skipped += 1;
      continue;
    }

    if (!configCache.has(entry.companyId)) {
      configCache.set(
        entry.companyId,
        await prisma.whatsAppConfig.findUnique({ where: { companyId: entry.companyId }, select: { phoneNumberId: true, status: true } }),
      );
    }
    const config = configCache.get(entry.companyId);
    if (!config || config.status === "DISCONNECTED" || !config.phoneNumberId) {
      skipped += 1;
      continue;
    }

    const templateKey = `${entry.companyId}:${kind}`;
    if (!templateCache.has(templateKey)) {
      const template = await prisma.whatsAppTemplate.findFirst({
        where: { companyId: entry.companyId, nameKey: BILLING_TEMPLATES[kind], status: "ACTIVE", approval: "APPROVED" },
        select: { id: true, name: true, language: true, body: true },
      });
      templateCache.set(templateKey, template && variableCount(template.body) === TEMPLATE_VARIABLES ? template : null);
    }
    const template = templateCache.get(templateKey);
    if (!template) {
      skipped += 1;
      continue;
    }

    // Depois de um prazo descumprido, o aviso de atraso sai uma vez por prazo
    const idempotencyKey = `cobranca:${entry.id}:${kind}${kind === "OVERDUE" && grace ? `:${isoDay(grace)}` : ""}`;
    const exists = await prisma.whatsAppMessage.findFirst({
      where: { companyId: entry.companyId, idempotencyKey },
      select: { id: true },
    });
    if (exists) continue;

    const contract = info?.label ?? "seu contrato";
    const variables = [
      client.name,
      contract,
      brl(entry.amount),
      brDate(entry.dueDate),
      entry.company.pixKey ?? "peça a chave Pix respondendo esta mensagem",
    ];
    try {
      await prisma.whatsAppMessage.create({
        data: {
          companyId: entry.companyId,
          clientId: client.id,
          templateId: template.id,
          consentId: consent.id,
          toPhone,
          variables,
          templateNameSnapshot: template.name,
          templateLanguageSnapshot: template.language,
          templateBodySnapshot: template.body,
          origin: "CONTRACT_BILLING",
          originId: entry.id,
          idempotencyKey,
          nextAttemptAt: now,
        },
      });
      queued += 1;
    } catch (error) {
      // Corrida com outro worker: o unique (companyId, idempotencyKey) segura
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }

  return { queued, skipped };
}

/**
 * Pausa automática (2026-10-27) — DESLIGADA por padrão; só roda para a
 * empresa que ligou "pausar automaticamente após N dias em débito". Nunca
 * toca entrega "nunca pausar", entrega já pausada/inativa nem contrato em
 * prazo combinado. A entrega fica marcada `pausedForDebt` e volta sozinha
 * quando o pagamento é registrado.
 */
export async function autoPauseOverdue(params: { prisma: PrismaClient; now?: Date }): Promise<{ paused: number }> {
  const { prisma } = params;
  const now = params.now ?? new Date();
  const today = localDayNumber(now);
  const companies = await prisma.company.findMany({
    where: { status: "ACTIVE", autoPauseEnabled: true },
    select: { id: true, autoPauseDays: true },
  });
  let paused = 0;
  for (const company of companies) {
    const contracts = await prisma.subscription.findMany({
      where: {
        companyId: company.id,
        status: { not: "CANCELLED" },
        delivery: { status: "ACTIVE", neverPause: false },
      },
      select: { id: true, graceUntil: true, deliveryId: true },
    });
    for (const contract of contracts) {
      if (contract.graceUntil && localDayNumber(contract.graceUntil) >= today) continue;
      const oldest = await prisma.financialEntry.findFirst({
        where: {
          companyId: company.id,
          origin: "SUBSCRIPTION",
          status: "OPEN",
          originId: { startsWith: `${contract.id}:` },
        },
        orderBy: { dueDate: "asc" },
        select: { dueDate: true },
      });
      if (!oldest) continue;
      const overdueDays = today - localDayNumber(oldest.dueDate);
      if (overdueDays < company.autoPauseDays || !contract.deliveryId) continue;
      const deliveryId = contract.deliveryId;
      await prisma.$transaction(async (tx) => {
        // Condições repetidas no WHERE: nunca pausa "nunca pausar", mesmo em corrida
        const result = await tx.clientDelivery.updateMany({
          where: { id: deliveryId, companyId: company.id, status: "ACTIVE", neverPause: false },
          data: { status: "PAUSED", pausedForDebt: true, statusChangedAt: now },
        });
        if (result.count === 0) return;
        paused += 1;
        await tx.billingActionLog.create({
          data: {
            companyId: company.id,
            deliveryId,
            subscriptionId: contract.id,
            action: "AUTO_PAUSE",
            fromStatus: "ACTIVE",
            toStatus: "PAUSED",
            reason: `Pausa automática: ${overdueDays} dia(s) em atraso`,
          },
        });
      });
    }
  }
  return { paused };
}
