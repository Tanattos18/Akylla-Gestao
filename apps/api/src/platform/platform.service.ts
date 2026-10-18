import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type {
  PlatformActivateInput,
  PlatformCompaniesQuery,
  PlatformCompanyDto,
  PlatformCreateCompanyInput,
  PlatformCreateCompanyResult,
  PlatformPaymentDto,
  PlatformSuspendInput,
} from "@petflow/shared";
import { AccessService, computeAccess } from "../billing/access";
import { systemDatabaseUrl } from "../common/tenant/rls.extension";
import { env } from "../config/env";

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

const companySelect = {
  id: true,
  name: true,
  slug: true,
  document: true,
  segment: true,
  status: true,
  createdAt: true,
  trialEndsAt: true,
  billingExempt: true,
  suspendedReason: true,
  tenantSubscription: {
    select: {
      status: true,
      currentPeriodEnd: true,
      billingCycle: true,
      plan: { select: { name: true } },
    },
  },
  users: {
    where: { role: "ADMIN" as const },
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: { name: true, email: true },
  },
  _count: { select: { users: true, clients: true, products: true } },
} satisfies Prisma.CompanySelect;

type CompanyRow = Prisma.CompanyGetPayload<{ select: typeof companySelect }>;

/**
 * Painel do dono da plataforma (Fase 8). Enxerga todas as empresas, então
 * usa uma conexão de SISTEMA (ignora a RLS, como o worker e a CLI). Só é
 * alcançável pelas rotas protegidas por PlatformGuard.
 */
