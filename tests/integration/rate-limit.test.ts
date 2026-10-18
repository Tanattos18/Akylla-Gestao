import { afterAll, describe, expect, it } from "vitest";
import { HttpException } from "@nestjs/common";
import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import {
  InMemoryRateLimitStore,
  RATE_LIMIT_KEY_PREFIX,
  RedisRateLimitStore,
  createRateLimitStore,
  type RateLimitStore,
} from "../../apps/api/src/common/rate-limit/rate-limit-store";

/**
 * Fase 1 · 1C — rate limit distribuído (Redis) com fallback em memória.
 * O Redis é simulado com ioredis-mock (sem servidor); a queda do Redis é
 * testada com o cliente real apontando para uma porta fechada.
 */

const toClose: Array<{ onApplicationShutdown?: () => Promise<void> }> = [];

afterAll(async () => {
  await Promise.all(toClose.map((store) => store.onApplicationShutdown?.()));
});

async function expect429(store: RateLimitStore, key: string, limit: number, windowMs: number) {
  const error = await store.hit(key, limit, windowMs).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  const http = error as HttpException;
  expect(http.getStatus()).toBe(429);
  const body = http.getResponse() as { retryAfterSeconds: number; message: string };
  expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  expect(body.message).toContain("Muitas tentativas");
}

describe("Escolha do backend (REDIS_URL)", () => {
  it("sem REDIS_URL → memória", () => {
    expect(createRateLimitStore(undefined).kind).toBe("memory");
    expect(createRateLimitStore("").kind).toBe("memory");
  });

  it("com REDIS_URL → Redis", () => {
    const store = createRateLimitStore("redis://127.0.0.1:1");
    toClose.push(store as RedisRateLimitStore);
    expect(store.kind).toBe("redis");
    expect(store).toBeInstanceOf(RedisRateLimitStore);
  });
});

describe("InMemoryRateLimitStore (comportamento preservado)", () => {
  it("bloqueia com 429 após o limite e libera após reset", async () => {
    const store = new InMemoryRateLimitStore();
    for (let i = 0; i < 3; i += 1) await store.hit("ip|a@b.com", 3, 60_000);
    await expect429(store, "ip|a@b.com", 3, 60_000);
    await store.reset("ip|a@b.com");
    await expect(store.hit("ip|a@b.com", 3, 60_000)).resolves.toBeUndefined();
  });

  it("limite 0 desliga o rate limit", async () => {
    const store = new InMemoryRateLimitStore();
    for (let i = 0; i < 20; i += 1) await store.hit("k", 0, 60_000);
  });
});

describe("RedisRateLimitStore", () => {
  it("bloqueia com 429 após o limite, com chave prefixada no Redis", async () => {
    const client = new RedisMock() as unknown as Redis;
    const store = new RedisRateLimitStore(client);

    for (let i = 0; i < 3; i += 1) await store.hit("1.2.3.4|dono@empresa.com", 3, 60_000);
    await expect429(store, "1.2.3.4|dono@empresa.com", 3, 60_000);

    const keys = await client.keys(`${RATE_LIMIT_KEY_PREFIX}:*`);
    expect(keys.length).toBe(1);
    expect(keys[0]).toContain("1.2.3.4|dono@empresa.com");
    const ttl = await client.pttl(keys[0] as string);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
  });

  it("contador é compartilhado entre instâncias da API (o motivo do Redis)", async () => {
    const client = new RedisMock() as unknown as Redis;
    const instanciaA = new RedisRateLimitStore(client);
    const instanciaB = new RedisRateLimitStore(client);

    await instanciaA.hit("ip|x", 2, 60_000);
    await instanciaB.hit("ip|x", 2, 60_000);
    // 3ª tentativa, em qualquer instância, estoura
    await expect429(instanciaA, "ip|x", 2, 60_000);
    await expect429(instanciaB, "ip|x", 2, 60_000);
  });

  it("reset libera a chave (login bem-sucedido) e chaves são independentes", async () => {
    const client = new RedisMock() as unknown as Redis;
    const store = new RedisRateLimitStore(client);

    await store.hit("ip|a", 1, 60_000);
    await expect429(store, "ip|a", 1, 60_000);
    await expect(store.hit("ip|b", 1, 60_000)).resolves.toBeUndefined();

    await store.reset("ip|a");
    await expect(store.hit("ip|a", 1, 60_000)).resolves.toBeUndefined();
  });

  it("limites diferentes (login × cadastro) não se misturam", async () => {
    const client = new RedisMock() as unknown as Redis;
    const store = new RedisRateLimitStore(client);

    await store.hit("register|ip", 1, 3_600_000);
    await expect429(store, "register|ip", 1, 3_600_000);
    // Mesma chave em outro limitador (outro par limite/janela) é outro contador
    await expect(store.hit("register|ip", 5, 900_000)).resolves.toBeUndefined();
  });

  it("limite 0 desliga o rate limit", async () => {
    const store = new RedisRateLimitStore(new RedisMock() as unknown as Redis);
    for (let i = 0; i < 10; i += 1) await store.hit("k", 0, 60_000);
  });
});

describe("Fallback quando o Redis cai", () => {
  it("Redis inacessível → limite continua valendo em memória, sem erro 500", async () => {
    const store = createRateLimitStore("redis://127.0.0.1:1");
    toClose.push(store as RedisRateLimitStore);

    const started = Date.now();
    await store.hit("ip|queda", 2, 60_000);
    await store.hit("ip|queda", 2, 60_000);
    await expect429(store, "ip|queda", 2, 60_000);
    // Não espera timeout de conexão: falha na hora e usa a memória
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
