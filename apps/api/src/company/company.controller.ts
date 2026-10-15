import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { CompanyService } from "./company.service";

/**
 * Dados da própria empresa (N3 · 9.3): exportação integral para
 * portabilidade/encerramento. Restrita ao administrador do tenant.
 */
@Controller("company")
export class CompanyController {
  constructor(@Inject(CompanyService) private readonly company: CompanyService) {}

  @Get("export")
  @UseGuards(AdminGuard)
  exportCompany(@Auth() auth: AuthContext) {
    return this.company.exportCompany(auth);
  }
}
