import { Inject, Injectable } from "@nestjs/common";
import { env } from "../config/env";
import {
  InMemoryRateLimitStore,
  type RateLimitStore,
} from "../common/rate-limit/rate-limit-store";

export const RATE_LIMIT_STORE = "RATE_LIMIT_STORE";

/**
 * Guarda de rate limit de login/cadastro/reset (N4 · 1.3).
 * Delega ao `RateLimitStore` (memória hoje; Redis em produção
 * multi-instância). Comportamento idêntico ao anterior.
 */
@Injectable()
export class LoginRateLimiter {
  constructor(
    @Inject(RATE_LIMIT_STORE)
    private readonly store: RateLimitStore = new InMemoryRateLimitStore(),
  ) {}

  check(key: string): void {
    this.store.hit(key, env.AUTH_RATE_LIMIT_MAX, env.AUTH_RATE_LIMIT_WINDOW_MS);
  }

  reset(key: string): void {
    this.store.reset(key);
  }
}
