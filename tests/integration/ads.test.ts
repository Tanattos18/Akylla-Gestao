import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { systemDatabaseUrl } from "../../apps/api/src/common/tenant/rls.extension";
import { computeIndicators, effectiveMetrics } from "../../apps/api/src/ads/ads-indicators";
import { parseAdCsv, parseAdDate, parseAdNumber } from "../../apps/api/src/ads/ads-csv";
import { utmSlug } from "../../apps/api/src/ads/ads.service";

/** 2026-10-29: gestão de anúncios — fases A1 (base manual) e A2 (importar CSV). */

const PASSWORD = "SenhaForte123!";
const DAY_MS = 86_400_000;

let app: INestApplication;
let prisma: PrismaService;
let system: PrismaClient;

let companyA: string;
let adminAId: string;
let adminA: string;
let memberA: string;
let adminB: string;
let adminC: string;
let clientA1: string;
let clientA2: string;
let clientB1: string;
let deliveryA1: string;
let deliveryB1: string;
let subscriptionA1: string;

const http = () => request(app.getHttpServer());

/** Dia relativo a hoje no fuso de Brasília (AAAA-MM-DD). */
function day(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY_MS - 3 * 3600_000).toISOString().slice(0, 10);
}

async function user(company: string, email: string, role: "ADMIN" | "MEMBER") {
  const u = await prisma.user.create({
    data: { companyId: company, name: email.split("@")[0]!, email, role, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
  const res = await http().post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { id: u.id, cookie: sessionCookieFrom(res) };
}

async function client(company: string, name: string) {
  return (await prisma.client.create({ data: { companyId: company, name, nameKey: name.toLowerCase() } })).id;
}

async function campaign(body: Record<string, unknown>, cookie = adminA) {
  const res = await http()
    .post("/api/ads/campaigns")
    .set("Cookie", cookie)
    .send({ clientId: clientA1, platform: "META", objective: "MESSAGES", ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string; utmCampaign: string; status: string; promotedItem: string; targetUrl: string | null };
}

function csv(content: string, name = "relatorio.csv") {
  return { buffer: Buffer.from(content, "utf8"), name };
}

function upload(campaignId: string, file: { buffer: Buffer; name: string }, fields: Record<string, string> = {}, cookie = adminA) {
  let req = http().post(`/api/ads/campaigns/${campaignId}/metrics/import`).set("Cookie", cookie);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  return req.attach("file", file.buffer, file.name);
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  system = new PrismaClient({ datasources: { db: { url: systemDatabaseUrl(process.env.DATABASE_URL as string) } } });
  await resetDatabase(prisma);

  // A: sem assinatura nem teste (isenta: tudo liberado); B: outra empresa;
  // C: kit Básico (sem o módulo ADS)
  companyA = (await prisma.company.create({ data: { name: "Agência Anúncios", slug: "ads-a" } })).id;
  const companyB = (await prisma.company.create({ data: { name: "Outra agência", slug: "ads-b" } })).id;
  const companyC = (await prisma.company.create({ data: { name: "Loja sem anúncios", slug: "ads-c", trialEndsAt: new Date(Date.now() - 30 * DAY_MS) } })).id;
  await prisma.tenantSubscription.create({
    data: {
      companyId: companyC,
      planId: "tenantplan_essencial",
      status: "ACTIVE",
      currentPeriodStart: new Date(Date.now() - DAY_MS),
      currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
    },
  });

  const a = await user(companyA, "admin@ads-a.test", "ADMIN");
  adminAId = a.id;
  adminA = a.cookie;
  memberA = (await user(companyA, "membro@ads-a.test", "MEMBER")).cookie;
  adminB = (await user(companyB, "admin@ads-b.test", "ADMIN")).cookie;
  adminC = (await user(companyC, "admin@ads-c.test", "ADMIN")).cookie;

  clientA1 = await client(companyA, "Barbearia do Zé");
  clientA2 = await client(companyA, "Loja da Ana");
  clientB1 = await client(companyB, "Cliente da B");

  deliveryA1 = (
    await prisma.clientDelivery.create({
      data: { companyId: companyA, clientId: clientA1, name: "Site da Barbearia", type: "SITE", siteUrl: "https://barbearia.test/" },
    })
  ).id;
  deliveryB1 = (
    await prisma.clientDelivery.create({ data: { companyId: companyB, clientId: clientB1, name: "Site B", type: "SITE" } })
  ).id;

  // Contrato de gestão de anúncios (entrega ADS_MANAGEMENT), R$ 600/mês
  const adsDelivery = await prisma.clientDelivery.create({
    data: { companyId: companyA, clientId: clientA1, name: "Gestão de anúncios — Básico", type: "ADS_MANAGEMENT" },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: { companyId: companyA, name: "Anúncios Básico", nameKey: "anuncios basico", price: "600.00", durationDays: 30, createdByUserId: adminAId },
  });
  subscriptionA1 = (
    await prisma.subscription.create({
      data: {
        companyId: companyA,
        clientId: clientA1,
        planId: plan.id,
        deliveryId: adsDelivery.id,
        startAt: new Date(Date.now() - 5 * DAY_MS),
        endAt: new Date(Date.now() + 25 * DAY_MS),
        createdByUserId: adminAId,
      },
    })
  ).id;
});

afterAll(async () => {
  await resetDatabase(prisma);
  await system.$disconnect();
  await app.close();
});

describe("indicadores (funções puras)", () => {
  const row = (date: string, source: "MANUAL" | "CSV" | "API", spend: string, extra: Partial<{ impressions: number; clicks: number; results: number }> = {}) => ({
    campaignId: "c1",
    date: new Date(`${date}T00:00:00.000Z`),
    source,
    impressions: extra.impressions ?? 0,
    reach: 0,
    clicks: extra.clicks ?? 0,
    spend: new Prisma.Decimal(spend),
    results: extra.results ?? 0,
  });

  it("divisão por zero vira null", () => {
    expect(computeIndicators([])).toMatchObject({ spend: "0.00", ctr: null, cpc: null, costPerResult: null, days: 0 });
    expect(computeIndicators([row("2026-10-01", "MANUAL", "50")])).toMatchObject({ spend: "50.00", ctr: null, cpc: null, costPerResult: null });
  });

  it("CTR, CPC e custo por resultado com arredondamento de 2 casas", () => {
    const ind = computeIndicators([row("2026-10-01", "MANUAL", "100", { impressions: 3000, clicks: 7, results: 3 })]);
    expect(ind.ctr).toBe(0.23);
    expect(ind.cpc).toBe("14.29");
    expect(ind.costPerResult).toBe("33.33");
  });

  it("precedência no mesmo dia: API > CSV > MANUAL", () => {
    const rows = effectiveMetrics([
      row("2026-10-01", "MANUAL", "10"),
      row("2026-10-01", "API", "30"),
      row("2026-10-01", "CSV", "20"),
      row("2026-10-02", "MANUAL", "5"),
      row("2026-10-02", "CSV", "7"),
    ]);
    expect(rows.map((r) => [r.source, r.spend.toFixed(2)])).toEqual([
      ["API", "30.00"],
      ["CSV", "7.00"],
    ]);
    expect(rows[0]!.overridden.sort()).toEqual(["CSV", "MANUAL"]);
    expect(computeIndicators(rows).spend).toBe("37.00");
  });

  it("slug do UTM sem acento nem símbolo", () => {
    expect(utmSlug("Corte + Barba — Outubro/2026")).toBe("corte-barba-outubro-2026");
    expect(utmSlug("!!!")).toBe("campanha");
  });
});

describe("leitura do CSV (funções puras)", () => {
  it("números no formato brasileiro e internacional", () => {
    expect(parseAdNumber("1.234,56", "money")).toBe("1234.56");
    expect(parseAdNumber("R$ 1.234,56", "money")).toBe("1234.56");
    expect(parseAdNumber("1,234.56", "money")).toBe("1234.56");
    expect(parseAdNumber("12,5", "money")).toBe("12.5");
    expect(parseAdNumber("99.90", "money")).toBe("99.90");
    expect(parseAdNumber("1.234", "int")).toBe("1234");
    expect(parseAdNumber("1,234", "int")).toBe("1234");
    expect(parseAdNumber("--", "int")).toBe("0");
    expect(parseAdNumber("", "money")).toBe("0");
    expect(parseAdNumber("abc", "int")).toBeNull();
    expect(parseAdNumber("-5", "int")).toBeNull();
  });

  it("datas em ISO, dd/mm/aaaa, pt-BR por extenso e inglês", () => {
    expect(parseAdDate("2026-10-05")).toBe("2026-10-05");
    expect(parseAdDate("05/10/2026")).toBe("2026-10-05");
    expect(parseAdDate("5 de out. de 2026")).toBe("2026-10-05");
    expect(parseAdDate("5 de outubro de 2026")).toBe("2026-10-05");
    expect(parseAdDate("Oct 5, 2026")).toBe("2026-10-05");
    expect(parseAdDate("31/02/2026")).toBeNull();
    expect(parseAdDate("Total")).toBeNull();
  });

  it("Google Ads em UTF-16 com tabulação, títulos antes do cabeçalho e linha de total", () => {
    const text = "Campaign report\r\nOctober 1, 2026 - October 31, 2026\r\nDay\tCampaign\tClicks\tImpr.\tCost\tConversions\r\n2026-10-07\tSearch\t5\t1,100\t1,234.50\t2.00\r\nTotal: Campaigns\t--\t5\t1,100\t1,234.50\t2.00\r\n";
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    const parsed = parseAdCsv(buffer);
    expect(parsed.format).toBe("GOOGLE");
    expect(parsed.skipped).toBe(1);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ date: "2026-10-07", clicks: 5, impressions: 1100, results: 2, campaign: "Search" });
    expect(parsed.rows[0]!.spend.toFixed(2)).toBe("1234.50");
  });

  it("Meta sem detalhamento por dia: linha de período vira erro", () => {
    const parsed = parseAdCsv(
      Buffer.from('"Início dos relatórios","Término dos relatórios","Nome da campanha","Impressões","Valor usado (BRL)"\n"2026-10-01","2026-10-31","X","100","10,00"\n'),
    );
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]!.message).toContain("vários dias");
  });
});

