import { Module } from "@nestjs/common";
import { TenantLimitsModule } from "../billing/tenant-limits.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [TenantLimitsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
