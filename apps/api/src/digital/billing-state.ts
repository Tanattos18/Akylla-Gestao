import type { DeliveryStatus, Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";
import {
  BILLING_DUE_SOON_DAYS,
  billingStateSeverity,
  parseContractReceivableOriginId,
  type BillingState,
  type BillingStatusDto,
} from "@petflow/shared";

/**
 * Situação de cobrança (2026-10-27), sempre calculada no servidor a partir
 * dos títulos em aberto do contrato, do prazo combinado e do status da
 * entrega. O "dia" é o dia local do Brasil (UTC−3), como no worker.
 */

const DAY_MS = 86_400_000;
const LOCAL_OFFSET_MS = -3 * 60 * 60 * 1000;

export function localDay(date: Date): number {
  return Math.floor((date.getTime() + LOCAL_OFFSET_MS) / DAY_MS);
}

/** "AAAA-MM-DD" → fim desse dia no horário de Brasília. */
export function endOfLocalDay(day: string): Date {
  return new Date(`${day}T23:59:59.999-03:00`);
}

export interface ContractFacts {
  contractStatus: SubscriptionStatus;
  deliveryStatus: DeliveryStatus | null;
  endAt: Date;
  graceUntil: Date | null;
  /** Títulos em aberto do contrato (vencimento e valor). */
  openDues: Array<{ dueDate: Date; amount: Prisma.Decimal }>;
}

export function computeBillingStatus(facts: ContractFacts, debtDays: number, now: Date): BillingStatusDto {
  const today = localDay(now);
  const graceUntil = facts.graceUntil?.toISOString() ?? null;
  const base = { graceUntil, agreementBroken: false };
  const dues = [...facts.openDues].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const first = dues[0];
  const dueInfo = first
    ? { daysToDue: localDay(first.dueDate) - today, dueDate: first.dueDate.toISOString(), amount: first.amount.toFixed(2) }
    : { daysToDue: localDay(facts.endAt) - today, dueDate: facts.endAt.toISOString(), amount: null };

  if (facts.contractStatus === "CANCELLED" || facts.deliveryStatus === "CANCELLED") {
    return { ...base, ...dueInfo, state: "INATIVO" };
  }
  if (facts.deliveryStatus === "PAUSED") return { ...base, ...dueInfo, state: "PAUSADO" };

  if (first && dueInfo.daysToDue < 0) {
    const overdueDays = -dueInfo.daysToDue;
    const graceActive = facts.graceUntil !== null && localDay(facts.graceUntil) >= today;
    if (graceActive) return { ...base, ...dueInfo, state: "EM_ACORDO" };
    const agreementBroken = facts.graceUntil !== null;
    const state: BillingState = overdueDays >= debtDays || agreementBroken ? "EM_DEBITO" : "VENCIDO";
    return { ...base, ...dueInfo, agreementBroken, state };
  }
  if (dueInfo.daysToDue <= BILLING_DUE_SOON_DAYS) return { ...base, ...dueInfo, state: "VENCE_EM" };
  return { ...base, ...dueInfo, state: "EM_DIA" };
}

export function worst(states: BillingStatusDto[]): BillingStatusDto | null {
  return states.reduce<BillingStatusDto | null>(
    (acc, s) => (!acc || billingStateSeverity[s.state] > billingStateSeverity[acc.state] ? s : acc),
    null,
  );
}

type Db = Pick<PrismaClient, "subscription" | "financialEntry" | "company">;

export interface CompanyBillingStatuses {
  bySubscription: Map<string, BillingStatusDto & { subscriptionId: string; clientId: string; deliveryId: string | null }>;
  byDelivery: Map<string, BillingStatusDto>;
  byClient: Map<string, BillingStatusDto>;
}

/** Situação de todos os contratos da empresa (e o pior por entrega e por cliente). */
export async function loadBillingStatuses(db: Db, companyId: string, now = new Date()): Promise<CompanyBillingStatuses> {
  const [company, contracts, open] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { overduePauseDays: true } }),
    db.subscription.findMany({
      where: { companyId },
      select: {
        id: true,
        clientId: true,
        deliveryId: true,
        status: true,
        endAt: true,
        graceUntil: true,
        delivery: { select: { status: true } },
      },
    }),
    db.financialEntry.findMany({
      where: { companyId, origin: "SUBSCRIPTION", direction: "RECEIVABLE", status: "OPEN" },
      select: { originId: true, dueDate: true, amount: true },
    }),
  ]);
  const debtDays = company?.overduePauseDays ?? 10;
  const duesBySub = new Map<string, Array<{ dueDate: Date; amount: Prisma.Decimal }>>();
  for (const entry of open) {
    const parsed = parseContractReceivableOriginId(entry.originId ?? "");
    if (!parsed) continue;
    const list = duesBySub.get(parsed.subscriptionId) ?? [];
    list.push({ dueDate: entry.dueDate, amount: entry.amount });
    duesBySub.set(parsed.subscriptionId, list);
  }

  const result: CompanyBillingStatuses = { bySubscription: new Map(), byDelivery: new Map(), byClient: new Map() };
  const perDelivery = new Map<string, BillingStatusDto[]>();
  const perClient = new Map<string, BillingStatusDto[]>();
  for (const c of contracts) {
    const status = computeBillingStatus(
      {
        contractStatus: c.status,
        deliveryStatus: c.delivery?.status ?? null,
        endAt: c.endAt,
        graceUntil: c.graceUntil,
        openDues: duesBySub.get(c.id) ?? [],
      },
      debtDays,
      now,
    );
    result.bySubscription.set(c.id, { ...status, subscriptionId: c.id, clientId: c.clientId, deliveryId: c.deliveryId });
    if (c.deliveryId) perDelivery.set(c.deliveryId, [...(perDelivery.get(c.deliveryId) ?? []), status]);
    perClient.set(c.clientId, [...(perClient.get(c.clientId) ?? []), status]);
  }
  for (const [id, list] of perDelivery) result.byDelivery.set(id, worst(list)!);
  for (const [id, list] of perClient) result.byClient.set(id, worst(list)!);
  return result;
}
