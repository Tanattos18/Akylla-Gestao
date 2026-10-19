import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ListCreditAccountsQuery,
  ListCreditInstallmentsQuery,
  SaleCreditInput,
  UpdateCreditAccountInput,
  PayFinancialEntryInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { FinancialService } from "../financial/financial.service";
import { buildInstallmentPlan, startOfTodayUtc } from "./installment-plan";

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

const ZERO = new Prisma.Decimal(0);

const installmentSelect = {
  id: true,
  number: true,
  totalInstallments: true,
  dueDate: true,
  amount: true,
  status: true,
  paidAt: true,
  cancelledAt: true,
  financialEntryId: true,
  createdAt: true,
  sale: { select: { id: true, receiptCode: true } },
  creditAccount: { select: { id: true, client: { select: { id: true, name: true } } } },
} as const;

type InstallmentRecord = Prisma.CreditInstallmentGetPayload<{ select: typeof installmentSelect }>;

function formatInstallment(i: InstallmentRecord) {
  const { creditAccount, ...rest } = i;
  return { ...rest, amount: i.amount.toFixed(2), client: creditAccount.client };
}

const accountSelect = {
  id: true,
  creditLimit: true,
  balance: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, phone: true } },
} as const;

type AccountRecord = Prisma.CreditAccountGetPayload<{ select: typeof accountSelect }>;

function formatAccount(a: AccountRecord, overdue: Prisma.Decimal = ZERO) {
  const available = Prisma.Decimal.max(a.creditLimit.minus(a.balance), ZERO);
  return {
    ...a,
    creditLimit: a.creditLimit.toFixed(2),
    balance: a.balance.toFixed(2),
    available: available.toFixed(2),
    overdue: overdue.toFixed(2),
  };
}

function dayStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`);
}

/**
 * Crediário (Fase 2 · 2.2): conta do cliente com limite aprovado, parcelas
 * calculadas no servidor, a receber por parcela (origin CREDIT_SALE),
 * vencimento marcado na leitura e pagamento via FinancialService (caixa
 * aberto). Regras: docs/akylla/CREDIARIO.md.
 */
@Injectable()
export class CreditService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinancialService) private readonly financial: FinancialService,
  ) {}

  async isModuleEnabled(db: Db, companyId: string): Promise<boolean> {
    const row = await db.companyModule.findUnique({
      where: { companyId_module: { companyId, module: "CREDIT" } },
      select: { status: true },
    });
    return row?.status !== "DISABLED";
  }

  /** Vencimento "lazy": parcelas em aberto com data passada viram OVERDUE. */
  async markOverdue(db: Db, companyId: string): Promise<void> {
    await db.creditInstallment.updateMany({
      where: { companyId, status: "OPEN", dueDate: { lt: startOfTodayUtc() } },
      data: { status: "OVERDUE" },
    });
  }

  // ------------------------------------------------------ integração venda

  /**
   * Bloqueia a conta do cliente (FOR UPDATE — depois dos locks de caixa e
   * produtos, ordem fixa) e valida módulo, aprovação, bloqueio e limite.
   */
  async lockAndCheckForSale(tx: Tx, auth: AuthContext, clientId: string, total: Prisma.Decimal) {
    if (!(await this.isModuleEnabled(tx, auth.companyId))) {
      throw new ForbiddenException("Módulo Crediário desativado para esta empresa");
    }
    const rows = await tx.$queryRaw<Array<{ id: string; status: string; creditLimit: Prisma.Decimal; balance: Prisma.Decimal }>>`
      SELECT id, status, "creditLimit", balance FROM "CreditAccount"
      WHERE "clientId" = ${clientId} AND "companyId" = ${auth.companyId}
      FOR UPDATE`;
    const account = rows[0];
    if (!account) {
      throw new ForbiddenException("Cliente sem crediário aprovado. Defina um limite em Crediário.");
    }
    if (account.status !== "ACTIVE") {
      throw new ForbiddenException("Crediário do cliente está bloqueado");
    }
    const balance = new Prisma.Decimal(account.balance);
    const limit = new Prisma.Decimal(account.creditLimit);
    if (balance.plus(total).gt(limit)) {
      const available = Prisma.Decimal.max(limit.minus(balance), ZERO);
      throw new ForbiddenException(
        `Limite de crédito excedido: disponível R$ ${available.toFixed(2)}, venda R$ ${total.toFixed(2)}`,
      );
    }
    return { id: account.id };
  }

  /** Cria as parcelas + a receber de cada uma e soma o total ao saldo. */
  async createForSale(
    tx: Tx,
    auth: AuthContext,
    sale: { id: string; receiptCode: string; total: Prisma.Decimal; clientId: string; accountId: string },
    credit: SaleCreditInput,
  ) {
    const plan = buildInstallmentPlan(sale.total, credit.installments, credit.firstDueDate);
    if (plan[0] && plan[0].dueDate < startOfTodayUtc()) {
      throw new BadRequestException("O 1º vencimento não pode ser no passado");
    }
    for (const item of plan) {
      const installment = await tx.creditInstallment.create({
        data: {
          companyId: auth.companyId,
          creditAccountId: sale.accountId,
          saleId: sale.id,
          number: item.number,
          totalInstallments: plan.length,
          dueDate: item.dueDate,
          amount: item.amount,
        },
        select: { id: true },
      });
      const entry = await tx.financialEntry.create({
        data: {
          companyId: auth.companyId,
          direction: "RECEIVABLE",
          description: `Crediário ${sale.receiptCode} — parcela ${item.number}/${plan.length}`,
          amount: item.amount,
          dueDate: item.dueDate,
          clientId: sale.clientId,
          origin: "CREDIT_SALE",
          originId: installment.id,
          createdByUserId: auth.userId,
        },
        select: { id: true },
      });
      await tx.creditInstallment.update({ where: { id: installment.id }, data: { financialEntryId: entry.id } });
    }
    await tx.creditAccount.update({
      where: { id: sale.accountId },
      data: { balance: { increment: sale.total } },
    });
    return plan.length;
  }

  /**
   * Cancelamento da venda a prazo (mesma transação): parcelas em aberto e
   * vencidas → CANCELLED (a receber cancelado) e saem do saldo. Retorna o
   * total JÁ PAGO, que a venda devolve ao cliente pelo caixa.
   */
  async cancelForSale(tx: Tx, auth: AuthContext, saleId: string, reason: string): Promise<Prisma.Decimal> {
    const installments = await tx.creditInstallment.findMany({
      where: { saleId, companyId: auth.companyId },
      select: { id: true, status: true, amount: true, financialEntryId: true, creditAccountId: true },
      orderBy: { number: "asc" },
    });
    if (installments.length === 0) return ZERO;
    const accountId = installments[0]?.creditAccountId as string;
    await tx.$queryRaw`SELECT id FROM "CreditAccount" WHERE id = ${accountId} FOR UPDATE`;

    let paid = ZERO;
    let outstanding = ZERO;
    const now = new Date();
    for (const i of installments) {
      if (i.status === "PAID") {
        paid = paid.plus(i.amount);
        continue;
      }
      if (i.status === "CANCELLED") continue;
      outstanding = outstanding.plus(i.amount);
      await tx.creditInstallment.update({ where: { id: i.id }, data: { status: "CANCELLED", cancelledAt: now } });
      if (i.financialEntryId) {
        await tx.financialEntry.updateMany({
          where: { id: i.financialEntryId, status: "OPEN" },
          data: { status: "CANCELLED", cancelReason: `Venda cancelada: ${reason}` },
        });
      }
    }
    if (outstanding.gt(0)) {
      await tx.creditAccount.update({ where: { id: accountId }, data: { balance: { decrement: outstanding } } });
    }
    return paid;
  }

  // ---------------------------------------------------------------- contas

  async listAccounts(auth: AuthContext, query: ListCreditAccountsQuery) {
    await this.markOverdue(this.prisma, auth.companyId);
    const where: Prisma.CreditAccountWhereInput = {
      companyId: auth.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { client: { name: { contains: query.search, mode: "insensitive" } } } : {}),
    };
    const [items, total, overdueByAccount, totals] = await Promise.all([
      this.prisma.creditAccount.findMany({
        where,
        select: accountSelect,
        orderBy: { client: { name: "asc" } },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.creditAccount.count({ where }),
      this.prisma.creditInstallment.groupBy({
        by: ["creditAccountId"],
        where: { companyId: auth.companyId, status: "OVERDUE" },
        _sum: { amount: true },
      }),
      this.prisma.creditInstallment.groupBy({
        by: ["status"],
        where: { companyId: auth.companyId, status: { in: ["OPEN", "OVERDUE"] } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    const overdueMap = new Map(overdueByAccount.map((g) => [g.creditAccountId, g._sum.amount ?? ZERO]));
    const sumOf = (status: "OPEN" | "OVERDUE") => totals.find((t) => t.status === status)?._sum.amount ?? ZERO;
    return {
      items: items.map((a) => formatAccount(a, overdueMap.get(a.id))),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totals: {
        receivable: sumOf("OPEN").plus(sumOf("OVERDUE")).toFixed(2),
        overdue: sumOf("OVERDUE").toFixed(2),
        overdueCount: totals.find((t) => t.status === "OVERDUE")?._count._all ?? 0,
      },
    };
  }

  async getAccount(auth: AuthContext, clientId: string) {
    await this.markOverdue(this.prisma, auth.companyId);
    const account = await this.prisma.creditAccount.findFirst({
      where: { clientId, companyId: auth.companyId },
      select: accountSelect,
    });
    if (!account) throw new NotFoundException("Cliente sem crediário");
    const installments = await this.prisma.creditInstallment.findMany({
      where: { creditAccountId: account.id, companyId: auth.companyId },
      select: installmentSelect,
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    });
    const overdue = installments
      .filter((i) => i.status === "OVERDUE")
      .reduce((acc, i) => acc.plus(i.amount), ZERO);
    return { ...formatAccount(account, overdue), installments: installments.map(formatInstallment) };
  }

  /** ADMIN aprova/ajusta o crediário (cria a conta se não existir). */
  async upsertAccount(auth: AuthContext, clientId: string, input: UpdateCreditAccountInput) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException("Cliente não encontrado");
    const existing = await this.prisma.creditAccount.findFirst({
      where: { clientId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!existing && input.creditLimit === undefined) {
      throw new BadRequestException("Informe o limite para aprovar o crediário");
    }
    if (existing) {
      await this.prisma.creditAccount.update({
        where: { id: existing.id },
        data: {
          ...(input.creditLimit !== undefined ? { creditLimit: new Prisma.Decimal(input.creditLimit) } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
    } else {
      await this.prisma.creditAccount.create({
        data: {
          companyId: auth.companyId,
          clientId,
          creditLimit: new Prisma.Decimal(input.creditLimit as string),
          status: input.status ?? "ACTIVE",
        },
      });
    }
    return this.getAccount(auth, clientId);
  }

  // -------------------------------------------------------------- parcelas

  async listInstallments(auth: AuthContext, query: ListCreditInstallmentsQuery) {
    await this.markOverdue(this.prisma, auth.companyId);
    const where: Prisma.CreditInstallmentWhereInput = {
      companyId: auth.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { creditAccount: { clientId: query.clientId } } : {}),
      ...(query.from || query.to
        ? { dueDate: { ...(query.from ? { gte: dayStart(query.from) } : {}), ...(query.to ? { lte: dayEnd(query.to) } : {}) } }
        : {}),
    };
    const [items, total, sum] = await Promise.all([
      this.prisma.creditInstallment.findMany({
        where,
        select: installmentSelect,
        orderBy: [{ dueDate: "asc" }, { number: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.creditInstallment.count({ where }),
      this.prisma.creditInstallment.aggregate({ where, _sum: { amount: true } }),
    ]);
    return {
      items: items.map(formatInstallment),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totals: { amount: (sum._sum.amount ?? ZERO).toFixed(2) },
    };
  }

  /** Baixa da parcela pelo financeiro (caixa aberto; sincroniza a parcela). */
  async payInstallment(auth: AuthContext, id: string, input?: PayFinancialEntryInput) {
    await this.markOverdue(this.prisma, auth.companyId);
    const installment = await this.prisma.creditInstallment.findFirst({
      where: { id, companyId: auth.companyId },
      select: { status: true, financialEntryId: true },
    });
    if (!installment) throw new NotFoundException("Parcela não encontrada");
    if ((installment.status !== "OPEN" && installment.status !== "OVERDUE") || !installment.financialEntryId) {
      throw new ConflictException("Apenas parcelas em aberto ou vencidas podem ser pagas");
    }
    await this.financial.pay(auth, installment.financialEntryId, input);
    const paid = await this.prisma.creditInstallment.findFirstOrThrow({
      where: { id, companyId: auth.companyId },
      select: installmentSelect,
    });
    return formatInstallment(paid);
  }
}
