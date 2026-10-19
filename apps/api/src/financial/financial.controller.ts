import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createFinancialEntrySchema,
  financialReasonSchema,
  financialSummaryQuerySchema,
  listFinancialQuerySchema,
  payFinancialEntrySchema,
  updateFinancialEntrySchema,
  type CreateFinancialEntryInput,
  type FinancialReasonInput,
  type FinancialSummaryQuery,
  type ListFinancialQuery,
  type PayFinancialEntryInput,
  type UpdateFinancialEntryInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { FinancialService } from "./financial.service";

const listPipe = new ZodValidationPipe(listFinancialQuerySchema);
const summaryPipe = new ZodValidationPipe(financialSummaryQuerySchema);

@Controller("financial")
export class FinancialController {
  constructor(@Inject(FinancialService) private readonly financial: FinancialService) {}

  /** Auditoria (bloco 3): lançar e liquidar títulos é do administrador */
  @Post()
  @UseGuards(AdminGuard)
  create(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createFinancialEntrySchema)) body: CreateFinancialEntryInput,
  ) {
    return this.financial.create(auth, body);
  }

  @Get()
  list(@Auth() auth: AuthContext, @Query(listPipe) query: ListFinancialQuery) {
    return this.financial.list(auth, query);
  }

  @Get("summary")
  summary(@Auth() auth: AuthContext, @Query(summaryPipe) query: FinancialSummaryQuery) {
    return this.financial.summary(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.financial.get(auth, id);
  }

  @Patch(":id")
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateFinancialEntrySchema)) body: UpdateFinancialEntryInput,
  ) {
    return this.financial.update(auth, id, body);
  }

  @Post(":id/pay")
  @UseGuards(AdminGuard)
  pay(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(payFinancialEntrySchema)) body: PayFinancialEntryInput,
  ) {
    return this.financial.pay(auth, id, body);
  }

  @Post(":id/reverse")
  @UseGuards(AdminGuard)
  reverse(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(financialReasonSchema)) body: FinancialReasonInput,
  ) {
    return this.financial.reverse(auth, id, body);
  }

  @Post(":id/cancel")
  @UseGuards(AdminGuard)
  cancel(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(financialReasonSchema)) body: FinancialReasonInput,
  ) {
    return this.financial.cancel(auth, id, body);
  }
}
