import { Module } from "@nestjs/common";
import { ClientHistoryController, DeliveriesController } from "./deliveries.controller";
import { DeliveriesService } from "./deliveries.service";
import { DigitalProductsController } from "./digital-products.controller";
import { DigitalProductsService } from "./digital-products.service";
import { OverduePolicyController } from "./overdue-policy.controller";

/** Transformação 2026-10-23: catálogo digital, entregas por cliente e política de atraso. */
@Module({
  controllers: [DigitalProductsController, DeliveriesController, ClientHistoryController, OverduePolicyController],
  providers: [DigitalProductsService, DeliveriesService],
  exports: [DigitalProductsService, DeliveriesService],
})
export class DigitalModule {}
