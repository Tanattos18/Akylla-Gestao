import { Module } from "@nestjs/common";
import { FinancialModule } from "../financial/financial.module";
import {
  CommissionRulesController,
  CommissionsController,
  ProfessionalsController,
} from "./commissions.controller";
import { CommissionsService } from "./commissions.service";

/** Fase 2 · 2.1 — Comissões (módulo opcional COMMISSIONS). */
@Module({
  imports: [FinancialModule],
  controllers: [ProfessionalsController, CommissionRulesController, CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
