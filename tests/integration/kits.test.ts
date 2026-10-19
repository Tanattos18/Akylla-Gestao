import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { computeComboPrice } from "@petflow/shared";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

/**
 * Fase 8b — kits de acesso (Básico, Intermediário, Avançado) + módulos
 * avulsos: o cliente só usa o que contratou; teste grátis e isentas usam tudo.
 */

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;
const OWNER_EMAIL = "dono@akylla.test"; // PLATFORM_ADMIN_EMAILS nos testes

let app: INestApplication;
let prisma: PrismaService;
let ownerCookie: string;
const http = () => request(app.getHttpServer());

async function company(slug: string, data: { trialEndsAt?: Date | null; billingExempt?: boolean } = {}) {
  const created = await prisma.company.create({ data: { name: `Empresa ${slug}`, slug, ...data } });
  await prisma.user.create({
    data: {
      companyId: created.id,
      name: `Admin ${slug}`,
      email: `admin@${slug}.test`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: "ADMIN",
    },
  });
  return created.id;
}

async function login(email: string) {
  const res = await http().post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return sessionCookieFrom(res);
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  await resetDatabase(prisma);
  const ownerCompany = await prisma.company.create({ data: { name: "Akylla", slug: "akylla" } });
  await prisma.user.create({
    data: {
      companyId: ownerCompany.id,
      name: "Dono",
      email: OWNER_EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: "ADMIN",
    },
  });
  ownerCookie = await login(OWNER_EMAIL);
});

afterAll(async () => {
  await resetDatabase(prisma);
  await app.close();
});

describe("preço do combo (puro)", () => {
  const offers = [
    { module: "FISCAL" as const, priceMonthly: "39.90" },
    { module: "SERVICES" as const, priceMonthly: "9.90" },
  ];
  const kit = { priceMonthly: "79.90", priceYearly: "799.00", includedModules: ["WHATSAPP", "CREDIT"] as const };

  it("mensal soma os avulsos; anual = kit anual + 10× cada avulso; módulo do kit não é cobrado", () => {
    expect(computeComboPrice({ kit, extraModules: ["FISCAL"], offers, cycle: "MONTHLY" })).toBe("119.80");
    expect(computeComboPrice({ kit, extraModules: ["FISCAL", "SERVICES"], offers, cycle: "YEARLY" })).toBe("1297.00");
    expect(computeComboPrice({ kit, extraModules: ["CREDIT"], offers, cycle: "MONTHLY" })).toBe("79.90");
    expect(computeComboPrice({ kit: { ...kit, priceYearly: null }, extraModules: [], offers, cycle: "YEARLY" })).toBe("958.80");
  });
});

