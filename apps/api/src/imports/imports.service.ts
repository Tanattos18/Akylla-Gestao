import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { PrismaService } from "../prisma/prisma.module";
import {
  createCategorySchema,
  createClientSchema,
  createProductSchema,
  createServiceSchema,
  createSupplierSchema,
  productUnitSchema,
  type CreateProductInput,
  type ImportErrorDetail,
  type ImportReport,
  type ImportType,
  type ListImportsQuery,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = IMPORT_MAX_FILE_BYTES;
const MAX_ROWS = 5000;
const MAX_ERROR_DETAILS = 100;

type CsvRow = Record<string, string>;

interface PlanContext {
  categoryByName: Map<string, string>;
  supplierByName: Map<string, string>;
  existingKeys: Set<string>;
}

type Classified = {
  payloads: Array<Record<string, unknown>>;
  skipped: number;
  errors: ImportErrorDetail[];
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function str(row: CsvRow, key: string): string | undefined {
  const value = row[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Aceita formato BR ("1.234,56", "12,5") e neutro ("1234.56"). */
function parseDecimalCell(value: string): string | null {
  const raw = value.trim();
  if (raw.length === 0) return null;
  if (raw.includes(",")) {
    if (raw.includes(".") && raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      return raw.replace(/\./g, "").replace(",", ".");
    }
    if (raw.includes(".") && raw.lastIndexOf(".") > raw.lastIndexOf(",")) {
      return raw.replace(/,/g, "");
    }
    return raw.replace(",", ".");
  }
  return raw;
}

function rowIssue(rowNumber: number, message: string): ImportErrorDetail {
  return { row: rowNumber, message: `Linha ${rowNumber}: ${message}` };
}

function zodIssueList(error: { issues: Array<{ message: string }> }): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

const REQUIRED_COLUMNS: Record<ImportType, string[]> = {
  CATEGORY: ["nome"],
  SUPPLIER: ["nome"],
  PRODUCT: ["nome"],
  CLIENT: ["nome"],
  SERVICE: ["nome", "preco"],
};

const TEMPLATE_HEADERS: Record<ImportType, string[]> = {
  CATEGORY: ["nome", "descricao"],
  SUPPLIER: ["nome", "documento", "email", "telefone", "observacoes"],
  PRODUCT: [
    "nome",
    "sku",
    "codigo_barras",
    "unidade",
    "preco_custo",
    "preco_venda",
    "estoque_minimo",
    "saldo_inicial",
    "categoria",
    "fornecedor",
  ],
  CLIENT: [
    "nome",
    "telefone",
    "celular",
    "email",
    "cpf",
    "endereco",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "cep",
    "observacoes",
  ],
  SERVICE: ["nome", "descricao", "duracao_minutos", "preco"],
};

const TEMPLATE_EXAMPLES: Record<ImportType, string[][]> = {
  CATEGORY: [
    ["Higiene", "Produtos de higiene e limpeza"],
    ["Alimentos", "Ração e suprimentos"],
  ],
  SUPPLIER: [
    [
      "Fornecedor Exemplo",
      "12345678000199",
      "contato@fornecedor.com",
      "(11) 99999-0000",
      "",
    ],
  ],
  PRODUCT: [
    [
      "Produto Exemplo",
      "SKU001",
      "7891234567890",
      "UNIDADE",
      "10,50",
      "19,90",
      "5",
      "20",
      "Alimentos",
      "Fornecedor Exemplo",
    ],
  ],
  CLIENT: [
    [
      "Maria Silva",
      "(11) 98888-7777",
      "",
      "maria@email.com",
      "123.456.789-01",
      "Rua das Flores",
      "123",
      "",
      "Centro",
      "São Paulo",
      "SP",
      "01001000",
      "",
    ],
  ],
  SERVICE: [
    ["Banho e Tosa", "Higiene completa", "60", "80,00"],
    ["Corte de unhas", "", "15", "25,00"],
  ],
};

const TEMPLATE_FILE_SLUGS: Record<ImportType, string> = {
  CATEGORY: "categorias",
  SUPPLIER: "fornecedores",
  PRODUCT: "produtos",
  CLIENT: "clientes",
  SERVICE: "servicos",
};

function escapeTemplateCell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  template(type: ImportType): { csv: string; filename: string } {
    const lines = [
      TEMPLATE_HEADERS[type],
      ...TEMPLATE_EXAMPLES[type],
    ].map((cells) => cells.map(escapeTemplateCell).join(";"));
    return {
      csv: `\uFEFF${lines.join("\r\n")}\r\n`,
      filename: `akylla_modelo_${TEMPLATE_FILE_SLUGS[type]}.csv`,
    };
  }

  async list(auth: AuthContext, query: ListImportsQuery) {
    const where = { companyId: auth.companyId };
    const [items, total] = await Promise.all([
      this.prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          type: true,
          status: true,
          filename: true,
          createdCount: true,
          skippedCount: true,
          errorCount: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      }),
      this.prisma.importBatch.count({ where }),
    ]);

    return {
      items: items.map((batch) => ({
        id: batch.id,
        type: batch.type,
        status: batch.status,
        filename: batch.filename,
        createdCount: batch.createdCount,
        skippedCount: batch.skippedCount,
        errorCount: batch.errorCount,
        createdByName: batch.createdBy.name,
        createdAt: batch.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async upload(
    auth: AuthContext,
    type: ImportType,
    dryRun: boolean,
    file: { originalname?: string; buffer?: Buffer } | undefined,
  ): Promise<ImportReport> {
    if (!file || !file.buffer) {
      throw new BadRequestException("Arquivo CSV é obrigatório");
    }
    if (!file.originalname?.toLowerCase().endsWith(".csv")) {
      throw new BadRequestException("O arquivo deve ter extensão .csv");
    }
    if (file.buffer.byteLength > MAX_FILE_BYTES) {
      throw new BadRequestException("Arquivo maior que 5 MB");
    }

    const filename = file.originalname.slice(0, 255);
    const rows = this.parseRows(file.buffer, type);

    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(
        `Planilha com ${rows.length} linhas de dados (máximo ${MAX_ROWS})`,
      );
    }

    const context = await this.buildContext(auth, type);
    const classified = this.classify(type, rows, context);

    await this.assertPlanLimit(auth, type, classified.payloads.length);

    const report = (batchId: string | null): ImportReport => ({
      dryRun,
      batchId,
      type,
      filename,
      totalRows: rows.length,
      created: classified.payloads.length,
      skipped: classified.skipped,
      errors: classified.errors.length,
      errorDetails: classified.errors.slice(0, MAX_ERROR_DETAILS),
    });

    if (dryRun) {
      return report(null);
    }

    try {
      const batch = await this.prisma.$transaction(async (tx) => {
        for (const payload of classified.payloads) {
          await this.insert(tx, auth, type, payload, filename);
        }
        return tx.importBatch.create({
          data: {
            companyId: auth.companyId,
            type,
            filename,
            createdCount: classified.payloads.length,
            skippedCount: classified.skipped,
            errorCount: classified.errors.length,
            errors:
              classified.errors.slice(0, MAX_ERROR_DETAILS).length > 0
                ? classified.errors.slice(0, MAX_ERROR_DETAILS)
                : Prisma.DbNull,
            createdByUserId: auth.userId,
          },
          select: { id: true },
        });
      });
      return report(batch.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Import ${type} falhou (${filename}): ${message}`);
      await this.prisma.importBatch
        .create({
          data: {
            companyId: auth.companyId,
            type,
            status: "FAILED",
            filename,
            errorCount: rows.length,
            errors: [{ row: 0, message: `Falha na importação: ${message}` }],
            createdByUserId: auth.userId,
          },
          select: { id: true },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  private parseRows(buffer: Buffer, type: ImportType): CsvRow[] {
    const content = buffer.toString("utf8");
    const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
    const semicolons = (firstLine.match(/;/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;
    const delimiter = semicolons > commas ? ";" : ",";

    let records: CsvRow[];
    try {
      records = parse(content, {
        bom: true,
        delimiter,
        columns: (header: string[]) => header.map(normalizeHeader),
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as CsvRow[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`CSV inválido: ${message}`);
    }

    if (records.length === 0) {
      throw new BadRequestException("Planilha sem linhas de dados");
    }

    const keys = Object.keys(records[0]);
    for (const required of REQUIRED_COLUMNS[type]) {
      if (!keys.includes(required)) {
        throw new BadRequestException(
          `Cabeçalho inválido: coluna obrigatória "${required}" não encontrada. Baixe o modelo em /api/imports/template?type=${type}`,
        );
      }
    }

    return records.filter((row) =>
      Object.values(row).some((value) => value.trim().length > 0),
    );
  }

  private async buildContext(
    auth: AuthContext,
    type: ImportType,
  ): Promise<PlanContext> {
    const context: PlanContext = {
      categoryByName: new Map(),
      supplierByName: new Map(),
      existingKeys: new Set(),
    };

    if (type === "PRODUCT") {
      const categories = await this.prisma.category.findMany({
        where: { companyId: auth.companyId },
        select: { id: true, name: true },
      });
      for (const category of categories) {
        context.categoryByName.set(normalizeName(category.name), category.id);
      }
      const suppliers = await this.prisma.supplier.findMany({
        where: { companyId: auth.companyId },
        select: { id: true, name: true },
      });
      for (const supplier of suppliers) {
        context.supplierByName.set(normalizeName(supplier.name), supplier.id);
      }
      const products = await this.prisma.product.findMany({
        where: { companyId: auth.companyId },
        select: { sku: true, barcode: true },
      });
      for (const product of products) {
        if (product.sku) context.existingKeys.add(`sku:${product.sku}`);
        if (product.barcode) context.existingKeys.add(`bc:${product.barcode}`);
      }
      return context;
    }

    if (type === "CATEGORY") {
      const rows = await this.prisma.category.findMany({
        where: { companyId: auth.companyId },
        select: { nameKey: true },
      });
      for (const row of rows) context.existingKeys.add(row.nameKey);
      return context;
    }

    if (type === "SERVICE") {
      const rows = await this.prisma.service.findMany({
        where: { companyId: auth.companyId },
        select: { nameKey: true },
      });
      for (const row of rows) context.existingKeys.add(row.nameKey);
      return context;
    }

    if (type === "CLIENT") {
      const rows = await this.prisma.client.findMany({
        where: { companyId: auth.companyId },
        select: { nameKey: true },
      });
      for (const row of rows) context.existingKeys.add(row.nameKey);
      return context;
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: { companyId: auth.companyId },
      select: { name: true },
    });
    for (const supplier of suppliers) {
      context.existingKeys.add(normalizeName(supplier.name));
    }
    return context;
  }

  private classify(
    type: ImportType,
    rows: CsvRow[],
    context: PlanContext,
  ): Classified {
    const classified: Classified = { payloads: [], skipped: 0, errors: [] };
    const seen = new Set<string>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      try {
        const outcome = this.classifyRow(type, row, rowNumber, context, seen);
        if (outcome === "skip") {
          classified.skipped += 1;
          return;
        }
        classified.payloads.push(outcome);
      } catch (error) {
        if (error instanceof RowValidationIssue) {
          classified.errors.push(error.detail);
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        classified.errors.push(rowIssue(rowNumber, message));
      }
    });

    return classified;
  }

  private classifyRow(
    type: ImportType,
    row: CsvRow,
    rowNumber: number,
    context: PlanContext,
    seen: Set<string>,
  ): Record<string, unknown> | "skip" {
    switch (type) {
      case "CATEGORY":
        return this.classifyCategory(row, rowNumber, context, seen);
      case "SUPPLIER":
        return this.classifySupplier(row, rowNumber, context, seen);
      case "PRODUCT":
        return this.classifyProduct(row, rowNumber, context, seen);
      case "CLIENT":
        return this.classifyClient(row, rowNumber, context, seen);
      case "SERVICE":
        return this.classifyService(row, rowNumber, context, seen);
    }
  }

  private classifyCategory(
    row: CsvRow,
    rowNumber: number,
    context: PlanContext,
    seen: Set<string>,
  ): Record<string, unknown> | "skip" {
    const parsed = createCategorySchema.safeParse({
      name: str(row, "nome"),
      description: str(row, "descricao"),
    });
    if (!parsed.success) {
      throw new RowValidationIssue(rowIssue(rowNumber, zodIssueList(parsed.error)));
    }

    const key = parsed.data.name.toLowerCase();
    if (context.existingKeys.has(key) || seen.has(key)) {
      return "skip";
    }
    seen.add(key);

    return {
      name: parsed.data.name,
      nameKey: key,
      description: parsed.data.description ?? null,
    };
  }

  private classifySupplier(
    row: CsvRow,
    rowNumber: number,
    context: PlanContext,
    seen: Set<string>,
  ): Record<string, unknown> | "skip" {
    const parsed = createSupplierSchema.safeParse({
      name: str(row, "nome"),
      document: str(row, "documento"),
      email: str(row, "email"),
      phone: str(row, "telefone"),
      notes: str(row, "observacoes"),
    });
    if (!parsed.success) {
      throw new RowValidationIssue(rowIssue(rowNumber, zodIssueList(parsed.error)));
    }

    const key = normalizeName(parsed.data.name);
    if (context.existingKeys.has(key) || seen.has(key)) {
      return "skip";
    }
    seen.add(key);

    return {
      name: parsed.data.name,
      document: parsed.data.document ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
    };
  }

  private classifyProduct(
    row: CsvRow,
    rowNumber: number,
    context: PlanContext,
    seen: Set<string>,
  ): Record<string, unknown> | "skip" {
    const costCell = str(row, "precocusto");
    const saleCell = str(row, "precovenda");
    const minCell = str(row, "estoqueminimo");
    const stockCell = str(row, "saldoinicial");

    const costPrice = costCell ? parseDecimalCell(costCell) : undefined;
    const salePrice = saleCell ? parseDecimalCell(saleCell) : undefined;
    const minimumStock = minCell ? parseDecimalCell(minCell) : undefined;
    const stockInitial = stockCell ? parseDecimalCell(stockCell) : undefined;

    if (costCell && costPrice === null) {
      throw new RowValidationIssue(rowIssue(rowNumber, "preco_custo inválido"));
    }
    if (saleCell && salePrice === null) {
      throw new RowValidationIssue(rowIssue(rowNumber, "preco_venda inválido"));
    }
    if (minCell && minimumStock === null) {
      throw new RowValidationIssue(rowIssue(rowNumber, "estoque_minimo inválido"));
    }
    if (stockCell && (stockInitial === null || Number(stockInitial) < 0)) {
      throw new RowValidationIssue(
        rowIssue(rowNumber, "saldo_inicial deve ser um número maior ou igual a zero"),
      );
    }

    const unitCell = str(row, "unidade");
    const unit = unitCell ? unitCell.toUpperCase() : undefined;
    if (unit && !productUnitSchema.safeParse(unit).success) {
      throw new RowValidationIssue(
        rowIssue(rowNumber, `unidade "${unitCell}" inválida`),
      );
    }

    const skuCell = str(row, "sku");
    const barcodeCell = str(row, "codigo_barras");
    const sku = skuCell ? skuCell.toUpperCase() : undefined;
    const barcode = barcodeCell ? barcodeCell.trim() : undefined;

    if (sku) {
      const key = `sku:${sku}`;
      if (context.existingKeys.has(key) || seen.has(key)) return "skip";
      seen.add(key);
    }
    if (barcode) {
      const key = `bc:${barcode}`;
      if (context.existingKeys.has(key) || seen.has(key)) return "skip";
      seen.add(key);
    }

    const categoryCell = str(row, "categoria");
    let categoryId: string | null = null;
    if (categoryCell) {
      const found = context.categoryByName.get(normalizeName(categoryCell));
      if (!found) {
        throw new RowValidationIssue(
          rowIssue(rowNumber, `categoria "${categoryCell}" não encontrada`),
        );
      }
      categoryId = found;
    }

    const supplierCell = str(row, "fornecedor");
    let supplierId: string | null = null;
    if (supplierCell) {
      const found = context.supplierByName.get(normalizeName(supplierCell));
      if (!found) {
        throw new RowValidationIssue(
          rowIssue(rowNumber, `fornecedor "${supplierCell}" não encontrado`),
        );
      }
      supplierId = found;
    }

    const parsed = createProductSchema.safeParse({
      name: str(row, "nome"),
      description: str(row, "descricao"),
      sku,
      barcode,
      unit,
      costPrice,
      salePrice,
      minimumStock,
      categoryId,
      supplierId,
    });
    if (!parsed.success) {
      throw new RowValidationIssue(rowIssue(rowNumber, zodIssueList(parsed.error)));
    }

    return { ...parsed.data, stockInitial: stockInitial ?? "0" };
  }

  private classifyClient(
    row: CsvRow,
    rowNumber: number,
    context: PlanContext,
    seen: Set<string>,
  ): Record<string, unknown> | "skip" {
    const parsed = createClientSchema.safeParse({
      name: str(row, "nome"),
      phone: str(row, "telefone"),
      mobile: str(row, "celular"),
      email: str(row, "email"),
      cpf: str(row, "cpf"),
      street: str(row, "endereco"),
      number: str(row, "numero"),
      complement: str(row, "complemento"),
      district: str(row, "bairro"),
      city: str(row, "cidade"),
      state: str(row, "estado"),
      zip: str(row, "cep"),
      notes: str(row, "observacoes"),
    });
    if (!parsed.success) {
      throw new RowValidationIssue(rowIssue(rowNumber, zodIssueList(parsed.error)));
    }

    const key = normalizeName(parsed.data.name);
    if (context.existingKeys.has(key) || seen.has(key)) {
      return "skip";
    }
    seen.add(key);

    return { ...parsed.data, nameKey: key };
  }

  private classifyService(
    row: CsvRow,
    rowNumber: number,
    context: PlanContext,
    seen: Set<string>,
  ): Record<string, unknown> | "skip" {
    const priceCell = str(row, "preco");
    const price = priceCell ? parseDecimalCell(priceCell) : undefined;
    if (priceCell && price === null) {
      throw new RowValidationIssue(rowIssue(rowNumber, "preco inválido"));
    }

    const durationCell = str(row, "duracaominutos");

    const parsed = createServiceSchema.safeParse({
      name: str(row, "nome"),
      description: str(row, "descricao"),
      durationMinutes: durationCell,
      price,
    });
    if (!parsed.success) {
      throw new RowValidationIssue(rowIssue(rowNumber, zodIssueList(parsed.error)));
    }

    const key = normalizeName(parsed.data.name);
    if (context.existingKeys.has(key) || seen.has(key)) {
      return "skip";
    }
    seen.add(key);

    return { ...parsed.data, nameKey: key };
  }

  private async assertPlanLimit(
    auth: AuthContext,
    type: ImportType,
    count: number,
  ): Promise<void> {
    if ((type !== "CLIENT" && type !== "PRODUCT") || count === 0) {
      return;
    }

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { companyId: auth.companyId },
      select: {
        status: true,
        plan: {
          select: { name: true, clientLimit: true, productLimit: true },
        },
      },
    });

    if (!subscription || subscription.status !== "ACTIVE") {
      return;
    }

    const limit =
      type === "CLIENT"
        ? subscription.plan.clientLimit
        : subscription.plan.productLimit;
    if (limit === null) {
      return;
    }

    const current =
      type === "CLIENT"
        ? await this.prisma.client.count({ where: { companyId: auth.companyId } })
        : await this.prisma.product.count({ where: { companyId: auth.companyId } });

    if (current + count > limit) {
      const label = type === "CLIENT" ? "clientes" : "produtos";
      throw new ForbiddenException(
        `Limite do plano ${subscription.plan.name} atingido: ${limit} ${label}. ` +
          `Contate a Akylla para fazer upgrade do plano.`,
      );
    }
  }

  private async insert(
    tx: Prisma.TransactionClient,
    auth: AuthContext,
    type: ImportType,
    payload: Record<string, unknown>,
    filename: string,
  ): Promise<void> {
    switch (type) {
      case "CATEGORY": {
        await tx.category.create({
          data: {
            companyId: auth.companyId,
            name: payload.name as string,
            nameKey: payload.nameKey as string,
            description: (payload.description as string | null) ?? null,
          },
        });
        return;
      }
      case "SUPPLIER": {
        await tx.supplier.create({
          data: {
            companyId: auth.companyId,
            name: payload.name as string,
            document: (payload.document as string | null) ?? null,
            email: (payload.email as string | null) ?? null,
            phone: (payload.phone as string | null) ?? null,
            notes: (payload.notes as string | null) ?? null,
          },
        });
        return;
      }
      case "CLIENT": {
        await tx.client.create({
          data: {
            companyId: auth.companyId,
            name: payload.name as string,
            nameKey: payload.nameKey as string,
            phone: (payload.phone as string | null) ?? null,
            mobile: (payload.mobile as string | null) ?? null,
            email: (payload.email as string | null) ?? null,
            cpf: (payload.cpf as string | null) ?? null,
            street: (payload.street as string | null) ?? null,
            number: (payload.number as string | null) ?? null,
            complement: (payload.complement as string | null) ?? null,
            district: (payload.district as string | null) ?? null,
            city: (payload.city as string | null) ?? null,
            state: (payload.state as string | null) ?? null,
            zip: (payload.zip as string | null) ?? null,
            notes: (payload.notes as string | null) ?? null,
          },
        });
        return;
      }
      case "SERVICE": {
        await tx.service.create({
          data: {
            companyId: auth.companyId,
            name: payload.name as string,
            nameKey: payload.nameKey as string,
            description: (payload.description as string | null) ?? null,
            durationMinutes: (payload.durationMinutes as number | null) ?? null,
            price: new Prisma.Decimal(payload.price as string),
          },
        });
        return;
      }
      case "PRODUCT": {
        const input = payload as unknown as CreateProductInput & {
          stockInitial: string;
        };
        const product = await tx.product.create({
          data: {
            companyId: auth.companyId,
            name: input.name,
            description: input.description ?? null,
            sku: input.sku ? input.sku.toUpperCase() : null,
            barcode: input.barcode ?? null,
            unit: input.unit,
            costPrice: new Prisma.Decimal(input.costPrice),
            salePrice: new Prisma.Decimal(input.salePrice),
            minimumStock: new Prisma.Decimal(input.minimumStock),
            categoryId: input.categoryId ?? null,
            supplierId: input.supplierId ?? null,
          },
        });

        const stockInitial = new Prisma.Decimal(input.stockInitial);
        if (stockInitial.gt(0)) {
          await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: stockInitial },
          });
          await tx.stockMovement.create({
            data: {
              companyId: auth.companyId,
              productId: product.id,
              type: "IN",
              quantity: stockInitial,
              notes: "Estoque inicial (importação)",
              reference: filename,
              createdByUserId: auth.userId,
            },
          });
        }
        return;
      }
    }
  }
}

class RowValidationIssue extends Error {
  constructor(public readonly detail: ImportErrorDetail) {
    super(detail.message);
  }
}
