import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.module";
import type { AuthContext } from "../common/decorators/auth.decorator";
import type {
  CreateLegalConsentInput,
  LgpdAnonymizeDto,
  LgpdConsentDto,
  LgpdDataExportDto,
} from "@petflow/shared";

const ANONYMOUS_NAME = "Cliente anonimizado";

@Injectable()
export class LgpdService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Registra o aceite de um documento legal (termos, privacidade ou
   * tratamento de dados). Fica vinculado ao usuário autenticado (papel USER)
   * ou, quando o cliente é o titular, ao clientId informado (papel CLIENT).
   */
  async recordConsent(
    auth: AuthContext,
    input: CreateLegalConsentInput,
  ): Promise<LgpdConsentDto> {
    const isClient = input.role === "CLIENT";

    if (isClient) {
      if (!input.clientId) {
        throw new ForbiddenException(
          "Consentimento de cliente exige identificar o cliente",
        );
      }
      const client = await this.prisma.client.findFirst({
        where: { id: input.clientId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!client) {
        throw new NotFoundException("Cliente não encontrado");
      }
    }

    const consent = await this.prisma.legalConsent.create({
      data: {
        companyId: auth.companyId,
        userId: isClient ? null : auth.userId,
        clientId: isClient ? input.clientId! : null,
        role: input.role,
        type: input.type,
        version: input.version,
      },
    });

    return this.toConsentDto(consent);
  }

  async listConsents(auth: AuthContext, clientId?: string) {
    const consents = await this.prisma.legalConsent.findMany({
      where: {
        companyId: auth.companyId,
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { acceptedAt: "desc" },
      take: 100,
    });

    return { items: consents.map((c) => this.toConsentDto(c)) };
  }

  /** Portabilidade (art. 18, V) — exporta todos os dados do titular. */
  async getClientDataExport(
    auth: AuthContext,
    clientId: string,
  ): Promise<LgpdDataExportDto> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: auth.companyId },
    });
    if (!client) {
      throw new NotFoundException("Cliente não encontrado");
    }

    const [sales, financialEntries, subscriptions, deliveries, consents] =
      await Promise.all([
        this.prisma.sale.findMany({
          where: { clientId, companyId: auth.companyId },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.financialEntry.findMany({
          where: { clientId, companyId: auth.companyId },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.subscription.findMany({
          where: { clientId, companyId: auth.companyId },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.clientDelivery.findMany({
          where: { clientId, companyId: auth.companyId },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.legalConsent.findMany({
          where: { clientId, companyId: auth.companyId },
          orderBy: { acceptedAt: "desc" },
        }),
      ]);

    return {
      client: client
        ? {
            id: client.id,
            name: client.name,
            phone: client.phone,
            mobile: client.mobile,
            email: client.email,
            cpf: client.cpf,
            street: client.street,
            number: client.number,
            complement: client.complement,
            district: client.district,
            city: client.city,
            state: client.state,
            zip: client.zip,
            notes: client.notes,
            createdAt: client.createdAt.toISOString(),
          }
        : null,
      sales,
      financialEntries,
      subscriptions,
      deliveries,
      consents: consents.map((c) => this.toConsentDto(c)),
    };
  }

  /**
   * Anonimização (direito ao esquecimento) — mascara os dados pessoais do
   * cliente e de seus pets, preservando os registros financeiros, vendas e
   * assinaturas (obrigação de retenção). A trilha de auditoria do que foi
   * feito fica no retorno; o registro não é apagado.
   */
  async anonymizeClient(
    auth: AuthContext,
    clientId: string,
  ): Promise<LgpdAnonymizeDto> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException("Cliente não encontrado");
    }

    const [salesCount, financialCount, subscriptionsCount] = await Promise.all([
      this.prisma.sale.count({ where: { clientId, companyId: auth.companyId } }),
      this.prisma.financialEntry.count({
        where: { clientId, companyId: auth.companyId },
      }),
      this.prisma.subscription.count({
        where: { clientId, companyId: auth.companyId },
      }),
    ]);

    const anonKey = `anon-${randomBytes(8).toString("hex")}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: clientId },
        data: {
          name: `${ANONYMOUS_NAME}`,
          nameKey: anonKey,
          phone: null,
          mobile: null,
          email: null,
          cpf: null,
          street: null,
          number: null,
          complement: null,
          district: null,
          city: null,
          state: null,
          zip: null,
          notes: null,
          status: "INACTIVE",
        },
      });

      await tx.pet.updateMany({
        where: { clientId, companyId: auth.companyId },
        data: {
          name: "Animal anonimizado",
          color: null,
          notes: null,
          breed: null,
        },
      });
    });

    return {
      clientId,
      anonymizedAt: new Date().toISOString(),
      retained: {
        sales: salesCount,
        financialEntries: financialCount,
        subscriptions: subscriptionsCount,
      },
    };
  }

  private toConsentDto(consent: {
    id: string;
    type: "TERMS" | "PRIVACY" | "DATA_PROCESSING";
    role: "USER" | "CLIENT";
    version: string;
    acceptedAt: Date;
  }): LgpdConsentDto {
    return {
      id: consent.id,
      type: consent.type,
      role: consent.role,
      version: consent.version,
      acceptedAt: consent.acceptedAt.toISOString(),
    };
  }
}
