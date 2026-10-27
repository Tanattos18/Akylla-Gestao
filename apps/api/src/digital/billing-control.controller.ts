import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Put, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  grantGraceSchema,
  optionalReasonSchema,
  reasonSchema,
  updateBillingSettingsSchema,
  type GrantGraceInput,
  type OptionalReasonInput,
  type ReasonInput,
  type UpdateBillingSettingsInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { InMemoryRateLimitStore } from "../common/rate-limit/rate-limit-store";
import { BillingControlService } from "./billing-control.service";

/** Ações de cobrança sobre entregas e contratos — só ADMIN. */
@Controller()
export class BillingControlController {
  constructor(@Inject(BillingControlService) private readonly control: BillingControlService) {}

  @Post("deliveries/:id/pause")
  @UseGuards(AdminGuard)
  pause(@Auth() auth: AuthContext, @Param("id") id: string, @Body(new ZodValidationPipe(reasonSchema)) body: ReasonInput) {
    return this.control.pause(auth, id, body.reason);
  }

  @Post("deliveries/:id/activate")
  @UseGuards(AdminGuard)
  activate(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(optionalReasonSchema)) body: OptionalReasonInput,
  ) {
    return this.control.activate(auth, id, body.reason || null);
  }

  @Post("deliveries/:id/deactivate")
  @UseGuards(AdminGuard)
  deactivate(@Auth() auth: AuthContext, @Param("id") id: string, @Body(new ZodValidationPipe(reasonSchema)) body: ReasonInput) {
    return this.control.deactivate(auth, id, body.reason);
  }

  @Get("deliveries/:id/billing-actions")
  deliveryHistory(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.control.history(auth, { deliveryId: id });
  }

  @Get("deliveries/:id/install-code")
  @UseGuards(AdminGuard)
  installCode(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.control.installCode(auth, id);
  }

  @Post("subscriptions/:id/grace")
  @UseGuards(AdminGuard)
  grace(@Auth() auth: AuthContext, @Param("id") id: string, @Body(new ZodValidationPipe(grantGraceSchema)) body: GrantGraceInput) {
    return this.control.grantGrace(auth, id, body);
  }

  @Get("subscriptions/:id/billing-actions")
  contractHistory(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.control.history(auth, { subscriptionId: id });
  }

  @Get("billing-settings")
  settings(@Auth() auth: AuthContext) {
    return this.control.getSettings(auth);
  }

  @Put("billing-settings")
  @UseGuards(AdminGuard)
  updateSettings(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateBillingSettingsSchema)) body: UpdateBillingSettingsInput,
  ) {
    return this.control.updateSettings(auth, body);
  }
}

/** Limite por IP + chave: o script consulta no carregamento de cada página. */
const PUBLIC_LIMIT = 120;
const PUBLIC_WINDOW_MS = 60_000;

/**
 * Endpoint PÚBLICO e somente leitura do script `akylla-status.js` colado no
 * site do cliente. Responde só ativo | aviso | pausado | inativo (+ mensagem),
 * sem dados pessoais; CORS aberto e cache curto. O script ignora qualquer
 * erro (o site continua normal).
 */
@Controller("public/site-status")
export class PublicSiteStatusController {
  private readonly limiter = new InMemoryRateLimitStore();

  constructor(@Inject(BillingControlService) private readonly control: BillingControlService) {}

  @Get(":key")
  @Public()
  async status(@Param("key") key: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) throw new NotFoundException("Site não encontrado");
    await this.limiter.hit(`site-status:${req.ip}:${key}`, PUBLIC_LIMIT, PUBLIC_WINDOW_MS);
    const status = await this.control.publicStatus(key);
    if (!status) throw new NotFoundException("Site não encontrado");
    res.setHeader("Cache-Control", "public, max-age=60");
    return status;
  }
}
