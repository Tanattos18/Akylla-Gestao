import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createTestApp, resetDatabase, sessionCookieFrom } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";

const PASSWORD = "SenhaForte123!";

let app: INestApplication;
let prisma: PrismaService;

let adminACookie: string;
let memberACookie: string;
let adminBCookie: string;
let companyAId: string;
let companyBId: string;

async function createCompany(slug: string) {
  return prisma.company.create({ data: { name: `Empresa ${slug}`, slug } });
}

async function createUser(params: {
  companyId: string;
  name: string;
  email: string;
  role?: "ADMIN" | "MEMBER";
}) {
  return prisma.user.create({
    data: {
      companyId: params.companyId,
      name: params.name,
      email: params.email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role: params.role ?? "MEMBER",
    },
  });
}

async function login(email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  if (response.status !== 200) {
    throw new Error(`Login falhou para ${email}: ${response.status}`);
  }
  return sessionCookieFrom(response);
}

function csvUpload(
  cookie: string,
  type: string,
  content: string,
  options?: { dryRun?: boolean; filename?: string },
) {
  const req = request(app.getHttpServer())
    .post("/api/imports")
    .set("Cookie", cookie)
    .field("type", type)
    .field("dryRun", options?.dryRun ? "true" : "false")
    .attach("file", Buffer.from(content, "utf8"), options?.filename ?? "import.csv");
  return req;
}

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  prisma = created.prisma;

  await resetDatabase(prisma);

  const companyA = await createCompany("imports-a");
  const companyB = await createCompany("imports-b");
  companyAId = companyA.id;
  companyBId = companyB.id;

  await createUser({
    companyId: companyA.id,
    name: "Admin A",
    email: "admin@imports-a.test",
    role: "ADMIN",
  });
  await createUser({
    companyId: companyA.id,
    name: "Membro A",
    email: "membro@imports-a.test",
  });
  await createUser({
    companyId: companyB.id,
    name: "Admin B",
    email: "admin@imports-b.test",
    role: "ADMIN",
  });

  await prisma.product.create({
    data: { companyId: companyB.id, name: "Produto da Empresa B", sku: "PROD-B-1" },
  });

  adminACookie = await login("admin@imports-a.test");
  memberACookie = await login("membro@imports-a.test");
  adminBCookie = await login("admin@imports-b.test");
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/imports/template", () => {
  it("devolve CSV modelo com BOM e Content-Disposition", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/imports/template?type=CATEGORY")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      "akylla_modelo_categorias.csv",
    );
    expect(response.text).toContain("nome");
    expect(response.text.charCodeAt(0)).toBe(0xfeff);
  });

  it("rejeita tipo inválido", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/imports/template?type=VENDAS")
      .set("Cookie", adminACookie);

    expect(response.status).toBe(400);
  });
});

