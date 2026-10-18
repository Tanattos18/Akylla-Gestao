import { Inject, Injectable } from "@nestjs/common";
import { env } from "../config/env";
import {
  InMemoryRateLimitStore,
  type RateLimitStore,
} from "../common/rate-limit/rate-limit-store";

export const RATE_LIMIT_STORE = "RATE_LIMIT_STORE";

/**
 * Guarda de rate limit de login/cadastro/reset (N4 · 1.3).
 * Delega ao `RateLimitStore` (memória sem REDIS_URL; Redis com
 * REDIS_URL — Fase 1 · 1C).
 */
@Injectable()
export class LoginRateLimiter {
  constructor(
    @Inject(RATE_LIMIT_STORE)
    private readonly store: RateLimitStore = new InMemoryRateLimitStore(),
  ) {}

  check(key: string): Promise<void> {
    return this.store.hit(key, env.AUTH_RATE_LIMIT_MAX, env.AUTH_RATE_LIMIT_WINDOW_MS);
  }

  reset(key: string): Promise<void> {
    return this.store.reset(key);
  }
}

/** Limite dedicado do cadastro aberto (N4 · 1.6): janela de 1h por IP. */
@Injectable()
export class RegisterRateLimiter {
  constructor(
    @Inject(RATE_LIMIT_STORE)
    private readonly store: RateLimitStore = new InMemoryRateLimitStore(),
  ) {}

  check(key: string): Promise<void> {
    return this.store.hit(
      key,
      env.REGISTER_RATE_LIMIT_MAX,
      env.REGISTER_RATE_LIMIT_WINDOW_MS,
    );
  }

  reset(key: string): Promise<void> {
    return this.store.reset(key);
  }
}
