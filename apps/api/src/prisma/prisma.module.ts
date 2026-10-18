import { Global, Inject, Injectable, Module, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { TenantContext } from "../common/tenant/tenant-context.service";
import { tenantGuardExtension } from "../common/tenant/tenant-guard.extension";
import { rlsExtension, withRlsTransactions } from "../common/tenant/rls.extension";

/**
 * Prisma com duas camadas de tenant (ADR-0001):
 * 1. guard ORM (N4 · 1.4) — injeta/valida `companyId` nos filtros;
 * 2. contexto RLS (Fase 1 · 1E) — toda consulta roda numa transação que
 *    define `app.company_id` (rota autenticada) ou `app.rls_bypass`
 *    (rota pública/CLI); o PostgreSQL aplica a política por linha.
 * O construtor devolve o client estendido (padrão da documentação do
 * Prisma para serviços), então nenhuma consulta escapa das extensões.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  // @Inject explícito: o runtime (tsx/esbuild) não emite
  // emitDecoratorMetadata — sem ele o Nest resolve undefined.
  constructor(@Inject(TenantContext) tenantContext: TenantContext) {
    const extended = new PrismaClient()
      .$extends(tenantGuardExtension(tenantContext))
      .$extends(rlsExtension(tenantContext));
    super();
    return withRlsTransactions(extended, tenantContext) as unknown as PrismaService;
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
