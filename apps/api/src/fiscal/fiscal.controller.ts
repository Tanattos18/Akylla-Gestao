import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  BusinessModules,
  cancelFiscalDocumentSchema,
  emitFiscalDocumentSchema,
  fiscalCertificateFormSchema,
  listFiscalDocumentsQuerySchema,
  updateFiscalConfigSchema,
  type CancelFiscalDocumentInput,
  type EmitFiscalDocumentInput,
  type FiscalCertificateForm,
  type ListFiscalDocumentsQuery,
  type UpdateFiscalConfigInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { Public } from "../common/decorators/public.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { env } from "../config/env";
import { FiscalService } from "./fiscal.service";

/** Fase 3 — fiscal por integração (módulo FISCAL). */
@RequireModule(BusinessModules.FISCAL)
@Controller("fiscal")
export class FiscalController {
  constructor(@Inject(FiscalService) private readonly service: FiscalService) {}

  /** Estado mínimo para o PDV/OS (sem segredos). */
  @Get("status")
  status(@Auth() auth: AuthContext) {
    return this.service.getStatus(auth);
  }

  @Get("config")
  @UseGuards(AdminGuard)
  getConfig(@Auth() auth: AuthContext) {
    return this.service.getConfig(auth);
  }

  @Put("config")
  @UseGuards(AdminGuard)
  updateConfig(@Auth() auth: AuthContext, @Body(new ZodValidationPipe(updateFiscalConfigSchema)) body: UpdateFiscalConfigInput) {
    return this.service.updateConfig(auth, body);
  }

  @Post("config/certificate")
  @UseGuards(AdminGuard)
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 64 * 1024, files: 1 } }))
  uploadCertificate(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(fiscalCertificateFormSchema)) body: FiscalCertificateForm,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.uploadCertificate(auth, file, body.password);
  }

  @Post("documents")
  @UseGuards(AdminGuard)
  emit(@Auth() auth: AuthContext, @Body(new ZodValidationPipe(emitFiscalDocumentSchema)) body: EmitFiscalDocumentInput) {
    return this.service.emit(auth, body);
  }

  @Get("documents")
  list(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listFiscalDocumentsQuerySchema)) query: ListFiscalDocumentsQuery) {
    return this.service.list(auth, query);
  }

  @Get("documents/:id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.service.get(auth, id);
  }

  @Get("documents/:id/xml")
  async xml(@Auth() auth: AuthContext, @Param("id") id: string, @Res() res: Response) {
    const file = await this.service.getXml(auth, id);
    res.set({
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    });
    res.send(file.xml);
  }

  @Post("documents/:id/cancel")
  @UseGuards(AdminGuard)
  @HttpCode(200)
  cancel(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cancelFiscalDocumentSchema)) body: CancelFiscalDocumentInput,
  ) {
    return this.service.cancel(auth, id, body);
  }
}

const webhookPayloadSchema = z.object({
  gatewayDocumentId: z.string().trim().min(1).max(120),
  status: z.enum(["AUTHORIZED", "REJECTED", "CANCELLED"]),
  accessKey: z.string().regex(/^\d{44}$/).optional(),
  protocol: z.string().max(60).optional(),
  xml: z.string().max(1_000_000).optional(),
  danfeUrl: z.string().url().max(500).optional(),
  reason: z.string().max(500).optional(),
});

/** Janela anti-replay do webhook fiscal (5 minutos). */
export const FISCAL_WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

/** HMAC-SHA256 de `${timestamp}.${corpo cru}` com FISCAL_WEBHOOK_SECRET. */
export function signFiscalWebhook(secret: string, timestamp: string, rawBody: Buffer | string): string {
  return createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
}

/**
 * Webhook da emissora (Fase 3): público, mas autenticado por assinatura.
 * - sem FISCAL_WEBHOOK_SECRET → 403 (fail-closed);
 * - `x-fiscal-timestamp` fora de ±5 min → 403 (anti-replay);
 * - `x-fiscal-signature: sha256=<hex>` comparada em tempo constante.
 */
@Public()
@Controller("webhooks/fiscal")
export class FiscalWebhookController {
  constructor(@Inject(FiscalService) private readonly service: FiscalService) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-fiscal-signature") signature: string | undefined,
    @Headers("x-fiscal-timestamp") timestamp: string | undefined,
    @Body() body: unknown,
  ) {
    const secret = env.FISCAL_WEBHOOK_SECRET;
    if (!secret) throw new ForbiddenException("Webhook fiscal desativado (sem segredo configurado)");
    const ts = Number(timestamp);
    if (!timestamp || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > FISCAL_WEBHOOK_TOLERANCE_MS) {
      throw new ForbiddenException("Assinatura do webhook inválida");
    }
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    const expected = Buffer.from(`sha256=${signFiscalWebhook(secret, timestamp, raw)}`);
    const received = Buffer.from(signature ?? "");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new ForbiddenException("Assinatura do webhook inválida");
    }
    const payload = new ZodValidationPipe(webhookPayloadSchema).transform(body) as z.infer<typeof webhookPayloadSchema>;
    return this.service.applyWebhook(payload);
  }
}
