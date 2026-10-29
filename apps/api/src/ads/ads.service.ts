import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AdLogAction } from "@prisma/client";
import {
  AD_CAMPAIGN_TRANSITIONS,
  AD_STATUS_REASON_REQUIRED,
  adCampaignStatusLabels,
  adPlatformUtmSource,
  type AdAccountDto,
  type AdCampaignDetailDto,
  type AdCampaignDto,
  type AdCampaignListItemDto,
  type AdClientSummaryDto,
  type AdImportReportDto,
  type AdLinkDto,
  type AdOverviewDto,
  type ChangeAdCampaignStatusInput,
  type CreateAdAccountInput,
  type CreateAdCampaignInput,
  type ListAdAccountsQuery,
  type ListAdCampaignsQuery,
  type UpdateAdAccountInput,
  type UpdateAdCampaignInput,
  type UpsertAdMetricInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { PrismaService } from "../prisma/prisma.module";
import { computeIndicators, dayKey, effectiveMetrics, toMetricDayDto, type MetricRow } from "./ads-indicators";
import { parseAdCsv } from "./ads-csv";

export const AD_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const DAY_MS = 86_400_000;
/** Campanha ativa sem métrica há N dias entra no alerta da visão geral. */
export const AD_STALE_DAYS = 3;
const MAX_LOGS = 100;
const UTM_MEDIUM = "cpc";

type Tx = Prisma.TransactionClient;

/** Hoje no fuso de Brasília (AAAA-MM-DD). */
function todayBr(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

function toDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** "AAAA-MM-DD" → data; null limpa; undefined não altera. */
function optionalDay(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : toDay(value);
}

function daysBetween(from: string, to: string): number {
  return Math.round((toDay(to).getTime() - toDay(from).getTime()) / DAY_MS);
}

function decimalOrNull(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(2);
}

/** Slug do utm_campaign: minúsculas, sem acento, só [a-z0-9-]. */
export function utmSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "campanha";
}

const campaignSelect = {
  id: true,
  clientId: true,
  adAccountId: true,
  deliveryId: true,
  subscriptionId: true,
  platform: true,
  objective: true,
  status: true,
  name: true,
  promotedItem: true,
  targetUrl: true,
  utmCampaign: true,
  audienceNotes: true,
  dailyBudget: true,
  totalBudget: true,
  startAt: true,
  endAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  adAccount: { select: { id: true, name: true } },
  delivery: { select: { id: true, name: true } },
  subscription: { select: { id: true, plan: { select: { name: true } } } },
} as const;

type CampaignRecord = Prisma.AdCampaignGetPayload<{ select: typeof campaignSelect }>;

function formatCampaign({ subscription, ...campaign }: CampaignRecord): AdCampaignDto {
  return {
    ...campaign,
    dailyBudget: decimalOrNull(campaign.dailyBudget),
    totalBudget: decimalOrNull(campaign.totalBudget),
    startAt: campaign.startAt ? dayKey(campaign.startAt) : null,
    endAt: campaign.endAt ? dayKey(campaign.endAt) : null,
    subscription: subscription ? { id: subscription.id, planName: subscription.plan.name } : null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

const accountSelect = {
  id: true,
  clientId: true,
  platform: true,
  name: true,
  externalAccountId: true,
  connection: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  _count: { select: { campaigns: true } },
} as const;

type AccountRecord = Prisma.AdAccountGetPayload<{ select: typeof accountSelect }>;

function formatAccount({ _count, ...account }: AccountRecord): AdAccountDto {
  return {
    ...account,
    campaignsCount: _count.campaigns,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

const metricSelect = {
  campaignId: true,
  date: true,
  source: true,
  impressions: true,
  reach: true,
  clicks: true,
  spend: true,
  results: true,
} as const;

/**
 * Gestão de anúncios (upgrade/PLANO_ANUNCIOS.md, fases A1 e A2). A verba é
 * do cliente; aqui ficam referências, métricas por dia e o histórico
 * imutável (AdCampaignLog). Indicadores sempre calculados no servidor.
 */
@Injectable()
export class AdsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Contas de anúncio
  // -------------------------------------------------------------------------

  async listAccounts(auth: AuthContext, query: ListAdAccountsQuery): Promise<AdAccountDto[]> {
    const accounts = await this.prisma.adAccount.findMany({
      where: {
        companyId: auth.companyId,
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.platform ? { platform: query.platform } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: accountSelect,
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    });
    return accounts.map(formatAccount);
  }

  async createAccount(auth: AuthContext, input: CreateAdAccountInput): Promise<AdAccountDto> {
    await this.assertClient(auth, input.clientId);
    try {
      const account = await this.prisma.adAccount.create({
        data: {
          companyId: auth.companyId,
          clientId: input.clientId,
          platform: input.platform,
          name: input.name,
          externalAccountId: input.externalAccountId ?? null,
        },
        select: accountSelect,
      });
      return formatAccount(account);
    } catch (error) {
      throw this.accountConflict(error);
    }
  }

  async updateAccount(auth: AuthContext, id: string, input: UpdateAdAccountInput): Promise<AdAccountDto> {
    const existing = await this.prisma.adAccount.findFirst({ where: { id, companyId: auth.companyId }, select: { id: true } });
    if (!existing) throw new NotFoundException("Conta de anúncio não encontrada");
    try {
      const account = await this.prisma.adAccount.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.externalAccountId !== undefined ? { externalAccountId: input.externalAccountId } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        select: accountSelect,
      });
      return formatAccount(account);
    } catch (error) {
      throw this.accountConflict(error);
    }
  }

  private accountConflict(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ConflictException("Já existe uma conta desta plataforma com este identificador");
    }
    return error;
  }

  // -------------------------------------------------------------------------
  // Campanhas
  // -------------------------------------------------------------------------

  async listCampaigns(auth: AuthContext, query: ListAdCampaignsQuery) {
    const where: Prisma.AdCampaignWhereInput = {
      companyId: auth.companyId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { promotedItem: { contains: query.search, mode: "insensitive" } },
              { utmCampaign: { contains: query.search, mode: "insensitive" } },
              { client: { name: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [campaigns, total] = await Promise.all([
      this.prisma.adCampaign.findMany({
        where,
        select: campaignSelect,
        orderBy: [{ createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.adCampaign.count({ where }),
    ]);
    return { items: await this.withIndicators(auth, campaigns), total, page: query.page, pageSize: query.pageSize };
  }

  async getCampaign(auth: AuthContext, id: string): Promise<AdCampaignDetailDto> {
    const campaign = await this.prisma.adCampaign.findFirst({ where: { id, companyId: auth.companyId }, select: campaignSelect });
    if (!campaign) throw new NotFoundException("Campanha não encontrada");
    const [metrics, logs] = await Promise.all([
      this.prisma.adMetricDaily.findMany({
        where: { companyId: auth.companyId, campaignId: id },
        select: metricSelect,
        orderBy: { date: "asc" },
      }),
      this.prisma.adCampaignLog.findMany({
        where: { companyId: auth.companyId, campaignId: id },
        select: { id: true, action: true, detail: true, createdAt: true, user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: MAX_LOGS,
      }),
    ]);
    const effective = effectiveMetrics(metrics);
    return {
      ...formatCampaign(campaign),
      indicators: computeIndicators(effective),
      metrics: effective.map(toMetricDayDto),
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        detail: log.detail,
        userName: log.user?.name ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
      allowedStatuses: [...AD_CAMPAIGN_TRANSITIONS[campaign.status]],
    };
  }

  async createCampaign(auth: AuthContext, input: CreateAdCampaignInput): Promise<AdCampaignDto> {
    await this.assertClient(auth, input.clientId);
    const refs = await this.assertRefs(auth, input.clientId, input.platform, {
      adAccountId: input.adAccountId ?? null,
      deliveryId: input.deliveryId ?? null,
      subscriptionId: input.subscriptionId ?? null,
    });
    const promotedItem = input.promotedItem?.trim() || refs.deliveryName;
    if (!promotedItem) throw new BadRequestException("Informe o que será anunciado ou escolha uma entrega");
    this.assertPeriod(input.startAt ?? null, input.endAt ?? null);

    const base = utmSlug(input.name);
    for (let attempt = 0; attempt < 5; attempt++) {
      const utmCampaign = attempt === 0 ? await this.nextUtm(auth, base) : `${base}-${Math.random().toString(36).slice(2, 7)}`;
      try {
        const campaign = await this.prisma.$transaction(async (tx) => {
          const created = await tx.adCampaign.create({
            data: {
              companyId: auth.companyId,
              clientId: input.clientId,
              adAccountId: input.adAccountId ?? null,
              deliveryId: input.deliveryId ?? null,
              subscriptionId: input.subscriptionId ?? null,
              platform: input.platform,
              objective: input.objective,
              name: input.name,
              promotedItem,
              targetUrl: input.targetUrl ?? refs.deliveryUrl ?? null,
              utmCampaign,
              audienceNotes: input.audienceNotes || null,
              dailyBudget: input.dailyBudget ?? null,
              totalBudget: input.totalBudget ?? null,
              startAt: optionalDay(input.startAt) ?? null,
              endAt: optionalDay(input.endAt) ?? null,
              notes: input.notes || null,
              createdByUserId: auth.userId,
            },
            select: campaignSelect,
          });
          await this.log(tx, auth, created.id, "CREATE", { name: created.name, utmCampaign, status: created.status });
          return created;
        });
        return formatCampaign(campaign);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }
    }
    throw new ConflictException("Não foi possível gerar um código UTM único. Tente outro nome.");
  }

  async updateCampaign(auth: AuthContext, id: string, input: UpdateAdCampaignInput): Promise<AdCampaignDto> {
    const current = await this.prisma.adCampaign.findFirst({ where: { id, companyId: auth.companyId }, select: campaignSelect });
    if (!current) throw new NotFoundException("Campanha não encontrada");

    const refs = await this.assertRefs(auth, current.clientId, current.platform, {
      adAccountId: input.adAccountId === undefined ? undefined : input.adAccountId,
      deliveryId: input.deliveryId === undefined ? undefined : input.deliveryId,
      subscriptionId: input.subscriptionId === undefined ? undefined : input.subscriptionId,
    });
    const startAt = input.startAt === undefined ? (current.startAt ? dayKey(current.startAt) : null) : input.startAt;
    const endAt = input.endAt === undefined ? (current.endAt ? dayKey(current.endAt) : null) : input.endAt;
    this.assertPeriod(startAt, endAt);

    let promotedItem: string | undefined;
    if (input.promotedItem !== undefined) {
      promotedItem = input.promotedItem?.trim() || refs.deliveryName || undefined;
      if (!promotedItem) throw new BadRequestException("Informe o que será anunciado ou escolha uma entrega");
    }

    const data: Prisma.AdCampaignUncheckedUpdateInput = {
      ...(input.adAccountId !== undefined ? { adAccountId: input.adAccountId } : {}),
      ...(input.deliveryId !== undefined ? { deliveryId: input.deliveryId } : {}),
      ...(input.subscriptionId !== undefined ? { subscriptionId: input.subscriptionId } : {}),
      ...(input.objective !== undefined ? { objective: input.objective } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(promotedItem !== undefined ? { promotedItem } : {}),
      ...(input.targetUrl !== undefined ? { targetUrl: input.targetUrl } : {}),
      ...(input.audienceNotes !== undefined ? { audienceNotes: input.audienceNotes || null } : {}),
      ...(input.dailyBudget !== undefined ? { dailyBudget: input.dailyBudget } : {}),
      ...(input.totalBudget !== undefined ? { totalBudget: input.totalBudget } : {}),
      ...(input.startAt !== undefined ? { startAt: optionalDay(input.startAt) } : {}),
      ...(input.endAt !== undefined ? { endAt: optionalDay(input.endAt) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.adCampaign.update({ where: { id: current.id }, data, select: campaignSelect });
      await this.log(tx, auth, current.id, "UPDATE", { fields: Object.keys(data).sort() });
      return campaign;
    });
    return formatCampaign(updated);
  }

  async changeStatus(auth: AuthContext, id: string, input: ChangeAdCampaignStatusInput): Promise<AdCampaignDto> {
    const current = await this.prisma.adCampaign.findFirst({ where: { id, companyId: auth.companyId }, select: { id: true, status: true } });
    if (!current) throw new NotFoundException("Campanha não encontrada");
    if (!AD_CAMPAIGN_TRANSITIONS[current.status].includes(input.status)) {
      throw new BadRequestException(
        `Não é possível passar de "${adCampaignStatusLabels[current.status]}" para "${adCampaignStatusLabels[input.status]}"`,
      );
    }
    const reason = input.reason?.trim() || null;
    if (AD_STATUS_REASON_REQUIRED.includes(input.status) && (!reason || reason.length < 3)) {
      throw new BadRequestException("Informe o motivo (mínimo 3 caracteres)");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.adCampaign.update({ where: { id: current.id }, data: { status: input.status }, select: campaignSelect });
      await this.log(tx, auth, current.id, "STATUS", { from: current.status, to: input.status, reason });
      return campaign;
    });
    return formatCampaign(updated);
  }

  /** Lança (ou corrige) a métrica MANUAL do dia; a correção fica no log. */
  async upsertMetric(auth: AuthContext, id: string, date: string, input: UpsertAdMetricInput) {
    const campaign = await this.prisma.adCampaign.findFirst({ where: { id, companyId: auth.companyId }, select: { id: true } });
    if (!campaign) throw new NotFoundException("Campanha não encontrada");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(toDay(date).getTime()) || dayKey(toDay(date)) !== date) {
      throw new BadRequestException("Data inválida (use AAAA-MM-DD)");
    }
    if (date > todayBr()) throw new BadRequestException("Não é possível lançar métrica de um dia futuro");

    const values = {
      impressions: input.impressions,
      reach: input.reach,
      clicks: input.clicks,
      spend: new Prisma.Decimal(input.spend),
      results: input.results,
    };
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.adMetricDaily.findUnique({
        where: { campaignId_date_source: { campaignId: campaign.id, date: toDay(date), source: "MANUAL" } },
        select: { id: true, impressions: true, reach: true, clicks: true, spend: true, results: true },
      });
      const after = { ...values, spend: values.spend.toFixed(2) };
      if (existing) {
        await tx.adMetricDaily.update({ where: { id: existing.id }, data: values });
        const before = {
          impressions: existing.impressions,
          reach: existing.reach,
          clicks: existing.clicks,
          spend: existing.spend.toFixed(2),
          results: existing.results,
        };
        await this.log(tx, auth, campaign.id, "METRIC_FIX", { date, source: "MANUAL", before, after });
      } else {
        await tx.adMetricDaily.create({
          data: { companyId: auth.companyId, campaignId: campaign.id, date: toDay(date), source: "MANUAL", ...values },
        });
        await this.log(tx, auth, campaign.id, "METRIC", { date, source: "MANUAL", values: after });
      }
      return { date, source: "MANUAL" as const, ...after, corrected: existing !== null };
    });
  }

  /** Link do anúncio com UTM (utm_campaign único gerado no servidor). */
  async link(auth: AuthContext, id: string, url: string | undefined): Promise<AdLinkDto> {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id, companyId: auth.companyId },
      select: { platform: true, utmCampaign: true, targetUrl: true },
    });
    if (!campaign) throw new NotFoundException("Campanha não encontrada");
    const base = url ?? campaign.targetUrl;
    if (!base) throw new BadRequestException("Informe a URL de destino (url=https://...)");
    let target: URL;
    try {
      target = new URL(base);
    } catch {
      throw new BadRequestException("URL inválida (use https://...)");
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      throw new BadRequestException("URL deve começar com http:// ou https://");
    }
    const utmSource = adPlatformUtmSource[campaign.platform];
    target.searchParams.set("utm_source", utmSource);
    target.searchParams.set("utm_medium", UTM_MEDIUM);
    target.searchParams.set("utm_campaign", campaign.utmCampaign);
    return { url: target.toString(), utmSource, utmMedium: UTM_MEDIUM, utmCampaign: campaign.utmCampaign };
  }

  // -------------------------------------------------------------------------
  // Visão geral e ficha do cliente
  // -------------------------------------------------------------------------

  async overview(auth: AuthContext, query: { from?: string; to?: string }): Promise<AdOverviewDto> {
    const today = todayBr();
    const to = query.to ?? today;
    const from = query.from ?? `${to.slice(0, 7)}-01`;
    if (from > to) throw new BadRequestException("Período inválido: início depois do fim");

    const [campaigns, metrics, lastDates, subscriptions] = await Promise.all([
      this.prisma.adCampaign.findMany({
        where: { companyId: auth.companyId },
        select: { id: true, name: true, status: true, startAt: true, createdAt: true, subscriptionId: true, client: { select: { id: true, name: true } } },
      }),
      this.prisma.adMetricDaily.findMany({
        where: { companyId: auth.companyId, date: { gte: toDay(from), lte: toDay(to) } },
        select: metricSelect,
      }),
      this.prisma.adMetricDaily.groupBy({
        by: ["campaignId"],
        where: { companyId: auth.companyId },
        _max: { date: true },
      }),
      this.prisma.subscription.findMany({
        where: { companyId: auth.companyId, status: "ACTIVE" },
        select: { id: true, delivery: { select: { type: true } }, plan: { select: { price: true, durationDays: true } } },
      }),
    ]);

    const effective = effectiveMetrics(metrics);
    const campaignClient = new Map(campaigns.map((c) => [c.id, c.client]));
    const byClient = new Map<string, { client: { id: string; name: string }; activeCampaigns: number; rows: typeof effective }>();
    const bucket = (client: { id: string; name: string }) => {
      let entry = byClient.get(client.id);
      if (!entry) {
        entry = { client, activeCampaigns: 0, rows: [] };
        byClient.set(client.id, entry);
      }
      return entry;
    };
    for (const campaign of campaigns) if (campaign.status === "ACTIVE") bucket(campaign.client).activeCampaigns++;
    for (const row of effective) {
      const client = campaignClient.get(row.campaignId);
      if (client) bucket(client).rows.push(row);
    }

    // Contratos de gestão: entrega do tipo ADS_MANAGEMENT ou ligados a uma campanha
    const linked = new Set(campaigns.map((c) => c.subscriptionId).filter((v): v is string => v !== null));
    let managementMonthly = new Prisma.Decimal(0);
    let managementContracts = 0;
    for (const sub of subscriptions) {
      if (sub.delivery?.type !== "ADS_MANAGEMENT" && !linked.has(sub.id)) continue;
      managementContracts++;
      if (sub.plan.durationDays > 0) managementMonthly = managementMonthly.add(sub.plan.price.mul(30).div(sub.plan.durationDays));
    }

    const lastByCampaign = new Map(lastDates.map((row) => [row.campaignId, row._max.date]));
    const stale: AdOverviewDto["stale"] = [];
    for (const campaign of campaigns) {
      if (campaign.status !== "ACTIVE") continue;
      const last = lastByCampaign.get(campaign.id) ?? null;
      const reference = last ? dayKey(last) : dayKey(campaign.startAt ?? campaign.createdAt);
      const daysWithout = Math.max(0, daysBetween(reference, today));
      if (daysWithout >= AD_STALE_DAYS) {
        stale.push({
          id: campaign.id,
          name: campaign.name,
          clientName: campaign.client.name,
          lastMetricDate: last ? dayKey(last) : null,
          daysWithout: last ? daysWithout : null,
        });
      }
    }

    return {
      from,
      to,
      activeCampaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
      indicators: computeIndicators(effective),
      managementMonthly: managementMonthly.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2),
      managementContracts,
      byClient: [...byClient.values()]
        .map((entry) => ({ client: entry.client, activeCampaigns: entry.activeCampaigns, indicators: computeIndicators(entry.rows) }))
        .sort((a, b) => Number(b.indicators.spend) - Number(a.indicators.spend) || a.client.name.localeCompare(b.client.name, "pt-BR")),
      stale,
    };
  }

  async clientAds(auth: AuthContext, clientId: string): Promise<AdClientSummaryDto> {
    await this.assertClient(auth, clientId);
    const [campaigns, accounts, metrics] = await Promise.all([
      this.prisma.adCampaign.findMany({
        where: { companyId: auth.companyId, clientId },
        select: campaignSelect,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.adAccount.findMany({ where: { companyId: auth.companyId, clientId }, select: accountSelect, orderBy: { name: "asc" } }),
      this.prisma.adMetricDaily.findMany({
        where: { companyId: auth.companyId, campaign: { clientId } },
        select: metricSelect,
      }),
    ]);
    return {
      indicators: computeIndicators(effectiveMetrics(metrics)),
      campaigns: await this.withIndicators(auth, campaigns),
      accounts: accounts.map(formatAccount),
    };
  }

  // -------------------------------------------------------------------------
  // Importação do CSV do Gerenciador de Anúncios (fase A2)
  // -------------------------------------------------------------------------

  async importMetrics(
    auth: AuthContext,
    id: string,
    form: { dryRun: boolean; campaignName?: string },
    file: { originalname?: string; buffer?: Buffer } | undefined,
  ): Promise<AdImportReportDto> {
    const campaign = await this.prisma.adCampaign.findFirst({ where: { id, companyId: auth.companyId }, select: { id: true, name: true } });
    if (!campaign) throw new NotFoundException("Campanha não encontrada");
    if (!file || !file.buffer) throw new BadRequestException("Arquivo CSV é obrigatório");
    if (!file.originalname?.toLowerCase().endsWith(".csv")) throw new BadRequestException("O arquivo deve ter extensão .csv");
    if (file.buffer.byteLength > AD_IMPORT_MAX_FILE_BYTES) throw new BadRequestException("Arquivo maior que 5 MB");
    const filename = file.originalname.slice(0, 255);

    const parsed = parseAdCsv(file.buffer);

    // Várias campanhas na planilha: a escolhida, ou a de mesmo nome
    let selected: string | null = null;
    if (form.campaignName) {
      if (!parsed.campaignNames.includes(form.campaignName)) {
        throw new BadRequestException(`A planilha não tem a campanha "${form.campaignName}"`);
      }
      selected = form.campaignName;
    } else if (parsed.campaignNames.length === 1) {
      selected = parsed.campaignNames[0]!;
    } else if (parsed.campaignNames.length > 1) {
      selected = parsed.campaignNames.find((name) => name.toLowerCase() === campaign.name.toLowerCase()) ?? null;
    }
    const needsChoice = parsed.campaignNames.length > 1 && selected === null;

    // Soma por dia (a planilha pode vir quebrada por conjunto/anúncio)
    const byDay = new Map<string, Omit<MetricRow, "campaignId" | "date" | "source">>();
    if (!needsChoice) {
      for (const row of parsed.rows) {
        if (selected !== null && row.campaign !== null && row.campaign !== selected) continue;
        const current = byDay.get(row.date) ?? { impressions: 0, reach: 0, clicks: 0, spend: new Prisma.Decimal(0), results: 0 };
        byDay.set(row.date, {
          impressions: current.impressions + row.impressions,
          reach: current.reach + row.reach,
          clicks: current.clicks + row.clicks,
          spend: current.spend.add(row.spend),
          results: current.results + row.results,
        });
      }
    }
    const days = [...byDay.keys()].sort();
    const existing = days.length
      ? await this.prisma.adMetricDaily.findMany({
          where: { companyId: auth.companyId, campaignId: campaign.id, source: "CSV", date: { in: days.map(toDay) } },
          select: { date: true },
        })
      : [];
    const replaced = new Set(existing.map((row) => dayKey(row.date)));
    const rows = days.map((date) => {
      const v = byDay.get(date)!;
      return { date, impressions: v.impressions, reach: v.reach, clicks: v.clicks, spend: v.spend.toFixed(2), results: v.results, replaces: replaced.has(date) };
    });

    const report = (imported: number): AdImportReportDto => ({
      dryRun: form.dryRun,
      filename,
      format: parsed.format,
      columns: parsed.columns,
      campaignNames: parsed.campaignNames,
      selectedCampaign: selected,
      rows,
      totals: computeIndicators([...byDay.values()]),
      skipped: parsed.skipped,
      errors: parsed.errors.slice(0, 100),
      imported,
    });

    if (form.dryRun) return report(0);
    if (needsChoice) throw new BadRequestException("A planilha tem várias campanhas: escolha qual importar");
    if (rows.length === 0) throw new BadRequestException("Nenhuma linha válida para importar");

    await this.prisma.$transaction(async (tx) => {
      for (const date of days) {
        const v = byDay.get(date)!;
        await tx.adMetricDaily.upsert({
          where: { campaignId_date_source: { campaignId: campaign.id, date: toDay(date), source: "CSV" } },
          create: { companyId: auth.companyId, campaignId: campaign.id, date: toDay(date), source: "CSV", ...v },
          update: { ...v },
        });
      }
      const totals = computeIndicators([...byDay.values()]);
      await this.log(tx, auth, campaign.id, "CSV_IMPORT", {
        filename,
        format: parsed.format,
        campaignName: selected,
        days: days.length,
        from: days[0],
        to: days[days.length - 1],
        replaced: replaced.size,
        spend: totals.spend,
        results: totals.results,
        errors: parsed.errors.length,
      });
    });
    return report(rows.length);
  }

  // -------------------------------------------------------------------------
  // Apoio
  // -------------------------------------------------------------------------

  private async withIndicators(auth: AuthContext, campaigns: CampaignRecord[]): Promise<AdCampaignListItemDto[]> {
    if (campaigns.length === 0) return [];
    const metrics = await this.prisma.adMetricDaily.findMany({
      where: { companyId: auth.companyId, campaignId: { in: campaigns.map((c) => c.id) } },
      select: metricSelect,
    });
    const byCampaign = new Map<string, ReturnType<typeof effectiveMetrics<MetricRow>>>();
    for (const row of effectiveMetrics(metrics)) {
      const list = byCampaign.get(row.campaignId) ?? [];
      list.push(row);
      byCampaign.set(row.campaignId, list);
    }
    return campaigns.map((campaign) => {
      const rows = byCampaign.get(campaign.id) ?? [];
      return {
        ...formatCampaign(campaign),
        indicators: computeIndicators(rows),
        lastMetricDate: rows.length ? dayKey(rows[rows.length - 1]!.date) : null,
      };
    });
  }

  private async assertClient(auth: AuthContext, clientId: string): Promise<void> {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, companyId: auth.companyId }, select: { id: true } });
    if (!client) throw new NotFoundException("Cliente não encontrado");
  }

  /**
   * Conta, entrega e contrato precisam ser da mesma empresa E do mesmo
   * cliente; a conta, da mesma plataforma. `undefined` = não alterar.
   */
  private async assertRefs(
    auth: AuthContext,
    clientId: string,
    platform: string,
    refs: { adAccountId?: string | null; deliveryId?: string | null; subscriptionId?: string | null },
  ): Promise<{ deliveryName: string | null; deliveryUrl: string | null }> {
    let deliveryName: string | null = null;
    let deliveryUrl: string | null = null;
    if (refs.adAccountId) {
      const account = await this.prisma.adAccount.findFirst({
        where: { id: refs.adAccountId, companyId: auth.companyId },
        select: { clientId: true, platform: true },
      });
      if (!account) throw new NotFoundException("Conta de anúncio não encontrada");
      if (account.clientId !== clientId) throw new BadRequestException("A conta de anúncio é de outro cliente");
      if (account.platform !== platform) throw new BadRequestException("A conta de anúncio é de outra plataforma");
    }
    if (refs.deliveryId) {
      const delivery = await this.prisma.clientDelivery.findFirst({
        where: { id: refs.deliveryId, companyId: auth.companyId },
        select: { clientId: true, name: true, siteUrl: true },
      });
      if (!delivery) throw new NotFoundException("Entrega não encontrada");
      if (delivery.clientId !== clientId) throw new BadRequestException("A entrega é de outro cliente");
      deliveryName = delivery.name;
      deliveryUrl = delivery.siteUrl;
    }
    if (refs.subscriptionId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { id: refs.subscriptionId, companyId: auth.companyId },
        select: { clientId: true },
      });
      if (!subscription) throw new NotFoundException("Contrato não encontrado");
      if (subscription.clientId !== clientId) throw new BadRequestException("O contrato é de outro cliente");
    }
    return { deliveryName, deliveryUrl };
  }

  private assertPeriod(startAt: string | null, endAt: string | null): void {
    if (startAt && endAt && endAt < startAt) throw new BadRequestException("O fim da campanha deve ser depois do início");
  }

  /** Primeiro slug livre: base, base-2, base-3... */
  private async nextUtm(auth: AuthContext, base: string): Promise<string> {
    const taken = await this.prisma.adCampaign.findMany({
      where: { companyId: auth.companyId, utmCampaign: { startsWith: base } },
      select: { utmCampaign: true },
    });
    const used = new Set(taken.map((c) => c.utmCampaign));
    if (!used.has(base)) return base;
    for (let n = 2; ; n++) {
      if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
    }
  }

  private async log(tx: Tx, auth: AuthContext, campaignId: string, action: AdLogAction, detail: Prisma.InputJsonValue): Promise<void> {
    await tx.adCampaignLog.create({ data: { companyId: auth.companyId, campaignId, action, detail, userId: auth.userId } });
  }
}
