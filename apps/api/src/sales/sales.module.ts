import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { CommissionsModule } from "../commissions/commissions.module";

@Module({
  imports: [CommissionsModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
