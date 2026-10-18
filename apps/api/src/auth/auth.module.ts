import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginRateLimiter, RegisterRateLimiter, RATE_LIMIT_STORE } from "./login-rate-limit";
import { createRateLimitStore } from "../common/rate-limit/rate-limit-store";
import { env } from "../config/env";
import { OriginCheckMiddleware } from "../common/middleware/origin-check.middleware";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginRateLimiter,
    RegisterRateLimiter,
    // Fase 1 · 1C: Redis quando REDIS_URL existe; senão memória
    { provide: RATE_LIMIT_STORE, useFactory: () => createRateLimitStore(env.REDIS_URL) },
  ],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginCheckMiddleware).forRoutes("auth");
  }
}
