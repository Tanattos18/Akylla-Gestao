import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  platformActivateSchema,
  platformCompaniesQuerySchema,
  platformCreateCompanySchema,
  type PlatformCreateCompanyInput,
  platformExemptSchema,
  platformSuspendSchema,
  platformTrialSchema,
  type PlatformActivateInput,
  type PlatformCompaniesQuery,
  type PlatformExemptInput,
  type PlatformSuspendInput,
  type PlatformTrialInput,
} from "@petflow/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PlatformGuard } from "./platform.guard";
import { PlatformService } from "./platform.service";

type PlatformRequest = Request & { platformAdminEmail?: string };

const by = (request: PlatformRequest) => request.platformAdminEmail ?? "desconhecido";

/** Painel do dono da plataforma (Fase 8): empresas, cobrança e acesso. */
@Controller("platform")
@UseGuards(PlatformGuard)
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("companies")
  list(@Query(new ZodValidationPipe(platformCompaniesQuerySchema)) query: PlatformCompaniesQuery) {
    return this.platform.listCompanies(query);
  }

  @Post("companies")
  create(
    @Body(new ZodValidationPipe(platformCreateCompanySchema)) body: PlatformCreateCompanyInput,
    @Req() request: PlatformRequest,
  ) {
    return this.platform.createCompany(body, by(request));
  }

  @Get("companies/:id")
  get(@Param("id") id: string) {
    return this.platform.getCompany(id);
  }

  @Get("companies/:id/payments")
  payments(@Param("id") id: string) {
    return this.platform.listPayments(id);
  }

  @Post("companies/:id/activate")
  @HttpCode(200)
  activate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(platformActivateSchema)) body: PlatformActivateInput,
    @Req() request: PlatformRequest,
  ) {
    return this.platform.activate(id, body, by(request));
  }

  @Post("companies/:id/trial")
  @HttpCode(200)
  trial(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(platformTrialSchema)) body: PlatformTrialInput,
    @Req() request: PlatformRequest,
  ) {
    return this.platform.extendTrial(id, body.days, by(request));
  }

  @Post("companies/:id/exempt")
  @HttpCode(200)
  exempt(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(platformExemptSchema)) body: PlatformExemptInput,
    @Req() request: PlatformRequest,
  ) {
    return this.platform.setExempt(id, body.exempt, by(request));
  }

  @Post("companies/:id/suspend")
  @HttpCode(200)
  suspend(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(platformSuspendSchema)) body: PlatformSuspendInput,
    @Req() request: PlatformRequest,
  ) {
    return this.platform.suspend(id, body, by(request));
  }

  @Post("companies/:id/reactivate")
  @HttpCode(200)
  reactivate(@Param("id") id: string, @Req() request: PlatformRequest) {
    return this.platform.reactivate(id, by(request));
  }
}
