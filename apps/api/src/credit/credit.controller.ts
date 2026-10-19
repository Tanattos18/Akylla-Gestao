import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  BusinessModules,
  listCreditAccountsQuerySchema,
  listCreditInstallmentsQuerySchema,
  updateCreditAccountSchema,
  type ListCreditAccountsQuery,
  type ListCreditInstallmentsQuery,
  type UpdateCreditAccountInput,
  payFinancialEntrySchema,
  type PayFinancialEntryInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreditService } from "./credit.service";

/** Fase 2 · 2.2 — contas de crediário (leitura: todos; aprovar/limite: ADMIN). */
@RequireModule(BusinessModules.CREDIT)
@Controller("credit-accounts")
export class CreditAccountsController {
  constructor(@Inject(CreditService) private readonly service: CreditService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listCreditAccountsQuerySchema)) query: ListCreditAccountsQuery) {
    return this.service.listAccounts(auth, query);
  }

  @Get(":clientId")
  get(@Auth() auth: AuthContext, @Param("clientId") clientId: string) {
    return this.service.getAccount(auth, clientId);
  }

  @Patch(":clientId")
  @UseGuards(AdminGuard)
  upsert(
    @Auth() auth: AuthContext,
    @Param("clientId") clientId: string,
    @Body(new ZodValidationPipe(updateCreditAccountSchema)) body: UpdateCreditAccountInput,
  ) {
    return this.service.upsertAccount(auth, clientId, body);
  }
}

/** Fase 2 · 2.2 — parcelas (leitura: todos; receber: ADMIN, caixa aberto). */
@RequireModule(BusinessModules.CREDIT)
@Controller("credit-installments")
export class CreditInstallmentsController {
  constructor(@Inject(CreditService) private readonly service: CreditService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listCreditInstallmentsQuerySchema)) query: ListCreditInstallmentsQuery) {
    return this.service.listInstallments(auth, query);
  }

  @Post(":id/pay")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  pay(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(payFinancialEntrySchema)) body: PayFinancialEntryInput,
  ) {
    return this.service.payInstallment(auth, id, body);
  }
}
