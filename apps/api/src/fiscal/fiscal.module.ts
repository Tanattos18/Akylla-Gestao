import { Module } from "@nestjs/common";
import { FiscalController, FiscalWebhookController } from "./fiscal.controller";
import { FiscalService } from "./fiscal.service";

/** Fase 3 — fiscal por integração (módulo opcional FISCAL). */
@Module({
  controllers: [FiscalController, FiscalWebhookController],
  providers: [FiscalService],
  exports: [FiscalService],
})
export class FiscalModule {}
