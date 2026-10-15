import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";

/**
 * Portabilidade e encerramento (N3 · 9.3): exporta todos os dados de negócio
 * da própria empresa em JSON documentado. Nunca inclui segredos
 * (`passwordHash`, `tokenHash` de sessão, tokens de integração).
 */
@Injectable()
export class CompanyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async exportCompany(auth: AuthContext) {
    const companyId = auth.companyId;

    const [
      company,
      users,
      categories,
      suppliers,
      products,
      stockMovements,
      clients,
      pets,
      services,
      sales,
      saleItems,
      cashSessions,
      cashMovements,
      financialEntries,
      appointments,
      subscriptionPlans,
      subscriptions,
      tenantSubscription,
      companyModules,
      importBatches,
      legalConsents,
      whatsappConfig,
      whatsappTemplates,
      whatsappConsents,
      whatsappMessages,
    ] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId } }),
      this.prisma.user.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.category.findMany({ where: { companyId } }),
      this.prisma.supplier.findMany({ where: { companyId } }),
      this.prisma.product.findMany({ where: { companyId } }),
      this.prisma.stockMovement.findMany({ where: { companyId } }),
      this.prisma.client.findMany({ where: { companyId } }),
      this.prisma.pet.findMany({ where: { companyId } }),
      this.prisma.service.findMany({ where: { companyId } }),
      this.prisma.sale.findMany({ where: { companyId } }),
      this.prisma.saleItem.findMany({ where: { sale: { companyId } } }),
      this.prisma.cashSession.findMany({ where: { companyId } }),
      this.prisma.cashMovement.findMany({ where: { companyId } }),
      this.prisma.financialEntry.findMany({ where: { companyId } }),
      this.prisma.appointment.findMany({ where: { companyId } }),
      this.prisma.subscriptionPlan.findMany({ where: { companyId } }),
      this.prisma.subscription.findMany({ where: { companyId } }),
      this.prisma.tenantSubscription.findUnique({ where: { companyId } }),
      this.prisma.companyModule.findMany({ where: { companyId } }),
      this.prisma.importBatch.findMany({ where: { companyId } }),
      this.prisma.legalConsent.findMany({ where: { companyId } }),
      this.prisma.whatsAppConfig.findUnique({ where: { companyId } }),
      this.prisma.whatsAppTemplate.findMany({ where: { companyId } }),
      this.prisma.whatsAppConsent.findMany({ where: { companyId } }),
      this.prisma.whatsAppMessage.findMany({ where: { companyId } }),
    ]);

    if (!company) {
      throw new NotFoundException("Empresa não encontrada");
    }

    return {
      exportedAt: new Date().toISOString(),
      company,
      users,
      categories,
      suppliers,
      products,
      stockMovements,
      clients,
      pets,
      services,
      sales,
      saleItems,
      cashSessions,
      cashMovements,
      financialEntries,
      appointments,
      subscriptionPlans,
      subscriptions,
      tenantSubscription,
      companyModules,
      importBatches,
      legalConsents,
      whatsappConfig,
      whatsappTemplates,
      whatsappConsents,
      whatsappMessages,
    };
  }
}
