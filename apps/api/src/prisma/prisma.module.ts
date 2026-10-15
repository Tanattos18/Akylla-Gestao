import { Global, Inject, Injectable, Module, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { TenantContext } from "../common/tenant/tenant-context.service";
import { tenantGuardExtension } from "../common/tenant/tenant-guard.extension";

/**
 * Prisma com guard ORM de tenant (N4 · 1.4): o construtor devolve o client
 * estendido (padrão recomendado pela documentação do Prisma para serviços),
 * de modo que TODA consulta da aplicação passa pela extensão. Sem contexto
 * de requisição a extensão é transparente (fail-open — ADR-0001).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  // @Inject explícito: o runtime (tsx/esbuild) não emite
  // emitDecoratorMetadata — sem ele o Nest resolve undefined.
  constructor(@Inject(TenantContext) tenantContext: TenantContext) {
    const extended = new PrismaClient().$extends(tenantGuardExtension(tenantContext));
    super();
    return extended as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}

@Global()
@Module({
  providers: [TenantContext, PrismaService],
  exports: [TenantContext, PrismaService],
})
export class PrismaModule {}
