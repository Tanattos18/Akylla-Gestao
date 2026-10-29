import { Module } from "@nestjs/common";
import { AdsController, ClientAdsController } from "./ads.controller";
import { AdsService } from "./ads.service";

/** 2026-10-29: gestão de anúncios (upgrade/PLANO_ANUNCIOS.md, fases A1 e A2). */
@Module({
  controllers: [AdsController, ClientAdsController],
  providers: [AdsService],
})
export class AdsModule {}
