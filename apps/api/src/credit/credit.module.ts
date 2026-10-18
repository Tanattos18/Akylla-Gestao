import { Module } from "@nestjs/common";
import { FinancialModule } from "../financial/financial.module";
import { CreditAccountsController, CreditInstallmentsController } from "./credit.controller";
import { CreditService } from "./credit.service";

/** Fase 2 · 2.2 — Crediário (módulo opcional CREDIT). */
@Module({
  imports: [FinancialModule],
  controllers: [CreditAccountsController, CreditInstallmentsController],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}
