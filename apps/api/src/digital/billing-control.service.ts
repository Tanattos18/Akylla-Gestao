import { randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { BillingAction, DeliveryStatus, Prisma } from "@prisma/client";
import {
  DEFAULT_BILLING_TEXTS,
  type BillingActionDto,
  type BillingSettingsDto,
  type BillingTextKey,
  type GrantGraceInput,
  type PublicSiteStatusDto,
  type UpdateBillingSettingsInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { allowedOrigins } from "../config/env";
import { computeBillingStatus, endOfLocalDay, loadBillingStatuses, localDay } from "./billing-state";

const TEXT_KEYS = Object.keys(DEFAULT_BILLING_TEXTS) as BillingTextKey[];

type Tx = Prisma.TransactionClient;

/** Registro imutável de uma decisão de cobrança. */
export async function logBillingAction(
  tx: Pick<Tx, "billingActionLog">,
  data: {
    companyId: string;
    action: BillingAction;
    deliveryId?: string | null;
    subscriptionId?: string | null;
    fromStatus?: DeliveryStatus | null;
    toStatus?: DeliveryStatus | null;
    reason?: string | null;
    graceUntil?: Date | null;
    userId?: string | null;
  },
) {
  await tx.billingActionLog.create({ data });
}

/**
 * Controle dos sites vendidos (2026-10-27): pausar até pagar, ativar,
 * inativar (cliente desistiu), reativar e dar prazo. Só ADMIN (no
 * controller). Entrega "nunca pausar" NUNCA pode ser pausada nem inativada —
 * bloqueado aqui, no backend, e o endpoint público sempre a devolve ativa.
 */
@Injectable()
export class BillingControlService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async findDelivery(auth: AuthContext, id: string) {
    const delivery = await this.prisma.clientDelivery.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true, status: true, neverPause: true, name: true, publicKey: true },
    });
    if (!delivery) throw new NotFoundException("Entrega não encontrada");
    return delivery;
  }

  private async changeStatus(
    auth: AuthContext,
    id: string,
    to: DeliveryStatus,
    action: BillingAction,
    reason: string | null,
    pausedForDebt: boolean,
  ) {
    const delivery = await this.findDelivery(auth, id);
    if (delivery.neverPause && (to === "PAUSED" || to === "CANCELLED")) {
      throw new ConflictException("Esta entrega está marcada para nunca ser pausada");
    }
    if (delivery.status === to) throw new ConflictException("A entrega já está nesse status");
    return this.prisma.$transaction(async (tx) => {
      // Trava contra corrida: só muda se o status ainda é o lido
      const updated = await tx.clientDelivery.updateMany({
        where: { id: delivery.id, companyId: auth.companyId, status: delivery.status, ...(to === "PAUSED" || to === "CANCELLED" ? { neverPause: false } : {}) },
        data: { status: to, pausedForDebt, statusChangedAt: new Date() },
      });
      if (updated.count === 0) throw new ConflictException("A entrega mudou enquanto você decidia; recarregue a tela");
      await logBillingAction(tx, {
        companyId: auth.companyId,
        deliveryId: delivery.id,
        action,
        fromStatus: delivery.status,
        toStatus: to,
        reason,
        userId: auth.userId,
      });
      return { id: delivery.id, status: to, pausedForDebt };
    });
  }

  pause(auth: AuthContext, id: string, reason: string) {
    return this.changeStatus(auth, id, "PAUSED", "PAUSE", reason, true);
  }

  async activate(auth: AuthContext, id: string, reason: string | null) {
    const delivery = await this.findDelivery(auth, id);
    return this.changeStatus(auth, id, "ACTIVE", delivery.status === "CANCELLED" ? "REACTIVATE" : "ACTIVATE", reason, false);
  }

  deactivate(auth: AuthContext, id: string, reason: string) {
    return this.changeStatus(auth, id, "CANCELLED", "DEACTIVATE", reason, false);
  }

  async grantGrace(auth: AuthContext, subscriptionId: string, input: GrantGraceInput) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, companyId: auth.companyId },
      select: { id: true, status: true, deliveryId: true },
    });
    if (!subscription) throw new NotFoundException("Contrato não encontrado");
    if (subscription.status === "CANCELLED") throw new ConflictException("Contrato cancelado");
    const until = endOfLocalDay(input.until);
    if (localDay(until) < localDay(new Date())) throw new BadRequestException("O prazo não pode ser no passado");
    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id: subscription.id }, data: { graceUntil: until, graceNote: input.note } });
      await logBillingAction(tx, {
        companyId: auth.companyId,
        subscriptionId: subscription.id,
        deliveryId: subscription.deliveryId,
        action: "GRACE",
        reason: input.note,
        graceUntil: until,
        userId: auth.userId,
      });
      return { id: subscription.id, graceUntil: until.toISOString(), graceNote: input.note };
    });
  }

  async history(auth: AuthContext, filter: { deliveryId?: string; subscriptionId?: string }): Promise<BillingActionDto[]> {
    const rows = await this.prisma.billingActionLog.findMany({
      where: { companyId: auth.companyId, ...filter },
      select: {
        id: true,
        action: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        graceUntil: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      reason: r.reason,
      graceUntil: r.graceUntil?.toISOString() ?? null,
      userName: r.user?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Código para colar no site do cliente (gera a chave pública na 1ª vez). */
  async installCode(auth: AuthContext, id: string) {
    const delivery = await this.findDelivery(auth, id);
    if (delivery.neverPause) {
      throw new ConflictException("Entrega 'nunca pausar' não usa o código de status");
    }
    let publicKey = delivery.publicKey;
    if (!publicKey) {
      publicKey = randomBytes(18).toString("base64url");
      await this.prisma.clientDelivery.updateMany({
        where: { id: delivery.id, companyId: auth.companyId, publicKey: null },
        data: { publicKey },
      });
      publicKey = (await this.findDelivery(auth, id)).publicKey as string;
    }
    const origin = (allowedOrigins[0] ?? "https://app.akyllagestao.com.br").replace(/\/$/, "");
    return {
      publicKey,
      snippet: `<script src="${origin}/akylla-status.js" data-site="${publicKey}" defer></script>`,
    };
  }

  async getSettings(auth: AuthContext): Promise<BillingSettingsDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: auth.companyId },
      select: { autoPauseEnabled: true, autoPauseDays: true, ...Object.fromEntries(TEXT_KEYS.map((k) => [k, true])) },
    });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    return toSettings(company as unknown as SettingsRow);
  }

  async updateSettings(auth: AuthContext, input: UpdateBillingSettingsInput): Promise<BillingSettingsDto> {
    const data: Record<string, unknown> = {};
    if (input.autoPauseEnabled !== undefined) data.autoPauseEnabled = input.autoPauseEnabled;
    if (input.autoPauseDays !== undefined) data.autoPauseDays = input.autoPauseDays;
    for (const key of TEXT_KEYS) {
      // "" ou null volta ao texto padrão
      if (input[key] !== undefined) data[key] = input[key] || null;
    }
    await this.prisma.company.update({ where: { id: auth.companyId }, data });
    return this.getSettings(auth);
  }

  /**
   * Endpoint público (sem login): situação do site do cliente para o script
   * `akylla-status.js`. Sem dados pessoais. "Nunca pausar" → sempre ativo.
   */
  async publicStatus(publicKey: string): Promise<PublicSiteStatusDto | null> {
    const delivery = await this.prisma.clientDelivery.findUnique({
      where: { publicKey },
      select: {
        id: true,
        companyId: true,
        status: true,
        neverPause: true,
        showWarningBanner: true,
        company: { select: { siteWarningText: true, siteSuspendedText: true, overduePauseDays: true } },
        subscriptions: {
          select: { status: true, endAt: true, graceUntil: true, id: true },
        },
      },
    });
    if (!delivery) return null;
    if (delivery.neverPause) return { status: "ativo", message: null };
    const suspended = delivery.company.siteSuspendedText ?? DEFAULT_BILLING_TEXTS.siteSuspendedText;
    if (delivery.status === "CANCELLED") return { status: "inativo", message: suspended };
    if (delivery.status === "PAUSED") return { status: "pausado", message: suspended };
    if (!delivery.showWarningBanner || delivery.subscriptions.length === 0) return { status: "ativo", message: null };

    const open = await this.prisma.financialEntry.findMany({
      where: {
        companyId: delivery.companyId,
        origin: "SUBSCRIPTION",
        status: "OPEN",
        OR: delivery.subscriptions.map((s) => ({ originId: { startsWith: `${s.id}:` } })),
      },
      select: { originId: true, dueDate: true, amount: true },
    });
    const now = new Date();
    const overdue = delivery.subscriptions.some((s) => {
      const state = computeBillingStatus(
        {
          contractStatus: s.status,
          deliveryStatus: delivery.status,
          endAt: s.endAt,
          graceUntil: s.graceUntil,
          openDues: open.filter((e) => (e.originId ?? "").startsWith(`${s.id}:`)),
        },
        delivery.company.overduePauseDays,
        now,
      ).state;
      return state === "VENCIDO" || state === "EM_DEBITO";
    });
    return overdue
      ? { status: "aviso", message: delivery.company.siteWarningText ?? DEFAULT_BILLING_TEXTS.siteWarningText }
      : { status: "ativo", message: null };
  }

  statuses(auth: AuthContext) {
    return loadBillingStatuses(this.prisma, auth.companyId);
  }
}

type SettingsRow = { autoPauseEnabled: boolean; autoPauseDays: number } & Record<BillingTextKey, string | null>;

function toSettings(row: SettingsRow): BillingSettingsDto {
  const texts = {} as Record<BillingTextKey, string>;
  const customized = {} as Record<BillingTextKey, boolean>;
  for (const key of TEXT_KEYS) {
    texts[key] = row[key] ?? DEFAULT_BILLING_TEXTS[key];
    customized[key] = row[key] !== null;
  }
  return { autoPauseEnabled: row.autoPauseEnabled, autoPauseDays: row.autoPauseDays, texts, customized };
}