describe("módulo ADS e permissões", () => {
  it("empresa sem o módulo no plano recebe 403 MODULE_NOT_CONTRACTED", async () => {
    const res = await http().get("/api/ads/campaigns").set("Cookie", adminC);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("MODULE_NOT_CONTRACTED");
    expect((await http().get("/api/ads/overview").set("Cookie", adminC)).status).toBe(403);
  });

  it("módulo desativado pela empresa → 403; reativado volta a funcionar", async () => {
    const off = await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "ADS", status: "DISABLED" });
    expect(off.status).toBe(200);
    expect((await http().get("/api/ads/campaigns").set("Cookie", adminA)).status).toBe(403);
    expect((await http().get(`/api/clients/${clientA1}/ads`).set("Cookie", adminA)).status).toBe(403);
    await http().patch("/api/company-modules").set("Cookie", adminA).send({ module: "ADS", status: "ACTIVE" });
    expect((await http().get("/api/ads/campaigns").set("Cookie", adminA)).status).toBe(200);
  });

  it("MEMBER lê, mas não escreve (AdminGuard)", async () => {
    const created = await campaign({ name: "Campanha do membro", promotedItem: "Corte" });
    expect((await http().get("/api/ads/campaigns").set("Cookie", memberA)).status).toBe(200);
    expect((await http().get(`/api/ads/campaigns/${created.id}`).set("Cookie", memberA)).status).toBe(200);
    expect((await http().post("/api/ads/accounts").set("Cookie", memberA).send({ clientId: clientA1, platform: "META", name: "Conta" })).status).toBe(403);
    expect((await http().post("/api/ads/campaigns").set("Cookie", memberA).send({ clientId: clientA1, platform: "META", objective: "MESSAGES", name: "X campanha", promotedItem: "X" })).status).toBe(403);
    expect((await http().patch(`/api/ads/campaigns/${created.id}`).set("Cookie", memberA).send({ name: "Outro nome" })).status).toBe(403);
    expect((await http().post(`/api/ads/campaigns/${created.id}/status`).set("Cookie", memberA).send({ status: "ACTIVE" })).status).toBe(403);
    expect((await http().put(`/api/ads/campaigns/${created.id}/metrics/${day(-1)}`).set("Cookie", memberA).send({ spend: "1" })).status).toBe(403);
    expect((await upload(created.id, csv("Dia,Custo\n2026-10-01,1\n"), {}, memberA)).status).toBe(403);
  });
});

