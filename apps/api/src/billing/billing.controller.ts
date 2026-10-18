import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  cancelTenantSubscriptionSchema,
  createCheckoutSchema,
  type CancelTenantSubscriptionInput,
  type CreateCheckoutInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { BillingService } from "./billing.service";
import { MercadoPagoService } from "./mercadopago.service";
import { AccessService } from "./access";

@Controller("billing")
export class BillingController {
  constructor(
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(MercadoPagoService) private readonly mpService: MercadoPagoService,
    @Inject(AccessService) private readonly accessService: AccessService,
  ) {}

  @Get("plans")
  listPlans() {
    return this.billingService.listPlans();
  }

  /** Kits (Fase 8b): preço de cada módulo avulso */
  @Get("modules")
  modules() {
    return this.billingService.listModuleOffers();
  }

  @Get("gateway")
  @UseGuards(AdminGuard)
  gateway() {
    return this.mpService.describe();
  }

  @Post("checkout")
  @UseGuards(AdminGuard)
  checkout(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(createCheckoutSchema))
    body: CreateCheckoutInput,
  ) {
    return this.mpService.createCheckout(auth.companyId, body.planId, body.payerEmail);
  }

  @Get("subscription")
  getSubscription(@Auth() auth: AuthContext) {
    return this.billingService.getSubscription(auth);
  }

  /** Fase 8: situação de acesso (teste, ativa, tolerância, somente leitura) */
  @Get("access")
  access(@Auth() auth: AuthContext) {
    return this.accessService.getAccess(auth.companyId, { fresh: true });
  }

  @Get("usage")
  getUsage(@Auth() auth: AuthContext) {
    return this.billingService.getUsage(auth);
  }

  @Post("subscription/cancel")
  @UseGuards(AdminGuard)
  cancel(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(cancelTenantSubscriptionSchema))
    body: CancelTenantSubscriptionInput,
  ) {
    return this.billingService.cancel(auth, body);
  }
}
