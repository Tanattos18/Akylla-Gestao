import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { MercadoPagoService } from "./mercadopago.service";
import { MercadoPagoWebhookController } from "./mercadopago-webhook.controller";

@Module({
  imports: [PrismaModule],
  controllers: [BillingController, MercadoPagoWebhookController],
  providers: [BillingService, MercadoPagoService],
  exports: [BillingService, MercadoPagoService],
})
export class BillingModule {}
