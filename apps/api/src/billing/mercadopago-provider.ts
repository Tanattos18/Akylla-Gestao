import { env } from "../config/env";

export interface MercadoPagoPreapprovalInput {
  reason: string;
  externalReference: string;
  payerEmail: string;
  amount: number;
  frequencyDays: number;
  backUrl: string;
}

export interface MercadoPagoPreapproval {
  id: string;
  initPoint: string | null;
  sandboxInitPoint: string | null;
  status: string;
}

export interface MercadoPagoProvider {
  createPreapproval(input: MercadoPagoPreapprovalInput): Promise<MercadoPagoPreapproval>;
}

export function createMercadoPagoProvider(config?: {
  accessToken?: string;
  env?: "sandbox" | "production";
}): MercadoPagoProvider {
  const accessToken = config?.accessToken ?? env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return new FailingMercadoPagoProvider(
      "MERCADOPAGO_ACCESS_TOKEN não configurado — checkout indisponível",
    );
  }

  return new SdkMercadoPagoProvider(accessToken);
}

/** Sem credenciais: falha explícita (nunca ativa cobrança real por engano). */
export class FailingMercadoPagoProvider implements MercadoPagoProvider {
  constructor(private readonly reason: string) {}

  async createPreapproval(): Promise<MercadoPagoPreapproval> {
    throw new Error(this.reason);
  }
}

/** Provedor real usando o SDK oficial do Mercado Pago. */
export class SdkMercadoPagoProvider implements MercadoPagoProvider {
  constructor(private readonly accessToken: string) {}

  async createPreapproval(input: MercadoPagoPreapprovalInput): Promise<MercadoPagoPreapproval> {
    // Import dinâmico para que o SDK só carregue quando credenciais existem
    // (e para manter o módulo testável sem rede).
    const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
    const client = new MercadoPagoConfig({ accessToken: this.accessToken });
    const preapproval = new PreApproval(client);

    const result = await preapproval.create({
      body: {
        reason: input.reason,
        external_reference: input.externalReference,
        payer_email: input.payerEmail,
        auto_recurring: {
          frequency: Math.max(1, Math.round(input.frequencyDays / 30)),
          frequency_type: "months",
          transaction_amount: input.amount,
          currency_id: "BRL",
        },
        back_url: input.backUrl,
      },
    });

    if (!result.id) {
      throw new Error("Mercado Pago não retornou id do preapproval");
    }

    // O campo sandbox_init_point não está nos tipos do SDK, mas a API o
    // retorna no modo sandbox — acesso defensivo.
    const sandboxInitPoint = (result as unknown as Record<string, unknown>).sandbox_init_point;

    return {
      id: result.id,
      initPoint: result.init_point ?? null,
      sandboxInitPoint: typeof sandboxInitPoint === "string" ? sandboxInitPoint : null,
      status: result.status ?? "pending",
    };
  }
}

/** Provedor controlado para testes: nunca toca a rede. */
export class MockMercadoPagoProvider implements MercadoPagoProvider {
  public calls: MercadoPagoPreapprovalInput[] = [];

  constructor(
    private readonly overrides?: Partial<MercadoPagoPreapproval>,
    private readonly failWith?: string,
  ) {}

  async createPreapproval(input: MercadoPagoPreapprovalInput): Promise<MercadoPagoPreapproval> {
    this.calls.push(input);
    if (this.failWith) {
      throw new Error(this.failWith);
    }
    return {
      id: this.overrides?.id ?? `mp_preapp_mock_${this.calls.length}`,
      initPoint: this.overrides?.initPoint ?? `https://mp.example/checkout_${this.calls.length}`,
      sandboxInitPoint:
        this.overrides?.sandboxInitPoint ??
        `https://sandbox.mp.example/checkout_${this.calls.length}`,
      status: this.overrides?.status ?? "pending",
    };
  }
}
