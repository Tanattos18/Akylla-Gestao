import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CompanyModulesController } from "./company-modules.controller";
import { CompanyModulesService } from "./company-modules.service";

@Module({
  imports: [PrismaModule],
  controllers: [CompanyModulesController],
  providers: [CompanyModulesService],
})
export class CompanyModulesModule {}