describe("catálogo de kits e módulos", () => {
  it("cliente vê kits (com módulos incluídos) e o preço de cada módulo", async () => {
    await company("catalogo", { trialEndsAt: new Date(Date.now() + 10 * DAY_MS) });
    const cookie = await login("admin@catalogo.test");
    const plans = await http().get("/api/billing/plans").set("Cookie", cookie);
    expect(plans.status).toBe(200);
    const names = plans.body.items.map((p: { name: string }) => p.name);
    expect(names.slice(0, 3)).toEqual(["Básico", "Intermediário", "Avançado"]);
    expect(plans.body.items[0].includedModules).toEqual(["WHATSAPP", "CREDIT"]);
    expect(plans.body.items[2].includedModules).toHaveLength(8);

    const modules = await http().get("/api/billing/modules").set("Cookie", cookie);
    expect(modules.status).toBe(200);
    expect(modules.body.items).toHaveLength(8);
    expect(modules.body.items.find((m: { module: string }) => m.module === "FISCAL")).toMatchObject({
      label: expect.any(String),
      priceMonthly: "39.90",
    });

    // Só o dono edita o catálogo
    expect((await http().get("/api/platform/catalog").set("Cookie", cookie)).status).toBe(403);
    expect((await http().put("/api/platform/modules/SERVICES").set("Cookie", cookie).send({ priceMonthly: "1.00" })).status).toBe(403);
  });

  it("dono edita preço de módulo e de kit (e valida a entrada)", async () => {
    const catalog = await http().get("/api/platform/catalog").set("Cookie", ownerCookie);
    expect(catalog.status).toBe(200);
    expect(catalog.body.plans.length).toBeGreaterThanOrEqual(3);
    expect(catalog.body.modules).toHaveLength(8);

    const changed = await http().put("/api/platform/modules/SERVICES").set("Cookie", ownerCookie).send({ priceMonthly: "12.50" });
    expect(changed.status).toBe(200);
    expect(changed.body.modules.find((m: { module: string }) => m.module === "SERVICES").priceMonthly).toBe("12.50");
    await http().put("/api/platform/modules/SERVICES").set("Cookie", ownerCookie).send({ priceMonthly: "9.90" });

    expect((await http().put("/api/platform/modules/NAO_EXISTE").set("Cookie", ownerCookie).send({ active: false })).status).toBe(400);
    expect((await http().put("/api/platform/modules/SERVICES").set("Cookie", ownerCookie).send({ priceMonthly: "abc" })).status).toBe(400);

    const plan = catalog.body.plans.find((p: { id: string }) => p.id === "tenantplan_essencial");
    const body = {
      priceMonthly: "84.90",
      priceYearly: "849.00",
      includedModules: [...plan.includedModules, "SERVICES"],
      userLimit: plan.userLimit,
      clientLimit: plan.clientLimit,
      productLimit: plan.productLimit,
    };
    const updated = await http().put("/api/platform/plans/tenantplan_essencial").set("Cookie", ownerCookie).send(body);
    expect(updated.status).toBe(200);
    expect(updated.body.plans.find((p: { id: string }) => p.id === "tenantplan_essencial")).toMatchObject({
      priceMonthly: "84.90",
      includedModules: ["WHATSAPP", "CREDIT", "SERVICES"],
    });
    // Restaura (o catálogo é global)
    await http()
      .put("/api/platform/plans/tenantplan_essencial")
      .set("Cookie", ownerCookie)
      .send({ ...body, priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly, includedModules: plan.includedModules });
    expect((await http().put("/api/platform/plans/nao-existe").set("Cookie", ownerCookie).send(body)).status).toBe(404);
    expect(
      (await http().put("/api/platform/plans/tenantplan_essencial").set("Cookie", ownerCookie).send({ ...body, includedModules: ["X"] })).status,
    ).toBe(400);
  });
});

