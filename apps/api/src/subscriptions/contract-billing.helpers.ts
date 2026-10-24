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
