import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.module";
import { env } from "../config/env";
import {
  createMercadoPagoProvider,
  type MercadoPagoProvider,
} from "./mercadopago-provider";

type WebhookQuery = {
  "data.id"?: string;
  type?: string;
};

type WebhookHeaders = Record<string, string | string[] | undefined>;

/**
 * Integração sandbox do Mercado Pago (Etapa 11, decisão D4).
 *
 * Fluxo:
 * 1. Admin cria checkout via POST /api/billing/checkout → preapproval no MP →
 *    TenantSubscription recebe gateway + gatewaySubscriptionId.
 * 2. Admin paga no ambiente sandbox do MP.
 * 3. MP envia webhook assinado → POST /api/webhooks/mercadopago → status
 *    sincronizado com TenantSubscription (idempotente por gatewaySubscriptionId).
 *
 * Cobrança recorrente real NÃO é ativada nesta etapa: sem
 * MERCADOPAGO_ACCESS_TOKEN configurado, o checkout falha com erro explícito.
 */
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private override: MercadoPagoProvider | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Uso em testes: injeta um provedor controlado. */
  setProvider(provider: MercadoPagoProvider | null): void {
    this.override = provider;
  }

  /** Uso em testes: sobrescreve o segredo de assinatura do webhook. */
  private webhookSecretOverride: string | null = null;

  setWebhookSecret(secret: string | null): void {
    this.webhookSecretOverride = secret;
  }

  private provider(): MercadoPagoProvider {
    if (this.override) return this.override;
    return createMercadoPagoProvider();
  }

  describe(): { env: "sandbox" | "production"; credentialsConfigured: boolean } {
    return {
      env: env.MERCADOPAGO_ENV,
      credentialsConfigured: Boolean(env.MERCADOPAGO_ACCESS_TOKEN),
    };
  }

  async createCheckout(
    companyId: string,
    planId: string,
    payerEmail: string,
  ): Promise<{ checkoutUrl: string; gatewaySubscriptionId: string }> {
    const plan = await this.prisma.tenantPlan.findFirst({
      where: { id: planId, active: true },
      select: { id: true, name: true, priceMonthly: true, durationDays: true },
    });
    if (!plan) {
      throw new BadRequestException("Plano indisponível");
    }

    let result;
    try {
      result = await this.provider().createPreapproval({
        reason: `Akylla Gestão — Plano ${plan.name}`,
        externalReference: `${companyId}:${plan.id}`,
        payerEmail,
        amount: Number(plan.priceMonthly),
        frequencyDays: plan.durationDays,
        backUrl: `${env.APP_ORIGINS.split(",")[0]?.trim() ?? "http://localhost:3000"}/faturamento`,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Falha ao criar checkout no Mercado Pago",
      );
    }

    const checkoutUrl =
      env.MERCADOPAGO_ENV === "sandbox"
        ? (result.sandboxInitPoint ?? result.initPoint)
        : result.initPoint;

    if (!checkoutUrl) {
      throw new BadRequestException(
        "Mercado Pago não retornou URL de checkout — verifique as credenciais",
      );
    }

    // A assinatura só fica ACTIVE quando o webhook confirmar o pagamento.
    await this.prisma.tenantSubscription.upsert({
      where: { companyId },
      create: {
        companyId,
        planId: plan.id,
        status: "EXPIRED",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + plan.durationDays * 86_400_000),
        gateway: "MERCADO_PAGO",
        gatewaySubscriptionId: result.id,
      },
      update: {
        planId: plan.id,
        gateway: "MERCADO_PAGO",
        gatewaySubscriptionId: result.id,
      },
    });

    return { checkoutUrl, gatewaySubscriptionId: result.id };
  }

  /**
   * Processa um webhook do Mercado Pago. Idempotente: eventos repetidos não
   * alteram o estado pela segunda vez (updateMany com guarda de status).
   */
  async handleWebhook(query: WebhookQuery, body: Record<string, unknown>): Promise<{ handled: boolean }> {
    const dataId = query["data.id"] ?? this.extractDataId(body);
    const type = query.type ?? this.extractType(body);

    if (type !== "preapproval" || !dataId) {
      return { handled: false };
    }

    // Busca o estado atualizado no provedor (mock em testes).
    const status = await this.fetchPreapprovalStatus(dataId);
    if (!status) {
      this.logger.warn(`Webhook preapproval ${dataId} sem estado correspondente`);
      return { handled: false };
    }

    const mapped = this.mapStatus(status);
    if (!mapped) {
      return { handled: false };
    }

    const result = await this.prisma.tenantSubscription.updateMany({
      where: { gatewaySubscriptionId: dataId },
      data: {
        status: mapped.status,
        ...(mapped.cancelledAt ? { cancelledAt: mapped.cancelledAt } : {}),
      },
    });

    return { handled: result.count > 0 };
  }

  private async fetchPreapprovalStatus(id: string): Promise<string | null> {
    if (this.override && "getStatus" in this.override) {
      const getter = (this.override as unknown as {
        getStatus?: (id: string) => Promise<string | null>;
      }).getStatus;
      if (getter) return getter.call(this.override, id);
    }

    // Em produção, consultaria GET /preapproval/{id} no SDK. Sem override de
    // testes e sem credenciais, não fazemos chamada de rede aqui.
    return null;
  }

  private mapStatus(
    mpStatus: string,
  ): { status: "ACTIVE" | "CANCELLED" | "EXPIRED"; cancelledAt?: Date } | null {
    switch (mpStatus) {
      case "authorized":
        return { status: "ACTIVE" };
      case "cancelled":
        return { status: "CANCELLED", cancelledAt: new Date() };
      case "paused":
        return { status: "EXPIRED" };
      default:
        return null;
    }
  }

  private extractDataId(body: Record<string, unknown>): string | null {
    const data = body.data as { id?: unknown } | undefined;
    if (data && typeof data.id === "string") return data.id;
    if (typeof body.id === "string") return body.id;
    return null;
  }

  private extractType(body: Record<string, unknown>): string | null {
    if (typeof body.type === "string") return body.type;
    return null;
  }

  /**
   * Verificação de assinatura do webhook (header x-signature do Mercado Pago).
   * Manifesto: `id:[data.id];request-id:[x-request-id];ts:[ts];` com HMAC-SHA256.
   */
  verifyWebhookSignature(
    headers: WebhookHeaders,
    dataId: string,
  ): boolean {
    const secret = this.webhookSecretOverride ?? env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return false;

    const raw = headers["x-signature"];
    const signature = Array.isArray(raw) ? raw[0] : raw;
    if (!signature) return false;

    const parts = Object.fromEntries(
      signature.split(",").map((part) => {
        const [key, ...rest] = part.split("=");
        return [key.trim(), rest.join("=")];
      }),
    );
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const rawRequestId = headers["x-request-id"];
    const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId ?? "";

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    // Comparação em tempo constante.
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(v1, "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }
}
