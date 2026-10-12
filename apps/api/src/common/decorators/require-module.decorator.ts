import { SetMetadata } from "@nestjs/common";
import type { BusinessModule } from "@petflow/shared";

export const REQUIRE_MODULE_KEY = "requireModule";

/** Marca controller/rota como pertencente a um módulo desativável. */
export const RequireModule = (module: BusinessModule) =>
  SetMetadata(REQUIRE_MODULE_KEY, module);
