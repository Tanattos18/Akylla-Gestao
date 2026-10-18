import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CancelFiscalDocumentInput,
  EmitFiscalDocumentInput,
  ListFiscalDocumentsQuery,
  UpdateFiscalConfigInput,
} from "@petflow/shared";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { encryptSecret, inspectCertificate } from "./fiscal-crypto";
import { createFiscalProvider, isSimulatedProvider, type EmitInput, type FiscalProvider } from "./fiscal-provider";

const documentSelect = {
  id: true,
  type: true,
  status: true,
  environment: true,
  number: true,
  series: true,
  amount: true,
  accessKey: true,
  protocol: true,
  danfeUrl: true,
  issuedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  rejectionReason: true,
  createdAt: true,
  sale: { select: { id: true, receiptCode: true } },
  serviceOrder: { select: { id: true, number: true } },
  requestedBy: { select: { id: true, name: true } },
} as const;

type DocumentRecord = Prisma.FiscalDocumentGetPayload<{ select: typeof documentSelect }>;

function formatDocument(d: DocumentRecord) {
  return { ...d, amount: d.amount.toFixed(2), hasXml: undefined as boolean | undefined };
}

/** Situações que impedem nova emissão para a mesma origem/tipo. */
const ACTIVE_STATUSES = ["PENDING", "AUTHORIZED"] as const;

/**
 * Fiscal por integração (Fase 3). Regras: docs/akylla/FISCAL.md.
 * - configuração com segredos cifrados (nunca devolvidos);
 * - emissão de NFC-e/NF-e (venda) e NFS-e (OS) pela emissora configurada;
 * - numeração por empresa/tipo/série (config travada na transação);
 * - cancelamento com justificativa; webhook atualiza situação.
 */
