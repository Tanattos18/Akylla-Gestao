import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type { CancelTenantSubscriptionInput } from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const planSelect = {
  id: true,
  name: true,
  description: true,
  priceMonthly: true,
  priceYearly: true,
  durationDays: true,
  userLimit: true,
  clientLimit: true,
  productLimit: true,
  active: true,
} as const;

type TenantPlanRecord = Prisma.TenantPlanGetPayload<{ select: typeof planSelect }>;

function formatPlan(plan: TenantPlanRecord) {
  return {
    ...plan,
    priceMonthly: plan.priceMonthly.toFixed(2),
    priceYearly: plan.priceYearly?.toFixed(2) ?? null,
  };
}

const subscriptionSelect = {
  id: true,
  companyId: true,
  planId: true,
  status: true,
  billingCycle: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelReason: true,
  cancelledAt: true,
  changedByUserId: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: planSelect },
} as const;

type TenantSubscriptionRecord = Prisma.TenantSubscriptionGetPayload<{
  select: typeof subscriptionSelect;
}>;

function formatSubscription(subscription: TenantSubscriptionRecord) {
  return {
    ...subscription,
    plan: formatPlan(subscription.plan),
  };
}

@Injectable()
export class BillingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPlans() {
    const plans = await this.prisma.tenantPlan.findMany({
      where: { active: true },
      select: planSelect,
      orderBy: { priceMonthly: "asc" },
    });
    return { items: plans.map(formatPlan) };
  }

  private async expireStale(companyId: string) {
    await this.prisma.tenantSubscription.updateMany({
      where: {
        companyId,
        status: "ACTIVE",
        currentPeriodEnd: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  }

  async getSubscription(auth: AuthContext) {    await this.expireStale(auth.companyId);

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { companyId: auth.companyId },
      select: subscriptionSelect,
    });

    if (!subscription) {
      throw new NotFoundException("Assinatura não encontrada");
    }

    return formatSubscription(subscription);
  }

  /**
   * Uso do plano (N3 · 6.1): limites do plano da assinatura + consumo atual
   * (usuários, clientes, produtos) da própria empresa. `NULL` = ilimitado.
   * Sem assinatura, retorna `subscription: null` com o consumo mesmo assim.
   */
  async getUsage(auth: AuthContext) {
    await this.expireStale(auth.companyId);

    const [subscription, users, clients, products] = await Promise.all([
      this.prisma.tenantSubscription.findUnique({
        where: { companyId: auth.companyId },
        select: subscriptionSelect,
      }),
      this.prisma.user.count({ where: { companyId: auth.companyId } }),
      this.prisma.client.count({ where: { companyId: auth.companyId } }),
      this.prisma.product.count({ where: { companyId: auth.companyId } }),
    ]);

    return {
      subscription: subscription ? formatSubscription(subscription) : null,
      usage: { users, clients, products },
    };
  }

  async cancel(auth: AuthContext, input: CancelTenantSubscriptionInput) {
    const existing = await this.prisma.tenantSubscription.findUnique({
      where: { companyId: auth.companyId },
    });
    if (!existing) {
      throw new NotFoundException("Assinatura não encontrada");
    }

    const result = await this.prisma.tenantSubscription.updateMany({
      where: { companyId: auth.companyId, status: { not: "CANCELLED" } },
      data: {
        status: "CANCELLED",
        cancelReason: input.reason || null,
        cancelledAt: new Date(),
        changedByUserId: auth.userId,
      },
    });
    if (result.count === 0) {
      throw new ConflictException("Assinatura já cancelada");
    }

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { companyId: auth.companyId },
      select: subscriptionSelect,
    });
    return formatSubscription(subscription!);
  }
}
