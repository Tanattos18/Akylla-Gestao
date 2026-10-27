import type { Prisma } from "@prisma/client";
import { contractReceivableOriginId, parseContractReceivableOriginId } from "@petflow/shared";

const DAY_MS = 86_400_000;

/**
 * Título de contrato pago no Financeiro (2026-10-24):
 * - "inicio": quita o primeiro período (só marca o pagamento);
 * - "renovacao": se ainda é o período seguinte do contrato, renova — novo
 *   período começa em max(agora, fim atual), mesma regra da renovação pelo
 *   caixa. Se o contrato já foi renovado por outro caminho, só registra.
 * Contrato cancelado não é reativado.
 */
export async function applyContractPayment(
  tx: Prisma.TransactionClient,
  companyId: string,
  originId: string,
  paidAt: Date,
): Promise<void> {
  const parsed = parseContractReceivableOriginId(originId);
  if (!parsed) return;
  const subscription = await tx.subscription.findFirst({
    where: { id: parsed.subscriptionId, companyId },
    include: { plan: { select: { durationDays: true } } },
  });
  if (!subscription || subscription.status === "CANCELLED") return;
  await resumeAfterPayment(tx, companyId, subscription.id, paidAt);

  const isNextPeriod =
    parsed.kind === "renovacao" && subscription.endAt.toISOString().slice(0, 10) === parsed.day;
  if (!isNextPeriod) {
    await tx.subscription.update({ where: { id: subscription.id }, data: { lastPaymentAt: paidAt } });
    return;
  }

  const startAt = subscription.endAt.getTime() > paidAt.getTime() ? subscription.endAt : paidAt;
  await tx.subscription.update({
    where: { id: subscription.id },
    data: {
      startAt,
      endAt: new Date(startAt.getTime() + subscription.plan.durationDays * DAY_MS),
      status: "ACTIVE",
      renewalCount: { increment: 1 },
      lastPaymentAt: paidAt,
    },
  });
}

/**
 * Renovação pelo caixa: o título de renovação já gerado para o fim antigo
 * fica quitado com o mesmo movimento (sem cobrar duas vezes).
 */
export async function settleRenewalReceivable(
  tx: Prisma.TransactionClient,
  params: { companyId: string; subscriptionId: string; previousEndAt: Date; paidAt: Date; cashMovementId: string },
): Promise<void> {
  await tx.financialEntry.updateMany({
    where: {
      companyId: params.companyId,
      origin: "SUBSCRIPTION",
      originId: contractReceivableOriginId(params.subscriptionId, "renovacao", params.previousEndAt),
      status: "OPEN",
    },
    data: { status: "PAID", paidAt: params.paidAt, cashMovementId: params.cashMovementId },
  });
}

/**
 * Depois de um pagamento (2026-10-27): sem outro título vencido em aberto, o
 * prazo combinado é encerrado e a entrega pausada POR DÉBITO volta ao ar
 * sozinha. Entrega inativada (cliente desistiu) ou pausada por outro motivo
 * não é tocada.
 */
export async function resumeAfterPayment(
  tx: Prisma.TransactionClient,
  companyId: string,
  subscriptionId: string,
  paidAt: Date,
): Promise<void> {
  const stillOverdue = await tx.financialEntry.count({
    where: {
      companyId,
      origin: "SUBSCRIPTION",
      status: "OPEN",
      originId: { startsWith: `${subscriptionId}:` },
      dueDate: { lt: paidAt },
    },
  });
  if (stillOverdue > 0) return;
  const subscription = await tx.subscription.update({
    where: { id: subscriptionId },
    data: { graceUntil: null, graceNote: null },
    select: { deliveryId: true, delivery: { select: { status: true, pausedForDebt: true } } },
  });
  if (!subscription.deliveryId || subscription.delivery?.status !== "PAUSED" || !subscription.delivery.pausedForDebt) return;
  const resumed = await tx.clientDelivery.updateMany({
    where: { id: subscription.deliveryId, companyId, status: "PAUSED", pausedForDebt: true },
    data: { status: "ACTIVE", pausedForDebt: false, statusChangedAt: paidAt },
  });
  if (resumed.count > 0) {
    await tx.billingActionLog.create({
      data: {
        companyId,
        deliveryId: subscription.deliveryId,
        subscriptionId,
        action: "AUTO_RESUME",
        fromStatus: "PAUSED",
        toStatus: "ACTIVE",
        reason: "Pagamento registrado",
      },
    });
  }
}
