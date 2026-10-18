import { Inject, Injectable } from "@nestjs/common";
import type { BusinessModule, GlobalSearchItem, GlobalSearchKind, GlobalSearchResult } from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { PrismaService } from "../prisma/prisma.module";

const LIMIT = 5;

const LABELS: Record<GlobalSearchKind, string> = {
  client: "Clientes",
  product: "Produtos",
  sale: "Vendas",
  serviceOrder: "Ordens de serviço",
  service: "Serviços",
  pet: "Pets",
};

function brl(value: { toString(): string }): string {
  return Number(value.toString()).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Busca global (Fase 7 · 7.3): até 5 resultados por tipo, só da empresa da
 * sessão, sem os tipos de módulos desligados.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async search(auth: AuthContext, rawQuery: string): Promise<GlobalSearchResult> {
    const query = rawQuery.trim();
    const companyId = auth.companyId;
    const contains = { contains: query, mode: "insensitive" as const };
    const digits = query.replace(/\D/g, "");
    const number = /^\d{1,9}$/.test(query) ? Number(query) : null;

    const disabledRows = await this.prisma.companyModule.findMany({
      where: { companyId, status: "DISABLED" },
      select: { module: true },
    });
    const disabled = new Set<BusinessModule>(disabledRows.map((row) => row.module));

    const [clients, products, sales, orders, services, pets] = await Promise.all([
      this.prisma.client.findMany({
        where: {
          companyId,
          OR: [
            { name: contains },
            { email: contains },
            ...(digits.length >= 4
              ? [{ phone: { contains: digits } }, { mobile: { contains: digits } }, { cpf: { contains: digits } }]
              : []),
          ],
        },
        orderBy: { name: "asc" },
        take: LIMIT,
        select: { id: true, name: true, mobile: true, phone: true, status: true },
      }),
      this.prisma.product.findMany({
        where: { companyId, OR: [{ name: contains }, { sku: contains }, { barcode: contains }] },
        orderBy: { name: "asc" },
        take: LIMIT,
        select: { id: true, name: true, sku: true, salePrice: true },
      }),
      this.prisma.sale.findMany({
        where: { companyId, receiptCode: { contains: query.toUpperCase() } },
        orderBy: { createdAt: "desc" },
        take: LIMIT,
        select: { id: true, receiptCode: true, total: true, status: true },
      }),
      disabled.has("SERVICE_ORDERS")
        ? Promise.resolve([])
        : this.prisma.serviceOrder.findMany({
            where: { companyId, OR: [{ title: contains }, ...(number !== null ? [{ number }] : [])] },
            orderBy: { createdAt: "desc" },
            take: LIMIT,
            select: { id: true, number: true, title: true, total: true },
          }),
      disabled.has("SERVICES")
        ? Promise.resolve([])
        : this.prisma.service.findMany({
            where: { companyId, name: contains },
            orderBy: { name: "asc" },
            take: LIMIT,
            select: { id: true, name: true, price: true },
          }),
      disabled.has("PETS")
        ? Promise.resolve([])
        : this.prisma.pet.findMany({
            where: { companyId, name: contains },
            orderBy: { name: "asc" },
            take: LIMIT,
            select: { id: true, name: true, client: { select: { id: true, name: true } } },
          }),
    ]);

    const items: Record<GlobalSearchKind, GlobalSearchItem[]> = {
      client: clients.map((c) => ({
        kind: "client",
        id: c.id,
        title: c.name,
        subtitle: [c.mobile ?? c.phone, c.status === "INACTIVE" ? "inativo" : null].filter(Boolean).join(" · ") || null,
        href: `/clientes/${c.id}`,
      })),
      product: products.map((p) => ({
        kind: "product",
        id: p.id,
        title: p.name,
        subtitle: [p.sku ? `SKU ${p.sku}` : null, brl(p.salePrice)].filter(Boolean).join(" · "),
        href: `/produtos/${p.id}`,
      })),
      sale: sales.map((s) => ({
        kind: "sale",
        id: s.id,
        title: s.receiptCode,
        subtitle: `${brl(s.total)}${s.status === "CANCELLED" ? " · cancelada" : ""}`,
        href: `/vendas/${s.id}`,
      })),
      serviceOrder: orders.map((o) => ({
        kind: "serviceOrder",
        id: o.id,
        title: `OS ${o.number} · ${o.title}`,
        subtitle: brl(o.total),
        href: `/os/${o.id}`,
      })),
      service: services.map((s) => ({
        kind: "service",
        id: s.id,
        title: s.name,
        subtitle: brl(s.price),
        href: "/servicos",
      })),
      pet: pets.map((p) => ({
        kind: "pet",
        id: p.id,
        title: p.name,
        subtitle: p.client.name,
        href: `/clientes/${p.client.id}`,
      })),
    };

    return {
      query,
      groups: (Object.keys(items) as GlobalSearchKind[])
        .filter((kind) => items[kind].length > 0)
        .map((kind) => ({ kind, label: LABELS[kind], items: items[kind] })),
    };
  }
}
