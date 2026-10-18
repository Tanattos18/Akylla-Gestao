import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import { lockOpenCashSession } from "../cash/cash-session.helpers";
import {
  releasePendingCommissionsForSale,
  releasePendingCommissionsForServiceOrder,
} from "../commissions/commission-release";
import type {
  CreateFinancialEntryInput,
  FinancialReasonInput,
  ListFinancialQuery,
  UpdateFinancialEntryInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

const entrySelect = {
  id: true,
  direction: true,
  description: true,
  amount: true,
  dueDate: true,
  status: true,
  paidAt: true,
  cancelReason: true,
  clientId: true,
  supplierId: true,
  categoryId: true,
  origin: true,
  originId: true,
  cashMovementId: true,
  clientRequestId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

type EntryRecord = Prisma.FinancialEntryGetPayload<{ select: typeof entrySelect }>;

function formatEntry(entry: EntryRecord) {
  return {
    ...entry,
    amount: entry.amount.toFixed(2),
  };
}

function dateFromStart(value: string): Date {
  return new Date(`${value}T00:00:00.000`);
}

function dateFromEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999`);
}

@Injectable()
export class FinancialService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListFinancialQuery) {
    const andConditions: Prisma.FinancialEntryWhereInput[] = [];

    if (query.direction) andConditions.push({ direction: query.direction });
    if (query.status) andConditions.push({ status: query.status });
    if (query.from) andConditions.push({ dueDate: { gte: dateFromStart(query.from) } });
    if (query.to) andConditions.push({ dueDate: { lte: dateFromEnd(query.to) } });
    if (query.search) {
      andConditions.push({
        OR: [
          { description: { contains: query.search, mode: "insensitive" } },
          { client: { name: { contains: query.search, mode: "insensitive" } } },
          { supplier: { name: { contains: query.search, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.FinancialEntryWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where,
        select: entrySelect,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.financialEntry.count({ where }),
    ]);

    return {
      items: items.map(formatEntry),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(auth: AuthContext, id: string) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id, companyId: auth.companyId },
      select: entrySelect,
    });

    if (!entry) {
      throw new NotFoundException("Título não encontrado");
    }

    return formatEntry(entry);
  }

  async create(auth: AuthContext, input: CreateFinancialEntryInput) {
    await this.validateRelations(auth, {
      clientId: input.clientId ?? null,
      supplierId: input.supplierId ?? null,
      categoryId: input.categoryId ?? null,
    });

    try {
      const entry = await this.prisma.financialEntry.create({
        data: {
          companyId: auth.companyId,
          direction: input.direction,
          description: input.description,
          amount: new Prisma.Decimal(input.amount),
          dueDate: dateFromStart(input.dueDate),
          clientId: input.clientId || null,
          supplierId: input.supplierId || null,
          categoryId: input.categoryId || null,
          clientRequestId: input.clientRequestId ?? null,
          createdByUserId: auth.userId,
        },
        select: entrySelect,
      });

      return formatEntry(entry);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Título já registrado para este identificador (possível reenvio)",
        );
      }
      throw error;
    }
  }

  async update(auth: AuthContext, id: string, input: UpdateFinancialEntryInput) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!entry) {
      throw new NotFoundException("Título não encontrado");
    }
    if (entry.status !== "OPEN") {
      throw new ConflictException("Apenas títulos em aberto podem ser editados");
    }
    if (entry.origin === "COMMISSION" || entry.origin === "COMMISSION_REVERSAL") {
      throw new ConflictException("Título de comissão: o valor é calculado pelo sistema e não pode ser editado");
    }
    if (entry.origin === "CREDIT_SALE") {
      throw new ConflictException("Parcela do crediário: valor e vencimento são definidos na venda");
    }
    if (entry.origin === "SERVICE_ORDER") {
      throw new ConflictException("Título de OS: o valor vem da ordem de serviço concluída");
    }

    await this.validateRelations(auth, {
      clientId: input.clientId !== undefined ? input.clientId || null : entry.clientId,
      supplierId:
        input.supplierId !== undefined ? input.supplierId || null : entry.supplierId,
      categoryId:
        input.categoryId !== undefined ? input.categoryId || null : entry.categoryId,
    });

    const updated = await this.prisma.financialEntry.update({
      where: { id: entry.id },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}),
        ...(input.dueDate !== undefined ? { dueDate: dateFromStart(input.dueDate) } : {}),
        ...(input.clientId !== undefined ? { clientId: input.clientId || null } : {}),
        ...(input.supplierId !== undefined ? { supplierId: input.supplierId || null } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId || null } : {}),
      },
      select: entrySelect,
    });

    return formatEntry(updated);
  }

  async pay(auth: AuthContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.financialEntry.findFirst({
        where: { id, companyId: auth.companyId },
      });

      if (!entry) {
        throw new NotFoundException("Título não encontrado");
      }
      if (entry.status !== "OPEN") {
        throw new ConflictException("Apenas títulos em aberto podem ser liquidados");
      }

      const cashSession = await lockOpenCashSession(
        tx,
        auth.companyId,
        "liquidar títulos",
      );

      const paidAt = new Date();
      const updated = await tx.financialEntry.updateMany({
        where: { id: entry.id, status: "OPEN" },
        data: { status: "PAID", paidAt },
      });
      if (updated.count === 0) {
        throw new ConflictException("Título já liquidado ou cancelado");
      }

      // Fase 2 · 2.1: título de comissão liquidado → comissão paga
      if (entry.origin === "COMMISSION" && entry.originId) {
        await tx.commission.updateMany({
          where: { id: entry.originId, companyId: auth.companyId, status: "RELEASED" },
          data: { status: "PAID", paidAt },
        });
      }

      // Fase 2 · 2.3: OS recebida → libera comissões que aguardavam o pagamento
      if (entry.origin === "SERVICE_ORDER" && entry.originId) {
        await releasePendingCommissionsForServiceOrder(tx, auth, entry.originId);
      }

      // Fase 2 · 2.2: parcela do crediário paga → sai do saldo do cliente;
      // venda quitada libera as comissões que aguardavam o pagamento
      if (entry.origin === "CREDIT_SALE" && entry.originId) {
        const installment = await tx.creditInstallment.findFirst({
          where: { id: entry.originId, companyId: auth.companyId },
          select: { id: true, saleId: true, creditAccountId: true, amount: true },
        });
        if (installment) {
          const paidInstallment = await tx.creditInstallment.updateMany({
            where: { id: installment.id, status: { in: ["OPEN", "OVERDUE"] } },
            data: { status: "PAID", paidAt },
          });
          if (paidInstallment.count === 0) {
            throw new ConflictException("Parcela já paga ou cancelada");
          }
          await tx.creditAccount.update({
            where: { id: installment.creditAccountId },
            data: { balance: { decrement: installment.amount } },
          });
          const remaining = await tx.creditInstallment.count({
            where: { saleId: installment.saleId, status: { in: ["OPEN", "OVERDUE"] } },
          });
          if (remaining === 0) {
            await releasePendingCommissionsForSale(tx, auth, installment.saleId);
          }
        }
      }

      const movement = await tx.cashMovement.create({
        data: {
          companyId: auth.companyId,
          cashSessionId: cashSession.id,
          type: entry.direction === "PAYABLE" ? "OUT" : "IN",
          origin: "ACCOUNT",
          inCash: true,
          amount: entry.amount,
          description: `Liquidação: ${entry.description}`,
          createdByUserId: auth.userId,
        },
        select: { id: true },
      });

      await tx.financialEntry.update({
        where: { id: entry.id },
        data: { cashMovementId: movement.id },
      });

      const full = await tx.financialEntry.findFirstOrThrow({
        where: { id: entry.id },
        select: entrySelect,
      });

      return formatEntry(full);
    });
  }

  async reverse(auth: AuthContext, id: string, input: FinancialReasonInput) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.financialEntry.findFirst({
        where: { id, companyId: auth.companyId },
        select: { ...entrySelect, cashMovementId: true },
      });

      if (!entry) {
        throw new NotFoundException("Título não encontrado");
      }
      if (entry.status !== "PAID") {
        throw new ConflictException("Apenas títulos liquidados podem ser estornados");
      }
      if (!entry.cashMovementId) {
        throw new ConflictException("Título liquidado sem vínculo de caixa");
      }

      const movement = await tx.cashMovement.findFirst({
        where: { id: entry.cashMovementId, companyId: auth.companyId },
        select: { id: true, cashSessionId: true, type: true, inCash: true, amount: true, description: true },
      });
      if (!movement) {
        throw new ConflictException("Lançamento de caixa vinculado não encontrado");
      }

      const sessionRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM "CashSession"
        WHERE id = ${movement.cashSessionId}
        FOR UPDATE`;
      if (sessionRows[0]?.status !== "OPEN") {
        throw new ConflictException(
          "Sessão de caixa fechada: não é possível estornar a liquidação",
        );
      }

      const entryUpdated = await tx.financialEntry.updateMany({
        where: { id: entry.id, status: "PAID" },
        data: { status: "OPEN", paidAt: null, cashMovementId: null },
      });
      if (entryUpdated.count === 0) {
        throw new ConflictException("Título já estornado ou cancelado");
      }

      // Fase 2 · 2.1: estorno do pagamento da comissão → volta a liberada
      if (entry.origin === "COMMISSION" && entry.originId) {
        await tx.commission.updateMany({
          where: { id: entry.originId, companyId: auth.companyId, status: "PAID" },
          data: { status: "RELEASED", paidAt: null },
        });
      }

      // Fase 2 · 2.2: estorno do recebimento da parcela → volta ao saldo
      // (o vencimento é reavaliado na próxima leitura)
      if (entry.origin === "CREDIT_SALE" && entry.originId) {
        const installment = await tx.creditInstallment.findFirst({
          where: { id: entry.originId, companyId: auth.companyId, status: "PAID" },
          select: { id: true, creditAccountId: true, amount: true },
        });
        if (installment) {
          await tx.creditInstallment.update({
            where: { id: installment.id },
            data: { status: "OPEN", paidAt: null },
          });
          await tx.creditAccount.update({
            where: { id: installment.creditAccountId },
            data: { balance: { increment: installment.amount } },
          });
        }
      }

      const reversed = await tx.cashMovement.updateMany({
        where: { id: movement.id, reversedAt: null },
        data: {
          reversedAt: new Date(),
          reversedByUserId: auth.userId,
          reversalReason: input.reason,
        },
      });
      if (reversed.count === 0) {
        throw new ConflictException("Lançamento de caixa já estornado");
      }

      await tx.cashMovement.create({
        data: {
          companyId: auth.companyId,
          cashSessionId: movement.cashSessionId,
          type: movement.type === "IN" ? "OUT" : "IN",
          origin: "REVERSAL",
          inCash: movement.inCash,
          amount: movement.amount,
          description: `Estorno: ${movement.description}`,
          justification: input.reason,
          reversalOfId: movement.id,
          createdByUserId: auth.userId,
        },
      });

      const full = await tx.financialEntry.findFirstOrThrow({
        where: { id: entry.id },
        select: entrySelect,
      });

      return formatEntry(full);
    });
  }

  async cancel(auth: AuthContext, id: string, input: FinancialReasonInput) {
    const entry = await this.prisma.financialEntry.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!entry) {
      throw new NotFoundException("Título não encontrado");
    }
    if (entry.status !== "OPEN") {
      throw new ConflictException("Apenas títulos em aberto podem ser cancelados");
    }
    if (entry.origin === "COMMISSION") {
      throw new ConflictException("Título de comissão: cancele a venda de origem (a comissão é cancelada junto)");
    }
    if (entry.origin === "CREDIT_SALE") {
      throw new ConflictException("Parcela do crediário: cancele a venda de origem (as parcelas são canceladas junto)");
    }

    const updated = await this.prisma.financialEntry.updateMany({
      where: { id: entry.id, status: "OPEN" },
      data: { status: "CANCELLED", cancelReason: input.reason },
    });
    if (updated.count === 0) {
      throw new ConflictException("Título já liquidado ou cancelado");
    }

    const full = await this.prisma.financialEntry.findFirstOrThrow({
      where: { id: entry.id },
      select: entrySelect,
    });

    return formatEntry(full);
  }

  async summary(auth: AuthContext, query: { from?: string; to?: string }) {
    const now = new Date();
    const dueRange: Prisma.FinancialEntryWhereInput =
      query.from || query.to
        ? {
            dueDate: {
              ...(query.from ? { gte: dateFromStart(query.from) } : {}),
              ...(query.to ? { lte: dateFromEnd(query.to) } : {}),
            },
          }
        : {};
    const paidRange: Prisma.FinancialEntryWhereInput =
      query.from || query.to
        ? {
            paidAt: {
              ...(query.from ? { gte: dateFromStart(query.from) } : {}),
              ...(query.to ? { lte: dateFromEnd(query.to) } : {}),
            },
          }
        : {};

    const base = { companyId: auth.companyId };

    const [
      openPayables,
      openReceivables,
      overduePayables,
      overdueReceivables,
      paidOut,
      paidIn,
      cancelledCount,
    ] = await Promise.all([
      this.prisma.financialEntry.aggregate({
        where: { ...base, status: "OPEN", direction: "PAYABLE", ...dueRange },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: { ...base, status: "OPEN", direction: "RECEIVABLE", ...dueRange },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          ...base,
          status: "OPEN",
          direction: "PAYABLE",
          dueDate: {
            lt: now,
            ...(query.from ? { gte: dateFromStart(query.from) } : {}),
            ...(query.to ? { lte: dateFromEnd(query.to) } : {}),
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          ...base,
          status: "OPEN",
          direction: "RECEIVABLE",
          dueDate: {
            lt: now,
            ...(query.from ? { gte: dateFromStart(query.from) } : {}),
            ...(query.to ? { lte: dateFromEnd(query.to) } : {}),
          },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: { ...base, status: "PAID", direction: "PAYABLE", ...paidRange },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.aggregate({
        where: { ...base, status: "PAID", direction: "RECEIVABLE", ...paidRange },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financialEntry.count({ where: { ...base, status: "CANCELLED" } }),
    ]);

    const amount = (value: Prisma.Decimal | null) => (value ?? new Prisma.Decimal(0)).toFixed(2);

    return {
      openPayablesTotal: amount(openPayables._sum.amount),
      openPayablesCount: openPayables._count,
      openReceivablesTotal: amount(openReceivables._sum.amount),
      openReceivablesCount: openReceivables._count,
      overduePayablesTotal: amount(overduePayables._sum.amount),
      overduePayablesCount: overduePayables._count,
      overdueReceivablesTotal: amount(overdueReceivables._sum.amount),
      overdueReceivablesCount: overdueReceivables._count,
      paidOutTotal: amount(paidOut._sum.amount),
      paidOutCount: paidOut._count,
      paidInTotal: amount(paidIn._sum.amount),
      paidInCount: paidIn._count,
      cancelledCount,
    };
  }

  private async validateRelations(
    auth: AuthContext,
    ids: { clientId: string | null; supplierId: string | null; categoryId: string | null },
  ) {
    if (ids.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: ids.clientId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!client) {
        throw new BadRequestException("Cliente inválido ou de outra empresa");
      }
    }

    if (ids.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: ids.supplierId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!supplier) {
        throw new BadRequestException("Fornecedor inválido ou de outra empresa");
      }
    }

    if (ids.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: ids.categoryId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!category) {
        throw new BadRequestException("Categoria inválida ou de outra empresa");
      }
    }
  }
}
