import { Inject, Injectable } from "@nestjs/common";
import type { AccessStatus, AccessSummaryDto, BillingCycle, BusinessModule } from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";

const DAY_MS = 86_400_000;
/** Dias de tolerância depois do vencimento (aviso, tudo liberado). */
export const GRACE_DAYS = 5;
/** Cache curto da situação por empresa (o guard roda em toda alteração). */
const CACHE_TTL_MS = 30_000;

export interface AccessInput {
  companyStatus: string;
  billingExempt: boolean;
  trialEndsAt: Date | null;
  subscription: {
    status: "ACTIVE" | "EXPIRED" | "CANCELLED";
    currentPeriodEnd: Date;
    billingCycle: BillingCycle;
    planName: string;
    /** Kits (Fase 8b): módulos do kit e avulsos contratados */
    includedModules?: BusinessModule[];
    extraModules?: BusinessModule[];
  } | null;
}

/**
 * Regra de acesso (Fase 8), pura para ser testada sem banco:
 * - suspensa pelo dono → SUSPENDED;
 * - isenta, ou sem assinatura e sem data de teste (empresas anteriores à
 *   Fase 8 e a empresa criada pelo bootstrap) → EXEMPT;
 * - acesso vale até o maior entre o fim do teste e o fim do período pago
 *   (assinatura cancelada continua valendo até o fim do período);
 * - venceu → GRACE por 5 dias → READ_ONLY.
 */
export function computeAccess(input: AccessInput, now: Date = new Date()): AccessSummaryDto {
  const sub = input.subscription;
  // EXPIRED com fim no futuro = checkout aberto e ainda não pago: não vale
  // como período pago (só a expiração natural mantém a data).
  const pendingCheckout = sub?.status === "EXPIRED" && sub.currentPeriodEnd.getTime() > now.getTime();
  const paidUntil = sub && !pendingCheckout ? sub.currentPeriodEnd : null;
  const base: Omit<AccessSummaryDto, "status" | "graceEndsAt" | "daysLeft" | "readOnly"> = {
    trialEndsAt: input.trialEndsAt?.toISOString() ?? null,
    paidUntil: paidUntil?.toISOString() ?? null,
    planName: sub?.planName ?? null,
    cycle: sub?.billingCycle ?? null,
    // Kits (Fase 8b): só o que foi contratado; sem assinatura válida, tudo
    // (teste grátis e isentas). Ajustado abaixo para TRIAL.
    modules:
      sub && !pendingCheckout
        ? [...new Set([...(sub.includedModules ?? []), ...(sub.extraModules ?? [])])]
        : null,
  };

  if (input.companyStatus === "INACTIVE") {
    return { ...base, status: "SUSPENDED", graceEndsAt: null, daysLeft: null, readOnly: true };
  }
  if (input.billingExempt || ((!sub || pendingCheckout) && !input.trialEndsAt)) {
    return { ...base, status: "EXEMPT", graceEndsAt: null, daysLeft: null, readOnly: false };
  }

  const paidMs = paidUntil?.getTime() ?? 0;
  const trialMs = input.trialEndsAt?.getTime() ?? 0;
  const accessEndMs = Math.max(paidMs, trialMs);
  const graceEndMs = accessEndMs + GRACE_DAYS * DAY_MS;
  const nowMs = now.getTime();
  const daysUntil = (ms: number) => Math.max(0, Math.ceil((ms - nowMs) / DAY_MS));

  let status: AccessStatus;
  let daysLeft: number;
  if (nowMs < accessEndMs) {
    status = paidMs > nowMs ? "ACTIVE" : "TRIAL";
    daysLeft = daysUntil(accessEndMs);
    // Em teste, tudo liberado (mesmo que já exista um kit contratado futuro)
    if (status === "TRIAL") base.modules = null;
  } else if (nowMs < graceEndMs) {
    status = "GRACE";
    daysLeft = daysUntil(graceEndMs);
  } else {
    status = "READ_ONLY";
    daysLeft = 0;
  }

  return {
    ...base,
    status,
    graceEndsAt: new Date(graceEndMs).toISOString(),
    daysLeft,
    readOnly: status === "READ_ONLY",
  };
}

@Injectable()
export class AccessService {
  private readonly cache = new Map<string, { at: number; value: AccessSummaryDto }>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAccess(companyId: string, options: { fresh?: boolean } = {}): Promise<AccessSummaryDto> {
    const cached = this.cache.get(companyId);
    if (!options.fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        status: true,
        billingExempt: true,
        trialEndsAt: true,
        tenantSubscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            billingCycle: true,
            extraModules: true,
            plan: { select: { name: true, includedModules: true } },
          },
        },
      },
    });
    const value = computeAccess({
      companyStatus: company?.status ?? "INACTIVE",
      billingExempt: company?.billingExempt ?? false,
      trialEndsAt: company?.trialEndsAt ?? null,
      subscription: company?.tenantSubscription
        ? {
            status: company.tenantSubscription.status,
            currentPeriodEnd: company.tenantSubscription.currentPeriodEnd,
            billingCycle: company.tenantSubscription.billingCycle,
            planName: company.tenantSubscription.plan.name,
            includedModules: company.tenantSubscription.plan.includedModules,
            extraModules: company.tenantSubscription.extraModules,
          }
        : null,
    });
    this.cache.set(companyId, { at: Date.now(), value });
    return value;
  }

  /** Limpa o cache depois de pagamento, extensão ou suspensão. */
  invalidate(companyId?: string): void {
    if (companyId) this.cache.delete(companyId);
    else this.cache.clear();
  }
}