describe("POST /api/imports — autorização e validação", () => {
  it("rejeita MEMBERS com 403", async () => {
    const response = await csvUpload(
      memberACookie,
      "CATEGORY",
      "nome;descricao\nHigiene;Teste\n",
    );

    expect(response.status).toBe(403);
  });

  it("rejeita sem arquivo", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/imports")
      .set("Cookie", adminACookie)
      .field("type", "CATEGORY");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Arquivo CSV é obrigatório");
  });

  it("rejeita extensão diferente de .csv", async () => {
    const response = await csvUpload(
      adminACookie,
      "CATEGORY",
      "nome\nHigiene\n",
      { filename: "dados.txt" },
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(".csv");
  });

  it("rejeita cabeçalho sem coluna obrigatória", async () => {
    const response = await csvUpload(
      adminACookie,
      "CATEGORY",
      "descricao;outra\nx;y\n",
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Cabeçalho inválido");
  });

  it("rejeita planilha sem linhas de dados", async () => {
    const response = await csvUpload(adminACookie, "CATEGORY", "nome;descricao\n");

    expect(response.status).toBe(400);
  });
});

describe("POST /api/imports — categorias", () => {
  const csv = "nome;descricao\nHigiene;Produtos de higiene\nAlimentos;Ração\n";

  it("dryRun valida sem gravar nada e sem criar histórico", async () => {
    const before = await prisma.category.count({ where: { companyId: companyAId } });

    const response = await csvUpload(adminACookie, "CATEGORY", csv, {
      dryRun: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.dryRun).toBe(true);
    expect(response.body.batchId).toBeNull();
    expect(response.body.created).toBe(2);
    expect(response.body.errors).toBe(0);

    const after = await prisma.category.count({ where: { companyId: companyAId } });
    expect(after).toBe(before);
    expect(
      await prisma.importBatch.count({ where: { companyId: companyAId } }),
    ).toBe(0);
  });

  it("importa categorias e cria registro de histórico", async () => {
    const response = await csvUpload(adminACookie, "CATEGORY", csv);

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(2);
    expect(response.body.batchId).toBeTruthy();

    const batches = await prisma.importBatch.findMany({
      where: { companyId: companyAId },
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].type).toBe("CATEGORY");
    expect(batches[0].createdCount).toBe(2);
    expect(batches[0].status).toBe("COMPLETED");
  });

  it("reimportar o mesmo arquivo pula tudo (idempotência do skip)", async () => {
    const response = await csvUpload(adminACookie, "CATEGORY", csv);

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(0);
    expect(response.body.skipped).toBe(2);
    expect(
      await prisma.category.count({ where: { companyId: companyAId } }),
    ).toBe(2);
  });

  it("ignora duplicatas dentro do mesmo arquivo", async () => {
    const response = await csvUpload(
      adminACookie,
      "CATEGORY",
      "nome\nBanho\nBanho\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);
    expect(response.body.skipped).toBe(1);
  });
});

describe("POST /api/imports — fornecedores", () => {
  it("importa fornecedor com documento, email e telefone", async () => {
    const response = await csvUpload(
      adminACookie,
      "SUPPLIER",
      "nome;documento;email;telefone\nFornecedor Import;12345678000199;forn@exemplo.com;(11) 98888-7777\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);

    const supplier = await prisma.supplier.findFirst({
      where: { companyId: companyAId, name: "Fornecedor Import" },
    });
    expect(supplier).not.toBeNull();
    expect(supplier?.document).toBe("12345678000199");
  });
});

describe("POST /api/imports — produtos", () => {
  const validCsv =
    "nome;sku;unidade;preco_custo;preco_venda;estoque_minimo;saldoinicial;categoria;fornecedor\n" +
    "Ração Premium;rac-01;kg;10,50;12,50;5;10;Alimentos;Fornecedor Import\n" +
    "Coleira;;UNIDADE;;20,00;;0;;\n";

  it("importa produtos com referências por nome e gera estoque inicial", async () => {
    const response = await csvUpload(adminACookie, "PRODUCT", validCsv);

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(2);
    expect(response.body.errors).toBe(0);

    const product = await prisma.product.findFirst({
      where: { companyId: companyAId, sku: "RAC-01" },
    });
    expect(product).not.toBeNull();
    expect(product?.unit).toBe("KG");
    expect(product?.stockQuantity.toFixed(3)).toBe("10.000");
    expect(product?.salePrice.toFixed(2)).toBe("12.50");

    const category = await prisma.category.findFirst({
      where: { companyId: companyAId, name: "Alimentos" },
    });
    expect(product?.categoryId).toBe(category?.id);

    const movement = await prisma.stockMovement.findFirst({
      where: { companyId: companyAId, productId: product!.id, type: "IN" },
    });
    expect(movement).not.toBeNull();
    expect(movement?.quantity.toFixed(3)).toBe("10.000");
    expect(movement?.notes).toBe("Estoque inicial (importação)");
  });

  it("linha com categoria inexistente vira erro e as demais são criadas", async () => {
    const response = await csvUpload(
      adminACookie,
      "PRODUCT",
      "nome;categoria\nSabão Inexistente;Fantasma\nAmaciante Suave;\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);
    expect(response.body.errors).toBe(1);
    expect(response.body.errorDetails[0].row).toBe(2);
    expect(response.body.errorDetails[0].message).toContain("categoria");
  });

  it("SKU repetido dentro do arquivo é pulado", async () => {
    const response = await csvUpload(
      adminACookie,
      "PRODUCT",
      "nome;sku\nProduto Duplicado;DUP-1\nProduto Duplicado 2;DUP-1\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);
    expect(response.body.skipped).toBe(1);
  });

  it("SKU já existente na empresa é pulado", async () => {
    const response = await csvUpload(
      adminACookie,
      "PRODUCT",
      "nome;sku\nOutro nome;RAC-01\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(0);
    expect(response.body.skipped).toBe(1);
  });

  it("unidade inválida gera erro na linha", async () => {
    const response = await csvUpload(
      adminACookie,
      "PRODUCT",
      "nome;unidade\nProduto Unidade Errada;PACAO\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.errors).toBe(1);
    expect(response.body.errorDetails[0].message).toContain("unidade");
  });
});

describe("POST /api/imports — clientes", () => {
  it("importa clientes válidos e reporta erros por linha", async () => {
    const response = await csvUpload(
      adminACookie,
      "CLIENT",
      "nome;telefone;email;cpf\n" +
        "Maria Silva;(11) 98888-7777;maria@email.com;123.456.789-01\n" +
        "João Souza;abc;joao@@email;000\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);
    expect(response.body.errors).toBe(1);
    expect(response.body.errorDetails[0].row).toBe(3);

    const client = await prisma.client.findFirst({
      where: { companyId: companyAId, name: "Maria Silva" },
    });
    expect(client).not.toBeNull();
    expect(client?.phone).toBe("11988887777");
    expect(client?.cpf).toBe("12345678901");
    expect(
      await prisma.client.findFirst({
        where: { companyId: companyAId, name: "João Souza" },
      }),
    ).toBeNull();
  });

  it("reimportação pula clientes já existentes", async () => {
    const response = await csvUpload(
      adminACookie,
      "CLIENT",
      "nome\nMaria Silva\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(0);
    expect(response.body.skipped).toBe(1);
  });
});

describe("POST /api/imports — serviços", () => {
  it("importa serviços com duração e preço em formato BR", async () => {
    const response = await csvUpload(
      adminACookie,
      "SERVICE",
      "nome;descricao;duracao_minutos;preco\nBanho Completo;Higiene total;60;80,00\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);

    const service = await prisma.service.findFirst({
      where: { companyId: companyAId, nameKey: "banho completo" },
    });
    expect(service).not.toBeNull();
    expect(service?.price.toFixed(2)).toBe("80.00");
    expect(service?.durationMinutes).toBe(60);
  });

  it("linhas sem preço viram erro", async () => {
    const response = await csvUpload(
      adminACookie,
      "SERVICE",
      "nome;preco\nServiço Sem Preço;\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.errors).toBe(1);
    expect(response.body.created).toBe(0);
  });
});

describe("POST /api/imports — CSV com BOM e formato brasileiro", () => {
  it("processa arquivo com BOM, ponto-e-vírgula e acentos", async () => {
    const csv =
      "\uFEFFnome;descricao\nUtensílios;Produtos diversos para a casa\n";
    const response = await csvUpload(adminACookie, "CATEGORY", csv);

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);

    const category = await prisma.category.findFirst({
      where: { companyId: companyAId, name: "Utensílios" },
    });
    expect(category).not.toBeNull();
  });

  it("aceita delimitador vírgula", async () => {
    const csv = "nome,descricao\nPapelaria,Artigos de escritório\n";
    const response = await csvUpload(adminACookie, "CATEGORY", csv);

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);
  });
});

describe("POST /api/imports — limites de plano", () => {
  it("403 quando o lote excede productLimit da assinatura ACTIVE", async () => {
    const plan = await prisma.tenantPlan.upsert({
      where: { nameKey: "essencial-import" },
      update: { productLimit: 1, active: true },
      create: {
        name: "Essencial Import",
        nameKey: "essencial-import",
        priceMonthly: 79.9,
        productLimit: 1,
      },
    });
    await prisma.tenantSubscription.create({
      data: {
        companyId: companyBId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await csvUpload(
      adminBCookie,
      "PRODUCT",
      "nome;sku\nProduto Novo B;NEW-B-1\n",
    );

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("Limite do plano Essencial Import");
    expect(
      await prisma.product.findFirst({
        where: { companyId: companyBId, sku: "NEW-B-1" },
      }),
    ).toBeNull();
  });

  it("sem assinatura não há limite de plano", async () => {
    const response = await csvUpload(
      adminACookie,
      "CLIENT",
      "nome\nCliente Sem Limite\n",
    );

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(1);
  });
});

describe("POST /api/imports — limites de arquivo", () => {
  it("rejeita planilha com mais de 5000 linhas de dados", async () => {
    const rows = ["nome"];
    for (let i = 1; i <= 5001; i += 1) {
      rows.push(`Cliente Linha ${String(i).padStart(4, "0")}`);
    }
    const response = await csvUpload(
      adminACookie,
      "CLIENT",
      `${rows.join("\n")}\n`,
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("5000");
  });
});

describe("GET /api/imports — histórico e isolamento", () => {
  it("lista o histórico paginado apenas da empresa autenticada", async () => {
    const responseA = await request(app.getHttpServer())
      .get("/api/imports?page=1&pageSize=10")
      .set("Cookie", adminACookie);

    expect(responseA.status).toBe(200);
    expect(responseA.body.items.length).toBeGreaterThan(0);
    expect(responseA.body.total).toBe(
      await prisma.importBatch.count({ where: { companyId: companyAId } }),
    );
    for (const item of responseA.body.items) {
      expect(typeof item.createdByName).toBe("string");
      expect(item.filename).toBeTruthy();
    }

    const responseB = await request(app.getHttpServer())
      .get("/api/imports?page=1&pageSize=10")
      .set("Cookie", adminBCookie);

    expect(responseB.status).toBe(200);
    expect(responseB.body.total).toBe(
      await prisma.importBatch.count({ where: { companyId: companyBId } }),
    );
  });

  it("registros importados em A não aparecem em B", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/categories?search=Utens%C3%ADlios&pageSize=10")
      .set("Cookie", adminBCookie);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(0);
  });

  it("rejeita MEMBERS com 403 no histórico", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/imports")
      .set("Cookie", memberACookie);

    expect(response.status).toBe(403);
  });
});
