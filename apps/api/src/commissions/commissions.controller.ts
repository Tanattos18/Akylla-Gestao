import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  BusinessModules,
  commissionSummaryQuerySchema,
  createCommissionRuleSchema,
  createProfessionalSchema,
  listCommissionRulesQuerySchema,
  listCommissionsQuerySchema,
  listProfessionalsQuerySchema,
  updateCommissionRuleSchema,
  updateProfessionalSchema,
  updateRecordStatusSchema,
  type CommissionSummaryQuery,
  type CreateCommissionRuleInput,
  type CreateProfessionalInput,
  type ListCommissionRulesQuery,
  type ListCommissionsQuery,
  type ListProfessionalsQuery,
  type UpdateCommissionRuleInput,
  type UpdateProfessionalInput,
  type UpdateRecordStatusInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CommissionsService } from "./commissions.service";

/** Fase 2 · 2.1 — profissionais (leitura: todos; escrita: ADMIN). */
@RequireModule(BusinessModules.COMMISSIONS)
@Controller("professionals")
export class ProfessionalsController {
  constructor(@Inject(CommissionsService) private readonly service: CommissionsService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listProfessionalsQuerySchema)) query: ListProfessionalsQuery) {
    return this.service.listProfessionals(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.service.getProfessional(auth, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Auth() auth: AuthContext, @Body(new ZodValidationPipe(createProfessionalSchema)) body: CreateProfessionalInput) {
    return this.service.createProfessional(auth, body);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProfessionalSchema)) body: UpdateProfessionalInput,
  ) {
    return this.service.updateProfessional(auth, id, body);
  }

  @Patch(":id/status")
  @UseGuards(AdminGuard)
  updateStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecordStatusSchema)) body: UpdateRecordStatusInput,
  ) {
    return this.service.updateProfessionalStatus(auth, id, body);
  }
}

/** Fase 2 · 2.1 — regras de comissão (ADMIN). */
@RequireModule(BusinessModules.COMMISSIONS)
@UseGuards(AdminGuard)
@Controller("commission-rules")
export class CommissionRulesController {
  constructor(@Inject(CommissionsService) private readonly service: CommissionsService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listCommissionRulesQuerySchema)) query: ListCommissionRulesQuery) {
    return this.service.listRules(auth, query);
  }

  @Post()
  create(@Auth() auth: AuthContext, @Body(new ZodValidationPipe(createCommissionRuleSchema)) body: CreateCommissionRuleInput) {
    return this.service.createRule(auth, body);
  }

  @Patch(":id")
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCommissionRuleSchema)) body: UpdateCommissionRuleInput,
  ) {
    return this.service.updateRule(auth, id, body);
  }
}

/** Fase 2 · 2.1 — comissões (leitura: todos; liberar/pagar: ADMIN). */
@RequireModule(BusinessModules.COMMISSIONS)
@Controller("commissions")
export class CommissionsController {
  constructor(@Inject(CommissionsService) private readonly service: CommissionsService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listCommissionsQuerySchema)) query: ListCommissionsQuery) {
    return this.service.list(auth, query);
  }

  @Get("summary")
  summary(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(commissionSummaryQuerySchema)) query: CommissionSummaryQuery) {
    return this.service.summary(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.service.get(auth, id);
  }

  @Post(":id/release")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  release(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.service.release(auth, id);
  }

  @Post(":id/pay")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  pay(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.service.pay(auth, id);
  }
}
