import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AllExceptionsFilter } from "../filters/all-exceptions.filter";
import { securityHeadersMiddleware } from "../middleware/security-headers.middleware";

/**
 * Configuração HTTP comum à API e aos testes (assim os testes exercitam a
 * mesma configuração da produção).
 */
export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix("api", { exclude: ["health", "health/ready"] });
  const express = app.getHttpAdapter().getInstance();
  // Não anunciar a tecnologia do servidor (auditoria pós-Fase 8)
  express.disable("x-powered-by");
  // Auditoria (bloco 9): só confia em X-Forwarded-For vindo da própria máquina
  // (Caddy/Next na VPS) — o IP real do cliente vale para limites e sessões,
  // e ninguém de fora consegue forjar o IP pelo cabeçalho.
  express.set("trust proxy", "loopback");
  app.use(cookieParser());
  app.use(securityHeadersMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter());
}
