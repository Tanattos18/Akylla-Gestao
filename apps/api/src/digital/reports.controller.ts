import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { digitalProductTypeLabels, parseContractReceivableOriginId, type DigitalReportsDto } from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";

const DAY_MS = 86_400_000;
const ZERO = new Prisma.Decimal(0);

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Relatórios de clientes e produtos digitais (2026-10-24): receita mensal
 * recorrente e recebido por mês, receita por produto do catálogo,
 * inadimplência e clientes por status. Tudo calculado no servidor.
 *
 * A receita recorrente de meses passados é aproximada: o contrato conta como
 * ativo no fim do mês se já existia, não estava cancelado e não tinha vencido
 * (o contrato guarda só o período atual).
 */
@Controller("digital")
export class DigitalReportsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("reports")
  async reports(@Auth() auth: AuthContext, @Query("months") monthsParam?: string): Promise<DigitalReportsDto> {
    const months = monthsParam === undefined ? 12 : Number(monthsParam);
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      throw new BadRequestException("months deve ser um inteiro de 1 a 24");
    }
    const companyId = auth.companyId;
    const now = new Date();
    const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const [contracts, paidEntries, cashRenewals, overdue, dueLast90, clients] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { companyId },
        select: {
          id: true,
          clientId: true,
          createdAt: true,
          cancelledAt: true,
          endAt: true,
          plan: { select: { price: true, durationDays: true } },
          delivery: { select: { type: true, product: { select: { name: true } } } },
        },
      }),
      this.prisma.financialEntry.findMany({
        where: { companyId, origin: "SUBSCRIPTION", direction: "RECEIVABLE", status: "PAID", paidAt: { gte: firstMonth } },
        select: { amount: true, paidAt: true, originId: true, cashMovementId: true },
      }),
      // Renovação pelo caixa sem título (o título quitado já conta acima)
      this.prisma.cashMovement.findMany({
        where: { companyId, type: "IN", subscriptionId: { not: null }, createdAt: { gte: firstMonth }, financialEntries: { none: {} } },
        select: { amount: true, createdAt: true, subscriptionId: true },
      }),
      this.prisma.financialEntry.findMany({
        where: { companyId, direction: "RECEIVABLE", status: "OPEN", dueDate: { lt: today } },
        select: { amount: true, dueDate: true, clientId: true, client: { select: { name: true } } },
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          companyId,
          direction: "RECEIVABLE",
          status: { not: "CANCELLED" },
          dueDate: { gte: new Date(today.getTime() - 90 * DAY_MS), lt: today },
        },
        _sum: { amount: true },
      }),
      this.prisma.client.findMany({ where: { companyId }, select: { id: true, status: true } }),
    ]);

    const monthly = (c: (typeof contracts)[number]) => c.plan.price.mul(30).div(c.plan.durationDays);
    const activeAt = (c: (typeof contracts)[number], point: Date) =>
      c.createdAt <= point && (c.cancelledAt === null || c.cancelledAt > point) && c.endAt >= point;
    const productOf = (c: (typeof contracts)[number] | undefined) =>
      c?.delivery ? (c.delivery.product?.name ?? digitalProductTypeLabels[c.delivery.type]) : "Sem entrega vinculada";
    const byId = new Map(contracts.map((c) => [c.id, c]));

    const payments = [
      ...paidEntries.map((e) => ({
        amount: e.amount,
        at: e.paidAt as Date,
        subscriptionId: parseContractReceivableOriginId(e.originId ?? "")?.subscriptionId ?? null,
      })),
      ...cashRenewals.map((m) => ({ amount: m.amount, at: m.createdAt, subscriptionId: m.subscriptionId })),
    ];

    const monthRows: DigitalReportsDto["months"] = [];
    for (let i = 0; i < months; i += 1) {
      const start = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + i, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1);
      const point = end < now ? end : now;
      const active = contracts.filter((c) => activeAt(c, point));
      const received = payments
        .filter((p) => p.at >= start && p.at <= end)
        .reduce((sum, p) => sum.add(p.amount), ZERO);
      monthRows.push({
        month: monthKey(start),
        monthlyRecurringRevenue: active.reduce((sum, c) => sum.add(monthly(c)), ZERO).toFixed(2),
        received: received.toFixed(2),
        activeContracts: active.length,
      });
    }

    const products = new Map<string, { received: Prisma.Decimal; mrr: Prisma.Decimal; contracts: number }>();
    const bucket = (name: string) => {
      let row = products.get(name);
      if (!row) {
        row = { received: ZERO, mrr: ZERO, contracts: 0 };
        products.set(name, row);
      }
      return row;
    };
    for (const c of contracts) {
      if (!activeAt(c, now)) continue;
      const row = bucket(productOf(c));
      row.mrr = row.mrr.add(monthly(c));
      row.contracts += 1;
    }
    for (const p of payments) {
      const row = bucket(productOf(p.subscriptionId ? byId.get(p.subscriptionId) : undefined));
      row.received = row.received.add(p.amount);
    }

    const overdueTotal = overdue.reduce((sum, e) => sum.add(e.amount), ZERO);
    const perClient = new Map<string, { name: string; total: Prisma.Decimal; count: number; oldest: Date }>();
    for (const e of overdue) {
      if (!e.clientId) continue;
      const row = perClient.get(e.clientId) ?? { name: e.client?.name ?? "—", total: ZERO, count: 0, oldest: e.dueDate };
      row.total = row.total.add(e.amount);
      row.count += 1;
      if (e.dueDate < row.oldest) row.oldest = e.dueDate;
      perClient.set(e.clientId, row);
    }
    const dueTotal = dueLast90._sum.amount ?? ZERO;

    const withActive = new Set(contracts.filter((c) => activeAt(c, now)).map((c) => c.clientId));
    const withOverdue = new Set(overdue.map((e) => e.clientId).filter((id): id is string => Boolean(id)));

    return {
      months: monthRows,
      revenueByProduct: [...products.entries()]
        .map(([product, row]) => ({
          product,
          received: row.received.toFixed(2),
          monthlyRecurringRevenue: row.mrr.toFixed(2),
          contracts: row.contracts,
        }))
        .sort((a, b) => Number(b.received) - Number(a.received) || Number(b.monthlyRecurringRevenue) - Number(a.monthlyRecurringRevenue)),
      delinquency: {
        overdueTotal: overdueTotal.toFixed(2),
        overdueCount: overdue.length,
        rate: dueTotal.isZero() ? 0 : Math.min(1, Number(overdueTotal.div(dueTotal).toFixed(4))),
        topClients: [...perClient.entries()]
          .map(([clientId, row]) => ({
            clientId,
            name: row.name,
            total: row.total.toFixed(2),
            count: row.count,
            oldestDueDate: row.oldest.toISOString(),
          }))
          .sort((a, b) => Number(b.total) - Number(a.total))
          .slice(0, 10),
      },
      clientsByStatus: {
        active: clients.filter((c) => c.status === "ACTIVE").length,
        inactive: clients.filter((c) => c.status !== "ACTIVE").length,
        withActiveContract: withActive.size,
        withOverdue: withOverdue.size,
        withoutContract: clients.filter((c) => c.status === "ACTIVE" && !withActive.has(c.id)).length,
      },
    };
  }
}
