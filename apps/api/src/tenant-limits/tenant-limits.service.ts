import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";

type LimitResource = "user" | "client" | "product";

const LIMIT_LABELS: Record<LimitResource, string> = {
  user: "usuários",
  client: "clientes",
  product: "produtos",
};

/**
 * Enforcement de limites do plano SaaS (TenantPlan) no backend.
 *
 * Regra (decisão D3 da Etapa 11): enforcement existe **apenas** quando a
 * empresa tem assinatura `ACTIVE`. Sem assinatura, expirada ou
 * cancelada — nenhum limite é aplicado (status quo).
 *
 * `NULL` no campo de limite = ilimitado (plano Completo).
 */
@Injectable()
export class TenantLimitsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertCanCreate(
    companyId: string,
    resource: LimitResource,
  ): Promise<void> {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { companyId },
      select: {
        status: true,
        plan: {
          select: {
            name: true,
            userLimit: true,
            clientLimit: true,
            productLimit: true,
          },
        },
      },
    });

    if (!subscription || subscription.status !== "ACTIVE") {
      return;
    }

    const limit =
      resource === "user"
        ? subscription.plan.userLimit
        : resource === "client"
          ? subscription.plan.clientLimit
          : subscription.plan.productLimit;

    if (limit === null) {
      return;
    }

    const count = await this.countResource(companyId, resource);

    if (count >= limit) {
      throw new ForbiddenException(
        `Limite do plano ${subscription.plan.name} atingido: ${limit} ${LIMIT_LABELS[resource]}. ` +
          `Contate a Akylla para fazer upgrade do plano.`,
      );
    }
  }

  private countResource(companyId: string, resource: LimitResource): Promise<number> {
    switch (resource) {
      case "user":
        return this.prisma.user.count({ where: { companyId } });
      case "client":
        return this.prisma.client.count({ where: { companyId } });
      case "product":
        return this.prisma.product.count({ where: { companyId } });
    }
  }
}
