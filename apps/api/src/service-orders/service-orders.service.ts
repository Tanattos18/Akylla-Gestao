import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type ServiceOrderStatus } from "@prisma/client";
import {
  SERVICE_ORDER_ATTACHMENT_MAX_BYTES,
  SERVICE_ORDER_MAX_ATTACHMENTS,
  SERVICE_ORDER_NEXT_STATUS,
  type CancelServiceOrderInput,
  type CreateServiceOrderInput,
  type ListServiceOrdersQuery,
  type ServiceOrderItemInput,
  type TransitionServiceOrderInput,
  type UpdateServiceOrderInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { CommissionsService } from "../commissions/commissions.service";
import {
  detectAllowedKind,
  readAttachment,
  removeAttachment,
  sanitizeFilename,
  saveAttachment,
} from "./attachment-storage";

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

const ZERO = new Prisma.Decimal(0);
/** Estados em que itens, desconto e profissional ainda podem mudar. */
const EDITABLE: ServiceOrderStatus[] = ["DRAFT", "QUOTE"];
const TERMINAL: ServiceOrderStatus[] = ["COMPLETED", "CANCELLED"];

export function formatOrderNumber(n: number): string {
  return `OS-${String(n).padStart(5, "0")}`;
}

const orderSelect = {
  id: true,
  number: true,
  status: true,
  title: true,
  notes: true,
  subtotal: true,
  discount: true,
  total: true,
  openedAt: true,
  quotedAt: true,
  approvedAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  cancelReason: true,
  financialEntryId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, phone: true, mobile: true } },
  professional: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      serviceId: true,
      productId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      subtotal: true,
    },
    orderBy: { id: "asc" },
  },
  attachments: {
    select: { id: true, filename: true, mimeType: true, size: true, uploadedAt: true },
    orderBy: { uploadedAt: "asc" },
  },
} as const;

type OrderRecord = Prisma.ServiceOrderGetPayload<{ select: typeof orderSelect }>;

function formatOrder(o: OrderRecord) {
  return {
    ...o,
    code: formatOrderNumber(o.number),
    subtotal: o.subtotal.toFixed(2),
    discount: o.discount.toFixed(2),
    total: o.total.toFixed(2),
    items: o.items.map((i) => ({
      ...i,
      quantity: i.quantity.toFixed(3),
      unitPrice: i.unitPrice.toFixed(2),
      subtotal: i.subtotal.toFixed(2),
    })),
  };
}

interface ResolvedItem {
  serviceId: string | null;
  productId: string | null;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
}

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Ordem de serviço (Fase 2 · 2.3). Regras: docs/akylla/ORDEM_DE_SERVICO.md.
 * Máquina de estados estrita; itens e valores calculados no servidor;
 * conclusão gera baixa de estoque, conta a receber e comissão.
 */
