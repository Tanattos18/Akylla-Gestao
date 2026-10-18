import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContextValue {
  companyId: string;
  userId: string;
}

/**
 * Contexto de tenant por requisição (N4 · 1.4 — camada ORM).
 * Preenchido pelo `TenantContextInterceptor` (após AuthGuard) e lido pela
 * extensão Prisma que injeta `companyId` em toda consulta de modelo com
 * tenant. Sem contexto (CLI, seeds, webhooks públicos) o guard ORM é
 * transparente — fail-open documentado na ADR.
 */
@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<TenantContextValue>();

  run<T>(value: TenantContextValue, callback: () => T): T {
    return this.storage.run(value, callback);
  }

  get(): TenantContextValue | undefined {
    return this.storage.getStore();
  }
}

/**
 * Executa `fn` como se fosse uma requisição da empresa (Fase 1 · 1E): o
 * guard ORM e a RLS passam a valer para `companyId`. Útil para jobs/CLI
 * que agem em nome de UMA empresa. O `await` acontece dentro do contexto
 * (PrismaPromise só executa no `then`).
 */
export function withTenantContext<T>(
  tenantContext: TenantContext,
  companyId: string,
  fn: () => PromiseLike<T>,
  userId = "system",
): Promise<T> {
  return tenantContext.run({ companyId, userId }, async () => await fn());
}
