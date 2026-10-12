import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import {
  upsertCompanyModuleSchema,
  type UpsertCompanyModuleInput,
} from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { AdminGuard } from "../common/guards/admin.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CompanyModulesService } from "./company-modules.service";

const upsertPipe = new ZodValidationPipe(upsertCompanyModuleSchema);

@Controller("company-modules")
export class CompanyModulesController {
  constructor(
    @Inject(CompanyModulesService)
    private readonly companyModulesService: CompanyModulesService,
  ) {}

  @Get()
  list(@Auth() auth: AuthContext) {
    return this.companyModulesService.list(auth);
  }

  @Patch()
  @UseGuards(AdminGuard)
  upsert(
    @Auth() auth: AuthContext,
    @Body(upsertPipe) body: UpsertCompanyModuleInput,
  ) {
    return this.companyModulesService.upsert(auth, body);
  }
}
