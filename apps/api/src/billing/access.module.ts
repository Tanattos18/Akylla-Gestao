import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AccessService } from "./access";

/** Situação de acesso da empresa (Fase 8), usada pelo AccessGuard global. */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
