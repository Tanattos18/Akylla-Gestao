import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Query,
} from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { MercadoPagoService } from "./mercadopago.service";

/**
 * Webhook público do Mercado Pago — protegido por assinatura HMAC
 * (x-signature), não por cookie de sessão.
 */
@Controller("webhooks/mercadopago")
export class MercadoPagoWebhookController {
  constructor(@Inject(MercadoPagoService) private readonly mp: MercadoPagoService) {}

  @Post()
  @Public()
  @HttpCode(200)
  async handle(
    @Query() query: Record<string, string>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    const dataId = query["data.id"] ?? (body?.data as { id?: string } | undefined)?.id;

    if (dataId && !this.mp.verifyWebhookSignature(headers, dataId)) {
      // Responde 200 para não gerar retry infinito, mas não processa.
      return { received: true, processed: false, reason: "assinatura inválida" };
    }

    const result = await this.mp.handleWebhook(query, body);
    return { received: true, processed: result.handled };
  }
}
