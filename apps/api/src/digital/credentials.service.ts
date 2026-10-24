import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CredentialAction, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import type {
  CreateCredentialInput,
  CredentialAccessLogDto,
  DeliveryCredentialDto,
  UpdateCredentialInput,
} from "@petflow/shared";
import type { AuthContext } from "../common/decorators/auth.decorator";
import { decryptCredential, encryptCredential } from "./credential-crypto";

const credentialSelect = {
  id: true,
  deliveryId: true,
  label: true,
  username: true,
  url: true,
  notes: true,
  secretEncrypted: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CredentialRecord = Prisma.DeliveryCredentialGetPayload<{ select: typeof credentialSelect }>;

/** Nunca devolve a senha (nem cifrada): só `hasSecret`. */
function toDto({ secretEncrypted, ...credential }: CredentialRecord): DeliveryCredentialDto {
  return {
    ...credential,
    hasSecret: secretEncrypted !== null,
    archivedAt: credential.archivedAt?.toISOString() ?? null,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

function textOrNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value ? value : null;
}

/**
 * Logins das entregas (2026-10-23). Senha cifrada (AES-256-GCM); mostrar a
 * senha é uma ação explícita, só de ADMIN, registrada em CredentialAccessLog
 * (imutável). Não há exclusão: o login é arquivado.
 */
@Injectable()
export class CredentialsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, deliveryId: string, includeArchived: boolean) {
    await this.assertDelivery(auth, deliveryId);
    const items = await this.prisma.deliveryCredential.findMany({
      where: { companyId: auth.companyId, deliveryId, ...(includeArchived ? {} : { archivedAt: null }) },
      select: credentialSelect,
      orderBy: { createdAt: "asc" },
    });
    return items.map(toDto);
  }

  async create(auth: AuthContext, deliveryId: string, input: CreateCredentialInput) {
    await this.assertDelivery(auth, deliveryId);
    const secretEncrypted = input.secret ? encryptCredential(input.secret) : null;
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.deliveryCredential.create({
        data: {
          companyId: auth.companyId,
          deliveryId,
          label: input.label,
          username: input.username || null,
          secretEncrypted,
          url: input.url || null,
          notes: input.notes || null,
          createdByUserId: auth.userId,
        },
        select: credentialSelect,
      });
      await this.log(tx, auth, created.id, "CREATE");
      return toDto(created);
    });
  }

  async update(auth: AuthContext, id: string, input: UpdateCredentialInput) {
    const existing = await this.find(auth, id);
    if (existing.archivedAt) throw new ConflictException("Login arquivado não pode ser alterado");
    const secretEncrypted =
      input.secret === undefined ? undefined : input.secret ? encryptCredential(input.secret) : null;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryCredential.update({
        where: { id: existing.id },
        data: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          username: textOrNull(input.username),
          url: textOrNull(input.url),
          notes: textOrNull(input.notes),
          secretEncrypted,
        },
        select: credentialSelect,
      });
      await this.log(tx, auth, existing.id, "UPDATE");
      return toDto(updated);
    });
  }

  async reveal(auth: AuthContext, id: string): Promise<{ secret: string | null }> {
    const existing = await this.find(auth, id);
    await this.log(this.prisma, auth, existing.id, "REVEAL");
    if (!existing.secretEncrypted) return { secret: null };
    try {
      return { secret: decryptCredential(existing.secretEncrypted) };
    } catch {
      // Chave trocada ou dado adulterado: GCM recusa em vez de devolver lixo
      throw new ConflictException("Não foi possível decifrar a senha (chave de cifra trocada?). Cadastre a senha de novo.");
    }
  }

  async archive(auth: AuthContext, id: string) {
    const existing = await this.find(auth, id);
    if (existing.archivedAt) throw new ConflictException("Login já arquivado");
    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.deliveryCredential.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
        select: credentialSelect,
      });
      await this.log(tx, auth, existing.id, "ARCHIVE");
      return toDto(archived);
    });
  }

  async accessLog(auth: AuthContext, id: string): Promise<CredentialAccessLogDto[]> {
    const existing = await this.find(auth, id);
    const logs = await this.prisma.credentialAccessLog.findMany({
      where: { companyId: auth.companyId, credentialId: existing.id },
      select: { id: true, action: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      userName: log.user.name,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  private async find(auth: AuthContext, id: string) {
    const credential = await this.prisma.deliveryCredential.findFirst({
      where: { id, companyId: auth.companyId },
      select: credentialSelect,
    });
    if (!credential) throw new NotFoundException("Login não encontrado");
    return credential;
  }

  private async assertDelivery(auth: AuthContext, deliveryId: string) {
    const delivery = await this.prisma.clientDelivery.findFirst({
      where: { id: deliveryId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!delivery) throw new NotFoundException("Entrega não encontrada");
  }

  private async log(
    db: Pick<Prisma.TransactionClient, "credentialAccessLog">,
    auth: AuthContext,
    credentialId: string,
    action: CredentialAction,
  ) {
    await db.credentialAccessLog.create({
      data: { companyId: auth.companyId, credentialId, userId: auth.userId, action },
    });
  }
}
