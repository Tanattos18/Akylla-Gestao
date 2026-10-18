import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { CommissionsModule } from "../commissions/commissions.module";
import { CreditModule } from "../credit/credit.module";

@Module({
  imports: [CommissionsModule, CreditModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