describe("contas de anúncio", () => {
  it("cria, impede duplicata e não aceita cliente de outra empresa", async () => {
    const res = await http().post("/api/ads/accounts").set("Cookie", adminA).send({ clientId: clientA1, platform: "META", name: "BM Barbearia", externalAccountId: "act_123" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ platform: "META", connection: "MANUAL", status: "ACTIVE", campaignsCount: 0 });
    expect(res.body.tokenEncrypted).toBeUndefined();

    const dup = await http().post("/api/ads/accounts").set("Cookie", adminA).send({ clientId: clientA1, platform: "META", name: "Repetida", externalAccountId: "act_123" });
    expect(dup.status).toBe(409);
    const other = await http().post("/api/ads/accounts").set("Cookie", adminA).send({ clientId: clientB1, platform: "META", name: "Conta alheia" });
    expect(other.status).toBe(404);

    const list = await http().get(`/api/ads/accounts?clientId=${clientA1}`).set("Cookie", adminA);
    expect(list.body.map((a: { name: string }) => a.name)).toContain("BM Barbearia");

    const patched = await http().patch(`/api/ads/accounts/${res.body.id}`).set("Cookie", adminA).send({ status: "INACTIVE" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("INACTIVE");
    expect((await http().patch(`/api/ads/accounts/${res.body.id}`).set("Cookie", adminB).send({ name: "Invasão" })).status).toBe(404);
  });
});

describe("campanhas", () => {
  it("UTM gerado no servidor, único por empresa; utmCampaign do cliente é ignorado", async () => {
    const first = await campaign({ name: "Promoção Outubro", promotedItem: "Corte + barba", utmCampaign: "hack" });
    const second = await campaign({ name: "Promoção Outubro", promotedItem: "Corte" });
    expect(first.utmCampaign).toBe("promocao-outubro");
    expect(second.utmCampaign).toBe("promocao-outubro-2");
    // Outra empresa pode usar o mesmo slug
    const b = await http()
      .post("/api/ads/campaigns")
      .set("Cookie", adminB)
      .send({ clientId: clientB1, platform: "GOOGLE", objective: "TRAFFIC", name: "Promoção Outubro", promotedItem: "Site" });
    expect(b.status).toBe(201);
    expect(b.body.utmCampaign).toBe("promocao-outubro");
  });

  it("entrega promovida preenche o item e a URL; referências de outro cliente/empresa são recusadas", async () => {
    const withDelivery = await campaign({ name: "Visitas ao site", objective: "TRAFFIC", deliveryId: deliveryA1, subscriptionId: subscriptionA1 });
    expect(withDelivery.promotedItem).toBe("Site da Barbearia");
    expect(withDelivery.targetUrl).toBe("https://barbearia.test/");

    const noItem = await http().post("/api/ads/campaigns").set("Cookie", adminA).send({ clientId: clientA1, platform: "META", objective: "MESSAGES", name: "Sem item" });
    expect(noItem.status).toBe(400);
    const foreignDelivery = await http().post("/api/ads/campaigns").set("Cookie", adminA).send({ clientId: clientA1, platform: "META", objective: "MESSAGES", name: "Alheia", deliveryId: deliveryB1 });
    expect(foreignDelivery.status).toBe(404);

    const accountA2 = await http().post("/api/ads/accounts").set("Cookie", adminA).send({ clientId: clientA2, platform: "META", name: "Conta da Ana" });
    const otherClient = await http().post("/api/ads/campaigns").set("Cookie", adminA).send({ clientId: clientA1, platform: "META", objective: "MESSAGES", name: "Conta errada", promotedItem: "X", adAccountId: accountA2.body.id });
    expect(otherClient.status).toBe(400);
    const otherPlatform = await http().post("/api/ads/campaigns").set("Cookie", adminA).send({ clientId: clientA2, platform: "GOOGLE", objective: "TRAFFIC", name: "Plataforma errada", promotedItem: "X", adAccountId: accountA2.body.id });
    expect(otherPlatform.status).toBe(400);
    const badPeriod = await http().post("/api/ads/campaigns").set("Cookie", adminA).send({ clientId: clientA1, platform: "META", objective: "MESSAGES", name: "Período", promotedItem: "X", startAt: "2026-10-10", endAt: "2026-10-01" });
    expect(badPeriod.status).toBe(400);
  });

  it("isolamento por empresa: id de outra empresa → 404", async () => {
    const mine = await campaign({ name: "Só da A", promotedItem: "X" });
    expect((await http().get(`/api/ads/campaigns/${mine.id}`).set("Cookie", adminB)).status).toBe(404);
    expect((await http().patch(`/api/ads/campaigns/${mine.id}`).set("Cookie", adminB).send({ name: "Invasão" })).status).toBe(404);
    expect((await http().post(`/api/ads/campaigns/${mine.id}/status`).set("Cookie", adminB).send({ status: "ACTIVE" })).status).toBe(404);
    expect((await http().put(`/api/ads/campaigns/${mine.id}/metrics/${day(-1)}`).set("Cookie", adminB).send({ spend: "1" })).status).toBe(404);
    expect((await http().get(`/api/ads/campaigns/${mine.id}/link?url=https://x.test/`).set("Cookie", adminB)).status).toBe(404);
    expect((await upload(mine.id, csv("Dia,Custo\n2026-10-01,1\n"), {}, adminB)).status).toBe(404);
    expect((await http().get(`/api/clients/${clientA1}/ads`).set("Cookie", adminB)).status).toBe(404);
    const listB = await http().get("/api/ads/campaigns?pageSize=100").set("Cookie", adminB);
    expect(listB.body.items.map((c: { id: string }) => c.id)).not.toContain(mine.id);
  });

  it("status com transições válidas, motivo obrigatório para pausar/finalizar e histórico", async () => {
    const c = await campaign({ name: "Ciclo de vida", promotedItem: "X" });
    expect((await http().post(`/api/ads/campaigns/${c.id}/status`).set("Cookie", adminA).send({ status: "PAUSED", reason: "teste" })).status).toBe(400);
    expect((await http().post(`/api/ads/campaigns/${c.id}/status`).set("Cookie", adminA).send({ status: "ACTIVE" })).status).toBe(201);
    expect((await http().post(`/api/ads/campaigns/${c.id}/status`).set("Cookie", adminA).send({ status: "PAUSED" })).status).toBe(400);
    expect((await http().post(`/api/ads/campaigns/${c.id}/status`).set("Cookie", adminA).send({ status: "PAUSED", reason: "Cliente sem estoque" })).status).toBe(201);
    expect((await http().post(`/api/ads/campaigns/${c.id}/status`).set("Cookie", adminA).send({ status: "FINISHED", reason: "Fim do mês" })).status).toBe(201);
    expect((await http().post(`/api/ads/campaigns/${c.id}/status`).set("Cookie", adminA).send({ status: "ACTIVE" })).status).toBe(400);

    const detail = await http().get(`/api/ads/campaigns/${c.id}`).set("Cookie", adminA);
    expect(detail.body.status).toBe("FINISHED");
    expect(detail.body.allowedStatuses).toEqual([]);
    const statusLogs = detail.body.logs.filter((l: { action: string }) => l.action === "STATUS");
    expect(statusLogs).toHaveLength(3);
    expect(statusLogs.map((l: { detail: { reason: string | null } }) => l.detail.reason)).toContain("Cliente sem estoque");
    expect(detail.body.logs.some((l: { action: string }) => l.action === "CREATE")).toBe(true);
  });

  it("link com UTM preserva os parâmetros do site e valida a URL", async () => {
    const c = await campaign({ name: "Link UTM", promotedItem: "X" });
    const res = await http().get(`/api/ads/campaigns/${c.id}/link?url=${encodeURIComponent("https://barbearia.test/agenda?ref=1&utm_source=velho")}`).set("Cookie", adminA);
    expect(res.status).toBe(200);
    const url = new URL(res.body.url);
    expect(url.searchParams.get("ref")).toBe("1");
    expect(url.searchParams.get("utm_source")).toBe("facebook");
    expect(url.searchParams.get("utm_medium")).toBe("cpc");
    expect(url.searchParams.get("utm_campaign")).toBe(c.utmCampaign);
    expect((await http().get(`/api/ads/campaigns/${c.id}/link`).set("Cookie", adminA)).status).toBe(400);
    expect((await http().get(`/api/ads/campaigns/${c.id}/link?url=javascript:alert(1)`).set("Cookie", adminA)).status).toBe(400);
  });
});

describe("métricas e indicadores", () => {
  it("lançamento manual, correção com log e indicadores no servidor", async () => {
    const c = await campaign({ name: "Mensagens WhatsApp", promotedItem: "Corte" });
    const empty = await http().get(`/api/ads/campaigns/${c.id}`).set("Cookie", adminA);
    expect(empty.body.indicators).toMatchObject({ spend: "0.00", ctr: null, cpc: null, costPerResult: null });

    const d1 = day(-3);
    const first = await http().put(`/api/ads/campaigns/${c.id}/metrics/${d1}`).set("Cookie", adminA).send({ impressions: 1000, reach: 800, clicks: 50, spend: "100,00", results: 5 });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ corrected: false, spend: "100.00" });
    await http().put(`/api/ads/campaigns/${c.id}/metrics/${day(-2)}`).set("Cookie", adminA).send({ spend: "0" });

    const fixed = await http().put(`/api/ads/campaigns/${c.id}/metrics/${d1}`).set("Cookie", adminA).send({ impressions: 1000, reach: 800, clicks: 50, spend: "120", results: 6 });
    expect(fixed.body.corrected).toBe(true);

    const detail = await http().get(`/api/ads/campaigns/${c.id}`).set("Cookie", adminA);
    expect(detail.body.indicators).toMatchObject({ impressions: 1000, clicks: 50, spend: "120.00", results: 6, ctr: 5, cpc: "2.40", costPerResult: "20.00", days: 2 });
    const fix = detail.body.logs.find((l: { action: string }) => l.action === "METRIC_FIX");
    expect(fix.detail).toMatchObject({ date: d1, before: { spend: "100.00", results: 5 }, after: { spend: "120.00", results: 6 } });
    expect(await prisma.adMetricDaily.count({ where: { campaignId: c.id, source: "MANUAL" } })).toBe(2);

    // Valores inválidos e dia futuro
    expect((await http().put(`/api/ads/campaigns/${c.id}/metrics/${day(-1)}`).set("Cookie", adminA).send({ clicks: -1 })).status).toBe(400);
    expect((await http().put(`/api/ads/campaigns/${c.id}/metrics/${day(2)}`).set("Cookie", adminA).send({ spend: "1" })).status).toBe(400);
    expect((await http().put(`/api/ads/campaigns/${c.id}/metrics/2026-02-30`).set("Cookie", adminA).send({ spend: "1" })).status).toBe(400);
  });

  it("precedência API > CSV > MANUAL no mesmo dia", async () => {
    const c = await campaign({ name: "Precedência", promotedItem: "X" });
    const d = day(-4);
    await http().put(`/api/ads/campaigns/${c.id}/metrics/${d}`).set("Cookie", adminA).send({ spend: "10", clicks: 10 });
    const imported = await upload(c.id, csv(`Dia,Cliques,Custo\n${d},20,"20,00"\n`), { dryRun: "false" });
    expect(imported.status).toBe(201);
    let detail = await http().get(`/api/ads/campaigns/${c.id}`).set("Cookie", adminA);
    expect(detail.body.indicators.spend).toBe("20.00");
    expect(detail.body.metrics[0]).toMatchObject({ source: "CSV", overridden: ["MANUAL"] });

    // Linha da API (fase A5) gravada pelo sistema vence as duas
    await system.adMetricDaily.create({
      data: { companyId: companyA, campaignId: c.id, date: new Date(`${d}T00:00:00.000Z`), source: "API", clicks: 30, spend: "30.00" },
    });
    detail = await http().get(`/api/ads/campaigns/${c.id}`).set("Cookie", adminA);
    expect(detail.body.indicators).toMatchObject({ spend: "30.00", clicks: 30, cpc: "1.00", days: 1 });
    expect(detail.body.metrics[0].source).toBe("API");
  });

  it("log imutável: sem rota de alteração e UPDATE bloqueado no banco", async () => {
    const c = await campaign({ name: "Log imutável", promotedItem: "X" });
    const log = await system.adCampaignLog.findFirstOrThrow({ where: { campaignId: c.id } });
    expect((await http().delete(`/api/ads/campaigns/${c.id}`).set("Cookie", adminA)).status).toBe(404);
    await expect(system.adCampaignLog.update({ where: { id: log.id }, data: { action: "UPDATE" } })).rejects.toThrow(/imutável/);
    expect((await system.adCampaignLog.findUniqueOrThrow({ where: { id: log.id } })).action).toBe("CREATE");
  });

  it("visão geral: ativas, investimento do período, mensalidade de gestão e alerta sem métrica", async () => {
    const active = await campaign({ name: "Ativa com métrica", promotedItem: "X", clientId: clientA2 });
    await http().post(`/api/ads/campaigns/${active.id}/status`).set("Cookie", adminA).send({ status: "ACTIVE" });
    await http().put(`/api/ads/campaigns/${active.id}/metrics/${day(-1)}`).set("Cookie", adminA).send({ spend: "50", results: 2 });
    const stale = await campaign({ name: "Ativa esquecida", promotedItem: "X", startAt: day(-6) });
    await http().post(`/api/ads/campaigns/${stale.id}/status`).set("Cookie", adminA).send({ status: "ACTIVE" });

    const res = await http().get(`/api/ads/overview?from=${day(-30)}&to=${day(0)}`).set("Cookie", adminA);
    expect(res.status).toBe(200);
    expect(res.body.activeCampaigns).toBeGreaterThanOrEqual(2);
    expect(res.body.managementMonthly).toBe("600.00");
    expect(res.body.managementContracts).toBe(1);
    const ana = res.body.byClient.find((r: { client: { id: string } }) => r.client.id === clientA2);
    expect(ana.indicators).toMatchObject({ spend: "50.00", results: 2, costPerResult: "25.00" });
    const alert = res.body.stale.find((s: { id: string }) => s.id === stale.id);
    expect(alert).toMatchObject({ lastMetricDate: null, clientName: "Barbearia do Zé" });
    expect(res.body.stale.some((s: { id: string }) => s.id === active.id)).toBe(false);

    // Outra empresa não vê nada da A
    const b = await http().get("/api/ads/overview").set("Cookie", adminB);
    expect(b.body.managementMonthly).toBe("0.00");
    expect(b.body.byClient.some((r: { client: { id: string } }) => r.client.id === clientA2)).toBe(false);
    expect((await http().get("/api/ads/overview?from=2026-10-10&to=2026-10-01").set("Cookie", adminA)).status).toBe(400);
  });

  it("aba Anúncios da ficha do cliente", async () => {
    const res = await http().get(`/api/clients/${clientA2}/ads`).set("Cookie", adminA);
    expect(res.status).toBe(200);
    expect(res.body.campaigns.length).toBeGreaterThanOrEqual(1);
    expect(res.body.accounts.map((a: { name: string }) => a.name)).toContain("Conta da Ana");
    expect(res.body.indicators.spend).toBe("50.00");
    expect((await http().get("/api/clients/inexistente/ads").set("Cookie", adminA)).status).toBe(404);
  });
});

