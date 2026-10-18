import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  BUSINESS_MODULES,
  type ApplyOnboardingInput,
  type BusinessModule,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { PrismaService } from "../prisma/prisma.module";

export interface OnboardingPresetDto {
  slug: string;
  name: string;
  description: string;
  defaultModules: BusinessModule[];
  defaultFiscalEnabled: boolean;
}

export interface OnboardingStatusDto {
  segment: string | null;
  completed: boolean;
  completedAt: string | null;
}

/**
 * Onboarding por perfil (Fase 4): o cliente escolhe Comércio, Serviços,
 * Híbrido ou Personalizado e o sistema liga os módulos do perfil. O catálogo
 * de perfis é global (dados de referência da migration).
 */
@Injectable()
export class OnboardingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPresets(): Promise<OnboardingPresetDto[]> {
    const presets = await this.prisma.onboardingPreset.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        description: true,
        defaultModules: true,
        defaultFiscalEnabled: true,
      },
    });
    return presets;
  }

  async status(auth: AuthContext): Promise<OnboardingStatusDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: auth.companyId },
      select: { segment: true, onboardingCompletedAt: true },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    return {
      segment: company.segment,
      completed: company.onboardingCompletedAt !== null,
      completedAt: company.onboardingCompletedAt?.toISOString() ?? null,
    };
  }

  /**
   * Aplica o perfil (idempotente): módulos do perfil → ACTIVE, demais →
   * DISABLED. PERSONALIZADO mantém os módulos atuais. Comércio garante a
   * configuração fiscal (emissora simulada, inativa até o ADMIN ativar).
   */
  async apply(
    auth: AuthContext,
    input: ApplyOnboardingInput,
  ): Promise<OnboardingStatusDto> {
    const preset = await this.prisma.onboardingPreset.findFirst({
      where: { slug: input.slug, active: true },
    });
    if (!preset) throw new NotFoundException("Perfil não encontrado");

    const customize = preset.slug === "PERSONALIZADO";
    const enabled = new Set<BusinessModule>(preset.defaultModules);

    await this.prisma.$transaction(async (tx) => {
      if (!customize) {
        for (const module of BUSINESS_MODULES) {
          const status = enabled.has(module) ? "ACTIVE" : "DISABLED";
          await tx.companyModule.upsert({
            where: { companyId_module: { companyId: auth.companyId, module } },
            create: { companyId: auth.companyId, module, status },
            update: { status },
          });
        }
      }
      if (preset.defaultFiscalEnabled) {
        await tx.fiscalConfig.upsert({
          where: { companyId: auth.companyId },
          create: { companyId: auth.companyId },
          update: {},
        });
      }
      await tx.company.update({
        where: { id: auth.companyId },
        data: { segment: preset.slug, onboardingCompletedAt: new Date() },
      });
    });

    return this.status(auth);
  }
}
