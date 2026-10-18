import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import {
  updateCompanySchema,
  updateCompanySlugSchema,
  type UpdateCompanyInput,
  type UpdateCompanySlugInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CompanyService } from "./company.service";

const updatePipe = new ZodValidationPipe(updateCompanySchema);
const slugPipe = new ZodValidationPipe(updateCompanySlugSchema);

/**
 * Dados da própria empresa: perfil (Fase 7 · 7.1) e exportação integral
 * para portabilidade/encerramento (N3 · 9.3).
 */
@Controller("company")
export class CompanyController {
  constructor(@Inject(CompanyService) private readonly company: CompanyService) {}

  @Get()
  profile(@Auth() auth: AuthContext) {
    return this.company.getProfile(auth);
  }

  @Patch()
  @UseGuards(AdminGuard)
  update(@Auth() auth: AuthContext, @Body(updatePipe) body: UpdateCompanyInput) {
    return this.company.updateProfile(auth, body);
  }

  @Patch("slug")
  @UseGuards(AdminGuard)
  updateSlug(@Auth() auth: AuthContext, @Body(slugPipe) body: UpdateCompanySlugInput) {
    return this.company.updateSlug(auth, body);
  }

  @Get("export")
  @UseGuards(AdminGuard)
  exportCompany(@Auth() auth: AuthContext) {
    return this.company.exportCompany(auth);
  }
}
