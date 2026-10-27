import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import {
  billingActionLabels,
  digitalProductTypeLabels,
  type ClientHistoryItemDto,
  type CreateDeliveryInput,
  type ListDeliveriesQuery,
  type UpdateDeliveryInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";
import type { BillingStatusDto } from "@petflow/shared";
import type { DeliveryStatus } from "@prisma/client";
import { loadBillingStatuses } from "./billing-state";
import { logBillingAction } from "./billing-control.service";

const deliverySelect = {
  id: true,
  clientId: true,
  productId: true,
  name: true,
  type: true,
  siteUrl: true,
  adminUrl: true,
  repositoryUrl: true,
  domain: true,
  domainRenewalAt: true,
  hostingProvider: true,
  hostingRenewalAt: true,
  notes: true,
  status: true,
  neverPause: true,
  monitorEnabled: true,
  monitorStatus: true,
  monitorHttpStatus: true,
  monitorResponseMs: true,
  monitorCheckedAt: true,
  monitorDownSince: true,
  showWarningBanner: true,
  pausedForDebt: true,
  statusChangedAt: true,
  publicKey: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  _count: { select: { subscriptions: true } },
} as const;

type DeliveryRecord = Prisma.ClientDeliveryGetPayload<{ select: typeof deliverySelect }>;

function day(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function formatDelivery({ _count, publicKey, ...delivery }: DeliveryRecord, billing?: BillingStatusDto | null) {
  return {
    ...delivery,
    // A chave só sai no "Copiar código de instalação" (ADMIN)
    hasInstallCode: publicKey !== null,
    billing: billing ?? fallbackBilling(delivery.status),
    domainRenewalAt: day(delivery.domainRenewalAt),
    hostingRenewalAt: day(delivery.hostingRenewalAt),
    contractsCount: _count.subscriptions,
  };
}

/** Entrega sem contrato: situação só pelo status. */
function fallbackBilling(status: DeliveryStatus): BillingStatusDto | null {
  if (status === "PAUSED" || status === "CANCELLED") {
    return {
      state: status === "PAUSED" ? "PAUSADO" : "INATIVO",
      daysToDue: null,
      dueDate: null,
      amount: null,
      graceUntil: null,
      agreementBroken: false,
    };
  }
  return null;
}

/** "AAAA-MM-DD" → meia-noite UTC; null limpa; undefined não altera. */
function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Texto vazio vira null; undefined não altera. */
function emptyToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value ? value : null;
}

function brl(value: Prisma.Decimal): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const financialStatusLabel = { OPEN: "em aberto", PAID: "pago", CANCELLED: "cancelado" } as const;

/**
 * Entregas por cliente (transformação 2026-10-23). `neverPause` protege
 * produtos próprios e clientes estratégicos: a entrega não pode ir para
 * PAUSED enquanto a flag estiver ligada.
 */
@Injectable()
export class DeliveriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListDeliveriesQuery) {
    const andConditions: Prisma.ClientDeliveryWhereInput[] = [];
    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { domain: { contains: query.search, mode: "insensitive" } },
          { siteUrl: { contains: query.search, mode: "insensitive" } },
          { client: { name: { contains: query.search, mode: "insensitive" } } },
        ],
      });
    }
    if (query.clientId) andConditions.push({ clientId: query.clientId });
    if (query.type) andConditions.push({ type: query.type });
    if (query.status) andConditions.push({ status: query.status });

    const statuses = await loadBillingStatuses(this.prisma, auth.companyId);
    const billingOf = (d: { id: string; status: DeliveryStatus }) => statuses.byDelivery.get(d.id) ?? fallbackBilling(d.status);
    if (query.billingState) {
      const all = await this.prisma.clientDelivery.findMany({
        where: { companyId: auth.companyId },
        select: { id: true, status: true },
      });
      andConditions.push({ id: { in: all.filter((d) => billingOf(d)?.state === query.billingState).map((d) => d.id) } });
    }

    const where: Prisma.ClientDeliveryWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.clientDelivery.findMany({
        where,
        select: deliverySelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.clientDelivery.count({ where }),
    ]);

    return { items: items.map((d) => formatDelivery(d, billingOf(d))), total, page: query.page, pageSize: query.pageSize };
  }

  async get(auth: AuthContext, id: string) {
    const delivery = await this.prisma.clientDelivery.findFirst({
      where: { id, companyId: auth.companyId },
      select: deliverySelect,
    });
    if (!delivery) throw new NotFoundException("Entrega não encontrada");
    const statuses = await loadBillingStatuses(this.prisma, auth.companyId);
    return formatDelivery(delivery, statuses.byDelivery.get(delivery.id) ?? null);
  }

  async create(auth: AuthContext, input: CreateDeliveryInput) {
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException("Cliente não encontrado");
    if (input.productId) await this.assertProduct(auth, input.productId);

    const neverPause = input.neverPause ?? false;
    const status = input.status ?? "ACTIVE";
    this.assertPausable(neverPause, status);

    const delivery = await this.prisma.clientDelivery.create({
      data: {
        companyId: auth.companyId,
        clientId: client.id,
        productId: input.productId ?? null,
        name: input.name,
        type: input.type,
        siteUrl: emptyToNull(input.siteUrl) ?? null,
        adminUrl: emptyToNull(input.adminUrl) ?? null,
        repositoryUrl: emptyToNull(input.repositoryUrl) ?? null,
        domain: emptyToNull(input.domain) ?? null,
        domainRenewalAt: toDate(input.domainRenewalAt) ?? null,
        hostingProvider: emptyToNull(input.hostingProvider) ?? null,
        hostingRenewalAt: toDate(input.hostingRenewalAt) ?? null,
        notes: emptyToNull(input.notes) ?? null,
        status,
        neverPause,
        monitorEnabled: input.monitorEnabled ?? true,
        showWarningBanner: input.showWarningBanner ?? false,
      },
      select: deliverySelect,
    });
    return formatDelivery(delivery);
  }

  async update(auth: AuthContext, id: string, input: UpdateDeliveryInput) {
    const existing = await this.prisma.clientDelivery.findFirst({ where: { id, companyId: auth.companyId } });
    if (!existing) throw new NotFoundException("Entrega não encontrada");
    if (input.productId) await this.assertProduct(auth, input.productId);

    this.assertPausable(input.neverPause ?? existing.neverPause, input.status ?? existing.status);
    const statusChanged = input.status !== undefined && input.status !== existing.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (statusChanged && input.status) {
        // Mudança de status pela edição também entra no histórico
        await logBillingAction(tx, {
          companyId: auth.companyId,
          deliveryId: existing.id,
          action:
            input.status === "PAUSED"
              ? "PAUSE"
              : input.status === "CANCELLED"
                ? "DEACTIVATE"
                : existing.status === "CANCELLED"
                  ? "REACTIVATE"
                  : "ACTIVATE",
          fromStatus: existing.status,
          toStatus: input.status,
          reason: "Alterado na edição da entrega",
          userId: auth.userId,
        });
      }
      return tx.clientDelivery.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
        siteUrl: emptyToNull(input.siteUrl),
        adminUrl: emptyToNull(input.adminUrl),
        repositoryUrl: emptyToNull(input.repositoryUrl),
        domain: emptyToNull(input.domain),
        domainRenewalAt: toDate(input.domainRenewalAt),
        hostingProvider: emptyToNull(input.hostingProvider),
        hostingRenewalAt: toDate(input.hostingRenewalAt),
        notes: emptyToNull(input.notes),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.neverPause !== undefined ? { neverPause: input.neverPause } : {}),
        ...(input.monitorEnabled !== undefined ? { monitorEnabled: input.monitorEnabled } : {}),
        ...(input.showWarningBanner !== undefined ? { showWarningBanner: input.showWarningBanner } : {}),
        ...(statusChanged ? { statusChangedAt: new Date(), pausedForDebt: input.status === "PAUSED" } : {}),
      },
      select: { id: true },
      });
    });
    return this.get(auth, updated.id);
  }

  /** Últimas checagens do monitor (só leitura). */
  async siteChecks(auth: AuthContext, id: string) {
    const delivery = await this.prisma.clientDelivery.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!delivery) throw new NotFoundException("Entrega não encontrada");
    const checks = await this.prisma.siteCheck.findMany({
      where: { companyId: auth.companyId, deliveryId: delivery.id },
      select: { id: true, url: true, ok: true, httpStatus: true, responseMs: true, error: true, checkedAt: true },
      orderBy: { checkedAt: "desc" },
      take: 50,
    });
    return checks.map((check) => ({ ...check, checkedAt: check.checkedAt.toISOString() }));
  }

  /** Linha do tempo da ficha do cliente: entregas, contratos, financeiro, agenda e OS. */
  async clientHistory(auth: AuthContext, clientId: string): Promise<ClientHistoryItemDto[]> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: auth.companyId },
      select: { id: true, createdAt: true },
    });
    if (!client) throw new NotFoundException("Cliente não encontrado");

    const scope = { clientId, companyId: auth.companyId };
    const take = 100;
    const actions = await this.prisma.billingActionLog.findMany({
      where: {
        companyId: auth.companyId,
        OR: [{ delivery: { clientId } }, { subscription: { clientId } }],
      },
      select: {
        action: true,
        reason: true,
        graceUntil: true,
        createdAt: true,
        deliveryId: true,
        subscriptionId: true,
        delivery: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const [deliveries, contracts, entries, appointments, orders] = await Promise.all([
      this.prisma.clientDelivery.findMany({
        where: scope,
        select: { id: true, name: true, type: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take,
      }),
      this.prisma.subscription.findMany({
        where: scope,
        select: {
          id: true,
          startAt: true,
          cancelledAt: true,
          cancelReason: true,
          plan: { select: { name: true } },
          delivery: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
      this.prisma.financialEntry.findMany({
        where: scope,
        select: { id: true, description: true, amount: true, direction: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take,
      }),
      this.prisma.appointment.findMany({
        where: scope,
        select: { id: true, startAt: true, service: { select: { name: true } } },
        orderBy: { startAt: "desc" },
        take,
      }),
      this.prisma.serviceOrder.findMany({
        where: scope,
        select: { id: true, number: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take,
      }),
    ]);

    const items: ClientHistoryItemDto[] = [
      { kind: "CLIENT_CREATED", at: client.createdAt.toISOString(), title: "Cliente cadastrado", detail: null, href: null },
    ];
    for (const d of deliveries) {
      items.push({
        kind: "DELIVERY_CREATED",
        at: d.createdAt.toISOString(),
        title: `Entrega: ${d.name}`,
        detail: digitalProductTypeLabels[d.type],
        href: `/entregas/${d.id}`,
      });
    }
    for (const c of contracts) {
      items.push({
        kind: "CONTRACT_STARTED",
        at: c.startAt.toISOString(),
        title: `Contrato iniciado: ${c.plan.name}`,
        detail: c.delivery ? `Entrega: ${c.delivery.name}` : null,
        href: `/assinaturas/${c.id}`,
      });
      if (c.cancelledAt) {
        items.push({
          kind: "CONTRACT_CANCELLED",
          at: c.cancelledAt.toISOString(),
          title: `Contrato cancelado: ${c.plan.name}`,
          detail: c.cancelReason,
          href: `/assinaturas/${c.id}`,
        });
      }
    }
    for (const e of entries) {
      items.push({
        kind: "FINANCIAL_ENTRY",
        at: e.createdAt.toISOString(),
        title: `${e.direction === "RECEIVABLE" ? "A receber" : "A pagar"}: ${e.description}`,
        detail: `${brl(e.amount)} · ${financialStatusLabel[e.status]}`,
        href: "/financeiro",
      });
    }
    for (const a of appointments) {
      items.push({
        kind: "APPOINTMENT",
        at: a.startAt.toISOString(),
        title: `Agendamento: ${a.service.name}`,
        detail: null,
        href: `/agenda/${a.id}`,
      });
    }
    for (const o of orders) {
      items.push({
        kind: "SERVICE_ORDER",
        at: o.createdAt.toISOString(),
        title: `Ordem de serviço nº ${o.number}`,
        detail: null,
        href: `/os/${o.id}`,
      });
    }

    for (const a of actions) {
      const prazo = a.graceUntil ? ` até ${a.graceUntil.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "";
      items.push({
        kind: "BILLING_ACTION",
        at: a.createdAt.toISOString(),
        title: `${billingActionLabels[a.action]}${prazo}${a.delivery ? `: ${a.delivery.name}` : ""}`,
        detail: [a.reason, a.user ? `por ${a.user.name}` : "pelo sistema"].filter(Boolean).join(" · "),
        href: a.deliveryId ? `/entregas/${a.deliveryId}` : a.subscriptionId ? `/assinaturas/${a.subscriptionId}` : null,
      });
    }

    return items.sort((a, b) => b.at.localeCompare(a.at));
  }

  private async assertProduct(auth: AuthContext, productId: string) {
    const product = await this.prisma.digitalProduct.findFirst({
      where: { id: productId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Produto digital não encontrado");
  }

  private assertPausable(neverPause: boolean, status: string) {
    if (neverPause && (status === "PAUSED" || status === "CANCELLED")) {
      throw new ConflictException("Esta entrega está marcada para nunca ser pausada");
    }
  }
}
