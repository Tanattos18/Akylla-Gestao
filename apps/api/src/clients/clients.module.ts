import { Module } from "@nestjs/common";
import { TenantLimitsModule } from "../tenant-limits/tenant-limits.module";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";

@Module({
  imports: [TenantLimitsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
