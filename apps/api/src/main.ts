import "reflect-metadata";
import "./instrument";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { securityHeadersMiddleware } from "./common/middleware/security-headers.middleware";
import { env, allowedOrigins } from "./config/env";
import { captureServerError, flushSentry } from "./monitoring/sentry";

async function bootstrap() {
  // rawBody: necessário para validar a assinatura X-Hub-Signature-256
  // do webhook do WhatsApp (Etapa 6)
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("api", { exclude: ["health", "health/ready"] });
  app.use(cookieParser());
  app.use(securityHeadersMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
  logger.log(`Akylla Gestão API disponível em http://localhost:${env.API_PORT}`);
}

bootstrap().catch(async (error) => {
  console.error("Falha ao iniciar a API:", error);
  captureServerError(error, { method: "BOOT" });
  await flushSentry();
  process.exit(1);
});
