import { Controller, Get, Inject } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { DigitalOverviewDto } from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const UPCOMING_LIMIT = 20;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Início (2026-10-23): receita mensal recorrente, a receber em 30 dias,
 * atrasados, vencimentos de contrato/domínio/hospedagem em 30 dias e sites
 * fora do ar (monitor). Tudo calculado no servidor.
 */
@Controller("digital")
export class DigitalOverviewController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("overview")
  async overview(@Auth() auth: AuthContext): Promise<DigitalOverviewDto> {
    const companyId = auth.companyId;
    const now = new Date();
    const today = startOfUtcDay(now);
    const limit = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);

    const [contracts, receivable, overdue, expiring, domains, hostings, down, monitoredSites] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { companyId, status: "ACTIVE", endAt: { gte: now } },
        select: { plan: { select: { price: true, durationDays: true } } },
      }),
      this.prisma.financialEntry.aggregate({
        where: { companyId, direction: "RECEIVABLE", status: "OPEN", dueDate: { gte: today, lte: limit } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: { companyId, direction: "RECEIVABLE", status: "OPEN", dueDate: { lt: today } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.subscription.findMany({
        where: { companyId, status: "ACTIVE", endAt: { gte: now, lte: limit } },
        select: { id: true, endAt: true, plan: { select: { name: true } }, client: { select: { name: true } } },
        orderBy: { endAt: "asc" },
        take: UPCOMING_LIMIT,
      }),
      this.prisma.clientDelivery.findMany({
        where: { companyId, status: { not: "CANCELLED" }, domainRenewalAt: { gte: today, lte: limit } },
        select: { id: true, name: true, domain: true, domainRenewalAt: true, client: { select: { name: true } } },
        orderBy: { domainRenewalAt: "asc" },
        take: UPCOMING_LIMIT,
      }),
      this.prisma.clientDelivery.findMany({
        where: { companyId, status: { not: "CANCELLED" }, hostingRenewalAt: { gte: today, lte: limit } },
        select: { id: true, name: true, hostingProvider: true, hostingRenewalAt: true, client: { select: { name: true } } },
        orderBy: { hostingRenewalAt: "asc" },
        take: UPCOMING_LIMIT,
      }),
      this.prisma.clientDelivery.findMany({
        where: { companyId, status: "ACTIVE", monitorEnabled: true, monitorStatus: "DOWN" },
        select: {
          id: true,
          name: true,
          siteUrl: true,
          neverPause: true,
          monitorDownSince: true,
          monitorHttpStatus: true,
          client: { select: { name: true } },
        },
        orderBy: { monitorDownSince: "asc" },
      }),
      this.prisma.clientDelivery.count({
        where: { companyId, status: "ACTIVE", monitorEnabled: true, siteUrl: { not: null } },
      }),
    ]);

    const daysUntil = (date: Date) => Math.max(0, Math.round((startOfUtcDay(date).getTime() - today.getTime()) / DAY_MS));

    // Contrato de N dias vale preço × 30 / N por mês
    const mrr = contracts.reduce(
      (sum, c) => sum.add(c.plan.price.mul(30).div(c.plan.durationDays)),
      new Prisma.Decimal(0),
    );

    const upcoming: DigitalOverviewDto["upcoming"] = [
      ...expiring.map((c) => ({
        kind: "CONTRACT" as const,
        date: c.endAt.toISOString(),
        daysLeft: daysUntil(c.endAt),
        title: `Contrato vence: ${c.plan.name}`,
        clientName: c.client.name,
        href: `/assinaturas/${c.id}`,
      })),
      ...domains.map((d) => ({
        kind: "DOMAIN" as const,
        date: (d.domainRenewalAt as Date).toISOString(),
        daysLeft: daysUntil(d.domainRenewalAt as Date),
        title: `Domínio renova: ${d.domain ?? d.name}`,
        clientName: d.client.name,
        href: `/entregas/${d.id}`,
      })),
      ...hostings.map((d) => ({
        kind: "HOSTING" as const,
        date: (d.hostingRenewalAt as Date).toISOString(),
        daysLeft: daysUntil(d.hostingRenewalAt as Date),
        title: `Hospedagem renova: ${d.name}${d.hostingProvider ? ` (${d.hostingProvider})` : ""}`,
        clientName: d.client.name,
        href: `/entregas/${d.id}`,
      })),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, UPCOMING_LIMIT);

    return {
      monthlyRecurringRevenue: mrr.toFixed(2),
      activeContracts: contracts.length,
      receivableNext30: { total: (receivable._sum.amount ?? new Prisma.Decimal(0)).toFixed(2), count: receivable._count },
      overdueReceivables: { total: (overdue._sum.amount ?? new Prisma.Decimal(0)).toFixed(2), count: overdue._count },
      upcoming,
      sitesDown: down.map((d) => ({
        deliveryId: d.id,
        name: d.name,
        clientName: d.client.name,
        url: d.siteUrl ?? "",
        since: d.monitorDownSince?.toISOString() ?? null,
        httpStatus: d.monitorHttpStatus,
        neverPause: d.neverPause,
      })),
      monitoredSites,
    };
  }
}
