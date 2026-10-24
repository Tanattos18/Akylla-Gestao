import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import {
  digitalProductTypeLabels,
  type ClientHistoryItemDto,
  type CreateDeliveryInput,
  type ListDeliveriesQuery,
  type UpdateDeliveryInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

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

function formatDelivery({ _count, ...delivery }: DeliveryRecord) {
  return {
    ...delivery,
    domainRenewalAt: day(delivery.domainRenewalAt),
    hostingRenewalAt: day(delivery.hostingRenewalAt),
    contractsCount: _count.subscriptions,
  };
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

    return { items: items.map(formatDelivery), total, page: query.page, pageSize: query.pageSize };
  }

  async get(auth: AuthContext, id: string) {
    const delivery = await this.prisma.clientDelivery.findFirst({
      where: { id, companyId: auth.companyId },
      select: deliverySelect,
    });
    if (!delivery) throw new NotFoundException("Entrega não encontrada");
    return formatDelivery(delivery);
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

    const updated = await this.prisma.clientDelivery.update({
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
      },
      select: deliverySelect,
    });
    return formatDelivery(updated);
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
    if (neverPause && status === "PAUSED") {
      throw new ConflictException("Esta entrega está marcada para nunca ser pausada");
    }
  }
}