describe("importação do CSV (fase A2)", () => {
  const metaCsv = () =>
    [
      '"Nome da campanha","Dia","Alcance","Impressões","Cliques no link","Valor usado (BRL)","Resultados","Indicador de resultados"',
      `"Corte + barba","${day(-6)}","1.200","2.500","80","150,50","12","actions:onsite_conversion.messaging_conversation_started_7d"`,
      `"Corte + barba","${day(-5)}","900","1.800","","99,90","7",""`,
      `"Corte + barba","${day(-5)}","10","200","5","0,10","1",""`,
      `"Outra campanha","${day(-6)}","10","20","1","1,00","0",""`,
      `"Corte + barba","ontem","1","1","1","1,00","1",""`,
    ].join("\n") + "\n";

  it("Meta pt-BR: prévia sem gravar, depois grava com source=CSV e log CSV_IMPORT", async () => {
    const c = await campaign({ name: "Corte + barba", promotedItem: "Corte + barba" });
    const preview = await upload(c.id, csv(metaCsv()));
    expect(preview.status).toBe(201);
    expect(preview.body).toMatchObject({
      dryRun: true,
      format: "META",
      selectedCampaign: "Corte + barba",
      campaignNames: ["Corte + barba", "Outra campanha"],
      imported: 0,
      columns: { date: "Dia", spend: "Valor usado (BRL)", clicks: "Cliques no link", campaign: "Nome da campanha" },
    });
    expect(preview.body.rows).toEqual([
      { date: day(-6), impressions: 2500, reach: 1200, clicks: 80, spend: "150.50", results: 12, replaces: false },
      { date: day(-5), impressions: 2000, reach: 910, clicks: 5, spend: "100.00", results: 8, replaces: false },
    ]);
    expect(preview.body.totals).toMatchObject({ spend: "250.50", results: 20, costPerResult: "12.53" });
    expect(preview.body.errors).toHaveLength(1);
    expect(preview.body.errors[0].message).toContain("data inválida");
    expect(await prisma.adMetricDaily.count({ where: { campaignId: c.id } })).toBe(0);

    const done = await upload(c.id, csv(metaCsv()), { dryRun: "false" });
    expect(done.status).toBe(201);
    expect(done.body.imported).toBe(2);
    const rows = await prisma.adMetricDaily.findMany({ where: { campaignId: c.id }, orderBy: { date: "asc" } });
    expect(rows.map((r) => [r.source, r.spend.toFixed(2)])).toEqual([
      ["CSV", "150.50"],
      ["CSV", "100.00"],
    ]);
    const log = await prisma.adCampaignLog.findFirstOrThrow({ where: { campaignId: c.id, action: "CSV_IMPORT" } });
    expect(log.detail).toMatchObject({ days: 2, replaced: 0, spend: "250.50", format: "META", campaignName: "Corte + barba" });

    // Reimportar substitui o CSV do mesmo dia (sem duplicar)
    const again = await upload(c.id, csv(metaCsv()));
    expect(again.body.rows.every((r: { replaces: boolean }) => r.replaces)).toBe(true);
    await upload(c.id, csv(metaCsv()), { dryRun: "false" });
    expect(await prisma.adMetricDaily.count({ where: { campaignId: c.id } })).toBe(2);
  });

  it("Google Ads pt-BR com títulos e linha de total", async () => {
    const c = await campaign({ name: "Pesquisa Barbearia", platform: "GOOGLE", objective: "TRAFFIC", promotedItem: "Site" });
    const content = [
      "Relatório de campanhas",
      "1 de outubro de 2026 - 31 de outubro de 2026",
      "Dia,Campanha,Moeda,Cliques,Impr.,Custo,Conversões",
      `${day(-8)},Pesquisa Barbearia,BRL,40,"1.000","55,20","3,00"`,
      `${day(-7)},Pesquisa Barbearia,BRL,10,500,"20,00","1,50"`,
      'Total: Campanha,--,BRL,50,"1.500","75,20","4,50"',
    ].join("\r\n");
    const res = await upload(c.id, csv(content, "google.csv"), { dryRun: "false" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ format: "GOOGLE", imported: 2, skipped: 1 });
    expect(res.body.totals).toMatchObject({ clicks: 50, impressions: 1500, spend: "75.20", results: 5 });
    const detail = await http().get(`/api/ads/campaigns/${c.id}`).set("Cookie", adminA);
    expect(detail.body.indicators).toMatchObject({ spend: "75.20", ctr: 3.33, cpc: "1.50" });
  });

  it("várias campanhas sem a de mesmo nome: exige escolher antes de gravar", async () => {
    const c = await campaign({ name: "Campanha nova", promotedItem: "X" });
    const preview = await upload(c.id, csv(metaCsv()));
    expect(preview.body.selectedCampaign).toBeNull();
    expect(preview.body.rows).toEqual([]);
    expect((await upload(c.id, csv(metaCsv()), { dryRun: "false" })).status).toBe(400);
    expect((await upload(c.id, csv(metaCsv()), { campaignName: "Não existe" })).status).toBe(400);
    const chosen = await upload(c.id, csv(metaCsv()), { dryRun: "false", campaignName: "Outra campanha" });
    expect(chosen.status).toBe(201);
    expect(chosen.body.rows).toHaveLength(1);
    expect(chosen.body.totals.spend).toBe("1.00");
  });

  it("arquivo inválido: extensão, cabeçalho e ausência", async () => {
    const c = await campaign({ name: "Arquivo inválido", promotedItem: "X" });
    expect((await upload(c.id, csv("Dia,Custo\n2026-10-01,1\n", "relatorio.xlsx"))).status).toBe(400);
    const header = await upload(c.id, csv("Nome,Telefone\nAna,1\n"));
    expect(header.status).toBe(400);
    expect(header.body.message).toContain("Cabeçalho");
    expect((await http().post(`/api/ads/campaigns/${c.id}/metrics/import`).set("Cookie", adminA)).status).toBe(400);
  });
});
