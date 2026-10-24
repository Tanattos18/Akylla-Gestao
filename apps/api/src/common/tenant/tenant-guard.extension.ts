import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { TenantContext } from "./tenant-context.service";

/**
 * Modelos com `companyId` obrigatório — alvo do guard ORM (N4 · 1.4).
 * Fora da lista: globais (`TenantPlan`), de sessão (`Session`,
 * `PasswordResetToken`), sem tenant (`Company`, `SaleItem`) e com tenant
 * opcional (`WhatsAppWebhookEvent`) ou sem (`WhatsAppMessageAttempt`).
 */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  "User",
  "Category",
  "Supplier",
  "Product",
  "StockMovement",
  "Client",
  "Pet",
  "Service",
  "Sale",
  "CashSession",
  "CashMovement",
  "FinancialEntry",
  "Appointment",
  "SubscriptionPlan",
  "Subscription",
  "TenantSubscription",
  "CompanyModule",
  "ImportBatch",
  "LegalConsent",
  "WhatsAppConfig",
  "WhatsAppTemplate",
  "WhatsAppConsent",
  "WhatsAppMessage",
  // Fase 2 · 2.1
  "Professional",
  "CommissionRule",
  "Commission",
  // Fase 2 · 2.2
  "CreditAccount",
  "CreditInstallment",
  // Fase 2 · 2.3
  "ServiceOrder",
  "ServiceOrderItem",
  "ServiceOrderAttachment",
  // Fase 3
  "FiscalConfig",
  "FiscalDocument",
  // Transformação 2026-10-23
  "DigitalProduct",
  "ClientDelivery",
]);

/** Operações cujo `where` aceita filtros (permite injeção via AND). */
const FILTER_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

/** Operações de escrita/leitura única — apenas verificação de mismatch. */
const UNIQUE_OPS = new Set([
  "create",
  "createMany",
  "update",
  "delete",
  "upsert",
  "findUnique",
  "findUniqueOrThrow",
]);

function extractLiteralCompanyId(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") return undefined;
  if ("companyId" in value && typeof value.companyId === "string") {
    return value.companyId;
  }
  return undefined;
}

/**
 * Guard ORM de tenant (N4 · 1.4 — camada de aplicação).
 *
 * Com contexto presente (rotas autenticadas):
 * - filtros sem `companyId` recebem `AND: [{ companyId }]` — um
 *   `findMany`/`findFirst` esquecido deixa de vazar outras empresas;
 * - `companyId` literal divergente no `where`/`data` é rejeitado (403).
 *
 * Sem contexto (CLI, seeds, webhooks `@Public`, login): transparente —
 * fail-open documentado na ADR-0001 (a fonte de verdade do isolamento
 * continua sendo o `companyId` derivado da sessão em cada serviço).
 */
export function tenantGuardExtension(tenantContext: TenantContext) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: "tenant-guard",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const ctx = tenantContext.get();
            if (!ctx || !model || !TENANT_MODELS.has(model)) {
              return query(args);
            }

            const companyId = ctx.companyId;

            if (FILTER_OPS.has(operation)) {
              const current = args as Record<string, unknown> | undefined;
              const where = (current?.where ?? {}) as Record<string, unknown>;
              const literal = extractLiteralCompanyId(where);
              if (literal && literal !== companyId) {
                throw new ForbiddenException("Acesso a dados de outra empresa");
              }
              if (!literal) {
                return query({
                  ...current,
                  where: { AND: [{ companyId }, where] },
                });
              }
              return query(args);
            }

            if (UNIQUE_OPS.has(operation)) {
              const current = (args ?? {}) as Record<string, unknown>;
              const where = current.where as Record<string, unknown> | undefined;
              if (where) {
                const literal = extractLiteralCompanyId(where);
                if (literal && literal !== companyId) {
                  throw new ForbiddenException("Acesso a dados de outra empresa");
                }
              }
              const data = current.data;
              const records = Array.isArray(data) ? data : [data];
              for (const record of records) {
                const literal = extractLiteralCompanyId(record);
                if (literal && literal !== companyId) {
                  throw new ForbiddenException("Escrita em outra empresa");
                }
              }
              return query(args);
            }

            return query(args);
          },
        },
      },
    }),
  );
}
