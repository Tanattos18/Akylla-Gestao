import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TenantLimitsService } from "./tenant-limits.service";

@Module({
  imports: [PrismaModule],
  providers: [TenantLimitsService],
  exports: [TenantLimitsService],
})
export class TenantLimitsModule {}
