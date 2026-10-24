import { Body, Controller, Get, Header, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createCredentialSchema,
  updateCredentialSchema,
  type CreateCredentialInput,
  type UpdateCredentialInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CredentialsService } from "./credentials.service";

/** Logins de uma entrega: membros veem rótulo e usuário; senha só ADMIN, auditado. */
@Controller()
export class CredentialsController {
  constructor(@Inject(CredentialsService) private readonly credentials: CredentialsService) {}

  @Get("deliveries/:id/credentials")
  list(@Auth() auth: AuthContext, @Param("id") id: string, @Query("archived") archived?: string) {
    return this.credentials.list(auth, id, archived === "true");
  }

  @Post("deliveries/:id/credentials")
  @UseGuards(AdminGuard)
  create(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createCredentialSchema)) body: CreateCredentialInput,
  ) {
    return this.credentials.create(auth, id, body);
  }

  @Patch("delivery-credentials/:id")
  @UseGuards(AdminGuard)
  update(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCredentialSchema)) body: UpdateCredentialInput,
  ) {
    return this.credentials.update(auth, id, body);
  }

  @Post("delivery-credentials/:id/reveal")
  @UseGuards(AdminGuard)
  @Header("Cache-Control", "no-store")
  reveal(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.credentials.reveal(auth, id);
  }

  @Post("delivery-credentials/:id/archive")
  @UseGuards(AdminGuard)
  archive(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.credentials.archive(auth, id);
  }

  @Get("delivery-credentials/:id/access-log")
  @UseGuards(AdminGuard)
  accessLog(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.credentials.accessLog(auth, id);
  }
}
