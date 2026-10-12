import { Inject, Injectable } from "@nestjs/common";
import {
  BUSINESS_MODULES,
  businessModuleLabels,
  type BusinessModule,
  type CompanyModuleStatus,
  type UpsertCompanyModuleInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { PrismaService } from "../prisma/prisma.module";

export interface CompanyModuleDto {
  module: BusinessModule;
  status: CompanyModuleStatus;
  label: string;
}

@Injectable()
export class CompanyModulesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext): Promise<CompanyModuleDto[]> {
    const rows = await this.prisma.companyModule.findMany({
      where: { companyId: auth.companyId },
      select: { module: true, status: true },
    });
    const byModule = new Map(rows.map((row) => [row.module, row.status]));

    return BUSINESS_MODULES.map((module) => ({
      module,
      status: byModule.get(module) ?? "ACTIVE",
      label: businessModuleLabels[module],
    }));
  }

  async upsert(
    auth: AuthContext,
    input: UpsertCompanyModuleInput,
  ): Promise<CompanyModuleDto> {
    const row = await this.prisma.companyModule.upsert({
      where: {
        companyId_module: { companyId: auth.companyId, module: input.module },
      },
      create: {
        companyId: auth.companyId,
        module: input.module,
        status: input.status,
      },
      update: { status: input.status },
      select: { module: true, status: true },
    });

    return {
      module: row.module,
      status: row.status,
      label: businessModuleLabels[row.module],
    };
  }
}
