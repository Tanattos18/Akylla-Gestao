import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthContext } from "../common/decorators/auth.decorator";

type Tx = Prisma.TransactionClient;

/**
 * Liberação de comissão (Fase 2 · 2.1/2.2) — função de transação sem DI,
 * usada pelo CommissionsService (venda paga na hora / liberação manual) e
 * pelo FinancialService (última parcela do crediário paga), sem dependência
 * circular entre os módulos.
 *
 * PENDING → RELEASED + conta a pagar (origin COMMISSION).
 */
export async function releaseCommissionInTx(
  tx: Tx,
  auth: AuthContext,
  commissionId: string,
  label: string,
): Promise<void> {
  const now = new Date();
  const updated = await tx.commission.updateMany({
    where: { id: commissionId, companyId: auth.companyId, status: "PENDING" },
    data: { status: "RELEASED", releasedAt: now },
  });
  if (updated.count === 0) throw new ConflictException("Comissão não está pendente");
  const commission = await tx.commission.findFirstOrThrow({
    where: { id: commissionId },
    select: { amount: true },
  });
  const entry = await tx.financialEntry.create({
    data: {
      companyId: auth.companyId,
      direction: "PAYABLE",
      description: `Comissão: ${label}`,
      amount: commission.amount,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      origin: "COMMISSION",
      originId: commissionId,
      createdByUserId: auth.userId,
    },
    select: { id: true },
  });
  await tx.commission.update({ where: { id: commissionId }, data: { financialEntryId: entry.id } });
}

/**
 * Venda a prazo totalmente paga (Fase 2 · 2.2): libera as comissões que
 * aguardavam o pagamento (ON_PAYMENT / SPLIT_50_50).
 */
export async function releasePendingCommissionsForSale(tx: Tx, auth: AuthContext, saleId: string): Promise<number> {
  const pending = await tx.commission.findMany({
    where: { saleId, companyId: auth.companyId, status: "PENDING" },
    select: { id: true, professional: { select: { name: true } }, sale: { select: { receiptCode: true } } },
  });
  for (const c of pending) {
    await releaseCommissionInTx(tx, auth, c.id, `${c.professional.name} — venda ${c.sale?.receiptCode ?? ""}`.trim());
  }
  return pending.length;
}

/**
 * OS concluída e recebida (Fase 2 · 2.3): libera as comissões que aguardavam
 * o pagamento.
 */
export async function releasePendingCommissionsForServiceOrder(
  tx: Tx,
  auth: AuthContext,
  serviceOrderId: string,
): Promise<number> {
  const pending = await tx.commission.findMany({
    where: { serviceOrderId, companyId: auth.companyId, status: "PENDING" },
    select: { id: true, professional: { select: { name: true } }, serviceOrder: { select: { number: true } } },
  });
  for (const c of pending) {
    await releaseCommissionInTx(tx, auth, c.id, `${c.professional.name} — OS ${c.serviceOrder?.number ?? ""}`.trim());
  }
  return pending.length;
}
