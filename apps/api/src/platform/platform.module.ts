import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PlatformController } from "./platform.controller";
import { PlatformGuard } from "./platform.guard";
import { PlatformService } from "./platform.service";

@Module({
  imports: [PrismaModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformGuard],
})
export class PlatformModule {}