@Injectable()
export class PlatformService implements OnModuleDestroy {
  private readonly logger = new Logger("Platform");
  private readonly db = new PrismaClient({
    datasources: { db: { url: systemDatabaseUrl(env.DATABASE_URL) } },
  });

  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.$disconnect();
  }

  private async toDto(company: CompanyRow, now: Date): Promise<PlatformCompanyDto> {
    const [lastSession, sales30d] = await Promise.all([
      this.db.session.findFirst({
        where: { user: { companyId: company.id } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      this.db.sale.count({
        where: { companyId: company.id, createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
      }),
    ]);
    const sub = company.tenantSubscription;
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      document: company.document,
      segment: company.segment,
      createdAt: company.createdAt.toISOString(),
      adminName: company.users[0]?.name ?? null,
      adminEmail: company.users[0]?.email ?? null,
      lastLoginAt: lastSession?.createdAt.toISOString() ?? null,
      usage: {
        users: company._count.users,
        clients: company._count.clients,
        products: company._count.products,
        sales30d,
      },
      billingExempt: company.billingExempt,
      suspendedReason: company.suspendedReason,
      access: computeAccess(
        {
          companyStatus: company.status,
          billingExempt: company.billingExempt,
          trialEndsAt: company.trialEndsAt,
          subscription: sub
            ? {
                status: sub.status,
                currentPeriodEnd: sub.currentPeriodEnd,
                billingCycle: sub.billingCycle,
                planName: sub.plan.name,
              }
            : null,
        },
        now,
      ),
    };
  }

  async listCompanies(query: PlatformCompaniesQuery): Promise<{ items: PlatformCompanyDto[] }> {
    const search = query.search?.trim();
    const companies = await this.db.company.findMany({
      where: {
        status: { not: "PENDING_VERIFICATION" },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
                { document: { contains: search.replace(/\D/g, "") || search } },
                { users: { some: { email: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: companySelect,
    });
    const now = new Date();
    const items = await Promise.all(companies.map((company) => this.toDto(company, now)));
    return { items: query.status ? items.filter((item) => item.access.status === query.status) : items };
  }

  async getCompany(id: string): Promise<PlatformCompanyDto> {
    const company = await this.db.company.findUnique({ where: { id }, select: companySelect });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    return this.toDto(company, new Date());
  }

  async listPayments(companyId: string): Promise<{ items: PlatformPaymentDto[] }> {
    await this.getCompany(companyId);
    const rows = await this.db.platformPayment.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        planName: row.planName,
        cycle: row.cycle,
        amount: row.amount.toFixed(2),
        method: row.method,
        periodStart: row.periodStart.toISOString(),
        periodEnd: row.periodEnd.toISOString(),
        note: row.note,
        recordedBy: row.recordedBy,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Registra um pagamento e ativa/renova o plano. O novo período começa no
   * fim do período pago atual (se ainda vigente) ou agora; a troca de plano
   * vale na hora. O pagamento fica registrado (histórico imutável).
   */
  async activate(companyId: string, input: PlatformActivateInput, recordedBy: string): Promise<PlatformCompanyDto> {
    const plan = await this.db.tenantPlan.findFirst({ where: { id: input.planId, active: true } });
    if (!plan) throw new NotFoundException("Plano não encontrado ou inativo");
    if (input.cycle === "YEARLY" && !plan.priceYearly) {
      throw new BadRequestException("Este plano não tem opção anual");
    }
    const days = input.cycle === "YEARLY" ? YEAR_DAYS : plan.durationDays;
    const amount = input.amount ?? (input.cycle === "YEARLY" ? plan.priceYearly!.toFixed(2) : plan.priceMonthly.toFixed(2));

    await this.db.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) throw new NotFoundException("Empresa não encontrada");
      const current = await tx.tenantSubscription.findUnique({ where: { companyId } });
      const now = new Date();
      // Período ainda pago (ativa ou cancelada que vale até o fim) é preservado;
      // checkout pendente (EXPIRED com data futura) não conta.
      const start =
        current && current.status !== "EXPIRED" && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
      const end = new Date(start.getTime() + days * DAY_MS);
      await tx.tenantSubscription.upsert({
        where: { companyId },
        create: {
          companyId,
          planId: plan.id,
          status: "ACTIVE",
          billingCycle: input.cycle,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          gateway: input.method === "MERCADO_PAGO" ? "MERCADO_PAGO" : "MANUAL",
        },
        update: {
          planId: plan.id,
          status: "ACTIVE",
          billingCycle: input.cycle,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          cancelReason: null,
          cancelledAt: null,
        },
      });
      await tx.platformPayment.create({
        data: {
          companyId,
          planName: plan.name,
          cycle: input.cycle,
          amount: new Prisma.Decimal(amount),
          method: input.method,
          periodStart: start,
          periodEnd: end,
          note: input.note || null,
          recordedBy,
        },
      });
    });
    this.access.invalidate(companyId);
    this.logger.log(`Pagamento registrado por ${recordedBy}: empresa ${companyId}, ${plan.name} ${input.cycle} R$ ${amount}`);
    return this.getCompany(companyId);
  }

  /**
   * Cadastra uma empresa cliente (Fase 8), sem depender do cadastro aberto
   * nem de SMTP: admin com e-mail já verificado e senha provisória
   * (mostrada uma vez ao dono, que envia ao cliente). Teste grátis de
   * `trialDays`; com 0, o dono registra o pagamento em seguida.
   */
  async createCompany(input: PlatformCreateCompanyInput, by: string): Promise<PlatformCreateCompanyResult> {
    const email = input.adminEmail.trim().toLowerCase();
    if (await this.db.user.findFirst({ where: { email }, select: { id: true } })) {
      throw new ConflictException("Já existe um usuário com este e-mail");
    }
    const base = slugify(input.companyName) || "empresa";
    let slug = base;
    for (let i = 2; await this.db.company.findUnique({ where: { slug }, select: { id: true } }); i += 1) {
      slug = `${base}-${i}`;
    }
    const temporaryPassword = `Akylla-${randomBytes(9).toString("base64url")}`;
    const now = new Date();
    const company = await this.db.company.create({
      data: {
        name: input.companyName,
        slug,
        status: "ACTIVE",
        trialEndsAt: new Date(now.getTime() + input.trialDays * DAY_MS),
        users: {
          create: {
            name: input.adminName,
            email,
            role: "ADMIN",
            emailVerifiedAt: now,
            passwordHash: await bcrypt.hash(temporaryPassword, 12),
          },
        },
      },
      select: { id: true },
    });
    this.logger.log(`Empresa ${company.id} (${slug}) cadastrada por ${by}, teste de ${input.trialDays} dia(s)`);
    return { company: await this.getCompany(company.id), temporaryPassword };
  }

  /** Senha provisória para o administrador da empresa (cliente esqueceu a senha). */
  async resetAdminPassword(companyId: string, by: string): Promise<{ email: string; temporaryPassword: string }> {
    const admin = await this.db.user.findFirst({
      where: { companyId, role: "ADMIN", status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    });
    if (!admin) throw new NotFoundException("Empresa sem administrador ativo");
    const temporaryPassword = `Akylla-${randomBytes(9).toString("base64url")}`;
    await this.db.$transaction([
      this.db.user.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) } }),
      this.db.session.updateMany({ where: { userId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    this.logger.log(`Senha provisória gerada por ${by} para o admin da empresa ${companyId}`);
    return { email: admin.email, temporaryPassword };
  }

  async extendTrial(companyId: string, days: number, by: string): Promise<PlatformCompanyDto> {
    const company = await this.db.company.findUnique({ where: { id: companyId }, select: { trialEndsAt: true } });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    const now = new Date();
    const base = company.trialEndsAt && company.trialEndsAt > now ? company.trialEndsAt : now;
    await this.db.company.update({
      where: { id: companyId },
      data: { trialEndsAt: new Date(base.getTime() + days * DAY_MS) },
    });
    this.access.invalidate(companyId);
    this.logger.log(`Teste estendido em ${days} dia(s) por ${by}: empresa ${companyId}`);
    return this.getCompany(companyId);
  }

  async setExempt(companyId: string, exempt: boolean, by: string): Promise<PlatformCompanyDto> {
    await this.getCompany(companyId);
    await this.db.company.update({ where: { id: companyId }, data: { billingExempt: exempt } });
    this.access.invalidate(companyId);
    this.logger.log(`Isenção ${exempt ? "concedida" : "removida"} por ${by}: empresa ${companyId}`);
    return this.getCompany(companyId);
  }

  /** Suspensão manual: bloqueia login e derruba as sessões abertas. Dados preservados. */
  async suspend(companyId: string, input: PlatformSuspendInput, by: string): Promise<PlatformCompanyDto> {
    await this.getCompany(companyId);
    const now = new Date();
    await this.db.$transaction([
      this.db.company.update({
        where: { id: companyId },
        data: { status: "INACTIVE", suspendedAt: now, suspendedReason: input.reason },
      }),
      this.db.session.updateMany({
        where: { user: { companyId }, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    this.access.invalidate(companyId);
    this.logger.log(`Empresa ${companyId} suspensa por ${by}: ${input.reason}`);
    return this.getCompany(companyId);
  }

  async reactivate(companyId: string, by: string): Promise<PlatformCompanyDto> {
    const company = await this.getCompany(companyId);
    if (company.access.status !== "SUSPENDED") throw new BadRequestException("A empresa não está suspensa");
    await this.db.company.update({
      where: { id: companyId },
      data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
    });
    this.access.invalidate(companyId);
    this.logger.log(`Empresa ${companyId} reativada por ${by}`);
    return this.getCompany(companyId);
  }
}
