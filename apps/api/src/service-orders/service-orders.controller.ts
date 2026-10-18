import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  BusinessModules,
  SERVICE_ORDER_ATTACHMENT_MAX_BYTES,
  cancelServiceOrderSchema,
  createServiceOrderSchema,
  listServiceOrdersQuerySchema,
  replaceServiceOrderItemsSchema,
  transitionServiceOrderSchema,
  updateServiceOrderSchema,
  type CancelServiceOrderInput,
  type CreateServiceOrderInput,
  type ListServiceOrdersQuery,
  type ReplaceServiceOrderItemsInput,
  type TransitionServiceOrderInput,
  type UpdateServiceOrderInput,
} from "@petflow/shared";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ServiceOrdersService } from "./service-orders.service";

/**
 * Fase 2 · 2.3 — ordens de serviço (módulo SERVICE_ORDERS). Operação do dia a
 * dia: qualquer usuário da empresa cria e movimenta OS (como no PDV).
 */
@RequireModule(BusinessModules.SERVICE_ORDERS)
@Controller("service-orders")
export class ServiceOrdersController {
  constructor(@Inject(ServiceOrdersService) private readonly service: ServiceOrdersService) {}

  @Get()
  list(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listServiceOrdersQuerySchema)) query: ListServiceOrdersQuery) {
    return this.service.list(auth, query);
  }

  @Get(":id")
  get(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.service.get(auth, id);
  }

  @Post()
  create(@Auth() auth: AuthContext, @Body(new ZodValidationPipe(createServiceOrderSchema)) body: CreateServiceOrderInput) {
    return this.service.create(auth, body);
  }

  @Patch(":id")
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateServiceOrderSchema)) body: UpdateServiceOrderInput,
  ) {
    return this.service.update(auth, id, body);
  }

  @Put(":id/items")
  replaceItems(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(replaceServiceOrderItemsSchema)) body: ReplaceServiceOrderItemsInput,
  ) {
    return this.service.replaceItems(auth, id, body.items);
  }

  @Patch(":id/status")
  transition(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(transitionServiceOrderSchema)) body: TransitionServiceOrderInput,
  ) {
    return this.service.transition(auth, id, body);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cancelServiceOrderSchema)) body: CancelServiceOrderInput,
  ) {
    return this.service.cancel(auth, id, body);
  }

  @Post(":id/attachments")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: SERVICE_ORDER_ATTACHMENT_MAX_BYTES, files: 1 } }))
  addAttachment(@Auth() auth: AuthContext, @Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.service.addAttachment(auth, id, file);
  }

  @Get(":id/attachments/:attachmentId")
  async download(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Res() res: Response,
  ) {
    const file = await this.service.readAttachment(auth, id, attachmentId);
    res.set({
      "Content-Type": file.mimeType,
      "Content-Length": String(file.content.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    });
    res.end(file.content);
  }

  @Delete(":id/attachments/:attachmentId")
  removeAttachment(@Auth() auth: AuthContext, @Param("id") id: string, @Param("attachmentId") attachmentId: string) {
    return this.service.removeAttachment(auth, id, attachmentId);
  }

  @Get(":id/messages")
  messages(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.service.messages(auth, id);
  }
}
