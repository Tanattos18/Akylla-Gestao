import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  BusinessModules,
  adDayParamSchema,
  adLinkQuerySchema,
  adMetricsImportFormSchema,
  adOverviewQuerySchema,
  changeAdCampaignStatusSchema,
  createAdAccountSchema,
  createAdCampaignSchema,
  listAdAccountsQuerySchema,
  listAdCampaignsQuerySchema,
  updateAdAccountSchema,
  updateAdCampaignSchema,
  upsertAdMetricSchema,
  type AdLinkQuery,
  type AdMetricsImportForm,
  type AdOverviewQuery,
  type ChangeAdCampaignStatusInput,
  type CreateAdAccountInput,
  type CreateAdCampaignInput,
  type ListAdAccountsQuery,
  type ListAdCampaignsQuery,
  type UpdateAdAccountInput,
  type UpdateAdCampaignInput,
  type UpsertAdMetricInput,
} from "@petflow/shared";
import { AdminGuard } from "../common/guards/admin.guard";
import { Auth, type AuthContext } from "../common/decorators/auth.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AD_IMPORT_MAX_FILE_BYTES, AdsService } from "./ads.service";

/** Gestão de anúncios (módulo ADS) — escritas só ADMIN. */
@Controller("ads")
@RequireModule(BusinessModules.ADS)
export class AdsController {
  constructor(@Inject(AdsService) private readonly ads: AdsService) {}

  @Get("overview")
  overview(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(adOverviewQuerySchema)) query: AdOverviewQuery) {
    return this.ads.overview(auth, query);
  }

  @Get("accounts")
  listAccounts(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listAdAccountsQuerySchema)) query: ListAdAccountsQuery) {
    return this.ads.listAccounts(auth, query);
  }

  @Post("accounts")
  @UseGuards(AdminGuard)
  createAccount(@Auth() auth: AuthContext, @Body(new ZodValidationPipe(createAdAccountSchema)) body: CreateAdAccountInput) {
    return this.ads.createAccount(auth, body);
  }

  @Patch("accounts/:id")
  @UseGuards(AdminGuard)
  updateAccount(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAdAccountSchema)) body: UpdateAdAccountInput,
  ) {
    return this.ads.updateAccount(auth, id, body);
  }

  @Get("campaigns")
  listCampaigns(@Auth() auth: AuthContext, @Query(new ZodValidationPipe(listAdCampaignsQuerySchema)) query: ListAdCampaignsQuery) {
    return this.ads.listCampaigns(auth, query);
  }

  @Post("campaigns")
  @UseGuards(AdminGuard)
  createCampaign(@Auth() auth: AuthContext, @Body(new ZodValidationPipe(createAdCampaignSchema)) body: CreateAdCampaignInput) {
    return this.ads.createCampaign(auth, body);
  }

  @Get("campaigns/:id")
  getCampaign(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.ads.getCampaign(auth, id);
  }

  @Patch("campaigns/:id")
  @UseGuards(AdminGuard)
  updateCampaign(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAdCampaignSchema)) body: UpdateAdCampaignInput,
  ) {
    return this.ads.updateCampaign(auth, id, body);
  }

  @Post("campaigns/:id/status")
  @UseGuards(AdminGuard)
  changeStatus(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(changeAdCampaignStatusSchema)) body: ChangeAdCampaignStatusInput,
  ) {
    return this.ads.changeStatus(auth, id, body);
  }

  @Put("campaigns/:id/metrics/:date")
  @UseGuards(AdminGuard)
  upsertMetric(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Param("date", new ZodValidationPipe(adDayParamSchema)) date: string,
    @Body(new ZodValidationPipe(upsertAdMetricSchema)) body: UpsertAdMetricInput,
  ) {
    return this.ads.upsertMetric(auth, id, date, body);
  }

  /** Fase A2: CSV do Gerenciador de Anúncios (Meta) ou do Google Ads; prévia por padrão. */
  @Post("campaigns/:id/metrics/import")
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: AD_IMPORT_MAX_FILE_BYTES } }))
  importMetrics(
    @Auth() auth: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adMetricsImportFormSchema)) body: AdMetricsImportForm,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.ads.importMetrics(auth, id, body, file);
  }

  @Get("campaigns/:id/link")
  link(@Auth() auth: AuthContext, @Param("id") id: string, @Query(new ZodValidationPipe(adLinkQuerySchema)) query: AdLinkQuery) {
    return this.ads.link(auth, id, query.url);
  }
}

/** Aba Anúncios da ficha do cliente. */
@Controller("clients")
@RequireModule(BusinessModules.ADS)
export class ClientAdsController {
  constructor(@Inject(AdsService) private readonly ads: AdsService) {}

  @Get(":id/ads")
  clientAds(@Auth() auth: AuthContext, @Param("id") id: string) {
    return this.ads.clientAds(auth, id);
  }
}
