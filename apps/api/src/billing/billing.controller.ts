import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  cancelTenantSubscriptionSchema,
  createCheckoutSchema,
  updateTenantSubscriptionSchema,
  type CancelTenantSubscriptionInput,
  type CreateCheckoutInput,
  type UpdateTenantSubscriptionInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { BillingService } from "./billing.service";
import { MercadoPagoService } from "./mercadopago.service";

@Controller("billing")
export class BillingController {
  constructor(
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(MercadoPagoService) private readonly mpService: MercadoPagoService,
  ) {}

  @Get("plans")
  listPlans() {
    return this.billingService.listPlans();
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

  @Put("subscription")
  @UseGuards(AdminGuard)
  upsertSubscription(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateTenantSubscriptionSchema))
    body: UpdateTenantSubscriptionInput,
  ) {
    return this.billingService.upsertSubscription(auth, body);
  }

  @Post("subscription/renew")
  @UseGuards(AdminGuard)
  renew(@Auth() auth: AuthContext) {
    return this.billingService.renew(auth);
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
