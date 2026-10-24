import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

/** Transformação 2026-10-23: catálogo digital, entregas, contratos e atraso. */

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;

let adminA: string;
let memberA: string;
let adminB: string;
let clientAId: string;
let otherClientAId: string;
let clientBId: string;
let planAId: string;

async function createUser(companyId: string, email: string, role: "ADMIN" | "MEMBER") {
  await prisma.user.create({
    data: { companyId, name: email, email, role, passwordHash: await bcrypt.hash(PASSWORD, 4) },
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
  await resetDatabase(prisma);

  const a = await prisma.company.create({ data: { name: "Agência A", slug: "digital-a" } });
  const b = await prisma.company.create({ data: { name: "Agência B", slug: "digital-b" } });
  await createUser(a.id, "admin@digital-a.test", "ADMIN");
  await createUser(a.id, "membro@digital-a.test", "MEMBER");
  await createUser(b.id, "admin@digital-b.test", "ADMIN");
  adminA = await login("admin@digital-a.test");
  memberA = await login("membro@digital-a.test");
  adminB = await login("admin@digital-b.test");

  clientAId = (await prisma.client.create({ data: { companyId: a.id, name: "Ana Site", nameKey: "ana site" } })).id;
  otherClientAId = (await prisma.client.create({ data: { companyId: a.id, name: "Beto Loja", nameKey: "beto loja" } })).id;
  clientBId = (await prisma.client.create({ data: { companyId: b.id, name: "Cliente B", nameKey: "cliente b" } })).id;

  const adminUser = await prisma.user.findFirstOrThrow({ where: { email: "admin@digital-a.test" } });
  planAId = (
    await prisma.subscriptionPlan.create({
      data: {
        companyId: a.id,
        name: "Manutenção mensal",
        nameKey: "manutenção mensal",
        price: "150.00",
        durationDays: 30,
        createdByUserId: adminUser.id,
      },
    })
  ).id;
});

afterAll(async () => {
  await app.close();
});

describe("Catálogo de produtos digitais", () => {
  let productId: string;

  it("admin cria produto com preço e periodicidade", async () => {
    const res = await http()
      .post("/api/digital-products")
      .set("Cookie", adminA)
      .send({ name: "Site institucional", type: "SITE", defaultPrice: "1.200,00", billingPeriod: "YEARLY" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Site institucional", type: "SITE", defaultPrice: "1200.00", billingPeriod: "YEARLY", status: "ACTIVE", deliveriesCount: 0 });
    productId = res.body.id;
  });

  it("nome duplicado na mesma empresa → 409; outra empresa pode repetir", async () => {
    const dup = await http().post("/api/digital-products").set("Cookie", adminA).send({ name: "site  INSTITUCIONAL", type: "SITE", defaultPrice: "10" });
    expect(dup.status).toBe(409);
    const other = await http().post("/api/digital-products").set("Cookie", adminB).send({ name: "Site institucional", type: "SITE", defaultPrice: "10" });
    expect(other.status).toBe(201);
  });

  it("membro lista mas não cria (403)", async () => {
    const list = await http().get("/api/digital-products?type=SITE").set("Cookie", memberA);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    const create = await http().post("/api/digital-products").set("Cookie", memberA).send({ name: "Domínio", type: "DOMAIN", defaultPrice: "40" });
    expect(create.status).toBe(403);
  });

  it("tipo inválido → 400; produto de outra empresa → 404", async () => {
    const bad = await http().post("/api/digital-products").set("Cookie", adminA).send({ name: "X produto", type: "PDV", defaultPrice: "1" });
    expect(bad.status).toBe(400);
    const cross = await http().get(`/api/digital-products/${productId}`).set("Cookie", adminB);
    expect(cross.status).toBe(404);
  });

  it("edita e inativa", async () => {
    const upd = await http().patch(`/api/digital-products/${productId}`).set("Cookie", adminA).send({ defaultPrice: "990.00" });
    expect(upd.status).toBe(200);
    expect(upd.body.defaultPrice).toBe("990.00");
    const st = await http().patch(`/api/digital-products/${productId}/status`).set("Cookie", adminA).send({ status: "INACTIVE" });
    expect(st.body.status).toBe("INACTIVE");
  });
});

describe("Entregas por cliente", () => {
  let deliveryId: string;

  it("cria entrega com URLs, domínio, hospedagem e datas de renovação", async () => {
    const res = await http()
      .post("/api/deliveries")
      .set("Cookie", memberA)
      .send({
        clientId: clientAId,
        name: "Site da Ana",
        type: "SITE",
        siteUrl: "https://ana.com.br",
        adminUrl: "https://ana.com.br/admin",
        repositoryUrl: "https://github.com/exemplo/ana",
        domain: "ana.com.br",
        domainRenewalAt: "2027-03-10",
        hostingProvider: "Hostinger",
        hostingRenewalAt: "2027-01-05",
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      clientId: clientAId,
      domainRenewalAt: "2027-03-10",
      hostingRenewalAt: "2027-01-05",
      status: "ACTIVE",
      neverPause: false,
      contractsCount: 0,
      client: { name: "Ana Site" },
    });
    deliveryId = res.body.id;
  });

  it("URL sem http(s) e data inválida → 400", async () => {
    const res = await http().post("/api/deliveries").set("Cookie", adminA).send({ clientId: clientAId, name: "Ruim", type: "SITE", siteUrl: "ftp://x.com", domainRenewalAt: "10/03/2027" });
    expect(res.status).toBe(400);
  });

  it("cliente de outra empresa → 404 (companyId vem da sessão)", async () => {
    const res = await http().post("/api/deliveries").set("Cookie", adminA).send({ clientId: clientBId, name: "Invasão", type: "SITE" });
    expect(res.status).toBe(404);
    const read = await http().get(`/api/deliveries/${deliveryId}`).set("Cookie", adminB);
    expect(read.status).toBe(404);
  });

  it("nunca pausar: bloqueia PAUSED enquanto a flag estiver ligada", async () => {
    const on = await http().patch(`/api/deliveries/${deliveryId}`).set("Cookie", adminA).send({ neverPause: true });
    expect(on.body.neverPause).toBe(true);
    const pause = await http().patch(`/api/deliveries/${deliveryId}`).set("Cookie", adminA).send({ status: "PAUSED" });
    expect(pause.status).toBe(409);
    const created = await http().post("/api/deliveries").set("Cookie", adminA).send({ clientId: clientAId, name: "Próprio", type: "SYSTEM", neverPause: true, status: "PAUSED" });
    expect(created.status).toBe(409);
  });

  it("limpa campo com texto vazio e filtra por cliente/tipo", async () => {
    const upd = await http().patch(`/api/deliveries/${deliveryId}`).set("Cookie", adminA).send({ adminUrl: "", hostingRenewalAt: null });
    expect(upd.status).toBe(200);
    expect(upd.body.adminUrl).toBeNull();
    expect(upd.body.hostingRenewalAt).toBeNull();
    expect(upd.body.siteUrl).toBe("https://ana.com.br");

    const list = await http().get(`/api/deliveries?clientId=${clientAId}&type=SITE`).set("Cookie", memberA);
    expect(list.body.total).toBe(1);
    const search = await http().get("/api/deliveries?search=ana.com").set("Cookie", memberA);
    expect(search.body.total).toBe(1);
  });

  it("contrato vinculado à entrega: mesma empresa e mesmo cliente", async () => {
    const otherClient = await http().post("/api/subscriptions").set("Cookie", adminA).send({ clientId: otherClientAId, planId: planAId, deliveryId });
    expect(otherClient.status).toBe(400);

    const ok = await http().post("/api/subscriptions").set("Cookie", adminA).send({ clientId: clientAId, planId: planAId, deliveryId });
    expect(ok.status).toBe(201);
    expect(ok.body.delivery).toMatchObject({ id: deliveryId, name: "Site da Ana", neverPause: true });

    const byDelivery = await http().get(`/api/subscriptions?deliveryId=${deliveryId}`).set("Cookie", adminA);
    expect(byDelivery.body.total).toBe(1);
    const delivery = await http().get(`/api/deliveries/${deliveryId}`).set("Cookie", adminA);
    expect(delivery.body.contractsCount).toBe(1);

    const crossTenant = await http().post("/api/subscriptions").set("Cookie", adminB).send({ clientId: clientBId, planId: planAId, deliveryId });
    expect(crossTenant.status).toBe(404);
  });

  it("histórico do cliente traz cadastro, entrega e contrato (mais recente primeiro)", async () => {
    const res = await http().get(`/api/clients/${clientAId}/history`).set("Cookie", memberA);
    expect(res.status).toBe(200);
    const kinds = res.body.map((item: { kind: string }) => item.kind);
    expect(kinds).toEqual(expect.arrayContaining(["CLIENT_CREATED", "DELIVERY_CREATED", "CONTRACT_STARTED"]));
    expect(kinds[kinds.length - 1]).toBe("CLIENT_CREATED");
    const cross = await http().get(`/api/clients/${clientAId}/history`).set("Cookie", adminB);
    expect(cross.status).toBe(404);
  });
});

describe("Política de atraso (só configuração)", () => {
  it("padrão: aviso no dia 1, pausa no dia 10, sem pausa automática", async () => {
    const res = await http().get("/api/overdue-policy").set("Cookie", memberA);
    expect(res.body).toEqual({ warnDays: 1, pauseDays: 10, autoPauseEnabled: false, pixKey: null });
  });

  it("admin altera; pausa antes do aviso → 400; membro → 403; isolado por empresa", async () => {
    const bad = await http().put("/api/overdue-policy").set("Cookie", adminA).send({ warnDays: 5, pauseDays: 3 });
    expect(bad.status).toBe(400);
    const member = await http().put("/api/overdue-policy").set("Cookie", memberA).send({ warnDays: 2, pauseDays: 15 });
    expect(member.status).toBe(403);
    const ok = await http().put("/api/overdue-policy").set("Cookie", adminA).send({ warnDays: 2, pauseDays: 15 });
    expect(ok.body).toEqual({ warnDays: 2, pauseDays: 15, autoPauseEnabled: false, pixKey: null });
    const b = await http().get("/api/overdue-policy").set("Cookie", adminB);
    expect(b.body).toMatchObject({ warnDays: 1, pauseDays: 10 });
  });
});
