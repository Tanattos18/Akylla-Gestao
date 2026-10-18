import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { CommissionsModule } from "../commissions/commissions.module";
import { CreditModule } from "../credit/credit.module";
import { FiscalModule } from "../fiscal/fiscal.module";

@Module({
  imports: [CommissionsModule, CreditModule, FiscalModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
