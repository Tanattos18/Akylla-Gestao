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
  CommissionSummaryQuery,
  CreateCommissionRuleInput,
  CreateProfessionalInput,
  ListCommissionRulesQuery,
  ListCommissionsQuery,
  ListProfessionalsQuery,
  UpdateCommissionRuleInput,
  UpdateProfessionalInput,
  UpdateRecordStatusInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { FinancialService } from "../financial/financial.service";
import {
  calculateCommission,
  releasesOnSale,
  type CalculatorLine,
} from "./commission-calculator";

type Tx = Prisma.TransactionClient;

function nameKeyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00.000`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999`);
}

const professionalSelect = {
  id: true,
  name: true,
  document: true,
  commissionDefault: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ProfessionalRecord = Prisma.ProfessionalGetPayload<{ select: typeof professionalSelect }>;

function formatProfessional(p: ProfessionalRecord) {
  return { ...p, commissionDefault: p.commissionDefault?.toFixed(2) ?? null };
}

const ruleSelect = {
  id: true,
  percentage: true,
  releasePolicy: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  professional: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} as const;

type RuleRecord = Prisma.CommissionRuleGetPayload<{ select: typeof ruleSelect }>;

function formatRule(rule: RuleRecord) {
  return { ...rule, percentage: rule.percentage.toFixed(2) };
}

const commissionSelect = {
  id: true,
  baseAmount: true,
  percentage: true,
  amount: true,
  releasePolicy: true,
  status: true,
  lines: true,
  releasedAt: true,
  paidAt: true,
  cancelledAt: true,
  cancelReason: true,
  financialEntryId: true,
  reversalEntryId: true,
  createdAt: true,
  professional: { select: { id: true, name: true } },
  sale: { select: { id: true, receiptCode: true, total: true, createdAt: true } },
} as const;

type CommissionRecord = Prisma.CommissionGetPayload<{ select: typeof commissionSelect }>;

function formatCommission(c: CommissionRecord) {
  return {
    ...c,
    baseAmount: c.baseAmount.toFixed(2),
    percentage: c.percentage.toFixed(2),
    amount: c.amount.toFixed(2),
    sale: c.sale ? { ...c.sale, total: c.sale.total.toFixed(2) } : null,
  };
}

/**
 * Comissões (Fase 2 · 2.1): profissionais, regras, cálculo na venda,
 * liberação (gera conta a pagar), pagamento (via FinancialService — exige
 * caixa aberto) e cancelamento/estorno auditados quando a venda é cancelada.
 */
@Injectable()
export class CommissionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinancialService) private readonly financial: FinancialService,
  ) {}

  // ---------------------------------------------------------------- módulo

  /** Ausência de linha em CompanyModule = módulo ativo (padrão do projeto). */
  async isModuleEnabled(client: Tx | PrismaService, companyId: string): Promise<boolean> {
    const row = await client.companyModule.findUnique({
      where: { companyId_module: { companyId, module: "COMMISSIONS" } },
      select: { status: true },
    });
    return row?.status !== "DISABLED";
  }

  // --------------------------------------------------------- profissionais

  async listProfessionals(auth: AuthContext, query: ListProfessionalsQuery) {
    const where: Prisma.ProfessionalWhereInput = {
      companyId: auth.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        select: professionalSelect,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.professional.count({ where }),
    ]);
    return { items: items.map(formatProfessional), total, page: query.page, pageSize: query.pageSize };
  }

  async getProfessional(auth: AuthContext, id: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id, companyId: auth.companyId },
      select: professionalSelect,
    });
    if (!professional) throw new NotFoundException("Profissional não encontrado");
    return formatProfessional(professional);
  }

  async createProfessional(auth: AuthContext, input: CreateProfessionalInput) {
    const nameKey = nameKeyOf(input.name);
    await this.assertUniqueProfessional(auth, nameKey);
    const created = await this.prisma.professional.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        nameKey,
        document: input.document || null,
        commissionDefault: input.commissionDefault != null ? new Prisma.Decimal(input.commissionDefault) : null,
      },
      select: professionalSelect,
    });
    return formatProfessional(created);
  }

  async updateProfessional(auth: AuthContext, id: string, input: UpdateProfessionalInput) {
    const existing = await this.prisma.professional.findFirst({ where: { id, companyId: auth.companyId } });
    if (!existing) throw new NotFoundException("Profissional não encontrado");
    let nameKey = existing.nameKey;
    if (input.name !== undefined) {
      nameKey = nameKeyOf(input.name);
      if (nameKey !== existing.nameKey) await this.assertUniqueProfessional(auth, nameKey);
    }
    const updated = await this.prisma.professional.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name, nameKey } : {}),
        ...(input.document !== undefined ? { document: input.document || null } : {}),
        ...(input.commissionDefault !== undefined
          ? { commissionDefault: input.commissionDefault != null ? new Prisma.Decimal(input.commissionDefault) : null }
          : {}),
      },
      select: professionalSelect,
    });
    return formatProfessional(updated);
  }

  async updateProfessionalStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const result = await this.prisma.professional.updateMany({
      where: { id, companyId: auth.companyId },
      data: { status: input.status },
    });
    if (result.count === 0) throw new NotFoundException("Profissional não encontrado");
    return this.getProfessional(auth, id);
  }

  private async assertUniqueProfessional(auth: AuthContext, nameKey: string) {
    const taken = await this.prisma.professional.findUnique({
      where: { companyId_nameKey: { companyId: auth.companyId, nameKey } },
      select: { id: true },
    });
    if (taken) throw new ConflictException("Já existe um profissional com este nome");
  }

  // ---------------------------------------------------------------- regras

  async listRules(auth: AuthContext, query: ListCommissionRulesQuery) {
    const where: Prisma.CommissionRuleWhereInput = {
      companyId: auth.companyId,
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.commissionRule.findMany({
        where,
        select: ruleSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.commissionRule.count({ where }),
    ]);
    return { items: items.map(formatRule), total, page: query.page, pageSize: query.pageSize };
  }

  async createRule(auth: AuthContext, input: CreateCommissionRuleInput) {
    await this.assertRuleTargets(auth, input);
    const rule = await this.prisma.commissionRule.create({
      data: {
        companyId: auth.companyId,
        professionalId: input.professionalId || null,
        productId: input.productId || null,
        categoryId: input.categoryId || null,
        percentage: new Prisma.Decimal(input.percentage),
        releasePolicy: input.releasePolicy,
        active: input.active,
      },
      select: ruleSelect,
    });
    return formatRule(rule);
  }

  async updateRule(auth: AuthContext, id: string, input: UpdateCommissionRuleInput) {
    const existing = await this.prisma.commissionRule.findFirst({ where: { id, companyId: auth.companyId } });
    if (!existing) throw new NotFoundException("Regra não encontrada");
    const merged = {
      professionalId: input.professionalId !== undefined ? input.professionalId || null : existing.professionalId,
      productId: input.productId !== undefined ? input.productId || null : existing.productId,
      categoryId: input.categoryId !== undefined ? input.categoryId || null : existing.categoryId,
    };
    if (merged.productId && merged.categoryId) {
      throw new BadRequestException("Informe produto OU categoria, não os dois");
    }
    await this.assertRuleTargets(auth, merged);
    const rule = await this.prisma.commissionRule.update({
      where: { id: existing.id },
      data: {
        ...merged,
        ...(input.percentage !== undefined ? { percentage: new Prisma.Decimal(input.percentage) } : {}),
        ...(input.releasePolicy !== undefined ? { releasePolicy: input.releasePolicy } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      select: ruleSelect,
    });
    return formatRule(rule);
  }

  private async assertRuleTargets(
    auth: AuthContext,
    targets: { professionalId?: string | null; productId?: string | null; categoryId?: string | null },
  ) {
    const checks: Array<[string | null | undefined, () => Promise<unknown>, string]> = [
      [targets.professionalId, () => this.prisma.professional.findFirst({ where: { id: targets.professionalId as string, companyId: auth.companyId }, select: { id: true } }), "Profissional inválido ou de outra empresa"],
      [targets.productId, () => this.prisma.product.findFirst({ where: { id: targets.productId as string, companyId: auth.companyId }, select: { id: true } }), "Produto inválido ou de outra empresa"],
      [targets.categoryId, () => this.prisma.category.findFirst({ where: { id: targets.categoryId as string, companyId: auth.companyId }, select: { id: true } }), "Categoria inválida ou de outra empresa"],
    ];
    for (const [id, find, message] of checks) {
      if (id && !(await find())) throw new BadRequestException(message);
    }
  }

  // ------------------------------------------------------ integração vendas

  /**
   * Valida o profissional da venda ANTES dos locks de produto (leitura
   * simples). Profissional informado com módulo desativado → 403.
   */
  async assertSaleProfessional(tx: Tx, auth: AuthContext, professionalId: string) {
    if (!(await this.isModuleEnabled(tx, auth.companyId))) {
      throw new ForbiddenException("Módulo Comissões desativado para esta empresa");
    }
    const professional = await tx.professional.findFirst({
      where: { id: professionalId, companyId: auth.companyId },
      select: { id: true, status: true },
    });
    if (!professional) throw new BadRequestException("Profissional inválido ou de outra empresa");
    if (professional.status !== "ACTIVE") throw new BadRequestException("Profissional está inativo");
  }

  /** Calcula e grava a comissão da venda (mesma transação da venda). */
  async createForSale(
    tx: Tx,
    auth: AuthContext,
    sale: {
      id: string;
      receiptCode: string;
      subtotal: Prisma.Decimal;
      total: Prisma.Decimal;
      professionalId: string;
      lines: CalculatorLine[];
      paidNow: boolean;
    },
  ) {
    const professional = await tx.professional.findFirstOrThrow({
      where: { id: sale.professionalId, companyId: auth.companyId },
      select: { id: true, name: true, commissionDefault: true },
    });
    const rules = await tx.commissionRule.findMany({
      where: {
        companyId: auth.companyId,
        active: true,
        OR: [{ professionalId: professional.id }, { professionalId: null }],
      },
      select: { id: true, professionalId: true, productId: true, categoryId: true, percentage: true, releasePolicy: true },
    });

    const result = calculateCommission({
      lines: sale.lines,
      saleSubtotal: sale.subtotal,
      saleTotal: sale.total,
      professional,
      rules,
    });
    if (result.amount.lte(0)) return null;

    const release = releasesOnSale(result.releasePolicy, sale.paidNow);
    const commission = await tx.commission.create({
      data: {
        companyId: auth.companyId,
        saleId: sale.id,
        professionalId: professional.id,
        baseAmount: result.baseAmount,
        percentage: result.percentage,
        amount: result.amount,
        releasePolicy: result.releasePolicy,
        status: "PENDING",
        lines: result.lines as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    if (release) {
      await this.releaseInTx(tx, auth, commission.id, `${professional.name} — venda ${sale.receiptCode}`);
    }
    return commission.id;
  }

  /** PENDING → RELEASED + conta a pagar (origin COMMISSION). */
  private async releaseInTx(tx: Tx, auth: AuthContext, commissionId: string, label: string) {
    const now = new Date();
    const updated = await tx.commission.updateMany({
      where: { id: commissionId, companyId: auth.companyId, status: "PENDING" },
      data: { status: "RELEASED", releasedAt: now },
    });
    if (updated.count === 0) throw new ConflictException("Comissão não está pendente");
    const commission = await tx.commission.findFirstOrThrow({
      where: { id: commissionId },
      select: { amount: true },
    });
    const entry = await tx.financialEntry.create({
      data: {
        companyId: auth.companyId,
        direction: "PAYABLE",
        description: `Comissão: ${label}`,
        amount: commission.amount,
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        origin: "COMMISSION",
        originId: commissionId,
        createdByUserId: auth.userId,
      },
      select: { id: true },
    });
    await tx.commission.update({ where: { id: commissionId }, data: { financialEntryId: entry.id } });
  }

  /**
   * Cancelamento da venda (mesma transação): comissão não paga → CANCELLED e
   * conta a pagar cancelada; comissão já paga → CANCELLED + conta a RECEBER
   * do profissional (estorno auditado, origin COMMISSION_REVERSAL).
   */
  async cancelForSale(tx: Tx, auth: AuthContext, saleId: string, receiptCode: string, reason: string) {
    const commissions = await tx.commission.findMany({
      where: { saleId, companyId: auth.companyId, status: { not: "CANCELLED" } },
      select: { id: true, status: true, amount: true, financialEntryId: true, professional: { select: { name: true } } },
    });
    const now = new Date();
    for (const c of commissions) {
      const cancelReason = `Venda ${receiptCode} cancelada: ${reason}`;
      let reversalEntryId: string | null = null;
      if (c.status === "PAID") {
        const reversal = await tx.financialEntry.create({
          data: {
            companyId: auth.companyId,
            direction: "RECEIVABLE",
            description: `Estorno de comissão paga: ${c.professional.name} — venda ${receiptCode} cancelada`,
            amount: c.amount,
            dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            origin: "COMMISSION_REVERSAL",
            originId: c.id,
            createdByUserId: auth.userId,
          },
          select: { id: true },
        });
        reversalEntryId = reversal.id;
      } else if (c.financialEntryId) {
        await tx.financialEntry.updateMany({
          where: { id: c.financialEntryId, status: "OPEN" },
          data: { status: "CANCELLED", cancelReason },
        });
      }
      const updated = await tx.commission.updateMany({
        where: { id: c.id, status: c.status },
        data: { status: "CANCELLED", cancelledAt: now, cancelReason, reversalEntryId },
      });
      if (updated.count === 0) throw new ConflictException("Comissão alterada em paralelo; tente novamente");
    }
  }

  // ------------------------------------------------------------- comissões

  async list(auth: AuthContext, query: ListCommissionsQuery) {
    const where: Prisma.CommissionWhereInput = {
      companyId: auth.companyId,
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: startOfDay(query.from) } : {}),
              ...(query.to ? { lte: endOfDay(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total, sums] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        select: commissionSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.commission.count({ where }),
      this.prisma.commission.aggregate({ where, _sum: { amount: true, baseAmount: true } }),
    ]);
    return {
      items: items.map(formatCommission),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totals: {
        amount: (sums._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        baseAmount: (sums._sum.baseAmount ?? new Prisma.Decimal(0)).toFixed(2),
      },
    };
  }

  async get(auth: AuthContext, id: string) {
    const commission = await this.prisma.commission.findFirst({
      where: { id, companyId: auth.companyId },
      select: commissionSelect,
    });
    if (!commission) throw new NotFoundException("Comissão não encontrada");
    return formatCommission(commission);
  }

  /** Totais por profissional e status no período (fechamento). */
  async summary(auth: AuthContext, query: CommissionSummaryQuery) {
    const where: Prisma.CommissionWhereInput = {
      companyId: auth.companyId,
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: startOfDay(query.from) } : {}),
              ...(query.to ? { lte: endOfDay(query.to) } : {}),
            },
          }
        : {}),
    };
    const groups = await this.prisma.commission.groupBy({
      by: ["professionalId", "status"],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    const ids = [...new Set(groups.map((g) => g.professionalId))];
    const professionals = await this.prisma.professional.findMany({
      where: { companyId: auth.companyId, id: { in: ids } },
      select: { id: true, name: true },
    });
    const names = new Map(professionals.map((p) => [p.id, p.name]));
    const zero = () => new Prisma.Decimal(0);
    const byProfessional = new Map<string, { pending: Prisma.Decimal; released: Prisma.Decimal; paid: Prisma.Decimal; cancelled: Prisma.Decimal; count: number }>();
    for (const g of groups) {
      const row = byProfessional.get(g.professionalId) ?? { pending: zero(), released: zero(), paid: zero(), cancelled: zero(), count: 0 };
      const value = g._sum.amount ?? zero();
      if (g.status === "PENDING") row.pending = row.pending.plus(value);
      if (g.status === "RELEASED") row.released = row.released.plus(value);
      if (g.status === "PAID") row.paid = row.paid.plus(value);
      if (g.status === "CANCELLED") row.cancelled = row.cancelled.plus(value);
      row.count += g._count._all;
      byProfessional.set(g.professionalId, row);
    }
    const items = [...byProfessional.entries()]
      .map(([professionalId, row]) => ({
        professionalId,
        name: names.get(professionalId) ?? "—",
        pending: row.pending.toFixed(2),
        released: row.released.toFixed(2),
        paid: row.paid.toFixed(2),
        cancelled: row.cancelled.toFixed(2),
        /** a pagar = liberada e ainda não paga */
        toPay: row.released.toFixed(2),
        count: row.count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const sum = (key: "pending" | "released" | "paid" | "cancelled") =>
      items.reduce((acc, item) => acc.plus(item[key]), zero()).toFixed(2);
    return {
      items,
      totals: { pending: sum("pending"), released: sum("released"), paid: sum("paid"), cancelled: sum("cancelled") },
    };
  }

  async release(auth: AuthContext, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const commission = await tx.commission.findFirst({
        where: { id, companyId: auth.companyId },
        select: { id: true, status: true, professional: { select: { name: true } }, sale: { select: { receiptCode: true } } },
      });
      if (!commission) throw new NotFoundException("Comissão não encontrada");
      if (commission.status !== "PENDING") throw new ConflictException("Apenas comissões pendentes podem ser liberadas");
      const label = `${commission.professional.name}${commission.sale ? ` — venda ${commission.sale.receiptCode}` : ""}`;
      await this.releaseInTx(tx, auth, commission.id, label);
    });
    return this.get(auth, id);
  }

  /** Paga a comissão liquidando a conta a pagar (exige caixa aberto). */
  async pay(auth: AuthContext, id: string) {
    const commission = await this.prisma.commission.findFirst({
      where: { id, companyId: auth.companyId },
      select: { status: true, financialEntryId: true },
    });
    if (!commission) throw new NotFoundException("Comissão não encontrada");
    if (commission.status !== "RELEASED" || !commission.financialEntryId) {
      throw new ConflictException("Apenas comissões liberadas podem ser pagas");
    }
    // FinancialService.pay sincroniza a comissão para PAID na mesma transação
    await this.financial.pay(auth, commission.financialEntryId);
    return this.get(auth, id);
  }
}
