import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createLegalConsentSchema,
  type CreateLegalConsentInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { LgpdService } from "./lgpd.service";

const consentPipe = new ZodValidationPipe(createLegalConsentSchema);

@Controller("lgpd")
export class LgpdController {
  constructor(@Inject(LgpdService) private readonly lgpd: LgpdService) {}

  @Post("consent")
  recordConsent(
    @Auth() auth: AuthContext,
    @Body(consentPipe) body: CreateLegalConsentInput,
  ) {
    return this.lgpd.recordConsent(auth, body);
  }

  @Get("consents")
  listConsents(
    @Auth() auth: AuthContext,
    @Query("clientId") clientId?: string,
  ) {
    return this.lgpd.listConsents(auth, clientId);
  }

  @Get("clients/:id/data-export")
  @UseGuards(AdminGuard)
  getClientDataExport(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.lgpd.getClientDataExport(auth, id);
  }

  @Delete("clients/:id/anonymize")
  @UseGuards(AdminGuard)
  anonymizeClient(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.lgpd.anonymizeClient(auth, id);
  }
}
