import { Module } from "@nestjs/common";
import { TenantLimitsModule } from "../tenant-limits/tenant-limits.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [TenantLimitsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
