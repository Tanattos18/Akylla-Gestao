import { Module } from "@nestjs/common";
import { ClientHistoryController, DeliveriesController } from "./deliveries.controller";
import { DeliveriesService } from "./deliveries.service";
import { DigitalProductsController } from "./digital-products.controller";
import { DigitalProductsService } from "./digital-products.service";
import { OverduePolicyController } from "./overdue-policy.controller";
import { CredentialsController } from "./credentials.controller";
import { CredentialsService } from "./credentials.service";
import { DigitalOverviewController } from "./overview.controller";

/** Transformação 2026-10-23: catálogo digital, entregas por cliente e política de atraso. */
@Module({
  controllers: [
    DigitalProductsController,
    DeliveriesController,
    ClientHistoryController,
    OverduePolicyController,
    CredentialsController,
    DigitalOverviewController,
  ],
  providers: [DigitalProductsService, DeliveriesService, CredentialsService],
  exports: [DigitalProductsService, DeliveriesService],
})
export class DigitalModule {}
