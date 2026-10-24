import { Body, Controller, Get, Inject, NotFoundException, Put, UseGuards } from "@nestjs/common";
import {
  updateOverduePolicySchema,
  type OverduePolicyDto,
  type UpdateOverduePolicyInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

/**
 * Política de atraso dos contratos: aviso no dia N, pausa da entrega no dia M,
 * e a chave Pix usada nas mensagens de cobrança.
 * Nesta etapa só guarda a configuração — nenhuma entrega é pausada
 * automaticamente (`autoPauseEnabled: false`).
 */
@Controller("overdue-policy")
export class OverduePolicyController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async get(@Auth() auth: AuthContext): Promise<OverduePolicyDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: auth.companyId },
      select: { overdueWarnDays: true, overduePauseDays: true, pixKey: true },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    return { warnDays: company.overdueWarnDays, pauseDays: company.overduePauseDays, autoPauseEnabled: false, pixKey: company.pixKey };
  }

  @Put()
  @UseGuards(AdminGuard)
  async update(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateOverduePolicySchema)) body: UpdateOverduePolicyInput,
  ): Promise<OverduePolicyDto> {
    const company = await this.prisma.company.update({
      where: { id: auth.companyId },
      data: {
        overdueWarnDays: body.warnDays,
        overduePauseDays: body.pauseDays,
        ...(body.pixKey !== undefined ? { pixKey: body.pixKey || null } : {}),
      },
      select: { overdueWarnDays: true, overduePauseDays: true, pixKey: true },
    });
    return { warnDays: company.overdueWarnDays, pauseDays: company.overduePauseDays, autoPauseEnabled: false, pixKey: company.pixKey };
  }
}
