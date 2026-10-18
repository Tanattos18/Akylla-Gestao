import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from "@nestjs/common";
import IORedis, { type Redis } from "ioredis";
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";

/**
 * Armazenamento do rate limit atrás de uma interface (N4 · 1.3; Fase 1 · 1C).
 *
 * - Sem `REDIS_URL`: `InMemoryRateLimitStore` (vale por instância e zera no
 *   restart; adequado para uma instância só).
 * - Com `REDIS_URL`: `RedisRateLimitStore` (contador compartilhado entre
 *   instâncias). Se o Redis cair, um limitador em memória assume
 *   ("insurance") e o login continua protegido, sem derrubar a API.
 *
 * Referência: animir/node-rate-limiter-flexible (ISC), indicada em
 * upgrade/REFERENCIAS_GIT.md (Fase 1 · 1C).
 */
export interface RateLimitStore {
  /** Registra uma tentativa. Lança 429 (HttpException) quando o limite da janela estoura. */
  hit(key: string, limit: number, windowMs: number): Promise<void>;
  reset(key: string): Promise<void>;
  /** Nome do backend em uso (diagnóstico e testes). */
  readonly kind: "memory" | "redis";
}

export const RATE_LIMIT_KEY_PREFIX = "akylla:rl";

function tooManyRequests(retryAfterMs: number): HttpException {
  return new HttpException(
    {
      message: "Muitas tentativas. Tente novamente em alguns minutos.",
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

interface Attempt {
  count: number;
  resetAt: number;
}

@Injectable()
export class InMemoryRateLimitStore implements RateLimitStore {
  readonly kind = "memory" as const;
  private readonly attempts = new Map<string, Attempt>();

  async hit(key: string, limit: number, windowMs: number): Promise<void> {
    if (limit <= 0) return;

    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (attempt.count >= limit) {
      throw tooManyRequests(attempt.resetAt - now);
    }

    attempt.count += 1;
  }

  async reset(key: string): Promise<void> {
    this.attempts.delete(key);
  }
}

/**
 * Janela fixa por chave no Redis (INCR + PEXPIRE atômicos via Lua da
 * biblioteca). Um limitador por par (limite, janela), criado sob demanda.
 */
export class RedisRateLimitStore implements RateLimitStore, OnApplicationShutdown {
  readonly kind = "redis" as const;
  private readonly logger = new Logger(RedisRateLimitStore.name);
  private readonly limiters = new Map<string, RateLimiterRedis>();

  constructor(private readonly client: Redis) {}

  private limiterFor(limit: number, windowMs: number): RateLimiterRedis {
    const id = `${limit}:${windowMs}`;
    let limiter = this.limiters.get(id);
    if (!limiter) {
      const duration = Math.max(1, Math.ceil(windowMs / 1000));
      limiter = new RateLimiterRedis({
        storeClient: this.client,
        keyPrefix: `${RATE_LIMIT_KEY_PREFIX}:${id}`,
        points: limit,
        duration,
        // Redis fora do ar → mesmo limite em memória, sem 500 no login
        insuranceLimiter: new RateLimiterMemory({ points: limit, duration }),
      });
      this.limiters.set(id, limiter);
    }
    return limiter;
  }

  async hit(key: string, limit: number, windowMs: number): Promise<void> {
    if (limit <= 0) return;
    try {
      await this.limiterFor(limit, windowMs).consume(key);
    } catch (rejection) {
      if (rejection instanceof RateLimiterRes) {
        throw tooManyRequests(rejection.msBeforeNext);
      }
      // Erro inesperado (não deveria ocorrer com insurance): falha aberta,
      // registrada — não bloquear todos os logins por pane de infraestrutura
      this.logger.error(
        `Falha no rate limit Redis: ${rejection instanceof Error ? rejection.message : String(rejection)}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  async reset(key: string): Promise<void> {
    await Promise.all(
      [...this.limiters.values()].map((limiter) => limiter.delete(key).catch(() => false)),
    );
  }
}

/**
 * Escolhe o backend pelo ambiente: `REDIS_URL` presente → Redis; ausente →
 * memória. O cliente não enfileira comandos offline: com o Redis fora, a
 * chamada falha na hora e o limitador em memória assume.
 */
export function createRateLimitStore(redisUrl: string | undefined): RateLimitStore {
  if (!redisUrl) return new InMemoryRateLimitStore();

  const logger = new Logger("RateLimitStore");
  const client = new IORedis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    // Reconecta com espera crescente até 5 s, indefinidamente
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  let down = false;
  client.on("error", (error: Error) => {
    if (!down) {
      down = true;
      logger.warn(`Redis indisponível (${error.message}); rate limit em memória até reconectar.`);
    }
  });
  client.on("ready", () => {
    if (down) logger.log("Redis reconectado; rate limit distribuído restabelecido.");
    down = false;
  });

  return new RedisRateLimitStore(client);
}
