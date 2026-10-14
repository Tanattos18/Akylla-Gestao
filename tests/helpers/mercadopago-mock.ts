import type {
  MercadoPagoPreapproval,
  MercadoPagoPreapprovalInput,
  MercadoPagoProvider,
} from "../../apps/api/src/billing/mercadopago-provider";

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
