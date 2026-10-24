import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CreateDigitalProductInput,
  ListDigitalProductsQuery,
  UpdateDigitalProductInput,
  UpdateRecordStatusInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";

export function digitalNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const productSelect = {
  id: true,
  name: true,
  type: true,
  description: true,
  defaultPrice: true,
  billingPeriod: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { deliveries: true } },
} as const;

type ProductRecord = Prisma.DigitalProductGetPayload<{ select: typeof productSelect }>;

function formatProduct({ _count, ...product }: ProductRecord) {
  return { ...product, defaultPrice: product.defaultPrice.toFixed(2), deliveriesCount: _count.deliveries };
}

/** Catálogo de produtos digitais (site, sistema, loja virtual, domínio...). */
@Injectable()
export class DigitalProductsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListDigitalProductsQuery) {
    const andConditions: Prisma.DigitalProductWhereInput[] = [];
    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.type) andConditions.push({ type: query.type });
    if (query.status) andConditions.push({ status: query.status });

    const where: Prisma.DigitalProductWhereInput = {
      companyId: auth.companyId,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.digitalProduct.findMany({
        where,
        select: productSelect,
        orderBy: { [query.orderBy]: query.direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.digitalProduct.count({ where }),
    ]);

    return { items: items.map(formatProduct), total, page: query.page, pageSize: query.pageSize };
  }

  async get(auth: AuthContext, id: string) {
    const product = await this.prisma.digitalProduct.findFirst({
      where: { id, companyId: auth.companyId },
      select: productSelect,
    });
    if (!product) throw new NotFoundException("Produto digital não encontrado");
    return formatProduct(product);
  }

  async create(auth: AuthContext, input: CreateDigitalProductInput) {
    const nameKey = digitalNameKey(input.name);
    await this.assertUniqueName(auth, nameKey);
    const product = await this.prisma.digitalProduct.create({
      data: {
        companyId: auth.companyId,
        name: input.name,
        nameKey,
        type: input.type,
        description: input.description || null,
        defaultPrice: new Prisma.Decimal(input.defaultPrice),
        billingPeriod: input.billingPeriod,
      },
      select: productSelect,
    });
    return formatProduct(product);
  }

  async update(auth: AuthContext, id: string, input: UpdateDigitalProductInput) {
    const existing = await this.prisma.digitalProduct.findFirst({ where: { id, companyId: auth.companyId } });
    if (!existing) throw new NotFoundException("Produto digital não encontrado");

    const nameKey = input.name !== undefined ? digitalNameKey(input.name) : existing.nameKey;
    if (nameKey !== existing.nameKey) await this.assertUniqueName(auth, nameKey);

    const updated = await this.prisma.digitalProduct.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name, nameKey } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.defaultPrice !== undefined ? { defaultPrice: new Prisma.Decimal(input.defaultPrice) } : {}),
        ...(input.billingPeriod !== undefined ? { billingPeriod: input.billingPeriod } : {}),
      },
      select: productSelect,
    });
    return formatProduct(updated);
  }

  async updateStatus(auth: AuthContext, id: string, input: UpdateRecordStatusInput) {
    const existing = await this.prisma.digitalProduct.findFirst({ where: { id, companyId: auth.companyId } });
    if (!existing) throw new NotFoundException("Produto digital não encontrado");
    const updated = await this.prisma.digitalProduct.update({
      where: { id: existing.id },
      data: { status: input.status },
      select: productSelect,
    });
    return formatProduct(updated);
  }

  private async assertUniqueName(auth: AuthContext, nameKey: string) {
    const duplicate = await this.prisma.digitalProduct.findUnique({
      where: { companyId_nameKey: { companyId: auth.companyId, nameKey } },
    });
    if (duplicate) throw new ConflictException("Já existe um produto digital com este nome nesta empresa");
  }
}
