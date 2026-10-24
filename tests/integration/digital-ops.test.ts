import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { systemDatabaseUrl } from "../../apps/api/src/common/tenant/rls.extension";
import { checkSites, probeSite, type FetchLike } from "../../apps/worker/src/monitor/site-monitor";

/** Transformação 2026-10-23: logins cifrados, monitor de sites (só leitura) e Início. */

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;

let app: INestApplication;
let prisma: PrismaService;
let system: PrismaClient;

let companyAId: string;
let adminA: string;
let memberA: string;
let adminB: string;
let adminUserId: string;
let clientAId: string;
let deliveryAId: string;

async function createUser(companyId: string, email: string, role: "ADMIN" | "MEMBER") {
  return prisma.user.create({
    data: { companyId, name: email.split("@")[0]!, email, role, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
}

async function login(email: string): Promise<string> {
  const response = await request(app.getHttpServer()).post("/api/auth/login").send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`Login falhou para ${email}: ${response.status}`);
  return sessionCookieFrom(response);
}

function http() {
  return request(app.getHttpServer());
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  system = new PrismaClient({ datasources: { db: { url: systemDatabaseUrl(process.env.DATABASE_URL as string) } } });
  await resetDatabase(prisma);

  const a = await prisma.company.create({ data: { name: "Agência Ops A", slug: "ops-a" } });
  const b = await prisma.company.create({ data: { name: "Agência Ops B", slug: "ops-b" } });
  companyAId = a.id;
  adminUserId = (await createUser(a.id, "admin@ops-a.test", "ADMIN")).id;
  await createUser(a.id, "membro@ops-a.test", "MEMBER");
  await createUser(b.id, "admin@ops-b.test", "ADMIN");
  adminA = await login("admin@ops-a.test");
  memberA = await login("membro@ops-a.test");
  adminB = await login("admin@ops-b.test");

  clientAId = (await prisma.client.create({ data: { companyId: a.id, name: "Cliente Ops", nameKey: "cliente ops" } })).id;
  deliveryAId = (
    await prisma.clientDelivery.create({
      data: { companyId: a.id, clientId: clientAId, name: "Loja do Cliente", type: "ONLINE_STORE", siteUrl: "https://loja.exemplo.test/" },
    })
  ).id;
});

afterAll(async () => {
  await system.$disconnect();
  await app.close();
});

describe("Logins das entregas (senha cifrada + auditoria)", () => {
  let credentialId: string;

  it("ADMIN cria login; a senha é gravada cifrada e nunca volta na listagem", async () => {
    const res = await http()
      .post(`/api/deliveries/${deliveryAId}/credentials`)
      .set("Cookie", adminA)
      .send({ label: "Painel admin", username: "dono@loja", secret: "S3nha-Super!", url: "https://loja.exemplo.test/admin" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ label: "Painel admin", username: "dono@loja", hasSecret: true });
    expect(res.body).not.toHaveProperty("secret");
    expect(res.body).not.toHaveProperty("secretEncrypted");
    credentialId = res.body.id;

    const stored = await system.deliveryCredential.findUniqueOrThrow({ where: { id: credentialId } });
    expect(stored.secretEncrypted).toMatch(/^v1:/);
    expect(stored.secretEncrypted).not.toContain("S3nha-Super!");

    const list = await http().get(`/api/deliveries/${deliveryAId}/credentials`).set("Cookie", memberA);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain("S3nha");
    expect(JSON.stringify(list.body)).not.toContain("v1:");
  });

  it("membro não cria nem mostra senha (403)", async () => {
    const create = await http().post(`/api/deliveries/${deliveryAId}/credentials`).set("Cookie", memberA).send({ label: "Outro" });
    expect(create.status).toBe(403);
    const reveal = await http().post(`/api/delivery-credentials/${credentialId}/reveal`).set("Cookie", memberA);
    expect(reveal.status).toBe(403);
  });

  it("mostrar a senha devolve em claro, sem cache, e fica na auditoria", async () => {
    const reveal = await http().post(`/api/delivery-credentials/${credentialId}/reveal`).set("Cookie", adminA);
    expect(reveal.status).toBe(201);
    expect(reveal.body).toEqual({ secret: "S3nha-Super!" });
    expect(reveal.headers["cache-control"]).toBe("no-store");

    const log = await http().get(`/api/delivery-credentials/${credentialId}/access-log`).set("Cookie", adminA);
    expect(log.body.map((entry: { action: string }) => entry.action)).toEqual(["REVEAL", "CREATE"]);
    expect(log.body[0].userName).toBe("admin");
  });

  it("editar sem senha mantém a senha; senha vazia apaga", async () => {
    const keep = await http().patch(`/api/delivery-credentials/${credentialId}`).set("Cookie", adminA).send({ username: "novo@loja" });
    expect(keep.body).toMatchObject({ username: "novo@loja", hasSecret: true });
    const clear = await http().patch(`/api/delivery-credentials/${credentialId}`).set("Cookie", adminA).send({ secret: "" });
    expect(clear.body.hasSecret).toBe(false);
    const reveal = await http().post(`/api/delivery-credentials/${credentialId}/reveal`).set("Cookie", adminA);
    expect(reveal.body).toEqual({ secret: null });
  });

  it("outra empresa não vê nem mostra (404)", async () => {
    expect((await http().get(`/api/deliveries/${deliveryAId}/credentials`).set("Cookie", adminB)).status).toBe(404);
    expect((await http().post(`/api/delivery-credentials/${credentialId}/reveal`).set("Cookie", adminB)).status).toBe(404);
  });

  it("arquivar tira da lista, impede edição e não apaga o registro", async () => {
    const archived = await http().post(`/api/delivery-credentials/${credentialId}/archive`).set("Cookie", adminA);
    expect(archived.status).toBe(201);
    expect(archived.body.archivedAt).not.toBeNull();
    const list = await http().get(`/api/deliveries/${deliveryAId}/credentials`).set("Cookie", adminA);
    expect(list.body).toHaveLength(0);
    const withArchived = await http().get(`/api/deliveries/${deliveryAId}/credentials?archived=true`).set("Cookie", adminA);
    expect(withArchived.body).toHaveLength(1);
    const edit = await http().patch(`/api/delivery-credentials/${credentialId}`).set("Cookie", adminA).send({ label: "Novo" });
    expect(edit.status).toBe(409);
    const actions = await system.credentialAccessLog.findMany({ where: { credentialId }, orderBy: { createdAt: "asc" } });
    expect(actions.map((a) => a.action)).toEqual(["CREATE", "REVEAL", "UPDATE", "UPDATE", "REVEAL", "ARCHIVE"]);
  });
});

describe("Monitor de sites (somente leitura)", () => {
  function fakeFetch(responder: (url: string, method: string) => number | Error) {
    const calls: Array<{ url: string; method: string }> = [];
    const impl: FetchLike = async (url, init) => {
      calls.push({ url, method: init.method });
      const result = responder(url, init.method);
      if (result instanceof Error) throw result;
      return { status: result, body: null };
    };
    return { impl, calls };
  }

  it("HEAD recusado (405) é confirmado com GET; só usa HEAD/GET", async () => {
    const { impl, calls } = fakeFetch((_url, method) => (method === "HEAD" ? 405 : 200));
    const result = await probeSite("https://x.test/", impl);
    expect(result).toMatchObject({ ok: true, httpStatus: 200, error: null });
    expect(calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
  });

  it("falha de rede vira DOWN com mensagem, sem lançar", async () => {
    const { impl } = fakeFetch(() => new Error("getaddrinfo ENOTFOUND"));
    const result = await probeSite("https://x.test/", impl);
    expect(result).toMatchObject({ ok: false, httpStatus: null });
    expect(result.error).toContain("ENOTFOUND");
  });

  it("grava status, mantém o início da queda e ignora entregas fora do monitor", async () => {
    // Pausada, sem URL e com monitor desligado ficam de fora
    await prisma.clientDelivery.createMany({
      data: [
        { companyId: companyAId, clientId: clientAId, name: "Pausada", type: "SITE", siteUrl: "https://pausada.test/", status: "PAUSED" },
        { companyId: companyAId, clientId: clientAId, name: "Sem URL", type: "DOMAIN" },
        { companyId: companyAId, clientId: clientAId, name: "Sem monitor", type: "SITE", siteUrl: "https://off.test/", monitorEnabled: false },
      ],
    });

    let status = 503;
    const { impl, calls } = fakeFetch(() => status);
    const t1 = new Date("2026-10-24T10:00:00Z");
    const first = await checkSites({ prisma: system, fetchImpl: impl, now: () => t1 });
    expect(first).toMatchObject({ checked: 1, up: 0, down: 1 });
    expect(new Set(calls.map((c) => c.url))).toEqual(new Set(["https://loja.exemplo.test/"]));
    expect(calls.every((c) => c.method === "HEAD" || c.method === "GET")).toBe(true);

    const t2 = new Date(t1.getTime() + 5 * 60_000);
    await checkSites({ prisma: system, fetchImpl: impl, now: () => t2 });
    let delivery = await system.clientDelivery.findUniqueOrThrow({ where: { id: deliveryAId } });
    expect(delivery).toMatchObject({ monitorStatus: "DOWN", monitorHttpStatus: 503 });
    expect(delivery.monitorDownSince?.toISOString()).toBe(t1.toISOString());

    status = 200;
    await checkSites({ prisma: system, fetchImpl: impl, now: () => new Date(t2.getTime() + 5 * 60_000) });
    delivery = await system.clientDelivery.findUniqueOrThrow({ where: { id: deliveryAId } });
    expect(delivery).toMatchObject({ monitorStatus: "UP", monitorHttpStatus: 200, monitorDownSince: null });

    const checks = await http().get(`/api/deliveries/${deliveryAId}/checks`).set("Cookie", memberA);
    expect(checks.body).toHaveLength(3);
    expect(checks.body[0]).toMatchObject({ ok: true, httpStatus: 200 });
  });

  it("apaga histórico com mais de 30 dias", async () => {
    await system.siteCheck.create({
      data: { companyId: companyAId, deliveryId: deliveryAId, url: "https://loja.exemplo.test/", ok: true, checkedAt: new Date(Date.now() - 40 * DAY_MS) },
    });
    const { impl } = fakeFetch(() => 200);
    const result = await checkSites({ prisma: system, fetchImpl: impl });
    expect(result.purged).toBe(1);
  });
});

describe("Início: resumo de clientes e produtos digitais", () => {
  it("receita recorrente, a receber, atrasados, vencimentos e sites fora do ar", async () => {
    const now = Date.now();
    const plan = await prisma.subscriptionPlan.create({
      data: { companyId: companyAId, name: "Manutenção anual", nameKey: "manutenção anual", price: "1200.00", durationDays: 360, createdByUserId: adminUserId },
    });
    await prisma.subscription.create({
      data: {
        companyId: companyAId,
        clientId: clientAId,
        planId: plan.id,
        deliveryId: deliveryAId,
        startAt: new Date(now - 340 * DAY_MS),
        endAt: new Date(now + 20 * DAY_MS),
        createdByUserId: adminUserId,
      },
    });
    await prisma.financialEntry.createMany({
      data: [
        { companyId: companyAId, direction: "RECEIVABLE", description: "Mensal", amount: "150.00", dueDate: new Date(now + 5 * DAY_MS), clientId: clientAId, createdByUserId: adminUserId },
        { companyId: companyAId, direction: "RECEIVABLE", description: "Atrasada", amount: "80.00", dueDate: new Date(now - 3 * DAY_MS), clientId: clientAId, createdByUserId: adminUserId },
        { companyId: companyAId, direction: "PAYABLE", description: "Conta", amount: "999.00", dueDate: new Date(now + 5 * DAY_MS), createdByUserId: adminUserId },
      ],
    });
    const renewal = new Date(now + 10 * DAY_MS);
    await prisma.clientDelivery.update({
      where: { id: deliveryAId },
      data: {
        domain: "loja.exemplo.test",
        domainRenewalAt: new Date(Date.UTC(renewal.getUTCFullYear(), renewal.getUTCMonth(), renewal.getUTCDate())),
        monitorStatus: "DOWN",
        monitorDownSince: new Date(now - 60_000),
        monitorHttpStatus: 502,
        neverPause: true,
      },
    });

    const res = await http().get("/api/digital/overview").set("Cookie", memberA);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      monthlyRecurringRevenue: "100.00",
      activeContracts: 1,
      receivableNext30: { total: "150.00", count: 1 },
      overdueReceivables: { total: "80.00", count: 1 },
      monitoredSites: 1,
    });
    expect(res.body.upcoming.map((u: { kind: string }) => u.kind).sort()).toEqual(["CONTRACT", "DOMAIN"]);
    expect(res.body.sitesDown).toEqual([
      expect.objectContaining({ deliveryId: deliveryAId, httpStatus: 502, neverPause: true, clientName: "Cliente Ops" }),
    ]);

    const other = await http().get("/api/digital/overview").set("Cookie", adminB);
    expect(other.body).toMatchObject({ monthlyRecurringRevenue: "0.00", activeContracts: 0, sitesDown: [] });
  });
});