describe("acesso por módulo contratado", () => {
  it("teste grátis e isenta usam todos os módulos", async () => {
    await company("kit-teste", { trialEndsAt: new Date(Date.now() + 5 * DAY_MS) });
    await company("kit-isenta", { trialEndsAt: new Date(Date.now() - 30 * DAY_MS), billingExempt: true });
    for (const email of ["admin@kit-teste.test", "admin@kit-isenta.test"]) {
      const cookie = await login(email);
      expect((await http().get("/api/service-orders").set("Cookie", cookie)).status).toBe(200);
      const access = await http().get("/api/billing/access").set("Cookie", cookie);
      expect(access.body.modules).toBeNull();
      const modules = await http().get("/api/company-modules").set("Cookie", cookie);
      expect(modules.body.every((m: { entitled: boolean }) => m.entitled)).toBe(true);
    }
  });

  it("Básico + Nota fiscal: cobra o combo, libera só o contratado e bloqueia o resto", async () => {
    const id = await company("kit-basico", { trialEndsAt: new Date(Date.now() - 30 * DAY_MS) });
    const res = await http()
      .post(`/api/platform/companies/${id}/activate`)
      .set("Cookie", ownerCookie)
      .send({ planId: "tenantplan_essencial", cycle: "MONTHLY", method: "PIX", extraModules: ["FISCAL", "CREDIT"] });
    expect(res.status).toBe(200);
    // CREDIT já está no kit: descartado dos avulsos e não cobrado
    expect(res.body.contract).toMatchObject({ planName: "Básico", extraModules: ["FISCAL"] });
    expect(res.body.access.modules.sort()).toEqual(["CREDIT", "FISCAL", "WHATSAPP"]);
    const payments = await http().get(`/api/platform/companies/${id}/payments`).set("Cookie", ownerCookie);
    expect(payments.body.items[0]).toMatchObject({ amount: "119.80", extraModules: ["FISCAL"] });

    const cookie = await login("admin@kit-basico.test");
    expect((await http().get("/api/credit-accounts").set("Cookie", cookie)).status).toBe(200);
    expect((await http().get("/api/fiscal/status").set("Cookie", cookie)).status).toBe(200);
    const blocked = await http().get("/api/service-orders").set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("MODULE_NOT_CONTRACTED");
    // Recursos do núcleo (fora dos módulos) continuam liberados
    expect((await http().get("/api/clients").set("Cookie", cookie)).status).toBe(200);

    const modules = await http().get("/api/company-modules").set("Cookie", cookie);
    const entitled = Object.fromEntries(modules.body.map((m: { module: string; entitled: boolean }) => [m.module, m.entitled]));
    expect(entitled).toMatchObject({ CREDIT: true, FISCAL: true, SERVICE_ORDERS: false, SUBSCRIPTIONS: false });
  });

  it("dono troca o kit/avulsos na hora (sem pagamento) e o acesso muda", async () => {
    const id = (await prisma.company.findFirstOrThrow({ where: { slug: "kit-basico" } })).id;
    const cookie = await login("admin@kit-basico.test");

    const up = await http()
      .post(`/api/platform/companies/${id}/modules`)
      .set("Cookie", ownerCookie)
      .send({ planId: "tenantplan_essencial", extraModules: ["SERVICE_ORDERS"] });
    expect(up.status).toBe(200);
    expect(up.body.contract.extraModules).toEqual(["SERVICE_ORDERS"]);
    expect((await http().get("/api/service-orders").set("Cookie", cookie)).status).toBe(200);
    expect((await http().get("/api/fiscal/status").set("Cookie", cookie)).status).toBe(403);

    const full = await http()
      .post(`/api/platform/companies/${id}/modules`)
      .set("Cookie", ownerCookie)
      .send({ planId: "tenantplan_completo", extraModules: [] });
    expect(full.body.contract.planName).toBe("Avançado");
    expect((await http().get("/api/fiscal/status").set("Cookie", cookie)).status).toBe(200);
    // Trocar kit não registra pagamento
    const payments = await http().get(`/api/platform/companies/${id}/payments`).set("Cookie", ownerCookie);
    expect(payments.body.items).toHaveLength(1);

    expect(
      (await http().post(`/api/platform/companies/${id}/modules`).set("Cookie", ownerCookie).send({ planId: "x", extraModules: [] })).status,
    ).toBe(404);
    expect(
      (await http().post(`/api/platform/companies/${id}/modules`).set("Cookie", cookie).send({ planId: "tenantplan_completo" })).status,
    ).toBe(403);
  });

  it("definir módulos durante o teste não corta nada até o teste acabar", async () => {
    const id = (await prisma.company.findFirstOrThrow({ where: { slug: "kit-teste" } })).id;
    const res = await http()
      .post(`/api/platform/companies/${id}/modules`)
      .set("Cookie", ownerCookie)
      .send({ planId: "tenantplan_essencial", extraModules: [] });
    expect(res.status).toBe(200);
    expect(res.body.access).toMatchObject({ status: "TRIAL", modules: null });
    const cookie = await login("admin@kit-teste.test");
    expect((await http().get("/api/service-orders").set("Cookie", cookie)).status).toBe(200);
  });
});