@Injectable()
export class ServiceOrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommissionsService) private readonly commissions: CommissionsService,
  ) {}

  // ------------------------------------------------------------- consulta

  async list(auth: AuthContext, query: ListServiceOrdersQuery) {
    const numberSearch = query.search?.replace(/\D/g, "");
    const where: Prisma.ServiceOrderWhereInput = {
      companyId: auth.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { client: { name: { contains: query.search, mode: "insensitive" } } },
              ...(numberSearch ? [{ number: Number(numberSearch) }] : []),
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            openedAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
    const [items, total, byStatus] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        select: orderSelect,
        orderBy: { number: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.serviceOrder.count({ where }),
      this.prisma.serviceOrder.groupBy({
        by: ["status"],
        where: { companyId: auth.companyId },
        _count: { _all: true },
      }),
    ]);
    return {
      items: items.map(formatOrder),
      total,
      page: query.page,
      pageSize: query.pageSize,
      countsByStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
    };
  }

  async get(auth: AuthContext, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId: auth.companyId },
      select: orderSelect,
    });
    if (!order) throw new NotFoundException("Ordem de serviço não encontrada");
    return formatOrder(order);
  }

  // --------------------------------------------------------------- escrita

  async create(auth: AuthContext, input: CreateServiceOrderInput) {
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, companyId: auth.companyId },
      select: { id: true, status: true },
    });
    if (!client) throw new BadRequestException("Cliente inválido ou de outra empresa");
    if (client.status !== "ACTIVE") throw new BadRequestException("Cliente está inativo");
    if (input.professionalId) await this.assertProfessional(this.prisma, auth, input.professionalId);

    const id = await this.prisma.$transaction(async (tx) => {
      const items = await this.resolveItems(tx, auth, input.items);
      const totals = this.totals(items, new Prisma.Decimal(input.discount));
      // Número sequencial por empresa: trava a linha da empresa
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${auth.companyId} FOR UPDATE`;
      const last = await tx.serviceOrder.aggregate({
        where: { companyId: auth.companyId },
        _max: { number: true },
      });
      const order = await tx.serviceOrder.create({
        data: {
          companyId: auth.companyId,
          number: (last._max.number ?? 0) + 1,
          clientId: client.id,
          professionalId: input.professionalId || null,
          title: input.title,
          notes: input.notes || null,
          discount: totals.discount,
          subtotal: totals.subtotal,
          total: totals.total,
          createdByUserId: auth.userId,
          items: { create: items.map((i) => ({ ...i, companyId: auth.companyId })) },
        },
        select: { id: true },
      });
      return order.id;
    });
    return this.get(auth, id);
  }

  async update(auth: AuthContext, id: string, input: UpdateServiceOrderInput) {
    const order = await this.findOrThrow(auth, id);
    const touchesValues = input.discount !== undefined || input.professionalId !== undefined || input.title !== undefined;
    if (touchesValues && !EDITABLE.includes(order.status)) {
      throw new ConflictException("Após a aprovação só as observações podem ser alteradas");
    }
    if (input.notes !== undefined && order.status === "CANCELLED") {
      throw new ConflictException("Ordem de serviço cancelada");
    }
    if (input.professionalId) await this.assertProfessional(this.prisma, auth, input.professionalId);

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.ServiceOrderUpdateManyMutationInput & { professionalId?: string | null } = {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.professionalId !== undefined ? { professionalId: input.professionalId || null } : {}),
      };
      if (input.discount !== undefined) {
        const totals = this.totals([], new Prisma.Decimal(input.discount), order.subtotal);
        Object.assign(data, { discount: totals.discount, total: totals.total });
      }
      const updated = await tx.serviceOrder.updateMany({
        where: { id: order.id, status: order.status },
        data,
      });
      if (updated.count === 0) throw new ConflictException("A OS mudou de situação; recarregue");
    });
    return this.get(auth, id);
  }

  /** Substitui todos os itens (rascunho/orçamento) e recalcula os totais. */
  async replaceItems(auth: AuthContext, id: string, inputItems: ServiceOrderItemInput[]) {
    const order = await this.findOrThrow(auth, id);
    if (!EDITABLE.includes(order.status)) {
      throw new ConflictException("Itens só podem ser alterados em rascunho ou orçamento");
    }
    await this.prisma.$transaction(async (tx) => {
      const items = await this.resolveItems(tx, auth, inputItems);
      const totals = this.totals(items, order.discount);
      const guard = await tx.serviceOrder.updateMany({
        where: { id: order.id, status: order.status },
        data: { subtotal: totals.subtotal, discount: totals.discount, total: totals.total },
      });
      if (guard.count === 0) throw new ConflictException("A OS mudou de situação; recarregue");
      await tx.serviceOrderItem.deleteMany({ where: { serviceOrderId: order.id, companyId: auth.companyId } });
      if (items.length > 0) {
        await tx.serviceOrderItem.createMany({
          data: items.map((i) => ({ ...i, companyId: auth.companyId, serviceOrderId: order.id })),
        });
      }
    });
    return this.get(auth, id);
  }

  /** Avança UM estado (pular etapa → 400). Concluir gera os efeitos. */
  async transition(auth: AuthContext, id: string, input: TransitionServiceOrderInput) {
    const order = await this.findOrThrow(auth, id);
    const expected = SERVICE_ORDER_NEXT_STATUS[order.status];
    if (!expected) throw new ConflictException(`OS ${order.status === "COMPLETED" ? "concluída" : "cancelada"}: sem próximo passo`);
    if (input.status !== expected) {
      throw new BadRequestException(`Transição inválida: de ${order.status} só é possível ir para ${expected}`);
    }
    if (input.status === "QUOTE") {
      const items = await this.prisma.serviceOrderItem.count({ where: { serviceOrderId: order.id } });
      if (items === 0) throw new BadRequestException("Inclua ao menos um item antes de emitir o orçamento");
    }

    const now = new Date();
    const stamp: Record<string, Date> = {
      QUOTE: { quotedAt: now },
      APPROVED: { approvedAt: now },
      IN_PROGRESS: { startedAt: now },
      COMPLETED: { completedAt: now },
    }[input.status] as unknown as Record<string, Date>;

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.serviceOrder.updateMany({
        where: { id: order.id, companyId: auth.companyId, status: order.status },
        data: { status: input.status, ...stamp },
      });
      if (moved.count === 0) throw new ConflictException("A OS mudou de situação; recarregue");
      if (input.status === "COMPLETED") await this.completeInTx(tx, auth, order.id);
    });
    return this.get(auth, id);
  }

  async cancel(auth: AuthContext, id: string, input: CancelServiceOrderInput) {
    const order = await this.findOrThrow(auth, id);
    if (TERMINAL.includes(order.status)) {
      throw new ConflictException("Ordem de serviço já concluída ou cancelada");
    }
    const cancelled = await this.prisma.serviceOrder.updateMany({
      where: { id: order.id, companyId: auth.companyId, status: { notIn: TERMINAL } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: input.reason },
    });
    if (cancelled.count === 0) throw new ConflictException("Ordem de serviço já concluída ou cancelada");
    return this.get(auth, id);
  }

  // -------------------------------------------------------------- anexos

  async addAttachment(auth: AuthContext, id: string, file: Express.Multer.File | undefined) {
    const order = await this.findOrThrow(auth, id);
    if (order.status === "CANCELLED") throw new ConflictException("Ordem de serviço cancelada");
    if (!file || !file.buffer || file.size === 0) throw new BadRequestException("Envie o arquivo no campo \"file\"");
    if (file.size > SERVICE_ORDER_ATTACHMENT_MAX_BYTES) throw new BadRequestException("Arquivo maior que 5 MB");
    const kind = detectAllowedKind(file.buffer);
    if (!kind) throw new BadRequestException("Tipo de arquivo não permitido (use JPG, PNG ou PDF)");
    const count = await this.prisma.serviceOrderAttachment.count({ where: { serviceOrderId: order.id } });
    if (count >= SERVICE_ORDER_MAX_ATTACHMENTS) {
      throw new BadRequestException(`Limite de ${SERVICE_ORDER_MAX_ATTACHMENTS} anexos por OS`);
    }

    const storagePath = await saveAttachment(auth.companyId, order.id, file.buffer, kind.ext);
    try {
      return await this.prisma.serviceOrderAttachment.create({
        data: {
          companyId: auth.companyId,
          serviceOrderId: order.id,
          filename: sanitizeFilename(file.originalname, kind.ext),
          mimeType: kind.mimeType,
          size: file.size,
          storagePath,
          uploadedByUserId: auth.userId,
        },
        select: { id: true, filename: true, mimeType: true, size: true, uploadedAt: true },
      });
    } catch (error) {
      await removeAttachment(storagePath);
      throw error;
    }
  }

  async readAttachment(auth: AuthContext, id: string, attachmentId: string) {
    const attachment = await this.prisma.serviceOrderAttachment.findFirst({
      where: { id: attachmentId, serviceOrderId: id, companyId: auth.companyId },
      select: { filename: true, mimeType: true, storagePath: true },
    });
    if (!attachment) throw new NotFoundException("Anexo não encontrado");
    const content = await readAttachment(attachment.storagePath).catch(() => {
      throw new NotFoundException("Arquivo do anexo não encontrado no armazenamento");
    });
    return { ...attachment, content };
  }

  async removeAttachment(auth: AuthContext, id: string, attachmentId: string) {
    const order = await this.findOrThrow(auth, id);
    if (TERMINAL.includes(order.status)) {
      throw new ConflictException("Anexos de OS concluída ou cancelada são mantidos como histórico");
    }
    const attachment = await this.prisma.serviceOrderAttachment.findFirst({
      where: { id: attachmentId, serviceOrderId: order.id, companyId: auth.companyId },
      select: { id: true, storagePath: true },
    });
    if (!attachment) throw new NotFoundException("Anexo não encontrado");
    await this.prisma.serviceOrderAttachment.delete({ where: { id: attachment.id } });
    await removeAttachment(attachment.storagePath);
    return { ok: true };
  }

  // ----------------------------------------------------------- mensagens

  async messages(auth: AuthContext, id: string) {
    const order = await this.findOrThrow(auth, id);
    const items = await this.prisma.whatsAppMessage.findMany({
      where: { companyId: auth.companyId, origin: "SERVICE_ORDER", originId: order.id },
      select: {
        id: true,
        status: true,
        toPhone: true,
        templateNameSnapshot: true,
        templateBodySnapshot: true,
        variables: true,
        failureReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  }

  // ------------------------------------------------------------- internos

  private async findOrThrow(auth: AuthContext, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true, number: true, status: true, subtotal: true, discount: true },
    });
    if (!order) throw new NotFoundException("Ordem de serviço não encontrada");
    return order;
  }

  private async assertProfessional(db: Db, auth: AuthContext, professionalId: string) {
    const professional = await db.professional.findFirst({
      where: { id: professionalId, companyId: auth.companyId },
      select: { status: true },
    });
    if (!professional) throw new BadRequestException("Profissional inválido ou de outra empresa");
    if (professional.status !== "ACTIVE") throw new BadRequestException("Profissional está inativo");
  }

  /** Preço de catálogo para serviço/produto; item livre usa o valor informado. */
  private async resolveItems(tx: Tx, auth: AuthContext, input: ServiceOrderItemInput[]): Promise<ResolvedItem[]> {
    const serviceIds = [...new Set(input.map((i) => i.serviceId).filter((v): v is string => Boolean(v)))];
    const productIds = [...new Set(input.map((i) => i.productId).filter((v): v is string => Boolean(v)))];
    const [services, products] = await Promise.all([
      serviceIds.length
        ? tx.service.findMany({ where: { id: { in: serviceIds }, companyId: auth.companyId }, select: { id: true, name: true, price: true, status: true } })
        : [],
      productIds.length
        ? tx.product.findMany({ where: { id: { in: productIds }, companyId: auth.companyId }, select: { id: true, name: true, salePrice: true, status: true } })
        : [],
    ]);
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    return input.map((item) => {
      const quantity = new Prisma.Decimal(item.quantity);
      let unitPrice: Prisma.Decimal;
      let description: string;
      if (item.serviceId) {
        const service = serviceMap.get(item.serviceId);
        if (!service) throw new BadRequestException("Serviço inválido ou de outra empresa");
        if (service.status !== "ACTIVE") throw new BadRequestException(`Serviço "${service.name}" está inativo`);
        unitPrice = service.price;
        description = item.description || service.name;
      } else if (item.productId) {
        const product = productMap.get(item.productId);
        if (!product) throw new BadRequestException("Produto inválido ou de outra empresa");
        if (product.status !== "ACTIVE") throw new BadRequestException(`Produto "${product.name}" está inativo`);
        unitPrice = product.salePrice;
        description = item.description || product.name;
      } else {
        unitPrice = new Prisma.Decimal(item.unitPrice as string);
        description = item.description as string;
      }
      return {
        serviceId: item.serviceId || null,
        productId: item.productId || null,
        description,
        quantity,
        unitPrice,
        subtotal: round2(unitPrice.times(quantity)),
      };
    });
  }

  private totals(items: ResolvedItem[], discount: Prisma.Decimal, knownSubtotal?: Prisma.Decimal) {
    const subtotal = knownSubtotal ?? items.reduce((acc, i) => acc.plus(i.subtotal), ZERO);
    if (discount.gt(subtotal)) {
      throw new BadRequestException("Desconto não pode ser maior que o subtotal da OS");
    }
    return { subtotal, discount, total: subtotal.minus(discount) };
  }

  /**
   * Conclusão (mesma transação da mudança de status):
   * 1. baixa de estoque dos itens de produto (locks por id, ordem fixa);
   * 2. conta a receber do cliente (origin SERVICE_ORDER), se total > 0;
   * 3. comissão do profissional (ON_SALE libera agora; ON_PAYMENT aguarda o
   *    recebimento da conta).
   */
  private async completeInTx(tx: Tx, auth: AuthContext, orderId: string) {
    const order = await tx.serviceOrder.findFirstOrThrow({
      where: { id: orderId, companyId: auth.companyId },
      select: {
        id: true,
        number: true,
        clientId: true,
        professionalId: true,
        subtotal: true,
        total: true,
        items: { select: { id: true, productId: true, serviceId: true, description: true, quantity: true, subtotal: true } },
      },
    });
    const code = formatOrderNumber(order.number);

    const productTotals = new Map<string, Prisma.Decimal>();
    for (const item of order.items) {
      if (item.productId) {
        productTotals.set(item.productId, (productTotals.get(item.productId) ?? ZERO).plus(item.quantity));
      }
    }
    const categories = new Map<string, string | null>();
    for (const productId of [...productTotals.keys()].sort()) {
      const rows = await tx.$queryRaw<Array<{ name: string; stockQuantity: Prisma.Decimal; categoryId: string | null }>>`
        SELECT name, "stockQuantity", "categoryId" FROM "Product"
        WHERE id = ${productId} AND "companyId" = ${auth.companyId}
        FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new NotFoundException("Produto da OS não encontrado");
      const quantity = productTotals.get(productId) as Prisma.Decimal;
      if (new Prisma.Decimal(row.stockQuantity).lt(quantity)) {
        throw new BadRequestException(
          `Estoque insuficiente para "${row.name}" (disponível: ${new Prisma.Decimal(row.stockQuantity).toFixed(3)})`,
        );
      }
      categories.set(productId, row.categoryId);
      await tx.product.update({ where: { id: productId }, data: { stockQuantity: { decrement: quantity } } });
      await tx.stockMovement.create({
        data: {
          companyId: auth.companyId,
          productId,
          type: "OUT",
          quantity,
          notes: `Ordem de serviço ${code}`,
          reference: code,
          createdByUserId: auth.userId,
        },
      });
    }

    if (order.total.gt(0)) {
      const now = new Date();
      const entry = await tx.financialEntry.create({
        data: {
          companyId: auth.companyId,
          direction: "RECEIVABLE",
          description: `Ordem de serviço ${code}`,
          amount: order.total,
          dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          clientId: order.clientId,
          origin: "SERVICE_ORDER",
          originId: order.id,
          createdByUserId: auth.userId,
        },
        select: { id: true },
      });
      await tx.serviceOrder.update({ where: { id: order.id }, data: { financialEntryId: entry.id } });
    }

    if (order.professionalId && order.total.gt(0)) {
      await this.commissions.createForServiceOrder(tx, auth, {
        id: order.id,
        label: code,
        subtotal: order.subtotal,
        total: order.total,
        professionalId: order.professionalId,
        lines: order.items.map((item) => ({
          saleItemId: item.id,
          productId: item.productId ?? item.serviceId ?? item.id,
          categoryId: item.productId ? categories.get(item.productId) ?? null : null,
          productName: item.description,
          lineSubtotal: item.subtotal,
        })),
      });
    }
  }
}