@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);
  /** Substituível nos testes (emissora falsa). */
  providerFactory: (name: string) => FiscalProvider = createFiscalProvider;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------- configuração

  async getConfig(auth: AuthContext) {
    const config = await this.prisma.fiscalConfig.findFirst({ where: { companyId: auth.companyId } });
    return {
      provider: config?.provider ?? "mock",
      environment: config?.environment ?? "HOMOLOGATION",
      active: config?.active ?? false,
      cnpj: config?.cnpj ?? null,
      nfceSeries: config?.nfceSeries ?? 1,
      nfeSeries: config?.nfeSeries ?? 1,
      hasApiToken: Boolean(config?.apiTokenEncrypted),
      certificate: config?.certificateEncrypted
        ? { uploaded: true, subject: config.certificateSubject, validTo: config.certificateValidTo }
        : { uploaded: false, subject: null, validTo: null },
      simulated: isSimulatedProvider(config?.provider ?? "mock"),
    };
  }

  /** Estado mínimo para telas operacionais (PDV): sem dados sensíveis. */
  async getStatus(auth: AuthContext) {
    const config = await this.prisma.fiscalConfig.findFirst({
      where: { companyId: auth.companyId },
      select: { active: true, environment: true, provider: true },
    });
    return {
      active: config?.active ?? false,
      environment: config?.environment ?? "HOMOLOGATION",
      simulated: isSimulatedProvider(config?.provider ?? "mock"),
    };
  }

  async updateConfig(auth: AuthContext, input: UpdateFiscalConfigInput) {
    const current = await this.prisma.fiscalConfig.findFirst({ where: { companyId: auth.companyId } });
    const next = {
      provider: input.provider ?? current?.provider ?? "mock",
      cnpj: input.cnpj !== undefined ? input.cnpj : current?.cnpj ?? null,
      active: input.active ?? current?.active ?? false,
      hasToken: input.apiToken !== undefined ? Boolean(input.apiToken) : Boolean(current?.apiTokenEncrypted),
      hasCertificate: Boolean(current?.certificateEncrypted),
    };
    if (next.active) {
      if (!next.cnpj) throw new BadRequestException("Informe o CNPJ do emitente antes de ativar a emissão");
      if (!isSimulatedProvider(next.provider) && (!next.hasToken || !next.hasCertificate)) {
        throw new BadRequestException("Integradora real exige token da API e certificado A1 antes de ativar");
      }
    }
    const data = {
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.environment !== undefined ? { environment: input.environment } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.cnpj !== undefined ? { cnpj: input.cnpj } : {}),
      ...(input.nfceSeries !== undefined ? { nfceSeries: input.nfceSeries } : {}),
      ...(input.nfeSeries !== undefined ? { nfeSeries: input.nfeSeries } : {}),
      ...(input.apiToken !== undefined ? { apiTokenEncrypted: input.apiToken ? encryptSecret(input.apiToken) : null } : {}),
    };
    if (current) {
      await this.prisma.fiscalConfig.update({ where: { id: current.id }, data });
    } else {
      await this.prisma.fiscalConfig.create({ data: { companyId: auth.companyId, ...data } });
    }
    return this.getConfig(auth);
  }

  async uploadCertificate(auth: AuthContext, file: Express.Multer.File | undefined, password: string) {
    if (!file?.buffer?.length) throw new BadRequestException("Envie o arquivo .pfx no campo \"file\"");
    const info = inspectCertificate(file.buffer, password);
    const data = {
      certificateEncrypted: encryptSecret(file.buffer),
      certificatePasswordEncrypted: encryptSecret(password),
      certificateSubject: info.subject.slice(0, 500),
      certificateValidTo: info.validTo,
    };
    const current = await this.prisma.fiscalConfig.findFirst({ where: { companyId: auth.companyId }, select: { id: true } });
    if (current) {
      await this.prisma.fiscalConfig.update({ where: { id: current.id }, data });
    } else {
      await this.prisma.fiscalConfig.create({ data: { companyId: auth.companyId, ...data } });
    }
    return this.getConfig(auth);
  }

  // -------------------------------------------------------------- emissão

  async emit(auth: AuthContext, input: EmitFiscalDocumentInput) {
    const config = await this.prisma.fiscalConfig.findFirst({ where: { companyId: auth.companyId } });
    if (!config?.active || !config.cnpj) {
      throw new BadRequestException("Emissão fiscal não está configurada/ativa para esta empresa (Fiscal › Configuração)");
    }
    const source = await this.loadSource(auth, input);

    const existing = await this.prisma.fiscalDocument.findFirst({
      where: {
        companyId: auth.companyId,
        type: input.type,
        status: { in: [...ACTIVE_STATUSES] },
        ...(input.saleId ? { saleId: input.saleId } : { serviceOrderId: input.serviceOrderId }),
      },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new ConflictException(`Já existe documento ${existing.status === "PENDING" ? "em processamento" : "autorizado"} para esta origem`);
    }

    const series = input.type === "NFE" ? config.nfeSeries : input.type === "NFCE" ? config.nfceSeries : 1;
    const document = await this.prisma.$transaction(async (tx) => {
      // Numeração sequencial por empresa/tipo/série: trava a configuração
      await tx.$queryRaw`SELECT id FROM "FiscalConfig" WHERE id = ${config.id} FOR UPDATE`;
      const last = await tx.fiscalDocument.aggregate({
        where: { companyId: auth.companyId, type: input.type, series },
        _max: { number: true },
      });
      return tx.fiscalDocument.create({
        data: {
          companyId: auth.companyId,
          saleId: input.saleId ?? null,
          serviceOrderId: input.serviceOrderId ?? null,
          type: input.type,
          environment: config.environment,
          number: (last._max.number ?? 0) + 1,
          series,
          amount: source.amount,
          requestedByUserId: auth.userId,
        },
        select: { id: true, number: true },
      });
    });

    // Chamada à emissora FORA da transação (rede lenta não segura locks)
    const provider = this.providerFactory(config.provider);
    const emitInput: EmitInput = {
      documentId: document.id,
      type: input.type,
      environment: config.environment,
      number: document.number,
      series,
      issuerCnpj: config.cnpj,
      amount: source.amount.toFixed(2),
      issuedAt: new Date(),
      customer: source.customer,
      items: source.items,
    };
    try {
      const result = await provider.emit(emitInput);
      await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: {
          status: result.status,
          gatewayDocumentId: result.gatewayDocumentId,
          accessKey: result.accessKey ?? null,
          protocol: result.protocol ?? null,
          xml: result.xml ?? null,
          danfeUrl: result.danfeUrl ?? null,
          rejectionReason: result.rejectionReason ?? null,
          issuedAt: result.status === "AUTHORIZED" ? new Date() : null,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha na emissora";
      this.logger.warn(`Emissão ${document.id} falhou: ${reason}`);
      await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: { status: "REJECTED", rejectionReason: reason.slice(0, 500) },
      });
    }
    return this.get(auth, document.id);
  }

  /** Origem da nota: venda (NFC-e/NF-e) ou OS concluída (NFS-e). */
  private async loadSource(auth: AuthContext, input: EmitFiscalDocumentInput) {
    if (input.saleId) {
      if (input.type === "NFSE") throw new BadRequestException("NFS-e é emitida a partir da ordem de serviço");
      const sale = await this.prisma.sale.findFirst({
        where: { id: input.saleId, companyId: auth.companyId },
        select: {
          status: true,
          total: true,
          client: { select: { name: true, cpf: true } },
          items: { select: { productName: true, quantity: true, unitPrice: true, subtotal: true } },
        },
      });
      if (!sale) throw new NotFoundException("Venda não encontrada");
      if (sale.status !== "COMPLETED") throw new BadRequestException("Só vendas concluídas podem ter nota fiscal");
      if (input.type === "NFE" && !sale.client?.cpf) {
        throw new BadRequestException("NF-e exige cliente com CPF na venda (use NFC-e para consumidor sem identificação)");
      }
      return {
        amount: sale.total,
        customer: sale.client ? { name: sale.client.name, cpf: sale.client.cpf } : null,
        items: sale.items.map((i) => ({
          description: i.productName,
          quantity: i.quantity.toFixed(3),
          unitPrice: i.unitPrice.toFixed(2),
          total: i.subtotal.toFixed(2),
        })),
      };
    }
    if (input.type !== "NFSE") throw new BadRequestException("Ordem de serviço emite NFS-e");
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: input.serviceOrderId, companyId: auth.companyId },
      select: {
        status: true,
        total: true,
        client: { select: { name: true, cpf: true } },
        items: { select: { description: true, quantity: true, unitPrice: true, subtotal: true } },
      },
    });
    if (!order) throw new NotFoundException("Ordem de serviço não encontrada");
    if (order.status !== "COMPLETED") throw new BadRequestException("Só OS concluída pode ter NFS-e");
    return {
      amount: order.total,
      customer: { name: order.client.name, cpf: order.client.cpf },
      items: order.items.map((i) => ({
        description: i.description,
        quantity: i.quantity.toFixed(3),
        unitPrice: i.unitPrice.toFixed(2),
        total: i.subtotal.toFixed(2),
      })),
    };
  }

  // ------------------------------------------------------------- consulta

  async list(auth: AuthContext, query: ListFiscalDocumentsQuery) {
    const where: Prisma.FiscalDocumentWhereInput = {
      companyId: auth.companyId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.saleId ? { saleId: query.saleId } : {}),
      ...(query.serviceOrderId ? { serviceOrderId: query.serviceOrderId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.fiscalDocument.findMany({
        where,
        select: { ...documentSelect, xml: false },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.fiscalDocument.count({ where }),
    ]);
    return { items: items.map(formatDocument), total, page: query.page, pageSize: query.pageSize };
  }

  async get(auth: AuthContext, id: string) {
    const document = await this.prisma.fiscalDocument.findFirst({
      where: { id, companyId: auth.companyId },
      select: { ...documentSelect, xml: true },
    });
    if (!document) throw new NotFoundException("Documento fiscal não encontrado");
    const { xml, ...rest } = document;
    return { ...formatDocument(rest as DocumentRecord), hasXml: Boolean(xml) };
  }

  async getXml(auth: AuthContext, id: string) {
    const document = await this.prisma.fiscalDocument.findFirst({
      where: { id, companyId: auth.companyId },
      select: { xml: true, type: true, number: true, accessKey: true },
    });
    if (!document) throw new NotFoundException("Documento fiscal não encontrado");
    if (!document.xml) throw new NotFoundException("XML ainda não disponível");
    const filename = `${document.accessKey ?? `${document.type}-${document.number}`}.xml`;
    return { xml: document.xml, filename };
  }

  // ------------------------------------------------------------ cancelamento

  async cancel(auth: AuthContext, id: string, input: CancelFiscalDocumentInput) {
    const document = await this.prisma.fiscalDocument.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true, status: true, gatewayDocumentId: true, companyId: true },
    });
    if (!document) throw new NotFoundException("Documento fiscal não encontrado");
    if (document.status !== "AUTHORIZED" || !document.gatewayDocumentId) {
      throw new ConflictException("Apenas documentos autorizados podem ser cancelados");
    }
    const config = await this.prisma.fiscalConfig.findFirstOrThrow({ where: { companyId: auth.companyId } });
    const result = await this.providerFactory(config.provider).cancel(document.gatewayDocumentId, input.reason);
    if (result.status !== "CANCELLED") {
      throw new ConflictException(`A emissora recusou o cancelamento: ${result.rejectionReason ?? "sem motivo informado"}`);
    }
    const updated = await this.prisma.fiscalDocument.updateMany({
      where: { id: document.id, status: "AUTHORIZED" },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: input.reason },
    });
    if (updated.count === 0) throw new ConflictException("Documento alterado em paralelo");
    return this.get(auth, id);
  }

  // ---------------------------------------------------------------- webhook

  /**
   * Atualização vinda da emissora (rota pública, assinatura validada no
   * controller). Idempotente: só muda se a situação for diferente e a
   * transição fizer sentido. Documento desconhecido → ignorado (200).
   */
  async applyWebhook(payload: {
    gatewayDocumentId: string;
    status: "AUTHORIZED" | "REJECTED" | "CANCELLED";
    accessKey?: string;
    protocol?: string;
    xml?: string;
    danfeUrl?: string;
    reason?: string;
  }) {
    const document = await this.prisma.fiscalDocument.findUnique({
      where: { gatewayDocumentId: payload.gatewayDocumentId },
      select: { id: true, status: true },
    });
    if (!document) return { applied: false, reason: "unknown-document" };
    const allowedFrom: Record<string, string[]> = {
      AUTHORIZED: ["PENDING"],
      REJECTED: ["PENDING"],
      CANCELLED: ["AUTHORIZED"],
    };
    const from = allowedFrom[payload.status] ?? [];
    if (!from.includes(document.status)) return { applied: false, reason: "no-op" };
    const updated = await this.prisma.fiscalDocument.updateMany({
      where: { id: document.id, status: { in: from as Array<"PENDING" | "AUTHORIZED"> } },
      data: {
        status: payload.status,
        ...(payload.status === "AUTHORIZED"
          ? {
              issuedAt: new Date(),
              accessKey: payload.accessKey ?? null,
              protocol: payload.protocol ?? null,
              xml: payload.xml ?? null,
              danfeUrl: payload.danfeUrl ?? null,
            }
          : {}),
        ...(payload.status === "REJECTED" ? { rejectionReason: (payload.reason ?? "Rejeitada pela SEFAZ").slice(0, 500) } : {}),
        ...(payload.status === "CANCELLED" ? { cancelledAt: new Date(), cancellationReason: payload.reason ?? "Cancelada na emissora" } : {}),
      },
    });
    return { applied: updated.count > 0 };
  }

  /** Venda com nota pendente/autorizada não pode ser cancelada sem antes cancelar a nota. */
  async assertSaleCancellable(tx: Prisma.TransactionClient, companyId: string, saleId: string) {
    const blocking = await tx.fiscalDocument.findFirst({
      where: { companyId, saleId, status: { in: [...ACTIVE_STATUSES] } },
      select: { type: true, status: true },
    });
    if (blocking) {
      throw new ConflictException(
        `Cancele antes a ${blocking.type === "NFCE" ? "NFC-e" : "NF-e"} ${blocking.status === "PENDING" ? "em processamento" : "autorizada"} desta venda (Fiscal)`,
      );
    }
  }
}
