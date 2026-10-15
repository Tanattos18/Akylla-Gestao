import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

/**
 * Armazenamento do rate limit atrás de uma interface (N4 · 1.3).
 * Hoje: memória (mesmo comportamento de antes). Produção multi-instância:
 * implementar esta interface com Redis/Upstash (janela deslizante) e trocar
 * o provider — nenhum chamador muda.
 */
export interface RateLimitStore {
  /**
   * Registra uma tentativa. Lança 429 (HttpException) quando o limite da
   * janela estoura; retorna os segundos restantes da janela.
   */
  hit(key: string, limit: number, windowMs: number): void;
  reset(key: string): void;
}

interface Attempt {
  count: number;
  resetAt: number;
}

@Injectable()
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly attempts = new Map<string, Attempt>();

  hit(key: string, limit: number, windowMs: number): void {
    if (limit <= 0) return;

    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (attempt.count >= limit) {
      const seconds = Math.ceil((attempt.resetAt - now) / 1000);
      throw new HttpException(
        {
          message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
          retryAfterSeconds: seconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    attempt.count += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
