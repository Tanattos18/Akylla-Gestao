import { Module } from "@nestjs/common";
import { CommissionsModule } from "../commissions/commissions.module";
import { ServiceOrdersController } from "./service-orders.controller";
import { ServiceOrdersService } from "./service-orders.service";

/** Fase 2 · 2.3 — Ordens de serviço (módulo opcional SERVICE_ORDERS). */
@Module({
  imports: [CommissionsModule],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
