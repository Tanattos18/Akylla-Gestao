import "reflect-metadata";
import "./instrument";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { configureHttp } from "./common/bootstrap/configure-http";
import { env, allowedOrigins } from "./config/env";
import { captureServerError, flushSentry } from "./monitoring/sentry";
import { setupOpenApi } from "./openapi/openapi";

async function bootstrap() {
  // rawBody: necessário para validar a assinatura X-Hub-Signature-256
  // do webhook do WhatsApp (Etapa 6)
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger("Bootstrap");

  configureHttp(app);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  app.enableShutdownHooks();

  // Fase 6 · 6.3: documentação OpenAPI (ligada fora de produção por padrão)
  if (env.API_DOCS_ENABLED ?? env.NODE_ENV !== "production") {
    setupOpenApi(app, env.AUTH_COOKIE_NAME);
    logger.log("Documentação da API em /api/docs");
  }

  // Auditoria (bloco 9): escuta só na própria máquina (o Caddy publica);
  // API_HOST=0.0.0.0 só se a API rodar em outro servidor/contêiner
  await app.listen(env.API_PORT, env.API_HOST);
  logger.log(`Akylla Gestão API disponível em http://${env.API_HOST}:${env.API_PORT}`);
}

bootstrap().catch(async (error) => {
  console.error("Falha ao iniciar a API:", error);
  captureServerError(error, { method: "BOOT" });
  await flushSentry();
  process.exit(1);
});
